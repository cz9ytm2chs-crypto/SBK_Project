import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { Paginated } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Pagination, Table, Td, Th, Tr } from '@/components/ui/data';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/disclosure';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { cn, formatDate, money, plural } from '@/lib/utils';
import { RoleBadge } from '../components/badges';
import { FilterSelect, SearchInput } from '../components/inputs';
import { ListFooter, PageHeader, QueryError, TableSkeleton } from '../components/page';
import { RolesTable } from '../components/roles-table';
import { StaffDialog } from '../components/staff-dialog';
import { ak, fullName, useCan, useUrlState } from '../lib';
import type { CustomerRow } from '../types';

const PAGE_SIZE = 20;
const TABS = [
  { value: 'customers', label: 'Покупатели' },
  { value: 'staff', label: 'Сотрудники' },
  { value: 'blocked', label: 'Заблокированные' },
  { value: 'roles', label: 'Роли и права' },
];

export default function CustomersPage() {
  const can = useCan();
  const { get, set, page } = useUrlState();
  const [staffOpen, setStaffOpen] = useState(false);
  const type = TABS.some((t) => t.value === get('type')) ? get('type') : 'customers';
  const params = { q: get('q'), type, sort: get('sort', 'new'), page, pageSize: PAGE_SIZE };
  const list = useQuery({
    queryKey: ak.customers(params),
    queryFn: () => api.get<Paginated<CustomerRow>>('/admin/customers', params),
    placeholderData: keepPreviousData,
    enabled: type !== 'roles',
  });
  const items = list.data?.items ?? [];

  return (
    <>
      <Seo title="Покупатели" noindex />
      <PageHeader
        title="Покупатели и сотрудники"
        actions={
          can('staff.manage') && (
            <Button onClick={() => setStaffOpen(true)}>
              <UserPlus /> Создать сотрудника
            </Button>
          )
        }
      />

      <Tabs value={type} onValueChange={(v) => set({ type: v === 'customers' ? null : v, q: null, sort: null })}>
        <TabsList className="mb-5">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {type === 'roles' ? (
        <div className="border border-line bg-paper">
          <RolesTable />
        </div>
      ) : (
        <div className="border border-line bg-paper">
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <SearchInput value={params.q} onChange={(q) => set({ q })} placeholder="Email, имя или телефон" />
            <FilterSelect
              label="Сортировка"
              allLabel={null}
              value={params.sort}
              onChange={(sort) => set({ sort: sort === 'new' ? null : sort })}
              options={[
                { value: 'new', label: 'Сначала новые' },
                { value: 'spent', label: 'По сумме покупок' },
              ]}
            />
          </div>

          {list.isLoading ? (
            <TableSkeleton cols={5} />
          ) : list.isError ? (
            <QueryError error={list.error} onRetry={() => list.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState icon={<Users />} title="Никого не найдено" description={params.q ? 'Попробуйте другой запрос.' : undefined} />
          ) : (
            <>
              <div className={cn('transition-opacity', list.isFetching && 'opacity-60')}>
                <Table>
                  <thead>
                    <tr>
                      <Th>Имя</Th>
                      <Th>Контакты</Th>
                      <Th>Роль</Th>
                      <Th>Регистрация</Th>
                      <Th className="text-right">Заказы</Th>
                      <Th className="text-right">Сумма покупок</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((u) => (
                      <Tr key={u.id}>
                        <Td>
                          <Link to={`/admin/customers/${u.id}`} className="font-medium underline-offset-4 hover:underline">
                            {fullName(u)}
                          </Link>
                          <div className="mt-0.5 flex gap-1">
                            {u.isBlocked && <Badge tone="danger">Заблокирован</Badge>}
                            {!u.emailVerifiedAt && <Badge tone="outline">Email не подтверждён</Badge>}
                          </div>
                        </Td>
                        <Td>
                          <p>{u.email}</p>
                          {u.phone && <p className="text-xs text-stone">{u.phone}</p>}
                        </Td>
                        <Td>
                          <RoleBadge role={u.role} />
                        </Td>
                        <Td className="text-xs text-stone">
                          {formatDate(u.createdAt)}
                          {u.lastLoginAt && <p>вход: {formatDate(u.lastLoginAt)}</p>}
                        </Td>
                        <Td className="text-right tabular-nums">{u.ordersCount}</Td>
                        <Td className="text-right tabular-nums">{money(u.totalSpent)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <ListFooter total={list.data!.total} page={page} pageSize={PAGE_SIZE}>
                <div className="flex items-center gap-4">
                  <Pagination page={page} pageCount={list.data!.pageCount} onChange={(p) => set({ page: p === 1 ? null : p })} />
                </div>
              </ListFooter>
            </>
          )}
        </div>
      )}

      {list.data && type !== 'roles' && (
        <p className="sr-only" aria-live="polite">
          Найдено {list.data.total} {plural(list.data.total, ['запись', 'записи', 'записей'])}
        </p>
      )}

      {can('staff.manage') && <StaffDialog open={staffOpen} onOpenChange={setStaffOpen} />}
    </>
  );
}
