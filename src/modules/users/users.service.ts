import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../entities/user.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * Foydalanuvchini topish yoki yaratish (upsert)
   */
  async findOrCreate(telegramUser: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
  }): Promise<UserEntity> {
    let user = await this.userRepo.findOne({
      where: { telegram_id: telegramUser.id },
    });

    if (!user) {
      user = this.userRepo.create({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
      });
      await this.userRepo.save(user);
      this.logger.log(`Yangi foydalanuvchi: ${telegramUser.id}`);
    } else {
      // Faollik vaqtini yangilash
      user.username = telegramUser.username;
      user.first_name = telegramUser.first_name;
      user.last_name = telegramUser.last_name;
      await this.userRepo.save(user);
    }

    return user;
  }

  async findByTelegramId(telegramId: number): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { telegram_id: telegramId } });
  }

  async getTotalCount(): Promise<number> {
    return this.userRepo.count();
  }

  async getActiveCount(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return this.userRepo
      .createQueryBuilder('user')
      .where('user.last_active_at > :date', { date: sevenDaysAgo })
      .getCount();
  }

  async getAllIds(): Promise<number[]> {
    const users = await this.userRepo.find({ select: ['telegram_id'] });
    return users.map((u) => Number(u.telegram_id));
  }

  async blockUser(telegramId: number): Promise<void> {
    await this.userRepo.update(
      { telegram_id: telegramId },
      { is_blocked: true },
    );
  }
}
