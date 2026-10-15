import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { ROLE_KEYS, ROLE_LABELS, type RoleKey } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/data';
import { useConfirm } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/form';
import { Badge, Skeleton } from '@/components/ui/misc';
import { useMe } from '@/hooks/auth';
import { api, errorMessage } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { formatDate, formatDateShort, money } from '@/lib/utils';
import { OrderStatusBadge, PaymentStatusBadge, RoleBadge } from '../components/badges';
import { InfoList, PageHeader, Panel, QueryError } from '../components/page';
import { StatCard } from '../components/stat-card';
import { ak, fullName, useCan } from '../lib';
import type { CustomerDetail } from '../types';

export default function CustomerPage() {
  const { id = '' } = useParams();
  const can = useCan();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ak.customer(id), queryFn: () => api.get<CustomerDetail>(`/admin/customers/${id}`) });
  const [role, setRole] = useState<string | null>(null);

  const access = useMutation({
    mutationFn: (body: { isBlocked?: boolean; role?: RoleKey | null }) => api.patch(`/admin/customers/${id}/access`, body),
    onSuccess: async (_r, body) => {
      toast.success(body.isBlocked === true ? 'Пользователь заблокирован' : body.isBlocked === false ? 'Пользователь разблокирован' : 'Роль изменена');
      setRole(null);
      await qc.invalidateQueries({ queryKey: ak.customer(id) });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <>
        <PageHeader title="Покупатель" back={{ to: '/admin/customers', label: 'Покупатели' }} />
        <Panel>
          <QueryError error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      </>
    );

  const u = q.data;
  const isSelf = me?.id === u.id;
  // Staff accounts can only be changed by a Super Admin (staff.manage).
  const canBlock = can('customers.manage') && !isSelf && (!u.role || can('staff.manage'));
  const canRole = can('staff.manage') && !isSelf;
  const selectedRole = role ?? u.role ?? '';

  const toggleBlock = async () => {
    const block = !u.isBlocked;
    const ok = await confirm({
      title: block ? `Заблокировать ${u.email}?` : `Разблокировать ${u.email}?`,
      description: block ? 'Пользователь не сможет войти, все его сессии будут завершены.' : 'Пользователь снова сможет входить в аккаунт.',
      confirmLabel: block ? 'Заблокировать' : 'Разблокировать',
      danger: block,
    });
    if (ok) access.mutate({ isBlocked: block });
  };

  const saveRole = async () => {
    const next = (selectedRole || null) as RoleKey | null;
    const ok = await confirm({
      title: 'Изменить роль?',
      description: next
        ? `${u.email} получит роль «${ROLE_LABELS[next]}» и доступ к панели управления. Текущие сессии будут завершены.`
        : `${u.email} потеряет доступ к панели управления. Текущие сессии будут завершены.`,
      confirmLabel: 'Изменить',
      danger: !next || next === 'SUPER_ADMIN',
    });
    if (ok) access.mutate({ role: next });
  };

  return (
    <>
      <Seo title={fullName(u)} noindex />
      <PageHeader
        back={{ to: '/admin/customers', label: 'Покупатели' }}
        title={fullName(u)}
        description={u.email}
        eyebrow={
          <span className="flex gap-1.5">
            <RoleBadge role={u.role} />
            {u.isBlocked && <Badge tone="danger">Заблокирован</Badge>}
          </span>
        }
        actions={
          canBlock && (
            <Button variant={u.isBlocked ? 'outline' : 'danger'} size="sm" onClick={toggleBlock} loading={access.isPending}>
              {u.isBlocked ? (
                <>
                  <ShieldCheck /> Разблокировать
                </>
              ) : (
                <>
                  <Ban /> Заблокировать
                </>
              )}
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Сумма покупок" value={money(u.totalSpent)} hint="оплаченные заказы" />
        <StatCard label="Оплаченных заказов" value={String(u.paidOrders)} />
        <StatCard label="Средний чек" value={money(u.paidOrders ? Math.round(u.totalSpent / u.paidOrders) : 0)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Panel title={`Заказы (${u.orders.length})`} bodyClassName="p-0">
          {u.orders.length === 0 ? (
            <p className="p-5 text-sm text-stone">Заказов нет.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Заказ</Th>
                  <Th>Статус</Th>
                  <Th>Оплата</Th>
                  <Th className="text-right">Сумма</Th>
                </tr>
              </thead>
              <tbody>
                {u.orders.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      {can('orders.read') ? (
                        <Link to={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                          {o.number}
                        </Link>
                      ) : (
                        <span className="font-medium">{o.number}</span>
                      )}
                      <p className="text-xs text-stone">{formatDateShort(o.createdAt)}</p>
                    </Td>
                    <Td>
                      <OrderStatusBadge status={o.status} />
                    </Td>
                    <Td>
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </Td>
                    <Td className="text-right tabular-nums">{money(o.total)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <aside className="space-y-6">
          <Panel title="Профиль">
            <InfoList
              items={[
                ['Email', u.email],
                ['Email подтверждён', u.emailVerifiedAt ? formatDate(u.emailVerifiedAt) : 'нет'],
                ['Телефон', u.phone || '—'],
                ['Регистрация', formatDate(u.createdAt)],
                ['Последний вход', u.lastLoginAt ? formatDateShort(u.lastLoginAt) : '—'],
                ['Рассылка', u.marketingOptIn ? 'подписан' : 'нет'],
              ]}
            />
          </Panel>

          {canRole && (
            <Panel title="Доступ к админке">
              <label htmlFor="role-select" className="mb-1.5 block text-xs font-medium text-graphite">
                Роль
              </label>
              <NativeSelect id="role-select" value={selectedRole} onChange={(e) => setRole(e.target.value)}>
                <option value="">Покупатель (без доступа)</option>
                {ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
              <Button className="mt-3" size="sm" block onClick={saveRole} disabled={selectedRole === (u.role ?? '')} loading={access.isPending}>
                Сохранить роль
              </Button>
            </Panel>
          )}

          <Panel title={`Адреса (${u.addresses.length})`}>
            {u.addresses.length === 0 ? (
              <p className="text-sm text-stone">Адресов нет.</p>
            ) : (
              <ul className="space-y-4">
                {u.addresses.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="font-medium">
                      {a.label || 'Адрес'} {a.isDefault && <Badge tone="outline">основной</Badge>}
                    </p>
                    <p className="text-graphite">
                      {[a.postalCode, a.region, a.city, a.street, a.house && `д. ${a.house}`, a.apartment && `кв. ${a.apartment}`].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-xs text-stone">
                      {a.firstName} {a.lastName} · {a.phone}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
