import type {
  AddressDTO,
  OrderDTO,
  OrderStatus,
  Paginated,
  PaymentProviderKey,
  PaymentStatus,
  RoleKey,
  ShipmentStatus,
} from '@silt/shared';

export type ProductStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// ── Dashboard ──
export interface PeriodStats {
  revenue: number;
  orders: number;
  averageOrder: number;
  newCustomers: number;
}
export interface DashboardData {
  current: PeriodStats;
  previous: PeriodStats;
  totalCustomers: number;
  series: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: number }[];
  recentOrders: {
    id: string;
    number: string;
    firstName: string;
    lastName: string;
    total: number;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: string;
  }[];
  lowStock: { id: string; sku: string; available: number; productId: string; name: string }[];
}

// ── Products ──
export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  price: number;
  compareAtPrice: number | null;
  category: string;
  brand: string | null;
  image: string | null;
  stock: number;
  available: number;
  variantCount: number;
  isNew: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  salesCount: number;
  updatedAt: string;
}

export interface RefSize {
  id: string;
  label: string;
  group: string;
  sortOrder: number;
}
export interface RefColor {
  id: string;
  name: string;
  slug: string;
  hex: string;
}
export interface ProductReferences {
  categories: { id: string; name: string; parentId: string | null }[];
  brands: { id: string; name: string }[];
  sizes: RefSize[];
  colors: RefColor[];
  collections: { id: string; name: string }[];
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  material: string;
  care: string;
  fit: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  status: ProductStatus;
  isNew: boolean;
  isBestseller: boolean;
  isFeatured: boolean;
  categoryId: string;
  brandId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  collectionIds: string[];
  variants: { id: string; sku: string; sizeId: string; colorId: string; stock: number; reserved: number; isActive: boolean }[];
  images: { id: string; url: string; storageKey: string | null; alt: string; colorId: string | null; isMain: boolean; sortOrder: number }[];
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  type: 'RESTOCK' | 'ADJUSTMENT' | 'RESERVE' | 'RELEASE' | 'SALE' | 'RETURN';
  quantity: number;
  stockAfter: number;
  reservedAfter: number;
  reason: string;
  createdAt: string;
  variant: { sku: string };
  actor: { email: string } | null;
  order: { number: string } | null;
  orderId: string | null;
}

// ── Orders ──
export interface AdminOrderRow {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  deliveryMethodName: string;
  paymentProvider: PaymentProviderKey;
  _count: { items: number };
}
export interface AdminOrderList extends Paginated<AdminOrderRow> {
  statusCounts: Partial<Record<OrderStatus, number>>;
}

export interface AdminPayment {
  id: string;
  provider: PaymentProviderKey;
  providerPaymentId: string | null;
  status: PaymentStatus;
  amount: number;
  refundedAmount: number;
  failureReason: string | null;
  createdAt: string;
  events: { id: string; type: string; createdAt: string; processedAt: string | null; error: string | null }[];
  refunds: { id: string; amount: number; reason: string; status: 'PENDING' | 'SUCCEEDED' | 'FAILED'; createdAt: string }[];
}

export interface AdminOrder extends OrderDTO {
  customerComment: string | null;
  user: { id: string; email: string; createdAt: string } | null;
  nextStatuses: OrderStatus[];
  history: { id: string; fromStatus: OrderStatus | null; toStatus: OrderStatus; comment: string; createdAt: string; actor: string }[];
  notes: { id: string; body: string; createdAt: string; author: string }[];
  payments: AdminPayment[];
  movements: { id: string; type: string; sku: string; quantity: number; reason: string; createdAt: string }[];
  emails: { id: string; subject: string; status: EmailStatus; attempts: number; lastError: string | null; createdAt: string }[];
}

export type { ShipmentStatus };

// ── Customers ──
export interface CustomerRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  isBlocked: boolean;
  emailVerifiedAt: string | null;
  role: RoleKey | null;
  ordersCount: number;
  totalSpent: number;
}
export interface CustomerDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  isBlocked: boolean;
  emailVerifiedAt: string | null;
  marketingOptIn: boolean;
  role: RoleKey | null;
  addresses: AddressDTO[];
  orders: { id: string; number: string; status: OrderStatus; paymentStatus: PaymentStatus; total: number; createdAt: string }[];
  totalSpent: number;
  paidOrders: number;
}
export interface RoleInfo {
  key: RoleKey;
  name: string;
  description: string;
  permissions: string[];
}
export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  data: unknown;
  ip: string | null;
  createdAt: string;
  actor: { email: string } | null;
}

// ── Catalog ──
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  _count: { products: number; children: number };
}
export interface AdminBrand {
  id: string;
  name: string;
  slug: string;
  description: string;
  _count: { products: number };
}
export interface AdminCollection {
  id: string;
  name: string;
  slug: string;
  description: string;
  season: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  productIds: string[];
}

// ── Content ──
export type BannerPlacement = 'HERO' | 'PROMO' | 'EDITORIAL';
export interface AdminBanner {
  id: string;
  placement: BannerPlacement;
  title: string;
  subtitle: string;
  eyebrow: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  sortOrder: number;
  isActive: boolean;
}
export interface HomeSectionRow {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  isActive: boolean;
  sortOrder: number;
}
export interface ContentPageRow {
  id: string;
  slug: string;
  title: string;
  updatedAt: string;
}
export interface ContentPage extends ContentPageRow {
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
}
export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface AdminReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  verifiedPurchase: boolean;
  createdAt: string;
  product: { name: string; slug: string };
  user: { email: string; firstName: string };
}

// ── Settings ──
export interface StoreSettings {
  storeName: string;
  logoUrl: string | null;
  currency: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  workingHours: string;
  socials: Record<string, string>;
  minOrderAmount: number;
  taxRatePercent: number;
  pricesIncludeTax: boolean;
  enabledPaymentProviders: PaymentProviderKey[];
  emailNotifications: Record<string, boolean>;
  reservationTtlMinutes: number;
  seoTitle: string;
  seoDescription: string;
}
export interface SettingsResponse {
  settings: StoreSettings;
  providers: { key: PaymentProviderKey; name: string; configured: boolean; testMode: boolean }[];
}
export interface DeliveryMethodRow {
  id: string;
  code: string;
  name: string;
  type: 'COURIER' | 'PICKUP' | 'PICKUP_POINT';
  description: string;
  price: number;
  freeFromAmount: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  isActive: boolean;
  sortOrder: number;
  pickupPoints: { id: string; name: string; address: string }[];
}
export type EmailStatus = 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED';
export interface EmailJobRow {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}
