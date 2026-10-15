import { z } from 'zod';
import { emailSchema, nameSchema, phoneSchema } from './auth';

export const addCartItemSchema = z.object({
  variantId: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(20),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(20),
});

export const contactStepSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});
export type ContactStep = z.infer<typeof contactStepSchema>;

export const shippingAddressSchema = z.object({
  country: z.string().trim().length(2).default('RU'),
  region: z.string().trim().max(80).default(''),
  city: z.string().trim().min(1, 'Укажите город').max(80),
  street: z.string().trim().min(1, 'Укажите улицу').max(120),
  house: z.string().trim().min(1, 'Укажите дом').max(20),
  apartment: z.string().trim().max(20).default(''),
  postalCode: z.string().trim().regex(/^\d{6}$/, 'Индекс — 6 цифр'),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

export const PAYMENT_PROVIDERS = ['MOCK', 'STRIPE', 'YOOKASSA'] as const;
export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number];

export const checkoutQuoteSchema = z.object({
  deliveryMethodCode: z.string().max(40).optional(),
});

export const placeOrderSchema = z.object({
  /** Generated once per checkout attempt on the client: repeated submits return the same order. */
  idempotencyKey: z.string().min(16).max(64),
  contact: contactStepSchema,
  deliveryMethodCode: z.string().min(1).max(40),
  address: shippingAddressSchema.optional(),
  pickupPointId: z.string().max(40).optional(),
  paymentProvider: z.enum(PAYMENT_PROVIDERS),
  comment: z.string().trim().max(500).default(''),
  saveAddress: z.boolean().default(false),
  acceptTerms: z.literal(true, { error: 'Необходимо согласие с условиями покупки' }),
  acceptPrivacy: z.literal(true, { error: 'Необходимо согласие на обработку данных' }),
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;
