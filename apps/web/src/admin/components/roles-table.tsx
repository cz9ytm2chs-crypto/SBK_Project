import { useQuery } from '@tanstack/react-query';
import { Check, Minus } from 'lucide-react';
import { ALL_PERMISSIONS, PERMISSIONS, ROLE_LABELS } from '@silt/shared';
import { Table, Td, Th, Tr } from '@/components/ui/data';
import { api } from '@/lib/api';
import { ak } from '../lib';
import type { RoleInfo } from '../types';
import { QueryError, TableSkeleton } from './page';

/** Permission matrix: which role can do what. */
export function RolesTable() {
  const q = useQuery({ queryKey: ak.roles, queryFn: () => api.get<RoleInfo[]>('/admin/customers/roles/list'), staleTime: 10 * 60_000 });
  if (q.isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (q.isError) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  const roles = q.data ?? [];
  return (
    <Table>
      <thead>
        <tr>
          <Th>Право</Th>
          {roles.map((r) => (
            <Th key={r.key} className="text-center" title={r.description}>
              {ROLE_LABELS[r.key] ?? r.name}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ALL_PERMISSIONS.map((p) => (
          <Tr key={p}>
            <Td>
              <p className="text-sm">{PERMISSIONS[p]}</p>
              <p className="font-mono text-2xs text-stone">{p}</p>
            </Td>
            {roles.map((r) => (
              <Td key={r.key} className="text-center">
                {r.permissions.includes(p) ? (
                  <Check className="mx-auto size-4 text-ink" aria-label="есть" />
                ) : (
                  <Minus className="mx-auto size-4 text-line" aria-label="нет" />
                )}
              </Td>
            ))}
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
