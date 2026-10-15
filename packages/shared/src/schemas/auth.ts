import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Укажите email')
  .max(254)
  .pipe(z.email('Некорректный email'));

export const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .max(128, 'Максимум 128 символов')
  .regex(/[A-Za-zА-Яа-я]/, 'Добавьте хотя бы одну букву')
  .regex(/\d/, 'Добавьте хотя бы одну цифру');

export const nameSchema = z.string().trim().min(1, 'Обязательное поле').max(60);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{10,20}$/, 'Некорректный номер телефона');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: z.string().trim().max(60).default(''),
  marketingOptIn: z.boolean().default(false),
  acceptTerms: z.literal(true, { error: 'Необходимо согласие с условиями' }),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Введите пароль').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль').max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  firstName: nameSchema,
  lastName: z.string().trim().max(60),
  phone: phoneSchema.or(z.literal('')).optional(),
  marketingOptIn: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const addressSchema = z.object({
  label: z.string().trim().max(40).default(''),
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  country: z.string().trim().length(2).default('RU'),
  region: z.string().trim().max(80).default(''),
  city: z.string().trim().min(1, 'Укажите город').max(80),
  street: z.string().trim().min(1, 'Укажите улицу').max(120),
  house: z.string().trim().min(1, 'Укажите дом').max(20),
  apartment: z.string().trim().max(20).default(''),
  postalCode: z.string().trim().regex(/^\d{6}$/, 'Индекс — 6 цифр'),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.input<typeof addressSchema>;
