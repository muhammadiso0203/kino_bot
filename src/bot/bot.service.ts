import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';
import { ChannelsService } from '../modules/channels/channels.service';
import { UsersService } from '../modules/users/users.service';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly channelsService: ChannelsService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Foydalanuvchi barcha majburiy kanallarga obuna bo'lganini tekshirish
   */
  async checkSubscriptions(userId: number): Promise<{
    isSubscribed: boolean;
    notSubscribed: any[];
  }> {
    const channels = await this.channelsService.getAll();

    if (channels.length === 0) {
      return { isSubscribed: true, notSubscribed: [] };
    }

    const notSubscribed = [];

    for (const channel of channels) {
      try {
        const member = await this.bot.telegram.getChatMember(
          channel.channel_id,
          userId,
        );

        const validStatuses = ['member', 'administrator', 'creator'];
        if (!validStatuses.includes(member.status)) {
          notSubscribed.push(channel);
        }
      } catch (err: any) {
        this.logger.warn(
          `Kanal tekshirishda xato: ${channel.channel_id} - ${(err as Error).message}`,
        );
        // Agar kanal o'chirilgan bo'lsa, uni tekshirishdan o'tkazib yuboramiz
      }
    }

    return {
      isSubscribed: notSubscribed.length === 0,
      notSubscribed,
    };
  }

  /**
   * Barcha foydalanuvchilarga xabar yuborish (broadcast)
   */
  async broadcast(
    message: string,
    fromCtx?: Context,
  ): Promise<{ success: number; failed: number }> {
    const userIds = await this.usersService.getAllIds();
    let success = 0;
    let failed = 0;

    this.logger.log(`Broadcast boshlandi: ${userIds.length} foydalanuvchi`);

    for (const userId of userIds) {
      try {
        await this.bot.telegram.sendMessage(userId, message, {
          parse_mode: 'HTML',
        });
        success++;
        // Rate limit uchun kichik kutish
        await new Promise((resolve) => setTimeout(resolve, 35));
      } catch (err: any) {
        failed++;
        if ((err as Error).message?.includes('blocked')) {
          await this.usersService.blockUser(userId);
        }
      }
    }

    this.logger.log(`Broadcast tugadi: ${success} muvaffaqiyatli, ${failed} xato`);
    return { success, failed };
  }
}
