import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { Prisma, prisma, type Tx } from '../../lib/prisma';
import { renderEmail, type EmailTemplate, type TemplatePayload } from './templates';

const MAX_ATTEMPTS = 5;
export const MAIL_DIR = path.resolve(process.cwd(), '.mail');

const transport =
  env.MAIL_TRANSPORT === 'smtp'
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      })
    : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });

/** Adds an email to the outbox. Pass `tx` so the email is queued only if the transaction commits. */
export async function enqueueEmail<T extends EmailTemplate>(
  to: string,
  template: T,
  payload: TemplatePayload<T>,
  tx: Tx = prisma,
) {
  const { subject } = renderEmail(template, payload);
  await tx.emailJob.create({
    data: { to, template, subject, payload: payload as unknown as Prisma.InputJsonValue },
  });
}

async function deliver(job: { id: string; to: string; template: string; payload: unknown }) {
  const { subject, html, text } = renderEmail(job.template as EmailTemplate, job.payload as never);
  const info = await transport.sendMail({ from: env.MAIL_FROM, to: job.to, subject, html, text });
  if (env.MAIL_TRANSPORT === 'file' && 'message' in info) {
    await mkdir(MAIL_DIR, { recursive: true });
    const file = path.join(MAIL_DIR, `${Date.now()}-${job.template}-${job.id}.eml`);
    await writeFile(file, info.message as Buffer);
  }
}

/** Sends due emails. Failed sends are retried with exponential backoff. */
export async function processEmailQueue(batch = 20) {
  const jobs = await prisma.emailJob.findMany({
    where: { status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: MAX_ATTEMPTS }, runAfter: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: batch,
  });
  for (const job of jobs) {
    // Claim the job; another worker instance may have taken it already.
    const claimed = await prisma.emailJob.updateMany({
      where: { id: job.id, status: job.status },
      data: { status: 'SENDING', attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      await deliver(job);
      await prisma.emailJob.update({ where: { id: job.id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } });
    } catch (err) {
      const attempts = job.attempts + 1;
      logger.warn({ err, jobId: job.id, attempts }, 'Email send failed');
      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError: String((err as Error).message).slice(0, 500),
          runAfter: new Date(Date.now() + 2 ** attempts * 30_000),
        },
      });
    }
  }
  return jobs.length;
}

/** Manual resend from the admin panel. */
export async function retryEmail(id: string) {
  await prisma.emailJob.update({
    where: { id },
    data: { status: 'QUEUED', attempts: 0, runAfter: new Date(), lastError: null },
  });
}
