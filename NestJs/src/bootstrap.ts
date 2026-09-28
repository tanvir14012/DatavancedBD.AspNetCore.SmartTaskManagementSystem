import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import fastifyCookie from '@fastify/cookie';

export async function createApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 64 * 1024,
      trustProxy: false,
      requestTimeout: 30_000,
      logger: {
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers.set-cookie',
        ],
      },
    }),
    { logger: ['error', 'warn', 'log'] },
  );
  app.enableShutdownHooks();
  const server = app.getHttpAdapter().getInstance();
  const allowedOrigins = new Set(
    process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) ?? [],
  );
  server.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (!origin) return;
    if (!allowedOrigins.has(origin)) {
      await reply.code(403).send({ message: 'Origin is not allowed.' });
      return;
    }
    reply.header('Vary', 'Origin');
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    if (request.method === 'OPTIONS') {
      reply.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS',
      );
      reply.header(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Tenant-ID',
      );
      reply.header('Access-Control-Max-Age', '600');
      await reply.code(204).send();
    }
  });
  await app.register(fastifyCookie);
  return app;
}
