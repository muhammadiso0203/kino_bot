import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelEntity, ChannelType } from '../../entities/channel.entity';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channelRepo: Repository<ChannelEntity>,
  ) {}

  async addChannel(data: {
    channel_id: string;
    title: string;
    username?: string;
    type: ChannelType;
    invite_link?: string;
  }): Promise<ChannelEntity> {
    const existing = await this.channelRepo.findOne({
      where: { channel_id: data.channel_id },
    });
    if (existing) {
      throw new ConflictException('Bu kanal allaqachon qo\'shilgan!');
    }

    const channel = this.channelRepo.create(data);
    await this.channelRepo.save(channel);
    this.logger.log(`Kanal qo'shildi: ${data.title}`);
    return channel;
  }

  async removeChannel(id: number): Promise<void> {
    const channel = await this.channelRepo.findOne({ where: { id } });
    if (!channel) {
      throw new NotFoundException('Kanal topilmadi!');
    }
    await this.channelRepo.remove(channel);
    this.logger.log(`Kanal o'chirildi: ${channel.title}`);
  }

  async getAll(): Promise<ChannelEntity[]> {
    return this.channelRepo.find({ order: { created_at: 'DESC' } });
  }

  async getById(id: number): Promise<ChannelEntity | null> {
    return this.channelRepo.findOne({ where: { id } });
  }
}
