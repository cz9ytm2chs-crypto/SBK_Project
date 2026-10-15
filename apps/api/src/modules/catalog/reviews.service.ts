import type { ReviewInput, ReviewSummaryDTO } from '@silt/shared';
import { conflict, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

const PAGE_SIZE = 10;

export async function listReviews(slug: string, page: number, userId: string | null): Promise<ReviewSummaryDTO> {
  const product = await prisma.product.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { id: true } });
  if (!product) throw notFound('Товар не найден');
  const where = { productId: product.id, status: 'APPROVED' as const };
  const [items, groups, mine] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
    userId ? prisma.review.findUnique({ where: { productId_userId: { productId: product.id, userId } } }) : null,
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as ReviewSummaryDTO['distribution'];
  let count = 0;
  let sum = 0;
  groups.forEach((g) => {
    distribution[g.rating as 1] = g._count._all;
    count += g._count._all;
    sum += g.rating * g._count._all;
  });
  return {
    average: count ? Math.round((sum / count) * 10) / 10 : 0,
    count,
    distribution,
    canReview: !!userId && !mine,
    items: items.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      fitFeedback: r.fitFeedback,
      author: `${r.user.firstName} ${r.user.lastName.slice(0, 1)}${r.user.lastName ? '.' : ''}`.trim(),
      verifiedPurchase: r.verifiedPurchase,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function createReview(slug: string, userId: string, input: ReviewInput) {
  const product = await prisma.product.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { id: true } });
  if (!product) throw notFound('Товар не найден');
  const existing = await prisma.review.findUnique({ where: { productId_userId: { productId: product.id, userId } } });
  if (existing) throw conflict('Вы уже оставили отзыв на этот товар', 'REVIEW_EXISTS');
  const purchased = await prisma.orderItem.count({
    where: { productId: product.id, order: { userId, status: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } } },
  });
  await prisma.review.create({
    data: {
      productId: product.id,
      userId,
      rating: input.rating,
      title: input.title ?? '',
      body: input.body,
      fitFeedback: input.fitFeedback,
      verifiedPurchase: purchased > 0,
    },
  });
  return { status: 'PENDING', message: 'Спасибо! Отзыв появится после модерации.' };
}

/** Recomputes denormalised rating after moderation. */
export async function refreshProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: 'APPROVED' },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await prisma.product.update({
    where: { id: productId },
    data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, ratingCount: agg._count._all },
  });
}
