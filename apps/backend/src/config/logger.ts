import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
});