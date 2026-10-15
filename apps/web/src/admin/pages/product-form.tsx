import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { productInputSchema, type ProductInput, type ProductInputParsed } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { CheckboxField, Field, Input, NativeSelect, Textarea } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/misc';
import { api } from '@/lib/api';
import { Seo } from '@/lib/seo';
import { ProductStatusBadge } from '../components/badges';
import { ImageManager } from '../components/image-manager';
import { CharCount, MoneyInput } from '../components/inputs';
import { MovementsJournal } from '../components/movements';
import { PageHeader, Panel, QueryError } from '../components/page';
import { useUnsavedChangesGuard } from '../components/unsaved-guard';
import { VariantEditor } from '../components/variant-editor';
import { ak, applyServerErrors, slugify, useCan } from '../lib';
import type { AdminProduct, ProductReferences } from '../types';

const EMPTY: ProductInput = {
  name: '',
  slug: '',
  description: '',
  material: '',
  care: '',
  fit: '',
  price: 0,
  compareAtPrice: null,
  costPrice: null,
  status: 'DRAFT',
  isNew: true,
  isBestseller: false,
  isFeatured: false,
  categoryId: '',
  brandId: '',
  collectionIds: [],
  seoTitle: '',
  seoDescription: '',
  variants: [],
  images: [],
};

function toForm(p: AdminProduct): ProductInput {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    material: p.material,
    care: p.care,
    fit: p.fit,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    costPrice: p.costPrice,
    status: p.status,
    isNew: p.isNew,
    isBestseller: p.isBestseller,
    isFeatured: p.isFeatured,
    categoryId: p.categoryId,
    brandId: p.brandId ?? '',
    collectionIds: p.collectionIds,
    seoTitle: p.seoTitle ?? '',
    seoDescription: p.seoDescription ?? '',
    variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, sizeId: v.sizeId, colorId: v.colorId, stock: v.stock, isActive: v.isActive })),
    images: [...p.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => ({ id: i.id, url: i.url, storageKey: i.storageKey, alt: i.alt, colorId: i.colorId, isMain: i.isMain })),
  };
}

export default function ProductFormPage() {
  const { id } = useParams();
  const product = useQuery({
    queryKey: ak.product(id ?? ''),
    queryFn: () => api.get<AdminProduct>(`/admin/products/${id}`),
    enabled: !!id,
    staleTime: 0,
  });
  const refs = useQuery({ queryKey: ak.references, queryFn: () => api.get<ProductReferences>('/admin/products/references'), staleTime: 5 * 60_000 });

  const error = product.error ?? refs.error;
  if (error)
    return (
      <>
        <PageHeader title={id ? 'Товар' : 'Новый товар'} back={{ to: '/admin/products', label: 'Товары' }} />
        <Panel>
          <QueryError error={error} onRetry={() => (product.isError ? product.refetch() : refs.refetch())} />
        </Panel>
      </>
    );
  if (!refs.data || (id && !product.data))
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <Skeleton className="h-[32rem]" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  return <ProductEditor key={id ?? 'new'} product={product.data} refs={refs.data} />;
}

function ProductEditor({ product, refs }: { product?: AdminProduct; refs: ProductReferences }) {
  const can = useCan();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isEdit = !!product;
  const canWrite = can('products.write');

  const form = useForm<ProductInput, unknown, ProductInputParsed>({
    resolver: zodResolver(productInputSchema),
    defaultValues: product ? toForm(product) : EMPTY,
  });
  const { register, control, handleSubmit, formState, setValue, watch, setError, reset } = form;
  const { errors, isDirty, isSubmitting } = formState;
  const { allowNavigation } = useUnsavedChangesGuard(isDirty && !isSubmitting && canWrite);

  // Slug follows the name (transliterated) until staff edit it by hand.
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const name = watch('name');
  useEffect(() => {
    if (!slugTouched) setValue('slug', slugify(name ?? ''), { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }, [name, slugTouched, setValue, formState.isSubmitted]);

  const save = useMutation({
    mutationFn: (values: ProductInputParsed) =>
      isEdit ? api.put<{ id: string }>(`/admin/products/${product.id}`, values) : api.post<{ id: string }>('/admin/products', values),
    onSuccess: async ({ id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ak.movements(id) });
      if (!isEdit) {
        toast.success('Товар создан');
        allowNavigation();
        navigate(`/admin/products/${id}/edit`, { replace: true });
        return;
      }
      const fresh = await qc.fetchQuery({ queryKey: ak.product(id), queryFn: () => api.get<AdminProduct>(`/admin/products/${id}`), staleTime: 0 });
      reset(toForm(fresh));
      toast.success('Изменения сохранены');
    },
    onError: (e) => applyServerErrors(e, setError),
  });

  const onInvalid = () => toast.error('Проверьте выделенные поля');
  const submit = handleSubmit((v) => save.mutateAsync(v).catch(() => undefined), onInvalid);

  const parents = refs.categories.filter((c) => !c.parentId);
  const seoTitle = watch('seoTitle');
  const seoDescription = watch('seoDescription');
  const status = watch('status');
  const reservedById = Object.fromEntries((product?.variants ?? []).map((v) => [v.id, v.reserved]));

  return (
    <form onSubmit={submit} noValidate>
      <Seo title={isEdit ? `Товар: ${product.name}` : 'Новый товар'} noindex />
      <PageHeader
        back={{ to: '/admin/products', label: 'Товары' }}
        title={isEdit ? product.name : 'Новый товар'}
        eyebrow={isEdit && <ProductStatusBadge status={product.status} />}
        actions={
          <>
            {isEdit && product.status === 'PUBLISHED' && (
              <Button asChild variant="ghost" size="sm">
                <a href={`/product/${product.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> На сайте
                </a>
              </Button>
            )}
            {canWrite && (
              <Button type="submit" loading={save.isPending} disabled={isEdit && !isDirty}>
                {isEdit ? 'Сохранить' : 'Создать товар'}
              </Button>
            )}
          </>
        }
      />
      {!canWrite && <p className="mb-5 border border-line bg-paper px-4 py-3 text-sm text-stone">Режим просмотра: у вас нет права редактировать товары.</p>}

      <fieldset disabled={!canWrite || save.isPending} className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Основное">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название" required error={errors.name?.message} className="md:col-span-2">
                {(p) => <Input {...p} {...register('name')} />}
              </Field>
              <Field label="Slug (адрес страницы)" required error={errors.slug?.message} hint={`/product/${watch('slug') || '…'}`} className="md:col-span-2">
                {(p) => (
                  <Input
                    {...p}
                    className="font-mono text-xs"
                    {...register('slug', { onChange: () => setSlugTouched(true) })}
                  />
                )}
              </Field>
              <Field label="Описание" required error={errors.description?.message} className="md:col-span-2">
                {(p) => <Textarea {...p} rows={6} {...register('description')} />}
              </Field>
              <Field label="Состав" error={errors.material?.message}>
                {(p) => <Textarea {...p} rows={3} className="min-h-0" {...register('material')} />}
              </Field>
              <Field label="Уход" error={errors.care?.message}>
                {(p) => <Textarea {...p} rows={3} className="min-h-0" {...register('care')} />}
              </Field>
              <Field label="Посадка" error={errors.fit?.message} className="md:col-span-2">
                {(p) => <Input {...p} {...register('fit')} />}
              </Field>
            </div>
          </Panel>

          <Panel title="Цены">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Цена" required error={errors.price?.message}>
                {(p) => <Controller control={control} name="price" render={({ field }) => <MoneyInput {...p} value={field.value} onChange={(v) => field.onChange(v ?? 0)} onBlur={field.onBlur} />} />}
              </Field>
              <Field label="Старая цена" error={errors.compareAtPrice?.message} hint="Для отображения скидки">
                {(p) => <Controller control={control} name="compareAtPrice" render={({ field }) => <MoneyInput {...p} nullable value={field.value} onChange={field.onChange} onBlur={field.onBlur} />} />}
              </Field>
              <Field label="Себестоимость" error={errors.costPrice?.message} hint="Видна только сотрудникам">
                {(p) => <Controller control={control} name="costPrice" render={({ field }) => <MoneyInput {...p} nullable value={field.value} onChange={field.onChange} onBlur={field.onBlur} />} />}
              </Field>
            </div>
          </Panel>

          <Panel title="Вариации и остатки">
            <VariantEditor form={form} sizes={refs.sizes} colors={refs.colors} reservedById={reservedById} lockExistingStock={!can('inventory.write')} />
          </Panel>

          <Panel title="Фотографии">
            <ImageManager form={form} colors={refs.colors} disabled={!canWrite} />
            {errors.images?.message && <p className="mt-2 text-xs text-danger">{errors.images.message}</p>}
          </Panel>

          <Panel title="SEO">
            <div className="grid gap-4">
              <Field label="SEO title" error={errors.seoTitle?.message} hint="Если пусто — используется название товара">
                {(p) => (
                  <div className="relative">
                    <Input {...p} className="pr-16" {...register('seoTitle')} />
                    <span className="absolute top-1/2 right-3 -translate-y-1/2">
                      <CharCount value={seoTitle} max={70} />
                    </span>
                  </div>
                )}
              </Field>
              <Field label="SEO description" error={errors.seoDescription?.message}>
                {(p) => (
                  <div>
                    <Textarea {...p} rows={3} className="min-h-0" {...register('seoDescription')} />
                    <div className="mt-1 text-right">
                      <CharCount value={seoDescription} max={160} />
                    </div>
                  </div>
                )}
              </Field>
            </div>
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6">
          <Panel title="Публикация">
            <div className="space-y-4">
              <Field label="Статус" error={errors.status?.message} hint={status === 'PUBLISHED' ? 'Товар виден в магазине' : 'Товар скрыт из магазина'}>
                {(p) => (
                  <NativeSelect {...p} {...register('status')}>
                    <option value="DRAFT">Черновик</option>
                    <option value="PUBLISHED">Опубликован</option>
                    <option value="ARCHIVED">В архиве</option>
                  </NativeSelect>
                )}
              </Field>
              <div className="space-y-3 pt-1">
                {(
                  [
                    ['isNew', 'Новинка'],
                    ['isBestseller', 'Хит продаж'],
                    ['isFeatured', 'Показывать на витрине'],
                  ] as const
                ).map(([key, label]) => (
                  <Controller
                    key={key}
                    control={control}
                    name={key}
                    render={({ field }) => <CheckboxField label={label} checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} disabled={!canWrite} />}
                  />
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Организация">
            <div className="space-y-4">
              <Field label="Категория" required error={errors.categoryId?.message}>
                {(p) => (
                  <NativeSelect {...p} {...register('categoryId')}>
                    <option value="">Выберите категорию</option>
                    {parents.map((c) => {
                      const children = refs.categories.filter((ch) => ch.parentId === c.id);
                      return children.length ? (
                        <optgroup key={c.id} label={c.name}>
                          <option value={c.id}>{c.name} (вся)</option>
                          {children.map((ch) => (
                            <option key={ch.id} value={ch.id}>
                              {ch.name}
                            </option>
                          ))}
                        </optgroup>
                      ) : (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      );
                    })}
                  </NativeSelect>
                )}
              </Field>
              <Field label="Бренд" error={errors.brandId?.message}>
                {(p) => (
                  <NativeSelect {...p} {...register('brandId')}>
                    <option value="">Без бренда</option>
                    {refs.brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-graphite">Коллекции</legend>
                {refs.collections.length === 0 ? (
                  <p className="text-xs text-stone">Коллекций пока нет.</p>
                ) : (
                  <Controller
                    control={control}
                    name="collectionIds"
                    render={({ field }) => (
                      <div className="max-h-56 space-y-2.5 overflow-y-auto">
                        {refs.collections.map((c) => {
                          const value = field.value ?? [];
                          return (
                            <CheckboxField
                              key={c.id}
                              label={c.name}
                              disabled={!canWrite}
                              checked={value.includes(c.id)}
                              onCheckedChange={(on) => field.onChange(on ? [...value, c.id] : value.filter((x) => x !== c.id))}
                            />
                          );
                        })}
                      </div>
                    )}
                  />
                )}
              </fieldset>
            </div>
          </Panel>

          {isEdit && (
            <Panel title="Сводка">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-stone">Остаток</dt>
                <dd className="text-right tabular-nums">{product.variants.reduce((s, v) => s + v.stock, 0)} шт.</dd>
                <dt className="text-stone">В резерве</dt>
                <dd className="text-right tabular-nums">{product.variants.reduce((s, v) => s + v.reserved, 0)} шт.</dd>
                <dt className="text-stone">Обновлён</dt>
                <dd className="text-right">{new Date(product.updatedAt).toLocaleDateString('ru-RU')}</dd>
              </dl>
            </Panel>
          )}
        </aside>
      </fieldset>

      {isEdit && (
        <Panel title="Журнал движения остатков" className="mt-6" bodyClassName="p-0">
          <MovementsJournal productId={product.id} />
        </Panel>
      )}

      {canWrite && (
        <div className="sticky bottom-0 z-30 -mx-4 mt-6 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {isDirty && <span className="mr-auto text-xs text-stone">Есть несохранённые изменения</span>}
          <Button asChild variant="ghost">
            <Link to="/admin/products">Отмена</Link>
          </Button>
          <Button type="submit" loading={save.isPending} disabled={isEdit && !isDirty}>
            {isEdit ? 'Сохранить' : 'Создать товар'}
          </Button>
        </div>
      )}
    </form>
  );
}
