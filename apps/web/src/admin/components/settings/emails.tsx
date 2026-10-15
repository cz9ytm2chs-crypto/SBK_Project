import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Paginated } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Pagination, Table, Td, Th, Tr } from '@/components/ui/data';
import { EmptyState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { cn, formatDateShort } from '@/lib/utils';
import { ak, useUrlState } from '../../lib';
import type { EmailJobRow } from '../../types';
import { EMAIL_STATUS_LABELS, EmailStatusBadge } from '../badges';
import { FilterSelect } from '../inputs';
import { ListFooter, QueryError, TableSkeleton } from '../page';

export function EmailsTab({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const { get, set, page } = useUrlState();
  const params = { status: get('emailStatus'), page };
  const q = useQuery({
    queryKey: ak.emails(params),
    queryFn: () => api.get<Paginated<EmailJobRow>>('/admin/settings/emails', { status: params.status, page }),
    placeholderData: keepPreviousData,
  });
  const retry = useMutation({
    mutationFn: (id: string) => api.post(`/admin/settings/emails/${id}/retry`),
    onSuccess: () => {
      toast.success('Письмо поставлено в очередь');
      qc.invalidateQueries({ queryKey: ['admin', 'emails'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const items = q.data?.items ?? [];

  return (
    <div className="border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <FilterSelect
          label="Статус"
          value={params.status}
          onChange={(emailStatus) => set({ emailStatus })}
          options={Object.entries(EMAIL_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Button variant="ghost" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RotateCw className={cn(q.isFetching && 'animate-spin')} /> Обновить
        </Button>
      </div>
      {q.isLoading ? (
        <TableSkeleton cols={5} />
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Mail />} title="Писем нет" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Письмо</Th>
                <Th>Получатель</Th>
                <Th>Статус</Th>
                <Th className="text-right">Попытки</Th>
                <Th>Создано</Th>
                <Th>
                  <span className="sr-only">Действия</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <Tr key={m.id}>
                  <Td>
                    <p>{m.subject}</p>
                    <p className="font-mono text-2xs text-stone">{m.template}</p>
                    {m.lastError && <p className="mt-0.5 max-w-md text-2xs break-words text-danger">{m.lastError}</p>}
                  </Td>
                  <Td className="text-xs">{m.to}</Td>
                  <Td>
                    <EmailStatusBadge status={m.status} />
                    {m.sentAt && <p className="mt-0.5 text-2xs text-stone">{formatDateShort(m.sentAt)}</p>}
                  </Td>
                  <Td className="text-right tabular-nums">{m.attempts}</Td>
                  <Td className="text-xs whitespace-nowrap text-stone">{formatDateShort(m.createdAt)}</Td>
                  <Td className="text-right">
                    {canWrite && m.status === 'FAILED' && (
                      <Button size="sm" variant="outline" onClick={() => retry.mutate(m.id)} disabled={retry.isPending}>
                        Повторить
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <ListFooter total={q.data!.total} page={page} pageSize={q.data!.pageSize}>
            <Pagination page={page} pageCount={q.data!.pageCount} onChange={(p) => set({ page: p === 1 ? null : p })} />
          </ListFooter>
        </>
      )}
    </div>
  );
}
