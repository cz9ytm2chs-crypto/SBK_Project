import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';
import { plural } from '@/lib/utils';
import type { ProductStatus } from '../types';
import { PRODUCT_STATUS_LABELS } from './badges';

export type BulkKind = 'price_percent' | 'stock_set' | 'stock_add' | `status:${ProductStatus}`;

const TITLES: Record<string, string> = {
  price_percent: 'Изменить цены на %',
  stock_set: 'Установить остаток',
  stock_add: 'Добавить к остатку',
};

/** Confirmation + parameter dialog for /admin/products/bulk. */
export function BulkDialog({ kind, productIds, onClose, onDone }: { kind: BulkKind | null; productIds: string[]; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const n = productIds.length;
  const count = `${n} ${plural(n, ['товар', 'товара', 'товаров'])}`;
  const status = kind?.startsWith('status:') ? (kind.slice(7) as ProductStatus) : null;

  const m = useMutation({
    mutationFn: () => {
      const num = Number(value.replace(',', '.'));
      const action = status
        ? { type: 'status', status }
        : kind === 'price_percent'
          ? { type: 'price_percent', percent: num }
          : kind === 'stock_set'
            ? { type: 'stock_set', stock: Math.round(num) }
            : { type: 'stock_add', delta: Math.round(num) };
      return api.post<{ updated: number }>('/admin/products/bulk', { productIds, action });
    },
    onSuccess: (r) => {
      toast.success(`Обновлено: ${r.updated} ${plural(r.updated, ['товар', 'товара', 'товаров'])}`);
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
      setValue('');
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const num = Number(value.replace(',', '.'));
  const invalid =
    !status &&
    (value.trim() === '' ||
      !Number.isFinite(num) ||
      (kind === 'price_percent' && (num < -90 || num > 500 || num === 0)) ||
      (kind === 'stock_set' && (num < 0 || num > 100000)) ||
      (kind === 'stock_add' && (num === 0 || Math.abs(num) > 100000)));

  const close = () => {
    setValue('');
    onClose();
  };

  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && close()}>
      {kind && (
        <DialogContent
          title={status ? `Статус: ${PRODUCT_STATUS_LABELS[status]}` : TITLES[kind]}
          description={`Выбрано: ${count}. Действие нельзя отменить автоматически.`}
          className="max-w-md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!invalid) m.mutate();
            }}
            className="space-y-5"
          >
            {!status && (
              <Field
                label={kind === 'price_percent' ? 'Изменение цены, %' : kind === 'stock_set' ? 'Остаток каждой вариации, шт.' : 'Добавить к каждой вариации, шт.'}
                hint={
                  kind === 'price_percent'
                    ? 'Например, 10 — поднять на 10%, −15 — снизить на 15%. Цены округляются до рубля.'
                    : kind === 'stock_add'
                      ? 'Отрицательное число уменьшит остаток (не ниже зарезервированного).'
                      : 'Остаток не опустится ниже зарезервированного в заказах.'
                }
              >
                {(p) => <Input {...p} autoFocus inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />}
              </Field>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={close}>
                Отмена
              </Button>
              <Button type="submit" variant={status === 'ARCHIVED' ? 'danger' : 'primary'} disabled={invalid} loading={m.isPending}>
                Применить
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
