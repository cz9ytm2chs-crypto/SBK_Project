import type { RequestHandler } from 'express';
import { resolveSession } from '../modules/auth/session.service';

export const loadSession: RequestHandler = async (req, res, next) => {
  try {
    await resolveSession(req, res);
    next();
  } catch (err) {
    next(err);
  }
};
