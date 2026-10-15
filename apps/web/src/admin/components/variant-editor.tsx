import { Grid3x3, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray, type UseFormReturn } from 'react-hook-form';
import type { ProductInput, ProductInputParsed } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { CheckboxField, Input, NativeSelect, Switch } from '@/components/ui/form';
import { cn, plural } from '@/lib/utils';
import type { RefColor, RefSize } from '../types';

type Form = UseFormReturn<ProductInput, unknown, ProductInputParsed>;

export function suggestSku(slug: string, color?: RefColor, size?: RefSize) {
  const base =
    slug
      .split('-')
      .filter(Boolean)
      .slice(0, 3)
      .map((p) => p.slice(0, 3))
      .join('')
      .toUpperCase() || 'SKU';
  const c = color ? color.slug.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() : '';
  const s = size ? size.label.replace(/\s+/g, '').toUpperCase() : '';
  return [base, c, s].filter(Boolean).join('-').slice(0, 64);
}

const SIZE_GROUP_LABELS: Record<string, string> = { APPAREL: 'Одежда', SHOES: 'Обувь', ONE_SIZE: 'Без размера' };

export function VariantEditor({
  form,
  sizes,
  colors,
  reservedById,
  lockExistingStock,
}: {
  form: Form;
  sizes: RefSize[];
  colors: RefColor[];
  reservedById: Record<string, number>;
  /** No inventory.write: stock of existing variants is read-only. */
  lockExistingStock: boolean;
}) {
  const { control, register, getValues, setValue, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'variants', keyName: 'fieldKey' });
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [pickSizes, setPickSizes] = useState<string[]>([]);
  const [pickColors, setPickColors] = useState<string[]>([]);
  const errors = formState.errors.variants;

  const sizeById = (id: string) => sizes.find((s) => s.id === id);
  const colorById = (id: string) => colors.find((c) => c.id === id);
  const skuFor = (sizeId: string, colorId: string) => suggestSku(getValues('slug') ?? '', colorById(colorId), sizeById(sizeId));

  /** Keep SKU in sync with size/color while it still equals the auto-suggested value. */
  const onComboChange = (i: number, field: 'sizeId' | 'colorId', value: string) => {
    const row = getValues(`variants.${i}`);
    const prevSuggestion = row.sizeId && row.colorId ? skuFor(row.sizeId, row.colorId) : '';
    const next = { ...row, [field]: value };
    setValue(`variants.${i}.${field}`, value, { shouldDirty: true, shouldValidate: formState.isSubmitted });
    if (next.sizeId && next.colorId && (!row.sku || row.sku === prevSuggestion))
      setValue(`variants.${i}.sku`, skuFor(next.sizeId, next.colorId), { shouldDirty: true, shouldValidate: formState.isSubmitted });
  };

  const generate = () => {
    const existing = new Set((getValues('variants') ?? []).map((v) => `${v.sizeId}:${v.colorId}`));
    let added = 0;
    for (const sizeId of pickSizes)
      for (const colorId of pickColors) {
        if (existing.has(`${sizeId}:${colorId}`)) continue;
        append({ sku: skuFor(sizeId, colorId), sizeId, colorId, stock: 0, isActive: true }, { shouldFocus: false });
        added++;
      }
    setMatrixOpen(false);
    setPickSizes([]);
    setPickColors([]);
    return added;
  };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const groups = [...new Set(sizes.map((s) => s.group))];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => append({ sku: '', sizeId: '', colorId: '', stock: 0, isActive: true })}>
          <Plus /> Вариация
        </Button>
        <Button type="button" size="sm" variant={matrixOpen ? 'primary' : 'ghost'} onClick={() => setMatrixOpen((v) => !v)} aria-expanded={matrixOpen}>
          <Grid3x3 /> Размеры × цвета
        </Button>
      </div>

      {matrixOpen && (
        <div className="mb-5 border border-line bg-milk p-4">
          <p className="text-sm text-graphite">Отметьте размеры и цвета — недостающие комбинации добавятся с нулевым остатком.</p>
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <fieldset>
              <legend className="label mb-2 text-stone">Размеры</legend>
              {groups.map((g) => (
                <div key={g} className="mb-3">
                  <p className="mb-1.5 text-xs text-stone">{SIZE_GROUP_LABELS[g] ?? g}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {sizes
                      .filter((s) => s.group === g)
                      .map((s) => (
                        <CheckboxField key={s.id} label={s.label} checked={pickSizes.includes(s.id)} onCheckedChange={() => setPickSizes((l) => toggle(l, s.id))} />
                      ))}
                  </div>
                </div>
              ))}
            </fieldset>
            <fieldset>
              <legend className="label mb-2 text-stone">Цвета</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {colors.map((c) => (
                  <CheckboxField
                    key={c.id}
                    label={
                      <span className="inline-flex items-center gap-1.5">
                        <span className="size-3 border border-line" style={{ background: c.hex }} aria-hidden />
                        {c.name}
                      </span>
                    }
                    checked={pickColors.includes(c.id)}
                    onCheckedChange={() => setPickColors((l) => toggle(l, c.id))}
                  />
                ))}
              </div>
            </fieldset>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button type="button" size="sm" onClick={generate} disabled={!pickSizes.length || !pickColors.length}>
              {pickSizes.length * pickColors.length ? `Добавить ${pickSizes.length * pickColors.length} ${plural(pickSizes.length * pickColors.length, ['комбинацию', 'комбинации', 'комбинаций'])}` : 'Выберите размеры и цвета'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMatrixOpen(false)}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <p className={cn('border border-dashed border-line px-4 py-8 text-center text-sm', errors ? 'text-danger' : 'text-stone')}>
          {errors?.message ?? errors?.root?.message ?? 'Добавьте хотя бы одну вариацию: размер, цвет и остаток.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left">
                <th className="label pb-2 font-medium text-stone">Размер</th>
                <th className="label pb-2 pl-2 font-medium text-stone">Цвет</th>
                <th className="label pb-2 pl-2 font-medium text-stone">SKU</th>
                <th className="label w-28 pb-2 pl-2 font-medium text-stone">Остаток</th>
                <th className="label w-20 pb-2 pl-2 font-medium text-stone">Резерв</th>
                <th className="label w-16 pb-2 pl-2 font-medium text-stone">Активна</th>
                <th className="w-10 pb-2" />
              </tr>
            </thead>
            <tbody>
              {fields.map((f, i) => {
                const e = errors?.[i];
                const reserved = f.id ? (reservedById[f.id] ?? 0) : 0;
                const stockLocked = lockExistingStock && !!f.id;
                return (
                  <tr key={f.fieldKey} className="align-top">
                    <td className="py-1.5">
                      <Controller
                        control={control}
                        name={`variants.${i}.sizeId`}
                        render={({ field }) => (
                          <NativeSelect
                            aria-label={`Размер, строка ${i + 1}`}
                            aria-invalid={!!e?.sizeId}
                            value={field.value}
                            onChange={(ev) => onComboChange(i, 'sizeId', ev.target.value)}
                            onBlur={field.onBlur}
                            className="h-10"
                          >
                            <option value="">—</option>
                            {sizes.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                      />
                      {e?.sizeId && <p className="mt-1 text-xs text-danger">{e.sizeId.message}</p>}
                    </td>
                    <td className="py-1.5 pl-2">
                      <Controller
                        control={control}
                        name={`variants.${i}.colorId`}
                        render={({ field }) => (
                          <NativeSelect
                            aria-label={`Цвет, строка ${i + 1}`}
                            aria-invalid={!!e?.colorId}
                            value={field.value}
                            onChange={(ev) => onComboChange(i, 'colorId', ev.target.value)}
                            onBlur={field.onBlur}
                            className="h-10"
                          >
                            <option value="">—</option>
                            {colors.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </NativeSelect>
                        )}
                      />
                      {e?.colorId && <p className="mt-1 text-xs text-danger">{e.colorId.message}</p>}
                    </td>
                    <td className="py-1.5 pl-2">
                      <Input aria-label={`SKU, строка ${i + 1}`} aria-invalid={!!e?.sku} className="h-10 font-mono text-xs uppercase" {...register(`variants.${i}.sku`)} />
                      {e?.sku && <p className="mt-1 text-xs text-danger">{e.sku.message}</p>}
                    </td>
                    <td className="py-1.5 pl-2">
                      <Input
                        type="number"
                        min={0}
                        aria-label={`Остаток, строка ${i + 1}`}
                        aria-invalid={!!e?.stock}
                        readOnly={stockLocked}
                        title={stockLocked ? 'Нет права изменять остатки' : undefined}
                        className={cn('h-10 tabular-nums', stockLocked && 'bg-mist')}
                        {...register(`variants.${i}.stock`, { valueAsNumber: true })}
                      />
                      {e?.stock && <p className="mt-1 text-xs text-danger">Целое число ≥ 0</p>}
                    </td>
                    <td className="py-1.5 pl-2 leading-10 text-stone tabular-nums">{f.id ? reserved : '—'}</td>
                    <td className="py-1.5 pl-2 leading-10">
                      <Controller
                        control={control}
                        name={`variants.${i}.isActive`}
                        render={({ field }) => (
                          <Switch checked={field.value ?? true} onCheckedChange={field.onChange} aria-label={`Вариация активна, строка ${i + 1}`} />
                        )}
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mt-1"
                        onClick={() => remove(i)}
                        disabled={reserved > 0}
                        title={reserved > 0 ? 'Вариация зарезервирована в заказах' : undefined}
                        aria-label={`Удалить вариацию, строка ${i + 1}`}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(errors?.message || errors?.root?.message) && <p className="mt-2 text-xs text-danger">{errors.message ?? errors.root?.message}</p>}
          <p className="mt-3 text-xs text-stone">
            Удалённые вариации, которые уже продавались, будут деактивированы. Изменения остатков записываются в журнал движения.
          </p>
        </div>
      )}
    </div>
  );
}

