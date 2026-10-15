import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { bannerInputSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, useConfirm } from '@/components/ui/dialog';
import { CheckboxField, Field, Input, NativeSelect, Textarea } from '@/components/ui/form';
import { Badge, EmptyState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { imageUrl } from '@/lib/utils';
import { ak, applyServerErrors } from '../../lib';
import type { AdminBanner, BannerPlacement } from '../../types';
import { ActiveBadge } from '../badges';
import { QueryError, TableSkeleton } from '../page';

type In = z.input<typeof bannerInputSchema>;
type Out = z.output<typeof bannerInputSchema>;

export const PLACEMENT_LABELS: Record<BannerPlacement, string> = { HERO: 'Главный экран', PROMO: 'Промо-блок', EDITORIAL: 'Редакционный' };

const toForm = (b: AdminBanner | null): In => ({
  placement: b?.placement ?? 'HERO',
  title: b?.title ?? '',
  subtitle: b?.subtitle ?? '',
  eyebrow: b?.eyebrow ?? '',
  imageUrl: b?.imageUrl ?? '',
  ctaLabel: b?.ctaLabel ?? '',
  ctaHref: b?.ctaHref ?? '',
  sortOrder: b?.sortOrder ?? 0,
  isActive: b?.isActive ?? true,
});

function BannerDialog({ open, onOpenChange, banner }: { open: boolean; onOpenChange: (o: boolean) => void; banner: AdminBanner | null }) {
  const qc = useQueryClient();
  const { register, control, handleSubmit, formState, reset, watch, setError } = useForm<In, unknown, Out>({ resolver: zodResolver(bannerInputSchema), defaultValues: toForm(banner) });
  useEffect(() => {
    if (open) reset(toForm(banner));
  }, [open, banner, reset]);
  const m = useMutation({
    mutationFn: (v: Out) => (banner ? api.put(`/admin/content/banners/${banner.id}`, v) : api.post('/admin/content/banners', v)),
    onSuccess: () => {
      toast.success(banner ? 'Баннер сохранён' : 'Баннер создан');
      qc.invalidateQueries({ queryKey: ak.banners });
      qc.invalidateQueries({ queryKey: ['home'] });
      onOpenChange(false);
    },
    onError: (e) => applyServerErrors(e, setError),
  });
  const e = formState.errors;
  const img = watch('imageUrl');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={banner ? 'Редактировать баннер' : 'Новый баннер'} className="max-w-2xl">
        <form onSubmit={handleSubmit((v) => m.mutate(v))} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Размещение" required error={e.placement?.message}>
            {(p) => (
              <NativeSelect {...p} {...register('placement')}>
                {Object.entries(PLACEMENT_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Порядок" error={e.sortOrder?.message}>
            {(p) => <Input {...p} type="number" min={0} {...register('sortOrder', { valueAsNumber: true })} />}
          </Field>
          <Field label="Надзаголовок" error={e.eyebrow?.message}>
            {(p) => <Input {...p} {...register('eyebrow')} />}
          </Field>
          <Field label="Заголовок" required error={e.title?.message}>
            {(p) => <Input {...p} {...register('title')} />}
          </Field>
          <Field label="Подзаголовок" error={e.subtitle?.message} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={2} className="min-h-0" {...register('subtitle')} />}
          </Field>
          <Field label="URL изображения" required error={e.imageUrl?.message} className="sm:col-span-2">
            {(p) => <Input {...p} type="url" placeholder="https://" {...register('imageUrl')} />}
          </Field>
          <div className="flex aspect-[16/7] items-center justify-center overflow-hidden border border-line bg-mist sm:col-span-2">
            {img ? <img src={imageUrl(img, 900, 7 / 16)} alt="Предпросмотр баннера" className="size-full object-cover" /> : <ImageIcon className="size-6 text-stone" aria-hidden />}
          </div>
          <Field label="Текст кнопки" error={e.ctaLabel?.message}>
            {(p) => <Input {...p} placeholder="Смотреть" {...register('ctaLabel')} />}
          </Field>
          <Field label="Ссылка кнопки" error={e.ctaHref?.message}>
            {(p) => <Input {...p} placeholder="/catalog" {...register('ctaHref')} />}
          </Field>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <CheckboxField className="sm:col-span-2" label="Показывать на сайте" checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />}
          />
          <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
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

export function BannersTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ak.banners, queryFn: () => api.get<AdminBanner[]>('/admin/content/banners') });
  const [dialog, setDialog] = useState<{ open: boolean; banner: AdminBanner | null }>({ open: false, banner: null });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/content/banners/${id}`),
    onSuccess: () => {
      toast.success('Баннер удалён');
      qc.invalidateQueries({ queryKey: ak.banners });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const onDelete = async (b: AdminBanner) => {
    if (await confirm({ title: `Удалить баннер «${b.title}»?`, confirmLabel: 'Удалить', danger: true })) remove.mutate(b.id);
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setDialog({ open: true, banner: null })}>
          <Plus /> Баннер
        </Button>
      </div>
      {q.isLoading ? (
        <TableSkeleton rows={4} cols={3} />
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<ImageIcon />} title="Баннеров нет" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {q.data.map((b) => (
            <li key={b.id} className="border border-line bg-paper">
              <div className="aspect-[16/7] overflow-hidden bg-mist">
                <img src={imageUrl(b.imageUrl, 600, 7 / 16)} alt="" className="size-full object-cover" loading="lazy" />
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-1">
                  <Badge tone="outline">{PLACEMENT_LABELS[b.placement]}</Badge>
                  <ActiveBadge active={b.isActive} />
                  <Badge tone="neutral">#{b.sortOrder}</Badge>
                </div>
                {b.eyebrow && <p className="label mt-3 text-stone">{b.eyebrow}</p>}
                <p className="mt-1 font-medium">{b.title}</p>
                {b.subtitle && <p className="mt-1 line-clamp-2 text-xs text-stone">{b.subtitle}</p>}
                {b.ctaLabel && (
                  <p className="mt-2 text-xs">
                    {b.ctaLabel} → <span className="font-mono text-stone">{b.ctaHref}</span>
                  </p>
                )}
                <div className="mt-3 flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, banner: b })} aria-label={`Редактировать баннер «${b.title}»`}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => onDelete(b)} aria-label={`Удалить баннер «${b.title}»`}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <BannerDialog open={dialog.open} onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} banner={dialog.banner} />
    </div>
  );
}
