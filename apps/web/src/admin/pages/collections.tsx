import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { collectionInputSchema, type CollectionInput } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Table, Td, Th, Tr } from '@/components/ui/data';
import { Dialog, SheetContent, useConfirm } from '@/components/ui/dialog';
import { CheckboxField, Field, Input, Textarea } from '@/components/ui/form';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { imageUrl } from '@/lib/utils';
import { ActiveBadge } from '../components/badges';
import { CharCount } from '../components/inputs';
import { PageHeader, Panel, QueryError, TableSkeleton } from '../components/page';
import { ProductPicker } from '../components/product-picker';
import { ak, applyServerErrors, slugify, useCan } from '../lib';
import type { AdminCollection } from '../types';

type Out = z.output<typeof collectionInputSchema>;

const toForm = (c: AdminCollection | null): CollectionInput => ({
  name: c?.name ?? '',
  slug: c?.slug ?? '',
  description: c?.description ?? '',
  season: c?.season ?? '',
  imageUrl: c?.imageUrl ?? '',
  isActive: c?.isActive ?? true,
  isFeatured: c?.isFeatured ?? false,
  sortOrder: c?.sortOrder ?? 0,
  seoTitle: c?.seoTitle ?? '',
  seoDescription: c?.seoDescription ?? '',
  productIds: c?.productIds ?? [],
});

function CollectionSheet({ open, onOpenChange, collection, canWrite }: { open: boolean; onOpenChange: (o: boolean) => void; collection: AdminCollection | null; canWrite: boolean }) {
  const qc = useQueryClient();
  const { register, control, handleSubmit, formState, reset, watch, setValue, setError } = useForm<CollectionInput, unknown, Out>({
    resolver: zodResolver(collectionInputSchema),
    defaultValues: toForm(collection),
  });
  const [slugTouched, setSlugTouched] = useState(!!collection);
  useEffect(() => {
    if (open) {
      reset(toForm(collection));
      setSlugTouched(!!collection);
    }
  }, [open, collection, reset]);
  const name = watch('name');
  useEffect(() => {
    if (!slugTouched && open) setValue('slug', slugify(name ?? ''), { shouldValidate: formState.isSubmitted });
  }, [name, slugTouched, open, setValue, formState.isSubmitted]);

  const m = useMutation({
    mutationFn: (v: Out) => (collection ? api.put(`/admin/collections/${collection.id}`, v) : api.post('/admin/collections', v)),
    onSuccess: () => {
      toast.success(collection ? 'Коллекция сохранена' : 'Коллекция создана');
      qc.invalidateQueries({ queryKey: ak.collections });
      qc.invalidateQueries({ queryKey: ak.references });
      qc.invalidateQueries({ queryKey: ['collections'] });
      onOpenChange(false);
    },
    onError: (e) => applyServerErrors(e, setError),
  });

  const confirm = useConfirm();
  const close = async (o: boolean) => {
    if (!o && formState.isDirty && !m.isPending) {
      const ok = await confirm({ title: 'Закрыть без сохранения?', description: 'Изменения будут потеряны.', confirmLabel: 'Закрыть', danger: true });
      if (!ok) return;
    }
    onOpenChange(o);
  };

  const e = formState.errors;
  const img = watch('imageUrl');
  return (
    <Dialog open={open} onOpenChange={close}>
      <SheetContent
        title={collection ? `Коллекция: ${collection.name}` : 'Новая коллекция'}
        className="max-w-2xl"
        footer={
          canWrite && (
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => close(false)}>
                Отмена
              </Button>
              <Button type="submit" form="collection-form" loading={m.isPending}>
                Сохранить
              </Button>
            </div>
          )
        }
      >
        <form id="collection-form" onSubmit={handleSubmit((v) => m.mutate(v))} noValidate>
          <fieldset disabled={!canWrite} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Название" required error={e.name?.message}>
              {(p) => <Input {...p} {...register('name')} />}
            </Field>
            <Field label="Slug" required error={e.slug?.message}>
              {(p) => <Input {...p} className="font-mono text-xs" {...register('slug', { onChange: () => setSlugTouched(true) })} />}
            </Field>
            <Field label="Описание" error={e.description?.message} className="sm:col-span-2">
              {(p) => <Textarea {...p} rows={3} {...register('description')} />}
            </Field>
            <Field label="Сезон" error={e.season?.message} hint="Например, SS26">
              {(p) => <Input {...p} {...register('season')} />}
            </Field>
            <Field label="Порядок" error={e.sortOrder?.message}>
              {(p) => <Input {...p} type="number" min={0} {...register('sortOrder', { valueAsNumber: true })} />}
            </Field>
            <Field label="URL обложки" error={e.imageUrl?.message} className="sm:col-span-2">
              {(p) => <Input {...p} type="url" placeholder="https://" {...register('imageUrl')} />}
            </Field>
            {img && <img src={imageUrl(img, 320, 0.75)} alt="" className="aspect-[4/3] w-48 border border-line object-cover sm:col-span-2" />}
            <div className="flex flex-wrap gap-6 sm:col-span-2">
              <Controller control={control} name="isActive" render={({ field }) => <CheckboxField label="Активна" checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={!canWrite} />} />
              <Controller control={control} name="isFeatured" render={({ field }) => <CheckboxField label="Показывать на главной" checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={!canWrite} />} />
            </div>
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
            <div className="border-t border-line pt-4 sm:col-span-2">
              <p className="mb-3 text-xs font-medium text-graphite">Товары коллекции</p>
              <Controller control={control} name="productIds" render={({ field }) => <ProductPicker value={field.value ?? []} onChange={field.onChange} disabled={!canWrite} />} />
              {e.productIds?.message && <p className="mt-1 text-xs text-danger">{e.productIds.message}</p>}
            </div>
          </fieldset>
        </form>
      </SheetContent>
    </Dialog>
  );
}

export default function CollectionsPage() {
  const can = useCan();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const canWrite = can('collections.write');
  const list = useQuery({ queryKey: ak.collections, queryFn: () => api.get<AdminCollection[]>('/admin/collections') });
  const [sheet, setSheet] = useState<{ open: boolean; collection: AdminCollection | null }>({ open: false, collection: null });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/collections/${id}`),
    onSuccess: () => {
      toast.success('Коллекция удалена');
      qc.invalidateQueries({ queryKey: ak.collections });
      qc.invalidateQueries({ queryKey: ak.references });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const onDelete = async (c: AdminCollection) => {
    const ok = await confirm({ title: `Удалить коллекцию «${c.name}»?`, description: 'Товары останутся в каталоге, удалится только подборка.', confirmLabel: 'Удалить', danger: true });
    if (ok) remove.mutate(c.id);
  };

  return (
    <>
      <Seo title="Коллекции" noindex />
      <PageHeader
        title="Коллекции"
        description="Тематические подборки товаров"
        actions={
          canWrite && (
            <Button onClick={() => setSheet({ open: true, collection: null })}>
              <Plus /> Коллекция
            </Button>
          )
        }
      />
      <Panel bodyClassName="p-0">
        {list.isLoading ? (
          <TableSkeleton cols={5} />
        ) : list.isError ? (
          <QueryError error={list.error} onRetry={() => list.refetch()} />
        ) : !list.data?.length ? (
          <EmptyState icon={<Layers />} title="Коллекций пока нет" action={canWrite && <Button onClick={() => setSheet({ open: true, collection: null })}>Создать коллекцию</Button>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Коллекция</Th>
                <Th>Сезон</Th>
                <Th className="text-right">Товары</Th>
                <Th>Статус</Th>
                <Th>
                  <span className="sr-only">Действия</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 shrink-0 bg-mist">{c.imageUrl && <img src={imageUrl(c.imageUrl, 112, 0.75)} alt="" className="size-full object-cover" loading="lazy" />}</div>
                      <div>
                        <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => setSheet({ open: true, collection: c })}>
                          {c.name}
                        </button>
                        <p className="font-mono text-2xs text-stone">/collections/{c.slug}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-stone">{c.season ?? '—'}</Td>
                  <Td className="text-right tabular-nums">{c.productIds.length}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <ActiveBadge active={c.isActive} />
                      {c.isFeatured && <Badge tone="dark">На главной</Badge>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => setSheet({ open: true, collection: c })} aria-label={`Открыть «${c.name}»`}>
                        <Pencil />
                      </Button>
                      {canWrite && (
                        <Button variant="ghost" size="icon-sm" onClick={() => onDelete(c)} aria-label={`Удалить «${c.name}»`}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <CollectionSheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} collection={sheet.collection} canWrite={canWrite} />
    </>
  );
}
