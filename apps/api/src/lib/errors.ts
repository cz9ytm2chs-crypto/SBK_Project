import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Требуется вход в аккаунт') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Недостаточно прав') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Не найдено') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message: string, code = 'CONFLICT', details?: unknown) =>
  new AppError(409, code, message, details);

export function zodDetails(err: z.ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

export const notFoundHandler: RequestHandler = (_req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', 'Маршрут не найден'));

/** Single error format: { error: { code, message, details? } }. Internals never leak. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Проверьте введённые данные', details: zodDetails(err) },
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        error: { code: 'UNIQUE_VIOLATION', message: 'Запись с такими данными уже существует', details: err.meta?.target },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Не найдено' } });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ error: { code: 'IN_USE', message: 'Запись используется и не может быть удалена' } });
      return;
    }
  }
  // body-parser errors
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Слишком большой запрос' } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Некорректный JSON' } });
    return;
  }
  logger.error({ err, url: req.originalUrl, method: req.method }, 'Unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' } });
};
