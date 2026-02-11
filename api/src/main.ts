import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  if (process.env.NODE_ENV === 'production') {
    const clientRoot = join(__dirname, '../web');
    app.useStaticAssets(clientRoot);
    const express = app.getHttpAdapter().getInstance();
    express.get(/.*/, (req: any, res: any) => {
      if (typeof req.path === 'string' && req.path.startsWith('/api')) {
        res.status(404).send('Not Found');
        return;
      }
      res.sendFile(join(clientRoot, 'index.html'));
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
