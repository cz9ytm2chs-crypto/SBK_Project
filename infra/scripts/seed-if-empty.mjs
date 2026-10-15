// Container start-up helper: fills an empty database with demo data (only when SEED_ON_EMPTY=true).
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

if (process.env.SEED_ON_EMPTY !== 'true') process.exit(0);

const prisma = new PrismaClient();
const products = await prisma.product.count();
await prisma.$disconnect();

if (products > 0) {
  console.log(`Database already has ${products} products — skipping demo seed.`);
} else {
  console.log('Empty database — loading demo data…');
  execSync('npx prisma db seed', { stdio: 'inherit' });
}
