import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env';
import { registerRoutes } from './routes';

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Plugins
  await app.register(cors, {
    origin: [env.FRONTEND_URL],
    credentials: true,
  });

  // Routes
  await registerRoutes(app);

  return app;
}

async function start() {
  const app = await buildApp();
  
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running at http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

export { buildApp };
