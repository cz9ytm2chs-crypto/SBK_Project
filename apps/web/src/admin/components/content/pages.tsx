import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { contentPageInputSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { Markdown } from '@/lib/markdown';
import { cn, formatDateShort } from '@/lib/utils';
import { ak, applyServerErrors } from '../../lib';
import type { ContentPage, ContentPageRow } from '../../types';
import { CharCount } from '../inputs';
import { QueryError, TableSkeleton } from '../page';
import { useUnsavedChangesGuard } from '../unsaved-guard';

type In = z.input<typeof contentPageInputSchema>;
type Out = z.output<typeof contentPageInputSchema>;

function PageEditor({ page, onDirtyChange }: { page: ContentPage; onDirtyChange: (dirty: boolean) => void }) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState(false);
  const { register, handleSubmit, formState, watch, reset, setError } = useForm<In, unknown, Out>({
    resolver: zodResolver(contentPageInputSchema),
    defaultValues: { title: page.title, body: page.body, seoTitle: page.seoTitle ?? '', seoDescription: page.seoDescription ?? '' },
  });
  useUnsavedChangesGuard(formState.isDirty);
  useEffect(() => {
    onDirtyChange(formState.isDirty);
  }, [formState.isDirty, onDirtyChange]);
  const m = useMutation({
    mutationFn: (v: Out) => api.put<ContentPage>(`/admin/content/pages/${page.slug}`, v),
    onSuccess: (saved) => {
      toast.success('Страница сохранена');
      reset({ title: saved.title, body: saved.body, seoTitle: saved.seoTitle ?? '', seoDescription: saved.seoDescription ?? '' });
      qc.setQueryData(ak.page(page.slug), saved);
      qc.invalidateQueries({ queryKey: ak.pages });
      qc.invalidateQueries({ queryKey: ['page', page.slug] });
    },
    onError: (e) => applyServerErrors(e, setError),
  });
  const e = formState.errors;
  const body = watch('body');

  return (
    <form onSubmit={handleSubmit((v) => m.mutate(v))} className="space-y-4" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href={`/${page.slug}`} target="_blank" rel="noreferrer" className="label inline-flex items-center gap-1 text-stone hover:text-ink">
          /{page.slug} <ExternalLink className="size-3" />
        </a>
        <Button type="submit" size="sm" loading={m.isPending} disabled={!formState.isDirty}>
          Сохранить
        </Button>
      </div>
      <Field label="Заголовок" required error={e.title?.message}>
        {(p) => <Input {...p} {...register('title')} />}
      </Field>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-graphite">Текст (Markdown: ## заголовок, - список, **жирный**)</span>
          <div role="tablist" aria-label="Режим" className="flex gap-3">
            {(['Редактор', 'Просмотр'] as const).map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={preview === (i === 1)}
                onClick={() => setPreview(i === 1)}
                className={cn('label', preview === (i === 1) ? 'text-ink' : 'text-stone hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {preview ? (
          <div className="prose-silt min-h-80 border border-line bg-milk p-5 text-sm">
            <Markdown source={body ?? ''} />
          </div>
        ) : (
          <Textarea aria-label="Текст страницы" aria-invalid={!!e.body} rows={18} className="font-mono text-xs leading-relaxed" {...register('body')} />
        )}
        {e.body && <p className="mt-1 text-xs text-danger">{e.body.message}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="SEO title" error={e.seoTitle?.message}>
          {(p) => (
            <div>
              <Input {...p} {...register('seoTitle')} />
              <div className="mt-1 text-right">
                <CharCount value={watch('seoTitle')} max={70} />
              </div>
            </div>
          )}
        </Field>
        <Field label="SEO description" error={e.seoDescription?.message}>
          {(p) => (
            <div>
              <Input {...p} {...register('seoDescription')} />
              <div className="mt-1 text-right">
                <CharCount value={watch('seoDescription')} max={160} />
              </div>
            </div>
          )}
        </Field>
      </div>
    </form>
  );
}

function PageLoader({ slug, onDirtyChange }: { slug: string; onDirtyChange: (dirty: boolean) => void }) {
  const q = useQuery({ queryKey: ak.page(slug), queryFn: () => api.get<ContentPage>(`/admin/content/pages/${slug}`), staleTime: 0 });
  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError || !q.data) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  return <PageEditor key={`${q.data.slug}-${q.data.updatedAt}`} page={q.data} onDirtyChange={onDirtyChange} />;
}

export function PagesTab() {
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ak.pages, queryFn: () => api.get<ContentPageRow[]>('/admin/content/pages') });
  const [slug, setSlug] = useState<string | null>(null);
  const dirty = useRef(false);
  const [onDirtyChange] = useState(() => (d: boolean) => {
    dirty.current = d;
  });
  const active = slug ?? q.data?.[0]?.slug ?? null;

  if (q.isLoading) return <TableSkeleton rows={6} cols={2} />;
  if (q.isError) return <QueryError error={q.error} onRetry={() => q.refetch()} />;

  const select = async (next: string) => {
    if (next === active) return;
    // Switching pages discards edits of the current one; the editor's own guard only covers route changes.
    if (dirty.current && !(await confirm({ title: 'Перейти без сохранения?', description: 'Изменения текущей страницы будут потеряны.', confirmLabel: 'Перейти', danger: true }))) return;
    dirty.current = false;
    setSlug(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Страницы" className="border border-line bg-paper">
        <ul>
          {q.data?.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => select(p.slug)}
                aria-current={active === p.slug ? 'page' : undefined}
                className={cn('block w-full border-b border-line px-4 py-3 text-left last:border-b-0', active === p.slug ? 'bg-ink text-milk' : 'hover:bg-mist')}
              >
                <span className="block text-sm">{p.title}</span>
                <span className={cn('text-2xs', active === p.slug ? 'text-milk/70' : 'text-stone')}>
                  /{p.slug} · {formatDateShort(p.updatedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border border-line bg-paper p-5">{active ? <PageLoader key={active} slug={active} onDirtyChange={onDirtyChange} /> : <p className="text-sm text-stone">Страниц нет.</p>}</div>
    </div>
  );
}
