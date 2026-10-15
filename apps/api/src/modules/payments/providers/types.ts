import type { PaymentProviderKey } from '@silt/shared';

export type ProviderPaymentStatus = 'PENDING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface CreatePaymentInput {
  paymentId: string; // our Payment.id — sent to the provider as metadata
  orderNumber: string;
  amount: number; // minor units, computed by the server
  currency: string;
  description: string;
  customerEmail: string;
  returnUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface CreatedPayment {
  providerPaymentId: string;
  confirmationUrl: string | null;
  status: ProviderPaymentStatus;
}

export interface ProviderPaymentState {
  status: ProviderPaymentStatus;
  amount: number;
  currency: string;
  failureReason?: string;
}

export interface ProviderWebhookEvent {
  eventId: string;
  type: string;
  providerPaymentId: string | null;
  payload: unknown;
}

export interface WebhookRequest {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
  ip: string | undefined;
}

/**
 * One interface for every payment provider. Checkout only talks to this,
 * so switching providers does not touch order logic.
 */
export interface PaymentProviderAdapter {
  key: PaymentProviderKey;
  displayName: string;
  description: string;
  testMode: boolean;
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  /** Source of truth: asks the provider for the current state. */
  getPayment(providerPaymentId: string): Promise<ProviderPaymentState>;
  /** Verifies authenticity (signature / origin) and extracts the event. Throws on invalid. */
  parseWebhook(req: WebhookRequest): Promise<ProviderWebhookEvent>;
  cancelPayment?(providerPaymentId: string): Promise<void>;
  refund?(providerPaymentId: string, amount: number, idempotencyKey: string): Promise<{ providerRefundId: string; succeeded: boolean }>;
}

export class WebhookVerificationError extends Error {}
