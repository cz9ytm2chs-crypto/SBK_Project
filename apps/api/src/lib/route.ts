import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import type { Permission } from '@silt/shared';
import { AppError, forbidden, unauthorized } from './errors';

export type AuthMode = 'public' | 'user' | 'optional';

interface RouteOptions<B extends z.ZodType, Q extends z.ZodType, P extends z.ZodType> {
  summary: string;
  body?: B;
  query?: Q;
  params?: P;
  /** "user" — must be logged in. Default: public. */
  auth?: AuthMode;
  /** Staff permission required (implies auth: "user"). */
  permission?: Permission;
  status?: number;
}

export interface Ctx<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  req: Request;
  res: Response;
}

interface RegistryEntry {
  method: string;
  path: string;
  tag: string;
  summary: string;
  auth: AuthMode;
  permission?: Permission;
  body?: z.ZodType;
  query?: z.ZodType;
}

/** Collected route metadata — rendered into the OpenAPI document. */
export const routeRegistry: RegistryEntry[] = [];

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export function createRoutes(router: Router, base: string, tag: string) {
  const register =
    (method: Method) =>
    <B extends z.ZodType = z.ZodUnknown, Q extends z.ZodType = z.ZodUnknown, P extends z.ZodType = z.ZodUnknown>(
      path: string,
      opts: RouteOptions<B, Q, P>,
      handler: (ctx: Ctx<z.output<B>, z.output<Q>, z.output<P>>) => unknown,
    ) => {
      const auth: AuthMode = opts.permission ? 'user' : (opts.auth ?? 'public');
      routeRegistry.push({
        method,
        path: `/api/v1${base}${path}`,
        tag,
        summary: opts.summary,
        auth,
        permission: opts.permission,
        body: opts.body,
        query: opts.query,
      });

      router[method](path, async (req: Request, res: Response, next: NextFunction) => {
        try {
          if (auth === 'user' && !req.user) throw unauthorized();
          if (opts.permission && !req.user?.permissions.includes(opts.permission)) throw forbidden();
          const body = opts.body ? opts.body.parse(req.body ?? {}) : req.body;
          const query = opts.query ? opts.query.parse(req.query) : req.query;
          const params = opts.params ? opts.params.parse(req.params) : req.params;
          const result = await handler({ body, query, params, req, res } as Ctx<
            z.output<B>,
            z.output<Q>,
            z.output<P>
          >);
          if (res.headersSent) return;
          if (result === undefined) res.status(opts.status ?? 204).end();
          else res.status(opts.status ?? 200).json(result);
        } catch (err) {
          next(err);
        }
      });
    };

  return {
    get: register('get'),
    post: register('post'),
    put: register('put'),
    patch: register('patch'),
    delete: register('delete'),
  };
}

export const idParams = z.object({ id: z.string().min(1).max(64) });
export const slugParams = z.object({ slug: z.string().min(1).max(160) });

export function assert(condition: unknown, error: AppError): asserts condition {
  if (!condition) throw error;
}
