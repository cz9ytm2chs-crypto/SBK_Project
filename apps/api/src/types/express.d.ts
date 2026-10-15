import type { SessionUser } from '@silt/shared';

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionId?: string;
      rawBody?: Buffer;
    }
  }
}

export {};
