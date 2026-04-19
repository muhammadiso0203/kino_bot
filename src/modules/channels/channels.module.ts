import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelEntity } from '../../entities/channel.entity';
import { ChannelsService } from './channels.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChannelEntity])],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
