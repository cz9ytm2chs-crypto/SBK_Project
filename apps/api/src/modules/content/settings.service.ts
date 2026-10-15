import type { PublicSettingsDTO } from '@silt/shared';
import { cache, cached } from '../../lib/cache';
import { prisma } from '../../lib/prisma';

export async function getSettings() {
  return cached('settings', 60, async () => {
    const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    return s ?? (await prisma.siteSettings.create({ data: { id: 1 } }));
  });
}

export const invalidateSettings = () => cache.del('settings');

export async function getPublicSettings(): Promise<PublicSettingsDTO> {
  const [s, courier] = await Promise.all([
    getSettings(),
    prisma.deliveryMethod.findFirst({ where: { isActive: true, freeFromAmount: { not: null } }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return {
    storeName: s.storeName,
    logoUrl: s.logoUrl,
    currency: s.currency,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    address: s.address,
    workingHours: s.workingHours,
    socials: (s.socials ?? {}) as Record<string, string>,
    minOrderAmount: s.minOrderAmount,
    freeShippingFrom: courier?.freeFromAmount ?? null,
    seoTitle: s.seoTitle,
    seoDescription: s.seoDescription,
  };
}
