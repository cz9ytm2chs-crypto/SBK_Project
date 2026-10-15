import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { faqItemInputSchema } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, useConfirm } from '@/components/ui/dialog';
import { CheckboxField, Field, Input, Textarea } from '@/components/ui/form';
import { EmptyState } from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { ak, applyServerErrors } from '../../lib';
import type { FaqItem } from '../../types';
import { ActiveBadge } from '../badges';
import { QueryError, TableSkeleton } from '../page';

type In = z.input<typeof faqItemInputSchema>;
type Out = z.output<typeof faqItemInputSchema>;

const toForm = (f: FaqItem | null, category = 'Общее'): In => ({
  category: f?.category ?? category,
  question: f?.question ?? '',
  answer: f?.answer ?? '',
  sortOrder: f?.sortOrder ?? 0,
  isActive: f?.isActive ?? true,
});

function FaqDialog({ open, onOpenChange, item, categories }: { open: boolean; onOpenChange: (o: boolean) => void; item: FaqItem | null; categories: string[] }) {
  const qc = useQueryClient();
  const { register, control, handleSubmit, formState, reset, setError } = useForm<In, unknown, Out>({ resolver: zodResolver(faqItemInputSchema), defaultValues: toForm(item) });
  const firstCategory = categories[0];
  useEffect(() => {
    if (open) reset(toForm(item, firstCategory));
  }, [open, item, firstCategory, reset]);
  const m = useMutation({
    mutationFn: (v: Out) => (item ? api.put(`/admin/content/faq/${item.id}`, v) : api.post('/admin/content/faq', v)),
    onSuccess: () => {
      toast.success(item ? 'Вопрос сохранён' : 'Вопрос добавлен');
      qc.invalidateQueries({ queryKey: ak.faq });
      qc.invalidateQueries({ queryKey: ['faq'] });
      onOpenChange(false);
    },
    onError: (e) => applyServerErrors(e, setError),
  });
  const e = formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={item ? 'Редактировать вопрос' : 'Новый вопрос'} className="max-w-xl">
        <form onSubmit={handleSubmit((v) => m.mutate(v))} className="grid gap-4 sm:grid-cols-[1fr_7rem]" noValidate>
          <Field label="Раздел" required error={e.category?.message}>
            {(p) => (
              <>
                <Input {...p} list="faq-categories" {...register('category')} />
                <datalist id="faq-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Порядок" error={e.sortOrder?.message}>
            {(p) => <Input {...p} type="number" min={0} {...register('sortOrder', { valueAsNumber: true })} />}
          </Field>
          <Field label="Вопрос" required error={e.question?.message} className="sm:col-span-2">
            {(p) => <Input {...p} {...register('question')} />}
          </Field>
          <Field label="Ответ" required error={e.answer?.message} className="sm:col-span-2">
            {(p) => <Textarea {...p} rows={6} {...register('answer')} />}
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

export function FaqTab() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ak.faq, queryFn: () => api.get<FaqItem[]>('/admin/content/faq') });
  const [dialog, setDialog] = useState<{ open: boolean; item: FaqItem | null }>({ open: false, item: null });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/content/faq/${id}`),
    onSuccess: () => {
      toast.success('Вопрос удалён');
      qc.invalidateQueries({ queryKey: ak.faq });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const items = q.data ?? [];
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setDialog({ open: true, item: null })}>
          <Plus /> Вопрос
        </Button>
      </div>
      {q.isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<HelpCircle />} title="Вопросов пока нет" />
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <section key={cat} className="border border-line bg-paper">
              <h3 className="label border-b border-line px-5 py-3 text-graphite">{cat}</h3>
              <ul className="divide-y divide-line">
                {items
                  .filter((i) => i.category === cat)
                  .map((i) => (
                    <li key={i.id} className="flex items-start gap-4 px-5 py-3">
                      <span className="w-6 pt-0.5 text-2xs text-stone tabular-nums">{i.sortOrder}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{i.question}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-stone">{i.answer}</p>
                      </div>
                      <ActiveBadge active={i.isActive} />
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setDialog({ open: true, item: i })} aria-label={`Редактировать: ${i.question}`}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={async () => {
                            if (await confirm({ title: 'Удалить вопрос?', description: i.question, confirmLabel: 'Удалить', danger: true })) remove.mutate(i.id);
                          }}
                          aria-label={`Удалить: ${i.question}`}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <FaqDialog open={dialog.open} onOpenChange={(open) => setDialog((s) => ({ ...s, open }))} item={dialog.item} categories={categories} />
    </div>
  );
}
