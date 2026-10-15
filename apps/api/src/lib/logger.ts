import pino from 'pino';

const level = process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info');

export const logger = pino({
  level,
  redact: {
    // Never log credentials, session tokens or payment secrets.
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
    ],
    censor: '[redacted]',
  },
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});
