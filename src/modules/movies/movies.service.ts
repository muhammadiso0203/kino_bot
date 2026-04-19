import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovieEntity } from '../../entities/movie.entity';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);

  constructor(
    @InjectRepository(MovieEntity)
    private readonly movieRepo: Repository<MovieEntity>,
  ) {}

  /**
   * Kod orqali kino qidirish va ko'rishlar sonini oshirish
   */
  async findByCode(code: string): Promise<MovieEntity | null> {
    const movie = await this.movieRepo.findOne({ where: { code } });
    if (movie) {
      movie.view_count += 1;
      await this.movieRepo.save(movie);
    }
    return movie;
  }

  async checkExists(code: string): Promise<boolean> {
    const exists = await this.movieRepo.findOne({ where: { code } });
    return !!exists;
  }

  async create(data: {
    code: string;
    name: string;
    file_id: string;
    description?: string;
  }): Promise<MovieEntity> {
    const existing = await this.movieRepo.findOne({
      where: { code: data.code },
    });
    if (existing) {
      throw new ConflictException(`Kod "${data.code}" allaqachon mavjud!`);
    }

    const movie = this.movieRepo.create(data);
    await this.movieRepo.save(movie);
    this.logger.log(`Yangi kino qo'shildi: ${data.code} - ${data.name}`);
    return movie;
  }

  async delete(code: string): Promise<void> {
    const movie = await this.movieRepo.findOne({ where: { code } });
    if (!movie) {
      throw new NotFoundException(`Kod "${code}" bo'yicha kino topilmadi!`);
    }
    await this.movieRepo.remove(movie);
    this.logger.log(`Kino o'chirildi: ${code}`);
  }

  async getAll(page = 1, limit = 10): Promise<[MovieEntity[], number]> {
    return this.movieRepo.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getTotalCount(): Promise<number> {
    return this.movieRepo.count();
  }

  async getTopMovies(limit = 5): Promise<MovieEntity[]> {
    return this.movieRepo.find({
      order: { view_count: 'DESC' },
      take: limit,
    });
  }
}
