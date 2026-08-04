import pino from 'pino';
import { env } from './env';

function createLogger() {
  const baseConfig = {
    level: env.LOG_LEVEL || 'info',
    serializers: {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err,
    },
  };

  // Use pino-pretty in development if available
  if (env.NODE_ENV === 'development') {
    try {
      return pino({
        ...baseConfig,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      });
    } catch (_error) {
      console.warn('[logger] pino-pretty not available, falling back to JSON logs');
      return pino(baseConfig);
    }
  }

  return pino(baseConfig);
}

export const logger = createLogger();
