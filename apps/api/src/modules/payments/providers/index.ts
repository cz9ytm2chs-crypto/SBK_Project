import type { PaymentProviderKey } from '@silt/shared';
import { badRequest } from '../../../lib/errors';
import { mockProvider } from './mock.provider';
import { stripeProvider } from './stripe.provider';
import type { PaymentProviderAdapter } from './types';
import { yookassaProvider } from './yookassa.provider';

const providers: Record<PaymentProviderKey, PaymentProviderAdapter> = {
  MOCK: mockProvider,
  STRIPE: stripeProvider,
  YOOKASSA: yookassaProvider,
};

export function getProvider(key: PaymentProviderKey) {
  return providers[key];
}

/** Provider that is enabled in settings AND configured on this server. */
export function getUsableProvider(key: PaymentProviderKey, enabled: PaymentProviderKey[]) {
  const p = providers[key];
  if (!enabled.includes(key) || !p.isConfigured())
    throw badRequest('Этот способ оплаты сейчас недоступен', 'PAYMENT_METHOD_UNAVAILABLE');
  return p;
}

export function availableProviders(enabled: PaymentProviderKey[]) {
  return enabled.map((k) => providers[k]).filter((p) => p.isConfigured());
}

export function providerStatus() {
  return Object.values(providers).map((p) => ({ key: p.key, name: p.displayName, configured: p.isConfigured(), testMode: p.testMode }));
}
