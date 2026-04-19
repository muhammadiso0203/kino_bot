import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AdminEntity } from '../../entities/admin.entity';

@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);
  private readonly superAdminIds: number[];

  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepo: Repository<AdminEntity>,
    private readonly configService: ConfigService,
  ) {
    // .env'dan super admin IDlarini olish
    const idsStr = this.configService.get<string>('ADMIN_IDS', '');
    this.superAdminIds = idsStr
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));

    this.logger.log(`Super adminlar: ${this.superAdminIds.join(', ')}`);
  }

  /**
   * Foydalanuvchi admin ekanini tekshirish
   */
  async isAdmin(telegramId: number): Promise<boolean> {
    // .env'dagi super adminlar
    if (this.superAdminIds.includes(telegramId)) return true;

    // Bazadagi adminlar
    const admin = await this.adminRepo.findOne({
      where: { telegram_id: telegramId },
    });
    return !!admin;
  }

  async isSuperAdmin(telegramId: number): Promise<boolean> {
    return this.superAdminIds.includes(telegramId);
  }

  async addAdmin(
    telegramId: number,
    username: string,
    addedBy: number,
  ): Promise<AdminEntity> {
    if (this.superAdminIds.includes(telegramId)) {
      throw new ConflictException('Bu foydalanuvchi super admin!');
    }

    const existing = await this.adminRepo.findOne({
      where: { telegram_id: telegramId },
    });
    if (existing) {
      throw new ConflictException('Bu foydalanuvchi allaqachon admin!');
    }

    const admin = this.adminRepo.create({
      telegram_id: telegramId,
      username,
      added_by: addedBy,
      is_super: false,
    });

    await this.adminRepo.save(admin);
    this.logger.log(`Yangi admin qo'shildi: ${telegramId}`);
    return admin;
  }

  async removeAdmin(telegramId: number): Promise<void> {
    if (this.superAdminIds.includes(telegramId)) {
      throw new Error('Super adminni o\'chirib bo\'lmaydi!');
    }

    const admin = await this.adminRepo.findOne({
      where: { telegram_id: telegramId },
    });
    if (!admin) {
      throw new NotFoundException('Admin topilmadi!');
    }

    await this.adminRepo.remove(admin);
    this.logger.log(`Admin o'chirildi: ${telegramId}`);
  }

  async getAll(): Promise<AdminEntity[]> {
    return this.adminRepo.find({ order: { created_at: 'DESC' } });
  }

  getSuperAdminIds(): number[] {
    return this.superAdminIds;
  }
}
