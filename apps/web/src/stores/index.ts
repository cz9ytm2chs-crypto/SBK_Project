import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Transient UI state: drawers and overlays. */
interface UiState {
  cartOpen: boolean;
  searchOpen: boolean;
  menuOpen: boolean;
  setCartOpen: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  setMenuOpen: (v: boolean) => void;
}
export const useUi = create<UiState>((set) => ({
  cartOpen: false,
  searchOpen: false,
  menuOpen: false,
  setCartOpen: (cartOpen) => set({ cartOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setMenuOpen: (menuOpen) => set({ menuOpen }),
}));

// localStorage can be unavailable (private mode, blocked storage) — fall back to memory.
const safeStorage = createJSONStorage(() => {
  try {
    const k = '__silt_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
});

/** Per-browser conveniences. Orders, carts and accounts live on the server. */
interface LocalState {
  recentlyViewed: string[]; // product ids
  searchHistory: string[];
  guestFavorites: string[]; // product ids, synced to the account after login
  addViewed: (id: string) => void;
  addSearch: (q: string) => void;
  clearSearchHistory: () => void;
  toggleGuestFavorite: (id: string) => void;
  clearGuestFavorites: () => void;
}
export const useLocal = create<LocalState>()(
  persist(
    (set) => ({
      recentlyViewed: [],
      searchHistory: [],
      guestFavorites: [],
      addViewed: (id) => set((s) => ({ recentlyViewed: [id, ...s.recentlyViewed.filter((x) => x !== id)].slice(0, 12) })),
      addSearch: (q) =>
        set((s) => {
          const v = q.trim();
          if (v.length < 2) return s;
          return { searchHistory: [v, ...s.searchHistory.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 8) };
        }),
      clearSearchHistory: () => set({ searchHistory: [] }),
      toggleGuestFavorite: (id) =>
        set((s) => ({ guestFavorites: s.guestFavorites.includes(id) ? s.guestFavorites.filter((x) => x !== id) : [id, ...s.guestFavorites].slice(0, 100) })),
      clearGuestFavorites: () => set({ guestFavorites: [] }),
    }),
    { name: 'silt', storage: safeStorage, version: 1 },
  ),
);
