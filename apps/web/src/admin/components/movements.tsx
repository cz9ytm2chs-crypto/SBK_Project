import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Table, Td, Th, Tr } from '@/components/ui/data';
import { api } from '@/lib/api';
import { cn, formatDateShort } from '@/lib/utils';
import { ak } from '../lib';
import type { InventoryMovement } from '../types';
import { QueryError, TableSkeleton } from './page';

export const MOVEMENT_LABELS: Record<string, string> = {
  RESTOCK: 'Поступление',
  ADJUSTMENT: 'Корректировка',
  RESERVE: 'Резерв',
  RELEASE: 'Снятие резерва',
  SALE: 'Продажа',
  RETURN: 'Возврат',
};

/** Stock ledger of a product (last 100 movements). */
export function MovementsJournal({ productId }: { productId: string }) {
  const q = useQuery({ queryKey: ak.movements(productId), queryFn: () => api.get<InventoryMovement[]>(`/admin/products/${productId}/movements`) });
  if (q.isLoading) return <TableSkeleton rows={4} cols={5} />;
  if (q.isError) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <p className="p-5 text-sm text-stone">Движений по остаткам ещё не было.</p>;
  return (
    <div className="max-h-[28rem] overflow-y-auto">
      <Table>
        <thead className="sticky top-0 bg-paper">
          <tr>
            <Th>Дата</Th>
            <Th>SKU</Th>
            <Th>Операция</Th>
            <Th className="text-right">Изменение</Th>
            <Th className="text-right">Остаток / резерв</Th>
            <Th>Основание</Th>
          </tr>
        </thead>
        <tbody>
          {q.data.map((m) => (
            <Tr key={m.id}>
              <Td className="text-xs whitespace-nowrap text-stone">{formatDateShort(m.createdAt)}</Td>
              <Td className="font-mono text-xs">{m.variant.sku}</Td>
              <Td>{MOVEMENT_LABELS[m.type] ?? m.type}</Td>
              <Td className={cn('text-right tabular-nums', m.quantity > 0 ? 'text-success' : m.quantity < 0 ? 'text-danger' : 'text-stone')}>
                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
              </Td>
              <Td className="text-right tabular-nums">
                {m.stockAfter} <span className="text-stone">/ {m.reservedAfter}</span>
              </Td>
              <Td className="text-xs">
                {m.reason}
                {m.order && m.orderId && (
                  <>
                    {' · '}
                    <Link to={`/admin/orders/${m.orderId}`} className="underline underline-offset-2">
                      {m.order.number}
                    </Link>
                  </>
                )}
                {m.actor && <span className="text-stone"> · {m.actor.email}</span>}
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
