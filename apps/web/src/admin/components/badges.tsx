import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  ROLE_LABELS,
  SHIPMENT_STATUS_LABELS,
  type OrderStatus,
  type PaymentStatus,
  type RoleKey,
  type ShipmentStatus,
} from '@silt/shared';
import { Badge } from '@/components/ui/misc';
import type { EmailStatus, ProductStatus, ReviewStatus } from '../types';

type Tone = 'neutral' | 'dark' | 'light' | 'accent' | 'success' | 'warning' | 'danger' | 'outline';

const ORDER_TONES: Record<OrderStatus, Tone> = {
  CREATED: 'outline',
  AWAITING_PAYMENT: 'warning',
  PAID: 'success',
  PROCESSING: 'neutral',
  SHIPPED: 'dark',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  REFUNDED: 'outline',
};
const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  PENDING: 'warning',
  REQUIRES_ACTION: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'outline',
  PARTIALLY_REFUNDED: 'neutral',
  REFUNDED: 'outline',
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <Badge tone={ORDER_TONES[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;

export const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge tone={PAYMENT_TONES[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>
);

export const ShipmentStatusBadge = ({ status }: { status: ShipmentStatus }) => (
  <Badge tone={status === 'DELIVERED' ? 'success' : status === 'RETURNED' ? 'danger' : 'neutral'}>{SHIPMENT_STATUS_LABELS[status]}</Badge>
);

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = { DRAFT: 'Черновик', PUBLISHED: 'Опубликован', ARCHIVED: 'В архиве' };
export const ProductStatusBadge = ({ status }: { status: ProductStatus }) => (
  <Badge tone={status === 'PUBLISHED' ? 'success' : status === 'DRAFT' ? 'warning' : 'outline'}>{PRODUCT_STATUS_LABELS[status]}</Badge>
);

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = { QUEUED: 'В очереди', SENDING: 'Отправляется', SENT: 'Отправлено', FAILED: 'Ошибка' };
export const EmailStatusBadge = ({ status }: { status: EmailStatus }) => (
  <Badge tone={status === 'SENT' ? 'success' : status === 'FAILED' ? 'danger' : 'warning'}>{EMAIL_STATUS_LABELS[status]}</Badge>
);

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = { PENDING: 'На модерации', APPROVED: 'Одобрен', REJECTED: 'Отклонён' };

export const RoleBadge = ({ role }: { role: RoleKey | null }) =>
  role ? <Badge tone="dark">{ROLE_LABELS[role]}</Badge> : <Badge tone="outline">Покупатель</Badge>;

export const ActiveBadge = ({ active }: { active: boolean }) =>
  active ? <Badge tone="success">Активен</Badge> : <Badge tone="outline">Скрыт</Badge>;
