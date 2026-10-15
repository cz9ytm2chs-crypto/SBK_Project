import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AddressDTO } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, useConfirm } from '@/components/ui/dialog';
import { Badge, EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import { useMe } from '@/hooks/auth';
import { api, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query';
import { Seo } from '@/lib/seo';
import { AddressForm, type AddressValues } from './components/address-form';
import { formatAddress } from './components/order-ui';

const MAX_ADDRESSES = 10;

type Editing = { mode: 'new' } | { mode: 'edit'; address: AddressDTO } | null;

export default function AccountAddressesPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: user } = useMe();
  const [editing, setEditing] = useState<Editing>(null);
  const q = useQuery({ queryKey: qk.addresses, queryFn: () => api.get<AddressDTO[]>('/users/me/addresses') });
  const list = q.data ?? [];
  const full = list.length >= MAX_ADDRESSES;

  const refresh = () => qc.invalidateQueries({ queryKey: qk.addresses });

  const save = useMutation({
    mutationFn: ({ id, values }: { id?: string; values: AddressValues }) =>
      id ? api.put<AddressDTO>(`/users/me/addresses/${id}`, values) : api.post<AddressDTO>('/users/me/addresses', values),
    onSuccess: (_, { id }) => {
      toast.success(id ? 'Адрес обновлён' : 'Адрес добавлен');
      setEditing(null);
      return refresh();
    },
  });

  const makeDefault = useMutation({
    mutationFn: ({ id, ...rest }: AddressDTO) => api.put<AddressDTO>(`/users/me/addresses/${id}`, { ...rest, isDefault: true }),
    onSuccess: () => {
      toast.success('Адрес по умолчанию изменён');
      return refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/users/me/addresses/${id}`),
    onSuccess: () => {
      toast('Адрес удалён');
      return refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onDelete = async (a: AddressDTO) => {
    const ok = await confirm({
      title: 'Удалить адрес?',
      description: `${a.label ? `«${a.label}» — ` : ''}${formatAddress(a)}`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok) remove.mutate(a.id);
  };

  const addButton = (
    <Button onClick={() => setEditing({ mode: 'new' })} disabled={full || q.isPending}>
      <Plus aria-hidden /> Добавить адрес
    </Button>
  );

  return (
    <div>
      <Seo title="Адреса" noindex />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-3xl">Адреса</h1>
          <p className="mt-2 text-sm text-stone">
            Сохранённые адреса подставляются при оформлении заказа.
            {full && ` Можно сохранить не больше ${MAX_ADDRESSES} адресов — удалите неактуальные.`}
          </p>
        </div>
        {list.length > 0 && addButton}
      </div>

      <div className="mt-10">
        {q.isPending ? (
          <div className="grid gap-4 md:grid-cols-2" aria-hidden>
            {[0, 1].map((i) => (
              <div key={i} className="border border-line p-6">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-4 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            className="border border-line"
            icon={<MapPin />}
            title="Нет сохранённых адресов"
            description="Добавьте адрес — и оформлять заказы станет быстрее."
            action={addButton}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {list.map((a) => (
              <li key={a.id} className="flex flex-col border border-line bg-paper p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{a.label || `${a.city}, ${a.street}`}</p>
                  {a.isDefault && <Badge tone="dark">По умолчанию</Badge>}
                </div>
                <address className="mt-3 flex-1 text-sm leading-relaxed text-graphite not-italic">
                  {a.firstName} {a.lastName}
                  <br />
                  {formatAddress(a)}
                  <br />
                  <span className="text-stone">{a.phone}</span>
                </address>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4">
                  <Button variant="link" size="sm" onClick={() => setEditing({ mode: 'edit', address: a })}>
                    Изменить
                  </Button>
                  {!a.isDefault && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => makeDefault.mutate(a)}
                      disabled={makeDefault.isPending && makeDefault.variables?.id === a.id}
                    >
                      Сделать основным
                    </Button>
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    className="text-danger"
                    onClick={() => onDelete(a)}
                    disabled={remove.isPending && remove.variables === a.id}
                    aria-label={`Удалить адрес ${a.label || formatAddress(a)}`}
                  >
                    Удалить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent title={editing.mode === 'edit' ? 'Изменить адрес' : 'Новый адрес'} className="max-w-xl">
            <AddressForm
              initial={editing.mode === 'edit' ? editing.address : undefined}
              prefill={{ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', phone: user?.phone ?? '' }}
              lockDefault={editing.mode === 'new' ? list.length === 0 : editing.address.isDefault}
              onSubmit={(values) => save.mutateAsync({ id: editing.mode === 'edit' ? editing.address.id : undefined, values })}
              onCancel={() => setEditing(null)}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
