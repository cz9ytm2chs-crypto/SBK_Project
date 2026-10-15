/** Staff permissions. The API checks these on every admin endpoint. */
export const PERMISSIONS = {
  'dashboard.view': 'Просмотр дашборда',
  'products.read': 'Просмотр товаров',
  'products.write': 'Создание и редактирование товаров',
  'products.delete': 'Удаление товаров',
  'inventory.write': 'Изменение остатков',
  'categories.write': 'Управление категориями и брендами',
  'collections.write': 'Управление коллекциями',
  'orders.read': 'Просмотр заказов',
  'orders.update': 'Обработка заказов',
  'orders.cancel': 'Отмена заказов',
  'orders.refund': 'Возвраты денежных средств',
  'customers.read': 'Просмотр покупателей',
  'customers.manage': 'Блокировка покупателей',
  'discounts.read': 'Просмотр промокодов',
  'discounts.write': 'Управление промокодами',
  'reviews.moderate': 'Модерация отзывов',
  'content.write': 'Управление контентом',
  'settings.read': 'Просмотр настроек',
  'settings.write': 'Изменение настроек',
  'staff.manage': 'Управление сотрудниками и ролями',
  'audit.read': 'Просмотр журнала действий',
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CONTENT_MANAGER'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  CONTENT_MANAGER: 'Контент-менеджер',
};

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  // Everything except managing staff: only a Super Admin can create admins.
  ADMIN: ALL_PERMISSIONS.filter((p) => p !== 'staff.manage'),
  MANAGER: [
    'dashboard.view',
    'products.read',
    'inventory.write',
    'orders.read',
    'orders.update',
    'orders.cancel',
    'customers.read',
    'discounts.read',
    'reviews.moderate',
  ],
  CONTENT_MANAGER: [
    'dashboard.view',
    'products.read',
    'products.write',
    'categories.write',
    'collections.write',
    'content.write',
    'reviews.moderate',
  ],
};

export function hasPermission(perms: readonly string[] | undefined, p: Permission): boolean {
  return !!perms?.includes(p);
}
