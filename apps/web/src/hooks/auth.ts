import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, SessionUser } from '@silt/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';
import { useLocal } from '@/stores';

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => (await api.get<{ user: SessionUser | null }>('/auth/me')).user,
    staleTime: 5 * 60_000,
  });
}

/** After login: move guest favourites to the account and refresh personal data. */
async function afterLogin(qc: ReturnType<typeof useQueryClient>, user: SessionUser) {
  qc.setQueryData(qk.me, user);
  const guest = useLocal.getState().guestFavorites;
  if (guest.length) {
    try {
      const ids = await api.post<string[]>('/favorites/sync', { productIds: guest });
      qc.setQueryData(qk.favoriteIds, ids);
      useLocal.getState().clearGuestFavorites();
    } catch {
      // keep guest favourites locally; they will sync on the next login
    }
  }
  await Promise.all([
    qc.invalidateQueries({ queryKey: qk.cart }),
    qc.invalidateQueries({ queryKey: qk.favoriteIds }),
    qc.invalidateQueries({ queryKey: qk.favorites }),
  ]);
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<{ user: SessionUser }>('/auth/login', input),
    onSuccess: ({ user }) => afterLogin(qc, user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<{ user: SessionUser }>('/auth/register', input),
    onSuccess: ({ user }) => afterLogin(qc, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSettled: () => {
      qc.setQueryData(qk.me, null);
      // Drop every personal query so nothing from the previous user stays on screen.
      qc.removeQueries({ predicate: (q) => !['me', 'settings', 'home', 'categories', 'collections'].includes(String(q.queryKey[0])) });
    },
  });
}
