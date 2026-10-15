import { describe, expect, it } from 'vitest';
import { canTransition, isConsistent, nextStaffStatuses } from './order-status';
import { ROLE_PERMISSIONS } from './rbac';

describe('order status machine', () => {
  it('only the system can mark an order as paid', () => {
    expect(canTransition('AWAITING_PAYMENT', 'PAID', 'system')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'PAID', 'staff')).toBe(false);
  });

  it('a paid order cannot be cancelled, only refunded', () => {
    expect(canTransition('PAID', 'CANCELLED', 'staff')).toBe(false);
    expect(canTransition('PAID', 'REFUNDED', 'staff')).toBe(true);
  });

  it('final statuses have no transitions', () => {
    expect(nextStaffStatuses('CANCELLED')).toEqual([]);
    expect(nextStaffStatuses('REFUNDED')).toEqual([]);
  });

  it('cannot skip steps', () => {
    expect(canTransition('PAID', 'SHIPPED', 'staff')).toBe(false);
    expect(canTransition('CREATED', 'DELIVERED', 'staff')).toBe(false);
  });

  it('detects contradictory states', () => {
    expect(isConsistent('PAID', 'PENDING')).toBe(false);
    expect(isConsistent('SHIPPED', 'SUCCEEDED')).toBe(true);
    expect(isConsistent('CANCELLED', 'SUCCEEDED')).toBe(false);
  });
});

describe('roles', () => {
  it('only super admin can manage staff', () => {
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain('staff.manage');
    expect(ROLE_PERMISSIONS.ADMIN).not.toContain('staff.manage');
    expect(ROLE_PERMISSIONS.MANAGER).not.toContain('settings.write');
    expect(ROLE_PERMISSIONS.CONTENT_MANAGER).not.toContain('orders.read');
  });
});
