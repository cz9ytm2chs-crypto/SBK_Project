import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutList } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { homeSectionUpdateSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Input, Switch } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { ak } from '../../lib';
import type { HomeSectionRow } from '../../types';
import { QueryError, TableSkeleton } from '../page';

function SectionRow({ section }: { section: HomeSectionRow }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ title: section.title, subtitle: section.subtitle, isActive: section.isActive, sortOrder: section.sortOrder });
  const dirty = v.title !== section.title || v.subtitle !== section.subtitle || v.isActive !== section.isActive || v.sortOrder !== section.sortOrder;
  const m = useMutation({
    mutationFn: () => {
      const parsed = homeSectionUpdateSchema.safeParse(v);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Проверьте поля');
      return api.put<HomeSectionRow>(`/admin/content/home-sections/${section.id}`, parsed.data);
    },
    onSuccess: () => {
      toast.success(`Блок «${v.title || section.key}» сохранён`);
      qc.invalidateQueries({ queryKey: ak.homeSections });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const id = `hs-${section.id}`;
  return (
    <li className="grid items-end gap-3 border-b border-line px-5 py-4 last:border-b-0 md:grid-cols-[8rem_1fr_1.4fr_5rem_auto_auto]">
      <div>
        <p className="label text-stone">Ключ</p>
        <p className="mt-2 font-mono text-xs">{section.key}</p>
      </div>
      <div>
        <label htmlFor={`${id}-title`} className="mb-1.5 block text-xs text-graphite">
          Заголовок
        </label>
        <Input id={`${id}-title`} className="h-10" value={v.title} maxLength={120} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </div>
      <div>
        <label htmlFor={`${id}-sub`} className="mb-1.5 block text-xs text-graphite">
          Подзаголовок
        </label>
        <Input id={`${id}-sub`} className="h-10" value={v.subtitle} maxLength={300} onChange={(e) => setV({ ...v, subtitle: e.target.value })} />
      </div>
      <div>
        <label htmlFor={`${id}-order`} className="mb-1.5 block text-xs text-graphite">
          Порядок
        </label>
        <Input
          id={`${id}-order`}
          type="number"
          min={0}
          className="h-10"
          value={v.sortOrder}
          onChange={(e) => setV({ ...v, sortOrder: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
        />
      </div>
      <div className="flex h-10 items-center gap-2">
        <Switch id={`${id}-active`} checked={v.isActive} onCheckedChange={(isActive) => setV({ ...v, isActive })} />
        <label htmlFor={`${id}-active`} className="text-xs text-graphite">
          Показывать
        </label>
      </div>
      <Button size="sm" variant={dirty ? 'primary' : 'ghost'} disabled={!dirty} loading={m.isPending} onClick={() => m.mutate()}>
        Сохранить
      </Button>
    </li>
  );
}

export function HomeSectionsTab() {
  const q = useQuery({ queryKey: ak.homeSections, queryFn: () => api.get<HomeSectionRow[]>('/admin/content/home-sections') });
  if (q.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (q.isError) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyState icon={<LayoutList />} title="Блоков главной нет" />;
  return (
    <div className="border border-line bg-paper">
      <p className="border-b border-line px-5 py-3 text-xs text-stone">Блоки выводятся на главной по возрастанию порядка. Выключенные блоки скрыты.</p>
      <ul>
        {q.data.map((s) => (
          <SectionRow key={`${s.id}-${s.title}-${s.subtitle}-${s.isActive}-${s.sortOrder}`} section={s} />
        ))}
      </ul>
    </div>
  );
}
