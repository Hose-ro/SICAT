import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { ensureTareasUploadDir } from './tareas/tareas.storage';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.use(
    '/api/auth',
    (_request: Request, response: Response, next: NextFunction) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Pragma', 'no-cache');
      next();
    },
  );

  const frontendUrl = (
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ).replace(/\/+$/, '');
  app.enableCors({
    origin: frontendUrl,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.setGlobalPrefix('api');
  ensureTareasUploadDir();
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const config = new DocumentBuilder()
    .setTitle('SICAT API')
    .setDescription('Sistema de Control de Asistencias y Tareas')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`SICAT Backend running on port ${port}`);
  console.log(
    `Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}

void bootstrap();
