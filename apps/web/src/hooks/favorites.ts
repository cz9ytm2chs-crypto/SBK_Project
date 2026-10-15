import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { useLocal } from '@/stores';
import { useMe } from './auth';

/** Favourite ids: from the account when logged in, from this browser otherwise. */
export function useFavoriteIds() {
  const { data: user } = useMe();
  const guest = useLocal((s) => s.guestFavorites);
  const server = useQuery({
    queryKey: qk.favoriteIds,
    queryFn: () => api.get<string[]>('/favorites/ids'),
    enabled: !!user,
  });
  return user ? (server.data ?? []) : guest;
}

export function useToggleFavorite() {
  const { data: user } = useMe();
  const qc = useQueryClient();
  const toggleGuest = useLocal((s) => s.toggleGuestFavorite);
  const ids = useFavoriteIds();
  const mutation = useMutation({
    mutationFn: ({ id, add }: { id: string; add: boolean }) => (add ? api.post(`/favorites/${id}`) : api.delete(`/favorites/${id}`)),
    onMutate: async ({ id, add }) => {
      await qc.cancelQueries({ queryKey: qk.favoriteIds });
      const prev = qc.getQueryData<string[]>(qk.favoriteIds) ?? [];
      qc.setQueryData(qk.favoriteIds, add ? [id, ...prev] : prev.filter((x) => x !== id));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(qk.favoriteIds, ctx?.prev);
      toast.error(errorMessage(err));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.favorites }),
  });

  return (id: string) => {
    const add = !ids.includes(id);
    if (user) mutation.mutate({ id, add });
    else toggleGuest(id);
    toast(add ? 'Добавлено в избранное' : 'Удалено из избранного');
  };
}
