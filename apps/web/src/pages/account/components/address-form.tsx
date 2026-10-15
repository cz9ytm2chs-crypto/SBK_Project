import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { addressSchema, type AddressDTO, type AddressInput } from '@silt/shared';
import { Button } from '@/components/ui/button';
import { CheckboxField, Field, Input } from '@/components/ui/form';
import { applyServerErrors } from '@/pages/auth/components/auth-errors';
import { FormAlert } from '@/pages/auth/components/auth-ui';

export type AddressValues = z.output<typeof addressSchema>;

const EMPTY: AddressInput = {
  label: '',
  firstName: '',
  lastName: '',
  phone: '',
  country: 'RU',
  region: '',
  city: '',
  street: '',
  house: '',
  apartment: '',
  postalCode: '',
  isDefault: false,
};

/** Add / edit form rendered inside a Dialog. `onSubmit` should reject with the API error. */
export function AddressForm({
  initial,
  prefill,
  lockDefault,
  onSubmit,
  onCancel,
}: {
  initial?: AddressDTO;
  prefill?: Partial<AddressInput>;
  /** First address is always the default one. */
  lockDefault?: boolean;
  onSubmit: (values: AddressValues) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: AddressInput = initial
    ? (({ id: _id, ...rest }) => rest)(initial)
    : { ...EMPTY, ...prefill, isDefault: !!lockDefault };
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(addressSchema), defaultValues: defaults });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormAlert>{formError}</FormAlert>
      <Field label="Название" error={errors.label?.message} hint="Например, «Дом» или «Офис»">
        {(p) => <Input {...p} {...register('label')} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Имя получателя" error={errors.firstName?.message} required>
          {(p) => <Input {...p} {...register('firstName')} autoComplete="shipping given-name" />}
        </Field>
        <Field label="Фамилия" error={errors.lastName?.message} required>
          {(p) => <Input {...p} {...register('lastName')} autoComplete="shipping family-name" />}
        </Field>
      </div>
      <Field label="Телефон" error={errors.phone?.message} required>
        {(p) => <Input {...p} {...register('phone')} type="tel" inputMode="tel" autoComplete="shipping tel" placeholder="+7 900 000-00-00" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Город" error={errors.city?.message} required>
          {(p) => <Input {...p} {...register('city')} autoComplete="shipping address-level2" />}
        </Field>
        <Field label="Регион" error={errors.region?.message}>
          {(p) => <Input {...p} {...register('region')} autoComplete="shipping address-level1" />}
        </Field>
      </div>
      <Field label="Улица" error={errors.street?.message} required>
        {(p) => <Input {...p} {...register('street')} autoComplete="shipping address-line1" />}
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Дом" error={errors.house?.message} required>
          {(p) => <Input {...p} {...register('house')} />}
        </Field>
        <Field label="Квартира" error={errors.apartment?.message}>
          {(p) => <Input {...p} {...register('apartment')} autoComplete="shipping address-line2" />}
        </Field>
        <Field label="Индекс" error={errors.postalCode?.message} required>
          {(p) => <Input {...p} {...register('postalCode')} inputMode="numeric" maxLength={6} autoComplete="shipping postal-code" />}
        </Field>
      </div>
      <Controller
        control={control}
        name="isDefault"
        render={({ field }) => (
          <CheckboxField
            className="pt-1"
            checked={!!field.value}
            disabled={lockDefault}
            onCheckedChange={(v) => field.onChange(v === true)}
            label="Использовать по умолчанию"
          />
        )}
      />
      <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {initial ? 'Сохранить' : 'Добавить адрес'}
        </Button>
      </div>
    </form>
  );
}
