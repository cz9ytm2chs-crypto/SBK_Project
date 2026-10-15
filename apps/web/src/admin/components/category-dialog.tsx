import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { brandInputSchema, categoryInputSchema, type CategoryInput } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, SheetContent } from '@/components/ui/dialog';
import { CheckboxField, Field, Input, NativeSelect, Textarea } from '@/components/ui/form';
import { api } from '@/lib/api';
import { ak, applyServerErrors, slugify } from '../lib';
import type { AdminBrand, AdminCategory } from '../types';
import { CharCount } from './inputs';

type CategoryOut = z.output<typeof categoryInputSchema>;

const toForm = (c?: AdminCategory | null, parentId?: string | null): CategoryInput => ({
  name: c?.name ?? '',
  slug: c?.slug ?? '',
  description: c?.description ?? '',
  imageUrl: c?.imageUrl ?? '',
  parentId: c?.parentId ?? parentId ?? '',
  sortOrder: c?.sortOrder ?? 0,
  isActive: c?.isActive ?? true,
  seoTitle: c?.seoTitle ?? '',
  seoDescription: c?.seoDescription ?? '',
});

/** Create/edit category in a side sheet. `category === null` → create. */
export function CategorySheet({
  open,
  onOpenChange,
  category,
  defaultParentId,
  categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  category: AdminCategory | null;
  defaultParentId?: string | null;
  categories: AdminCategory[];
}) {
  const qc = useQueryClient();
  const form = useForm<CategoryInput, unknown, CategoryOut>({ resolver: zodResolver(categoryInputSchema), defaultValues: toForm(category, defaultParentId) });
  const { register, control, handleSubmit, formState, reset, watch, setValue, setError } = form;
  const [slugTouched, setSlugTouched] = useState(!!category);

  useEffect(() => {
    if (open) {
      reset(toForm(category, defaultParentId));
      setSlugTouched(!!category);
    }
  }, [open, category, defaultParentId, reset]);

  const name = watch('name');
  useEffect(() => {
    if (!slugTouched && open) setValue('slug', slugify(name ?? ''), { shouldValidate: formState.isSubmitted });
  }, [name, slugTouched, open, setValue, formState.isSubmitted]);

  const m = useMutation({
    mutationFn: (v: CategoryOut) => (category ? api.put(`/admin/categories/${category.id}`, v) : api.post('/admin/categories', v)),
    onSuccess: () => {
      toast.success(category ? 'Категория сохранена' : 'Категория создана');
      qc.invalidateQueries({ queryKey: ak.categories });
      qc.invalidateQueries({ queryKey: ak.references });
      qc.invalidateQueries({ queryKey: ['categories'] });
      onOpenChange(false);
    },
    onError: (e) => applyServerErrors(e, setError),
  });

  // Only top-level categories can be parents (two levels max); a category with children stays top-level.
  const parentOptions = categories.filter((c) => !c.parentId && c.id !== category?.id);
  const hasChildren = !!category && category._count.children > 0;
  const e = formState.errors;
  const imageUrl = watch('imageUrl');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={category ? `Категория: ${category.name}` : 'Новая категория'}
        className="max-w-lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" form="category-form" loading={m.isPending}>
              Сохранить
            </Button>
          </div>
        }
      >
        <form id="category-form" onSubmit={handleSubmit((v) => m.mutate(v))} className="grid gap-4 p-5" noValidate>
          <Field label="Название" required error={e.name?.message}>
            {(p) => <Input {...p} {...register('name')} />}
          </Field>
          <Field label="Slug" required error={e.slug?.message} hint={`/category/${watch('slug') || '…'}`}>
            {(p) => <Input {...p} className="font-mono text-xs" {...register('slug', { onChange: () => setSlugTouched(true) })} />}
          </Field>
          <Field label="Родительская категория" error={e.parentId?.message} hint={hasChildren ? 'У категории есть подкатегории — она остаётся верхнего уровня' : undefined}>
            {(p) => (
              <NativeSelect {...p} disabled={hasChildren} {...register('parentId')}>
                <option value="">— Верхний уровень —</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Описание" error={e.description?.message}>
            {(p) => <Textarea {...p} rows={3} {...register('description')} />}
          </Field>
          <Field label="URL изображения" error={e.imageUrl?.message}>
            {(p) => <Input {...p} type="url" placeholder="https://" {...register('imageUrl')} />}
          </Field>
          {imageUrl && <img src={imageUrl} alt="" className="aspect-[4/3] w-40 border border-line object-cover" />}
          <div className="grid grid-cols-2 items-end gap-4">
            <Field label="Порядок" error={e.sortOrder?.message}>
              {(p) => <Input {...p} type="number" min={0} {...register('sortOrder', { valueAsNumber: true })} />}
            </Field>
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => <CheckboxField className="pb-3" label="Показывать в магазине" checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />}
            />
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
                <Textarea {...p} rows={3} className="min-h-0" {...register('seoDescription')} />
                <div className="mt-1 text-right">
                  <CharCount value={watch('seoDescription')} max={160} />
                </div>
              </div>
            )}
          </Field>
        </form>
      </SheetContent>
    </Dialog>
  );
}

type BrandIn = z.input<typeof brandInputSchema>;
type BrandOut = z.output<typeof brandInputSchema>;

export function BrandDialog({ open, onOpenChange, brand }: { open: boolean; onOpenChange: (o: boolean) => void; brand: AdminBrand | null }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState, reset, watch, setValue, setError } = useForm<BrandIn, unknown, BrandOut>({
    resolver: zodResolver(brandInputSchema),
    defaultValues: { name: '', slug: '', description: '' },
  });
  const [slugTouched, setSlugTouched] = useState(!!brand);
  useEffect(() => {
    if (open) {
      reset({ name: brand?.name ?? '', slug: brand?.slug ?? '', description: brand?.description ?? '' });
      setSlugTouched(!!brand);
    }
  }, [open, brand, reset]);
  const name = watch('name');
  useEffect(() => {
    if (!slugTouched && open) setValue('slug', slugify(name ?? ''));
  }, [name, slugTouched, open, setValue]);

  const m = useMutation({
    mutationFn: (v: BrandOut) => (brand ? api.put(`/admin/brands/${brand.id}`, v) : api.post('/admin/brands', v)),
    onSuccess: () => {
      toast.success(brand ? 'Бренд сохранён' : 'Бренд создан');
      qc.invalidateQueries({ queryKey: ak.brands });
      qc.invalidateQueries({ queryKey: ak.references });
      onOpenChange(false);
    },
    onError: (e) => applyServerErrors(e, setError),
  });
  const e = formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={brand ? `Бренд: ${brand.name}` : 'Новый бренд'}>
        <form onSubmit={handleSubmit((v) => m.mutate(v))} className="grid gap-4" noValidate>
          <Field label="Название" required error={e.name?.message}>
            {(p) => <Input {...p} {...register('name')} />}
          </Field>
          <Field label="Slug" required error={e.slug?.message}>
            {(p) => <Input {...p} className="font-mono text-xs" {...register('slug', { onChange: () => setSlugTouched(true) })} />}
          </Field>
          <Field label="Описание" error={e.description?.message}>
            {(p) => <Textarea {...p} rows={3} {...register('description')} />}
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" loading={m.isPending}>
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
