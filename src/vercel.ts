import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './main';

/**
 * Punto de entrada para Vercel (función serverless).
 * La app de Nest se crea una sola vez por instancia y se reutiliza entre peticiones.
 */
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let server: Promise<Handler> | undefined;

async function createServer(): Promise<Handler> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  configureApp(app);
  setupSwagger(app);
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  server ??= createServer().catch((err) => {
    server = undefined; // reintentar en la próxima petición
    throw err;
  });
  const app = await server;
  app(req, res);
}
