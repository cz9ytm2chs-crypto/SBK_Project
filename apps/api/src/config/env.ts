import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

// Hosting platforms expose the public URL; use it unless APP_URL/API_URL are set explicitly.
const platformUrl = process.env.RENDER_EXTERNAL_URL;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** "staging" = a production build used for demos: the test payment provider may be enabled. */
  APP_ENV: z.enum(['production', 'staging']).default('production'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /** Public storefront origin (used in emails, redirects, CORS). */
  APP_URL: z.string().url().default(platformUrl ?? 'http://localhost:5173'),
  /** Public API origin (used for payment return/webhook URLs). */
  API_URL: z.string().url().default(platformUrl ?? 'http://localhost:4000'),
  TRUST_PROXY: z.coerce.number().default(0),
  /** Server-side secret for signed links (e.g. guest order access). Must be set in production. */
  APP_SECRET: z.string().min(16).default('dev-only-app-secret-change-me'),
  COOKIE_SECURE: bool,
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  REDIS_URL: z.string().optional(),

  MAIL_TRANSPORT: z.enum(['smtp', 'file']).default('file'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('SILT <hello@silt.store>'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('silt'),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  PAYMENTS_MOCK_ENABLED: bool,
  MOCK_WEBHOOK_SECRET: z.string().default('dev-mock-webhook-secret-change-me'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),

  /** Built storefront to serve with server-side SEO tags (production). */
  WEB_DIST_PATH: z.string().optional(),
  DISABLE_WORKERS: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', z.prettifyError(parsed.error));
  process.exit(1);
}
if (parsed.data.NODE_ENV === 'production' && parsed.data.APP_SECRET.startsWith('dev-only')) {
  console.error('APP_SECRET must be set in production');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
  cookieSecure: parsed.data.COOKIE_SECURE || parsed.data.NODE_ENV === 'production',
  /** The mock provider never runs on a real production shop, whatever the flag says — only locally or on a staging/demo stand. */
  mockPaymentsEnabled:
    parsed.data.PAYMENTS_MOCK_ENABLED && (parsed.data.NODE_ENV !== 'production' || parsed.data.APP_ENV === 'staging'),
};
