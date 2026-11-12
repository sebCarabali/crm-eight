import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useStaticAssets(join(process.cwd(), 'public'));
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('Inventario API')
    .setDescription('API REST para manejo de inventario: categorías, productos y movimientos de stock')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`Inventario corriendo en http://localhost:${port}  (API docs: /docs)`);
}

if (require.main === module) {
  bootstrap();
}
