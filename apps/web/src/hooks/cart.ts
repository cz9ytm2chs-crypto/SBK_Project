import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CartDTO } from '@silt/shared';
import { api } from '@/lib/api';
import { qk } from '@/lib/query';

export function useCart() {
  return useQuery({ queryKey: qk.cart, queryFn: () => api.get<CartDTO>('/cart'), staleTime: 10_000 });
}

/** Every cart mutation returns the fresh server cart (prices and stock re-checked). */
function useCartMutation<V>(fn: (v: V) => Promise<CartDTO>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart) => {
      qc.setQueryData(qk.cart, cart);
      qc.invalidateQueries({ queryKey: qk.cartRecs });
    },
  });
}

export const useAddToCart = () =>
  useCartMutation((v: { variantId: string; quantity: number }) => api.post<CartDTO>('/cart/items', v));

export const useUpdateCartItem = () =>
  useCartMutation((v: { itemId: string; quantity: number }) => api.patch<CartDTO>(`/cart/items/${v.itemId}`, { quantity: v.quantity }));

export const useRemoveCartItem = () => useCartMutation((itemId: string) => api.delete<CartDTO>(`/cart/items/${itemId}`));
