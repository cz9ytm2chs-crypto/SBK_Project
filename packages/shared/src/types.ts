import type { OrderStatus, PaymentStatus, ShipmentStatus } from './order-status';
import type { Permission, RoleKey } from './rbac';
import type { PaymentProviderKey } from './schemas/checkout';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  emailVerified: boolean;
  marketingOptIn: boolean;
  role: RoleKey | null;
  permissions: Permission[];
}

export interface ImageDTO {
  id: string;
  url: string;
  alt: string;
  colorId: string | null;
  isMain: boolean;
}

export interface ColorDTO {
  id: string;
  name: string;
  slug: string;
  hex: string;
}

export interface SizeDTO {
  id: string;
  label: string;
  group: 'APPAREL' | 'SHOES' | 'ONE_SIZE';
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  productCount?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  children?: CategoryDTO[];
}

export interface BrandDTO {
  id: string;
  name: string;
  slug: string;
}

export interface CollectionDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  season: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  productCount?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface ProductCardDTO {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  category: { slug: string; name: string };
  price: number;
  compareAtPrice: number | null;
  discountPercent: number;
  image: string | null;
  hoverImage: string | null;
  colors: ColorDTO[];
  isNew: boolean;
  isBestseller: boolean;
  inStock: boolean;
  ratingAvg: number;
  ratingCount: number;
}

export interface VariantDTO {
  id: string;
  sku: string;
  sizeId: string;
  colorId: string;
  available: number;
}

export interface ProductDetailDTO extends ProductCardDTO {
  description: string;
  material: string;
  care: string;
  fit: string;
  images: ImageDTO[];
  sizes: SizeDTO[];
  variants: VariantDTO[];
  collections: { slug: string; name: string }[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface FacetsDTO {
  brands: (BrandDTO & { count: number })[];
  sizes: (SizeDTO & { count: number })[];
  colors: (ColorDTO & { count: number })[];
  price: { min: number; max: number };
}

export interface ProductListDTO extends Paginated<ProductCardDTO> {
  facets: FacetsDTO;
}

export interface ReviewDTO {
  id: string;
  rating: number;
  title: string;
  body: string;
  fitFeedback: string | null;
  author: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface ReviewSummaryDTO {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  items: ReviewDTO[];
  canReview: boolean;
}

export interface CartLineDTO {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  brand: string | null;
  image: string | null;
  size: string;
  color: string;
  colorHex: string;
  sku: string;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  available: number;
  lineTotal: number;
  /** Set when stock or price changed since the item was added. */
  issue: 'OUT_OF_STOCK' | 'QUANTITY_REDUCED' | 'UNAVAILABLE' | null;
}

export interface TotalsDTO {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  freeShippingRemaining: number | null;
}

export interface CartDTO {
  id: string;
  items: CartLineDTO[];
  itemCount: number;
  totals: TotalsDTO;
  currency: string;
  minOrderAmount: number;
}

export interface DeliveryMethodDTO {
  code: string;
  name: string;
  type: 'COURIER' | 'PICKUP' | 'PICKUP_POINT';
  description: string;
  price: number;
  freeFromAmount: number | null;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  requiresAddress: boolean;
  pickupPoints: { id: string; name: string; address: string; workingHours: string }[];
}

export interface PaymentMethodDTO {
  provider: PaymentProviderKey;
  name: string;
  description: string;
  testMode: boolean;
}

export interface CheckoutOptionsDTO {
  deliveryMethods: DeliveryMethodDTO[];
  paymentMethods: PaymentMethodDTO[];
}

export interface OrderItemDTO {
  id: string;
  productSlug: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  discount: number;
  lineTotal: number;
  variantId: string | null;
}

export interface OrderDTO {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  deliveryMethodName: string;
  shippingAddress: Record<string, string> | null;
  pickupPointName: string | null;
  currency: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  paymentProvider: PaymentProviderKey;
  reservationExpiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  items: OrderItemDTO[];
  shipment: {
    status: ShipmentStatus;
    carrier: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
  statusHistory: { toStatus: OrderStatus; comment: string; createdAt: string }[];
  canPay: boolean;
}

export interface OrderSummaryDTO {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  images: string[];
}

export interface PlaceOrderResultDTO {
  orderId: string;
  number: string;
  /** Redirect target: the provider's hosted payment page. */
  paymentUrl: string | null;
  /** Token that lets a guest view this order's status page. */
  accessToken: string;
}

export interface AddressDTO {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  region: string;
  city: string;
  street: string;
  house: string;
  apartment: string;
  postalCode: string;
  isDefault: boolean;
}

export interface BannerDTO {
  id: string;
  placement: 'HERO' | 'PROMO' | 'EDITORIAL';
  title: string;
  subtitle: string;
  eyebrow: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface HomeSectionDTO {
  key: string;
  title: string;
  subtitle: string;
  config: Record<string, unknown>;
}

export interface HomeDTO {
  sections: HomeSectionDTO[];
  banners: BannerDTO[];
  newArrivals: ProductCardDTO[];
  bestsellers: ProductCardDTO[];
  categories: CategoryDTO[];
  collections: CollectionDTO[];
  onSale: ProductCardDTO[];
}

export interface PublicSettingsDTO {
  storeName: string;
  logoUrl: string | null;
  currency: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  workingHours: string;
  socials: Record<string, string>;
  minOrderAmount: number;
  freeShippingFrom: number | null;
  seoTitle: string;
  seoDescription: string;
}

export interface SearchSuggestDTO {
  products: { slug: string; name: string; image: string | null; price: number }[];
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
  queries: string[];
}
