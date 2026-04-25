import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { UsersModule } from './modules/users/users.module';
import { MoviesModule } from './modules/movies/movies.module';
import { AdminsModule } from './modules/admins/admins.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { UserEntity } from './entities/user.entity';
import { MovieEntity } from './entities/movie.entity';
import { AdminEntity } from './entities/admin.entity';
import { ChannelEntity } from './entities/channel.entity';
import { JoinRequestEntity } from './entities/join-request.entity';
import { BotModule } from './bot/bot.module';

@Module({
  imports: [
    // Konfiguratsiya
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // PostgreSQL ulanishi
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME', 'postgres'),
        password: config.get('DB_PASSWORD', 'postgres'),
        database: config.get('DB_NAME', 'kinodb'),
        entities: [UserEntity, MovieEntity, AdminEntity, ChannelEntity, JoinRequestEntity],
        synchronize: true, // Auto-create tables for development
        logging: false,
      }),
    }),

    // Telegraf (Telegram Bot)
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.get<string>('BOT_TOKEN'),
        middlewares: [session()],
        include: [BotModule],
      }),
    }),

    // Modullar
    BotModule,
    UsersModule,
    MoviesModule,
    AdminsModule,
    ChannelsModule,
  ],
})
export class AppModule {}
