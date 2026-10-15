import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { Link } from 'react-router';
import type { Paginated } from '@silt/shared';
import { Pagination, Table, Td, Th, Tr } from '@/components/ui/data';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { cn, formatDateShort } from '@/lib/utils';
import { FilterSelect, SearchInput } from '../components/inputs';
import { JsonView } from '../components/json-view';
import { ListFooter, PageHeader, QueryError, TableSkeleton } from '../components/page';
import { ak, useUrlState } from '../lib';
import type { AuditEntry } from '../types';

const PREFIXES = [
  { value: 'product', label: 'Товары' },
  { value: 'inventory', label: 'Остатки' },
  { value: 'order', label: 'Заказы' },
  { value: 'user', label: 'Доступ пользователей' },
  { value: 'staff', label: 'Сотрудники' },
  { value: 'category', label: 'Категории' },
  { value: 'brand', label: 'Бренды' },
  { value: 'collection', label: 'Коллекции' },
  { value: 'banner', label: 'Баннеры' },
  { value: 'page', label: 'Страницы' },
  { value: 'faq', label: 'FAQ' },
  { value: 'review', label: 'Отзывы' },
  { value: 'settings', label: 'Настройки' },
  { value: 'delivery', label: 'Доставка' },
  { value: 'email', label: 'Письма' },
];

/** Where an audit entry's entity can be opened in the admin. */
function entityLink(e: AuditEntry) {
  if (!e.entityId) return null;
  if (e.entityType === 'Product') return `/admin/products/${e.entityId}/edit`;
  if (e.entityType === 'Order') return `/admin/orders/${e.entityId}`;
  if (e.entityType === 'User') return `/admin/customers/${e.entityId}`;
  return null;
}

export default function AuditPage() {
  const { get, set, page } = useUrlState();
  // A preset prefix from the select, or free text typed in the search box.
  const action = get('action');
  const params = { action, page };
  const q = useQuery({
    queryKey: ak.audit(params),
    queryFn: () => api.get<Paginated<AuditEntry>>('/admin/customers/audit/log', params),
    placeholderData: keepPreviousData,
  });
  const items = q.data?.items ?? [];
  const isPreset = PREFIXES.some((p) => p.value === action);

  return (
    <>
      <Seo title="Журнал действий" noindex />
      <PageHeader title="Журнал действий" description="Все изменения, сделанные сотрудниками в панели управления" />
      <div className="border border-line bg-paper">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <FilterSelect label="Раздел" value={isPreset ? action : ''} onChange={(v) => set({ action: v })} options={PREFIXES} />
          <SearchInput
            value={isPreset ? '' : action}
            onChange={(v) => set({ action: v })}
            placeholder="Действие начинается с… (например, order.status)"
            label="Фильтр по действию"
            className="max-w-sm"
          />
        </div>
        {q.isLoading ? (
          <TableSkeleton cols={5} />
        ) : q.isError ? (
          <QueryError error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="Записей нет" description={action ? 'Попробуйте другой фильтр.' : 'Действия сотрудников будут появляться здесь.'} />
        ) : (
          <>
            <div className={cn('transition-opacity', q.isFetching && 'opacity-60')}>
              <Table>
                <thead>
                  <tr>
                    <Th>Дата</Th>
                    <Th>Сотрудник</Th>
                    <Th>Действие</Th>
                    <Th>Объект</Th>
                    <Th>Данные</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => {
                    const link = entityLink(e);
                    return (
                      <Tr key={e.id} className="align-top">
                        <Td className="text-xs whitespace-nowrap text-stone">{formatDateShort(e.createdAt)}</Td>
                        <Td className="text-xs">
                          {e.actor?.email ?? <span className="text-stone">система</span>}
                          {e.ip && <p className="font-mono text-2xs text-stone">{e.ip}</p>}
                        </Td>
                        <Td>
                          <button type="button" onClick={() => set({ action: e.action })} className="text-left" title="Показать только это действие">
                            <Badge tone="outline" className="font-mono normal-case tracking-normal">
                              {e.action}
                            </Badge>
                          </button>
                        </Td>
                        <Td className="text-xs">
                          {e.entityType}
                          {e.entityId &&
                            (link ? (
                              <Link to={link} className="block font-mono text-2xs text-stone underline underline-offset-2 hover:text-ink">
                                {e.entityId}
                              </Link>
                            ) : (
                              <p className="font-mono text-2xs text-stone">{e.entityId}</p>
                            ))}
                        </Td>
                        <Td className="max-w-md">
                          <JsonView data={e.data} />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            <ListFooter total={q.data!.total} page={page} pageSize={q.data!.pageSize}>
              <Pagination page={page} pageCount={q.data!.pageCount} onChange={(p) => set({ page: p === 1 ? null : p })} />
            </ListFooter>
          </>
        )}
      </div>
    </>
  );
}
