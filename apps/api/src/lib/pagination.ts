import type { Paginated } from '@silt/shared';

export const paginate = (page: number, pageSize: number) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

export function paged<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
