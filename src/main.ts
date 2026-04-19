import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Bot polling orqali ishlaydi, HTTP server kerak emas
  // Faqat sog'liqni tekshirish uchun minimal port
  await app.listen(3000);
  console.log('🎬 Kino Bot ishga tushdi!');
}

bootstrap();
