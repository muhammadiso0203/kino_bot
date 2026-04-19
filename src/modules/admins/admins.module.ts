import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AdminEntity } from '../../entities/admin.entity';
import { AdminsService } from './admins.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminEntity]), ConfigModule],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
