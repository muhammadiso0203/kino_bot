import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { BotService } from './bot.service';
import { UsersModule } from '../modules/users/users.module';
import { MoviesModule } from '../modules/movies/movies.module';
import { AdminsModule } from '../modules/admins/admins.module';
import { ChannelsModule } from '../modules/channels/channels.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JoinRequestEntity } from '../entities/join-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([JoinRequestEntity]),
    UsersModule, 
    MoviesModule, 
    AdminsModule, 
    ChannelsModule
  ],
  providers: [BotUpdate, BotService],
  exports: [BotService],
})
export class BotModule {}
