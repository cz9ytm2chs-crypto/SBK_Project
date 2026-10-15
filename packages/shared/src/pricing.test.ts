import { describe, expect, it } from 'vitest';
import { allocate, calculatePricing, type CouponRules } from './pricing';

const lines = [
  { key: 'a', productId: 'p1', categoryId: 'tees', unitPrice: 3000_00, quantity: 2 },
  { key: 'b', productId: 'p2', categoryId: 'hoodies', unitPrice: 9000_00, quantity: 1 },
];

const coupon = (over: Partial<CouponRules> = {}): CouponRules => ({
  code: 'TEST',
  type: 'PERCENT',
  value: 10,
  minOrderAmount: 0,
  maxDiscountAmount: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  usageLimit: null,
  usageLimitPerUser: null,
  usedCount: 0,
  productIds: [],
  categoryIds: [],
  allowedUserIds: [],
  ...over,
});

describe('calculatePricing', () => {
  it('sums lines and applies shipping', () => {
    const r = calculatePricing({ lines, shipping: { price: 500_00, freeFromAmount: null } });
    expect(r.subtotal).toBe(15000_00);
    expect(r.shippingTotal).toBe(500_00);
    expect(r.total).toBe(15500_00);
  });

  it('gives free shipping above the threshold', () => {
    const r = calculatePricing({ lines, shipping: { price: 500_00, freeFromAmount: 10000_00 } });
    expect(r.shippingTotal).toBe(0);
    expect(r.freeShippingRemaining).toBeNull();
  });

  it('reports remaining amount for free shipping', () => {
    const r = calculatePricing({
      lines: [lines[0]],
      shipping: { price: 500_00, freeFromAmount: 10000_00 },
    });
    expect(r.freeShippingRemaining).toBe(4000_00);
  });

  it('extracts included VAT', () => {
    const r = calculatePricing({ lines: [{ ...lines[0], quantity: 1, unitPrice: 120_00 }], taxRatePercent: 20 });
    expect(r.taxTotal).toBe(20_00);
  });

  it('is zero for an empty cart', () => {
    const r = calculatePricing({ lines: [], shipping: { price: 500_00, freeFromAmount: null } });
    expect(r.total).toBe(0);
  });
});

describe('coupons in pricing', () => {
  it('applies a percent coupon and allocates it to lines', () => {
    const r = calculatePricing({ lines, coupon: coupon() });
    expect(r.discountTotal).toBe(1500_00);
    expect(r.lineDiscounts.a + r.lineDiscounts.b).toBe(1500_00);
  });

  it('restricts coupon to categories', () => {
    const r = calculatePricing({ lines, coupon: coupon({ categoryIds: ['hoodies'] }) });
    expect(r.discountTotal).toBe(900_00);
    expect(r.lineDiscounts.a).toBe(0);
  });

  it('rejects expired coupon', () => {
    const r = calculatePricing({ lines, coupon: coupon({ endsAt: new Date('2000-01-01') }) });
    expect(r.discountTotal).toBe(0);
    expect(r.coupon?.error).toBe('COUPON_EXPIRED');
  });

  it('never discounts more than the eligible amount', () => {
    const r = calculatePricing({ lines, coupon: coupon({ type: 'FIXED', value: 1_000_000_00 }) });
    expect(r.discountTotal).toBe(15000_00);
    expect(r.total).toBe(0);
  });
});

describe('allocate', () => {
  it('distributes remainder without losing kopecks', () => {
    const r = allocate(100, [
      { key: 'x', total: 1 },
      { key: 'y', total: 1 },
      { key: 'z', total: 1 },
    ]);
    expect(r.x + r.y + r.z).toBe(100);
  });
});
