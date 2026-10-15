/**
 * Pure price calculation. The server is the only caller whose result is trusted;
 * the client renders the totals the server returns.
 */

export interface PricingLine {
  key: string; // variantId
  productId: string;
  categoryId: string;
  unitPrice: number;
  quantity: number;
}

export interface CouponRules {
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  usedCount: number;
  productIds: string[];
  categoryIds: string[];
  allowedUserIds: string[];
}

export interface CouponContext {
  now: Date;
  userId: string | null;
  /** How many times this user / email already used the coupon. */
  usesByCustomer: number;
}

export type CouponError =
  | 'COUPON_INACTIVE'
  | 'COUPON_NOT_STARTED'
  | 'COUPON_EXPIRED'
  | 'COUPON_USAGE_LIMIT'
  | 'COUPON_USER_LIMIT'
  | 'COUPON_NOT_ALLOWED'
  | 'COUPON_MIN_AMOUNT'
  | 'COUPON_NOT_APPLICABLE';

export const COUPON_ERROR_MESSAGES: Record<CouponError, string> = {
  COUPON_INACTIVE: 'Промокод недействителен',
  COUPON_NOT_STARTED: 'Промокод ещё не начал действовать',
  COUPON_EXPIRED: 'Срок действия промокода истёк',
  COUPON_USAGE_LIMIT: 'Лимит использований промокода исчерпан',
  COUPON_USER_LIMIT: 'Вы уже использовали этот промокод',
  COUPON_NOT_ALLOWED: 'Промокод недоступен для вашего аккаунта',
  COUPON_MIN_AMOUNT: 'Сумма заказа меньше минимальной для промокода',
  COUPON_NOT_APPLICABLE: 'Промокод не распространяется на товары в корзине',
};

export interface ShippingRule {
  price: number;
  freeFromAmount: number | null;
}

export interface PricingResult {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  /** Discount allocated per line key — stored on order items. */
  lineDiscounts: Record<string, number>;
  coupon: { code: string; applied: boolean; error: CouponError | null } | null;
  freeShippingRemaining: number | null;
}

function lineEligible(line: PricingLine, c: CouponRules): boolean {
  const restricted = c.productIds.length > 0 || c.categoryIds.length > 0;
  if (!restricted) return true;
  return c.productIds.includes(line.productId) || c.categoryIds.includes(line.categoryId);
}

/** Checks coupon rules that do not depend on cart contents. */
export function checkCouponRules(c: CouponRules, ctx: CouponContext): CouponError | null {
  if (!c.isActive) return 'COUPON_INACTIVE';
  if (c.startsAt && ctx.now < c.startsAt) return 'COUPON_NOT_STARTED';
  if (c.endsAt && ctx.now > c.endsAt) return 'COUPON_EXPIRED';
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return 'COUPON_USAGE_LIMIT';
  if (c.allowedUserIds.length > 0 && (!ctx.userId || !c.allowedUserIds.includes(ctx.userId)))
    return 'COUPON_NOT_ALLOWED';
  if (c.usageLimitPerUser !== null && ctx.usesByCustomer >= c.usageLimitPerUser)
    return 'COUPON_USER_LIMIT';
  return null;
}

/** Splits `amount` across lines proportionally to their totals (largest remainder method). */
export function allocate(amount: number, lines: { key: string; total: number }[]) {
  const sum = lines.reduce((s, l) => s + l.total, 0);
  const result: Record<string, number> = {};
  if (sum <= 0 || amount <= 0) {
    lines.forEach((l) => (result[l.key] = 0));
    return result;
  }
  const raw = lines.map((l) => ({ key: l.key, exact: (amount * l.total) / sum }));
  let given = 0;
  raw.forEach((r) => {
    result[r.key] = Math.floor(r.exact);
    given += result[r.key];
  });
  raw
    .sort((a, b) => (b.exact % 1) - (a.exact % 1))
    .slice(0, amount - given)
    .forEach((r) => (result[r.key] += 1));
  return result;
}

export function calculatePricing(input: {
  lines: PricingLine[];
  coupon?: CouponRules | null;
  couponContext?: CouponContext;
  shipping?: ShippingRule | null;
  taxRatePercent?: number;
}): PricingResult {
  const { lines, coupon, shipping, taxRatePercent = 0 } = input;
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  let discountTotal = 0;
  let lineDiscounts: Record<string, number> = Object.fromEntries(lines.map((l) => [l.key, 0]));
  let couponState: PricingResult['coupon'] = null;

  if (coupon) {
    const ctx = input.couponContext ?? { now: new Date(), userId: null, usesByCustomer: 0 };
    let error = checkCouponRules(coupon, ctx);
    const eligible = lines.filter((l) => lineEligible(l, coupon));
    const eligibleSubtotal = eligible.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    if (!error && subtotal < coupon.minOrderAmount) error = 'COUPON_MIN_AMOUNT';
    if (!error && eligibleSubtotal === 0) error = 'COUPON_NOT_APPLICABLE';
    if (!error) {
      let d =
        coupon.type === 'PERCENT'
          ? Math.floor((eligibleSubtotal * Math.min(coupon.value, 100)) / 100)
          : coupon.value;
      if (coupon.maxDiscountAmount !== null) d = Math.min(d, coupon.maxDiscountAmount);
      discountTotal = Math.max(0, Math.min(d, eligibleSubtotal));
      lineDiscounts = {
        ...lineDiscounts,
        ...allocate(
          discountTotal,
          eligible.map((l) => ({ key: l.key, total: l.unitPrice * l.quantity })),
        ),
      };
    }
    couponState = { code: coupon.code, applied: !error, error };
  }

  const afterDiscount = subtotal - discountTotal;
  let shippingTotal = 0;
  let freeShippingRemaining: number | null = null;
  if (shipping) {
    const free = shipping.freeFromAmount !== null && afterDiscount >= shipping.freeFromAmount;
    shippingTotal = free || lines.length === 0 ? 0 : shipping.price;
    if (shipping.freeFromAmount !== null && !free)
      freeShippingRemaining = shipping.freeFromAmount - afterDiscount;
  }

  const total = afterDiscount + shippingTotal;
  // Prices include VAT: extract the included tax for receipts/reporting.
  const taxTotal = taxRatePercent > 0 ? Math.round((total * taxRatePercent) / (100 + taxRatePercent)) : 0;

  return {
    subtotal,
    discountTotal,
    shippingTotal,
    taxTotal,
    total,
    lineDiscounts,
    coupon: couponState,
    freeShippingRemaining,
  };
}
