import { z } from 'zod';
import { routeRegistry } from './route';

function toJsonSchema(schema: z.ZodType) {
  try {
    return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  } catch {
    return { type: 'object' };
  }
}

/** Builds an OpenAPI 3.1 document from the route registry. */
export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of routeRegistry) {
    const path = r.path.replace(/:(\w+)/g, '{$1}');
    const params = [...r.path.matchAll(/:(\w+)/g)].map((m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    }));
    const queryParams: unknown[] = [];
    if (r.query) {
      const js = toJsonSchema(r.query) as { properties?: Record<string, unknown> };
      for (const [name, schema] of Object.entries(js.properties ?? {}))
        queryParams.push({ name, in: 'query', required: false, schema });
    }
    paths[path] ??= {};
    paths[path][r.method] = {
      tags: [r.tag],
      summary: r.summary,
      description: r.permission ? `Требуется право \`${r.permission}\`` : undefined,
      security: r.auth === 'user' ? [{ session: [] }] : undefined,
      parameters: [...params, ...queryParams],
      requestBody: r.body
        ? { required: true, content: { 'application/json': { schema: toJsonSchema(r.body) } } }
        : undefined,
      responses: {
        200: { description: 'OK' },
        400: { $ref: '#/components/responses/Error' },
        401: { $ref: '#/components/responses/Error' },
        403: { $ref: '#/components/responses/Error' },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'SILT API',
      version: '1.0.0',
      description:
        'REST API магазина SILT. Авторизация — cookie-сессия `silt_sid`. Все изменяющие запросы требуют заголовок `X-CSRF-Token` со значением cookie `silt_csrf`.',
    },
    servers: [{ url: '/' }],
    paths,
    components: {
      securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'silt_sid' } },
      responses: {
        Error: {
          description: 'Ошибка',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: {
                    type: 'object',
                    properties: {
                      code: { type: 'string' },
                      message: { type: 'string' },
                      details: {},
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
