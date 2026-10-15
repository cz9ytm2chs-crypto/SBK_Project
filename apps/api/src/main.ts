import { createApp } from './app';
import { env } from './config/env';
import { startJobs } from './jobs';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { providerStatus } from './modules/payments/providers';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`SILT API on ${env.API_URL} (docs: ${env.API_URL}/api/docs)`);
  logger.info({ providers: providerStatus() }, 'Payment providers');
});

const stopJobs = env.DISABLE_WORKERS ? () => undefined : startJobs();

async function shutdown(signal: string) {
  logger.info(`${signal}: shutting down`);
  stopJobs();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
