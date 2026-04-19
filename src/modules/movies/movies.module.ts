import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovieEntity } from '../../entities/movie.entity';
import { MoviesService } from './movies.service';

@Module({
  imports: [TypeOrmModule.forFeature([MovieEntity])],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
