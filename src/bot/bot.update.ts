import {
  Update,
  Start,
  On,
  Action,
  InjectBot,
  Ctx,
} from 'nestjs-telegraf';
import { Logger, UseFilters } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { BotService } from './bot.service';
import { UsersService } from '../modules/users/users.service';
import { MoviesService } from '../modules/movies/movies.service';
import { AdminsService } from '../modules/admins/admins.service';
import { ChannelsService } from '../modules/channels/channels.service';
import { ChannelType } from '../entities/channel.entity';
import {
  adminMainKeyboard,
  moviesMenuKeyboard,
  channelsMenuKeyboard,
  adminsMenuKeyboard,
  channelTypeKeyboard,
  deleteChannelKeyboard,
  deleteAdminKeyboard,
  cancelKeyboard,
  subscribeCheckKeyboard,
} from './keyboards/admin.keyboard';


// Sessiya uchun tip
interface SessionData {
  step?: string;
  movieData?: {
    code?: string;
    name?: string;
    description?: string;
  };
  channelData?: {
    type?: ChannelType;
    channel_id?: string;
  };
  newAdminId?: number;
  deleteMovieCode?: string;
  broadcastMessage?: string;
}

interface BotContext extends Context {
  session: SessionData;
}

@Update()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<BotContext>,
    private readonly botService: BotService,
    private readonly usersService: UsersService,
    private readonly moviesService: MoviesService,
    private readonly adminsService: AdminsService,
    private readonly channelsService: ChannelsService,
  ) {}

  // =============================================
  // FOYDALANUVCHI QISMI
  // =============================================

  @Start()
  async onStart(@Ctx() ctx: BotContext) {
    try {
      const user = ctx.from;

      // Foydalanuvchini bazaga saqlash
      await this.usersService.findOrCreate({
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
      });

      // Admin tekshiruvi
      const isAdmin = await this.adminsService.isAdmin(user.id);
      if (isAdmin) {
        await ctx.reply(
          `👋 Xush kelibsiz, Admin ${user.first_name}!\n\nAdmin panelni ochish uchun /admin_update buyrug'ini yuboring.`,
        );
        return;
      }

      // Obuna tekshiruvi
      const { isSubscribed, notSubscribed } =
        await this.botService.checkSubscriptions(user.id);

      if (!isSubscribed) {
        await ctx.reply(
          '⚠️ Botdan foydalanish uchun quyidagi kanallarga obuna bo\'ling:',
          subscribeCheckKeyboard(notSubscribed),
        );
        return;
      }

      ctx.session = {};
      await ctx.reply(
        `🎬 Assalomu alaykum, ${user.first_name}!\n\n🔍 Kino kodini yuboring va men sizga kinoni topib beraman.`,
      );
    } catch (err) {
      this.logger.error('Start xatosi:', err);
      await ctx.reply('❌ Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
    }
  }

  // =============================================
  // ADMIN PANELI
  // =============================================

  @On('text')
  async onText(@Ctx() ctx: BotContext) {
    try {
      const text = (ctx.message as any)?.text;
      if (!text) return;

      // Admin buyruqlari tekshiruvi
      if (text === '/admin_update') {
        return this.openAdminPanel(ctx);
      }

      const isAdmin = await this.adminsService.isAdmin(ctx.from.id);

      // Admin o'z navbatini bajarish
      if (isAdmin && ctx.session?.step) {
        return this.handleAdminStep(ctx, text);
      }

      // Oddiy foydalanuvchi — kanal tekshiruv
      if (!isAdmin) {
        await this.usersService.findOrCreate({
          id: ctx.from.id,
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name,
        });

        const { isSubscribed, notSubscribed } =
          await this.botService.checkSubscriptions(ctx.from.id);

        if (!isSubscribed) {
          await ctx.reply(
            '⚠️ Botdan foydalanish uchun quyidagi kanallarga obuna bo\'ling:',
            subscribeCheckKeyboard(notSubscribed),
          );
          return;
        }
      }

      // Kino qidirish
      await this.searchMovie(ctx, text.trim());
    } catch (err) {
      this.logger.error('Text handler xatosi:', err);
    }
  }

  @On('my_chat_member')
  async onMyChatMember(@Ctx() ctx: BotContext) {
    try {
      const update = (ctx.update as any).my_chat_member;
      if (update.new_chat_member.status === 'kicked') {
        // Foydalanuvchi botni blokladi (yoki o'chirildi)
        await this.usersService.blockUser(update.from.id);
      } else if (update.new_chat_member.status === 'member') {
        // Foydalanuvchi botni blokdan chiqardi
        await this.usersService.findOrCreate({
          id: update.from.id,
          username: update.from.username,
          first_name: update.from.first_name,
          last_name: update.from.last_name,
        });
      }
    } catch (err) {
      this.logger.error('my_chat_member handler xatosi:', err);
    }
  }

  /**
   * Kino qidirish
   */
  private async searchMovie(ctx: BotContext, code: string) {
    try {
      const movie = await this.moviesService.findByCode(code);

      if (!movie) {
        await ctx.reply(
          `❌ <b>"${code}"</b> kodli kino topilmadi.\n\nBoshqa kod kiriting yoki to'g'ri kod ekanligini tekshiring.`,
          { parse_mode: 'HTML' },
        );
        return;
      }

      const caption =
        `🎬 <b>${movie.name}</b>\n` +
        `🔢 Kod: <code>${movie.code}</code>\n` +
        (movie.description ? `📝 ${movie.description}\n` : '') +
        `📥 Yuklanganlar: ${movie.view_count}`;

      await ctx.replyWithVideo(movie.file_id, {
        caption,
        parse_mode: 'HTML',
      });
    } catch (err) {
      this.logger.error('Kino qidirish xatosi:', err);
      await ctx.reply('❌ Xatolik yuz berdi.');
    }
  }

  // =============================================
  // ADMIN PANEL OCHISH
  // =============================================

  private async openAdminPanel(ctx: BotContext) {
    const isAdmin = await this.adminsService.isAdmin(ctx.from.id);
    if (!isAdmin) {
      await ctx.reply('⛔ Siz admin emassiz!');
      return;
    }

    ctx.session = {};
    await ctx.reply('🎛️ <b>Admin Panel</b>\n\nQuyidagi bo\'limlardan birini tanlang:', {
      parse_mode: 'HTML',
      ...adminMainKeyboard(),
    });
  }

  // =============================================
  // ADMIN STEPS (Conversation flow)
  // =============================================

  private async handleAdminStep(ctx: BotContext, text: string) {
    const step = ctx.session.step;

    switch (step) {
      // === KINO QO'SHISH ===
      case 'movie:add:code':
        if (!/^\d+$/.test(text.trim())) {
          await ctx.reply('❌ Kino kodi faqat <b>raqamlardan</b> iborat bo\'lishi kerak!\n\nMasalan: <code>1234</code>\n\nQaytadan kiriting:', { parse_mode: 'HTML' });
          return;
        }
        if (await this.moviesService.checkExists(text.trim())) {
          await ctx.reply(`❌ <b>"${text.trim()}"</b> kodli kino allaqachon mavjud!\n\nBoshqa kod kiriting:`, { parse_mode: 'HTML' });
          return;
        }
        ctx.session.movieData = { code: text.trim() };
        ctx.session.step = 'movie:add:name';
        await ctx.reply('📝 Kino nomini kiriting:');
        break;

      case 'movie:add:name':
        ctx.session.movieData.name = text;
        ctx.session.step = 'movie:add:video';
        await ctx.reply(
          '🎥 Kino video faylini yuboring:',
        );
        break;

      // case 'movie:add:description':
      //   if (text === '/skip') {
      //     await this.saveMovie(ctx, null);
      //   } else {
      //     await this.saveMovie(ctx, text);
      //   }
      //   break;


      // === KINO O'CHIRISH ===
      case 'movie:delete:code':
        if (!/^\d+$/.test(text.trim())) {
          await ctx.reply('❌ Kino kodi faqat <b>raqamlardan</b> iborat bo\'lishi kerak!\n\nMasalan: <code>1234</code>\n\nQaytadan kiriting:', { parse_mode: 'HTML' });
          return;
        }
        await this.deleteMovie(ctx, text.trim());
        break;

      // === KANAL QO'SHISH ===
      case 'channel:add:id':
        await this.handleChannelIdInput(ctx, text);
        break;

      // === ADMIN QO'SHISH ===
      case 'admin:add:id':
        const newId = parseInt(text, 10);
        if (isNaN(newId)) {
          await ctx.reply('❌ Noto\'g\'ri ID. Raqam kiriting:');
          return;
        }
        ctx.session.newAdminId = newId;
        ctx.session.step = 'admin:add:username';
        await ctx.reply('👤 Admin username kiriting (@username yoki -):');
        break;

      case 'admin:add:username':
        await this.addAdmin(
          ctx,
          ctx.session.newAdminId,
          text === '-' ? '' : text.replace('@', ''),
        );
        break;

      // === BROADCAST ===
      case 'broadcast:message':
        ctx.session.broadcastMessage = text;
        ctx.session.step = 'broadcast:confirm';
        await ctx.reply(
          `📨 Quyidagi xabarni ${await this.usersService.getTotalCount()} foydalanuvchiga yuborasizmi?\n\n${text}`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Ha, yuborish', 'broadcast:send'),
              Markup.button.callback('❌ Bekor qilish', 'cancel'),
            ],
          ]),
        );
        break;

      // === ADMIN O'CHIRISH ===
      case 'admin:delete:id':
        const delId = parseInt(text, 10);
        if (isNaN(delId)) {
          await ctx.reply('❌ Noto\'g\'ri ID:');
          return;
        }
        await this.removeAdmin(ctx, delId);
        break;
    }
  }

  // Video qabul qilish (kino qo'shish uchun)
  @On('video')
  async onVideo(@Ctx() ctx: BotContext) {
    const isAdmin = await this.adminsService.isAdmin(ctx.from.id);
    if (!isAdmin) return;

    if (ctx.session?.step === 'movie:add:video') {
      const video = (ctx.message as any)?.video;
      if (!video) return;

      const fileId = video.file_id;

      // file_id ni saqlash uchun vaqtincha sessionga
      ctx.session.movieData = ctx.session.movieData || {};
      (ctx.session.movieData as any).file_id = fileId;

      // Avtomatik tavsif yaratish
      const botUsername = ctx.botInfo?.username || 'bot';
      const { name, code } = ctx.session.movieData;
      const autoDescription = `<b>@${botUsername} – siz izlagan kinolar barchasi bizda</b>`;
      await this.saveMovie(ctx, autoDescription);
    }
  }

  // =============================================
  // INLINE KEYBOARD CALLBACKLAR
  // =============================================

  // --- Obuna tekshiruvi ---
  @Action('check:subscription')
  async onCheckSubscription(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const { isSubscribed, notSubscribed } =
      await this.botService.checkSubscriptions(ctx.from.id);

    if (!isSubscribed) {
      await ctx.editMessageText(
        '⚠️ Siz hali quyidagi kanallarga obuna bo\'lmadingiz:',
        subscribeCheckKeyboard(notSubscribed),
      );
    } else {
      await ctx.editMessageText(
        '✅ Rahmat! Endi kino kodini yuboring va kinoni topib beraman.',
      );
    }
  }

  // --- Admin asosiy menyu ---
  @Action('admin:back')
  async onAdminBack(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = {};
    await ctx.editMessageText(
      '🎛️ <b>Admin Panel</b>\n\nQuyidagi bo\'limlardan birini tanlang:',
      { parse_mode: 'HTML', ...adminMainKeyboard() },
    );
  }

  // --- Kinolar ---
  @Action('admin:movies')
  async onMoviesMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = {};
    await ctx.editMessageText(
      '🎬 <b>Kinolar boshqaruvi</b>\n\nNimani qilmoqchisiz?',
      { parse_mode: 'HTML', ...moviesMenuKeyboard() },
    );
  }

  @Action('movie:add')
  async onMovieAdd(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = { step: 'movie:add:code' };
    await ctx.editMessageText(
      '🔢 Kino kodini kiriting (masalan: 1234):',
      cancelKeyboard(),
    );
  }

  @Action('movie:delete')
  async onMovieDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = { step: 'movie:delete:code' };
    await ctx.editMessageText(
      '🗑️ O\'chirmoqchi bo\'lgan kinoning kodini kiriting:',
      cancelKeyboard(),
    );
  }

  @Action('movie:list')
  async onMovieList(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const [movies, total] = await this.moviesService.getAll(1, 20);

    if (movies.length === 0) {
      await ctx.editMessageText('📭 Kinolar bazasi bo\'sh.', moviesMenuKeyboard());
      return;
    }

    let text = `🎬 <b>Kinolar ro'yxati</b> (jami: ${total})\n\n`;
    movies.forEach((m, i) => {
      text += `${i + 1}. <code>${m.code}</code> — : ${m.name} (📥 Yuklanishlar soni: ${m.view_count})\n`;
    });

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...moviesMenuKeyboard(),
    });
  }

  // --- Kanallar ---
  @Action('admin:channels')
  async onChannelsMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = {};
    await ctx.editMessageText(
      '📢 <b>Kanallar boshqaruvi</b>\n\nNimani qilmoqchisiz?',
      { parse_mode: 'HTML', ...channelsMenuKeyboard() },
    );
  }

  @Action('channel:add')
  async onChannelAdd(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = { step: 'channel:add:type' };
    await ctx.editMessageText(
      '📢 Kanal turini tanlang:',
      channelTypeKeyboard(),
    );
  }

  @Action(/^channel_type:(.+)$/)
  async onChannelType(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const type = ((ctx as any).match as RegExpExecArray)[1] as ChannelType;
    ctx.session.channelData = { type };
    ctx.session.step = 'channel:add:id';
    await ctx.editMessageText(
      '🔗 Kanal ID yoki username kiriting:\n\n' +
        '• Ommaviy kanal: @username yoki -100xxxx\n' +
        '• Maxfiy/So\'rovli kanal: -100xxxx (ID)',
      cancelKeyboard(),
    );
  }

  @Action('channel:list')
  async onChannelList(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const channels = await this.channelsService.getAll();

    if (channels.length === 0) {
      await ctx.editMessageText('📭 Kanallar yo\'q.', channelsMenuKeyboard());
      return;
    }

    let text = `📢 <b>Majburiy kanallar</b> (${channels.length} ta)\n\n`;
    channels.forEach((ch, i) => {
      const typeLabel =
        ch.type === ChannelType.PUBLIC
          ? '🌐'
          : ch.type === ChannelType.PRIVATE
          ? '🔒'
          : '📬';
      text += `${i + 1}. ${typeLabel} ${ch.title}`;
      if (ch.username) text += ` (@${ch.username})`;
      text += `\n   ID: ${ch.channel_id}\n\n`;
    });

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...channelsMenuKeyboard(),
    });
  }

  @Action('channel:delete')
  async onChannelDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const channels = await this.channelsService.getAll();

    if (channels.length === 0) {
      await ctx.editMessageText('📭 O\'chirish uchun kanal yo\'q.', channelsMenuKeyboard());
      return;
    }

    await ctx.editMessageText(
      "🗑️ O'chirmoqchi bo'lgan kanalni tanlang:",
      deleteChannelKeyboard(channels),
    );
  }

  @Action(/^channel:delete:(\d+)$/)
  async onChannelDeleteConfirm(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const id = parseInt(((ctx as any).match as RegExpExecArray)[1], 10);

    try {
      const channel = await this.channelsService.getById(id);
      await this.channelsService.removeChannel(id);
      await ctx.editMessageText(
        `✅ <b>${channel?.title}</b> kanali o'chirildi!`,
        { parse_mode: 'HTML', ...channelsMenuKeyboard() },
      );
    } catch (err: any) {
      await ctx.editMessageText(`❌ Xatolik: ${(err as Error).message}`, channelsMenuKeyboard());
    }
  }

  // --- Broadcast ---
  @Action('admin:broadcast')
  async onBroadcastMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = { step: 'broadcast:message' };
    const total = await this.usersService.getTotalCount();
    await ctx.editMessageText(
      `📨 <b>Ommaviy xabar</b>\n\n👥 Jami foydalanuvchilar: ${total}\n\nYubormoqchi bo'lgan xabaringizni kiriting:\n<i>(HTML formatini ham ishlatishingiz mumkin)</i>`,
      { parse_mode: 'HTML', ...cancelKeyboard() },
    );
  }

  @Action('broadcast:send')
  async onBroadcastSend(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery('⏳ Xabar yuborilmoqda...');
    const message = ctx.session.broadcastMessage;

    if (!message) {
      await ctx.editMessageText('❌ Xabar topilmadi!');
      return;
    }

    await ctx.editMessageText('⏳ Xabar yuborilmoqda, iltimos kuting...');

    ctx.session = {};
    const result = await this.botService.broadcast(message);

    await ctx.editMessageText(
      `📊 <b>Broadcast natijasi:</b>\n\n✅ Muvaffaqiyatli: ${result.success}\n❌ Xato: ${result.failed}`,
      { parse_mode: 'HTML', ...adminMainKeyboard() },
    );
  }

  // --- Statistika ---
  @Action('admin:stats')
  async onStats(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();

    const [totalUsers, totalMovies, activeUsers, blockedUsers, topMovies] =
      await Promise.all([
        this.usersService.getTotalCount(),
        this.moviesService.getTotalCount(),
        this.usersService.getActiveCount(),
        this.usersService.getBlockedCount(),
        this.moviesService.getTopMovies(5),
      ]);

    let text =
      `📊 <b>Statistika</b>\n\n` +
      `👥 Jami foydalanuvchilar: <b>${totalUsers}</b>\n` +
      `🔥 7 kun ichida faol foydalanuvchilar: <b>${activeUsers}</b>\n` +
      `🚫 Botni bloklaganlar: <b>${blockedUsers}</b>\n` +
      `🎬 Jami kinolar: <b>${totalMovies}</b>\n\n`;

    if (topMovies.length > 0) {
      text += `🏆 <b>Top kinolar:</b>\n`;
      topMovies.forEach((m, i) => {
        text += `${i + 1}. ${m.name} (Yuklanganlar: ${m.view_count})\n`;
      });
    }

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...adminMainKeyboard(),
    });
  }

  // --- Adminlar ---
  @Action('admin:admins')
  async onAdminsMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = {};
    await ctx.editMessageText(
      '👑 <b>Adminlar boshqaruvi</b>\n\nNimani qilmoqchisiz?',
      { parse_mode: 'HTML', ...adminsMenuKeyboard() },
    );
  }

  @Action('admin_mgmt:add')
  async onAdminAdd(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const isSuperAdmin = await this.adminsService.isSuperAdmin(ctx.from.id);
    if (!isSuperAdmin) {
      await ctx.answerCbQuery('⛔ Faqat super admin qo\'sha oladi!', { show_alert: true });
      return;
    }
    ctx.session = { step: 'admin:add:id' };
    await ctx.editMessageText(
      '👤 Yangi admin Telegram ID kiriting:',
      cancelKeyboard(),
    );
  }

  @Action('admin_mgmt:list')
  async onAdminList(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const admins = await this.adminsService.getAll();
    const superIds = this.adminsService.getSuperAdminIds();

    let text = `👑 <b>Adminlar ro'yxati</b>\n\n`;

    // Super adminlar
    text += `🔴 <b>Super adminlar:</b>\n`;
    superIds.forEach((id) => {
      text += `• <code>${id}</code>\n`;
    });

    // DB adminlar
    if (admins.length > 0) {
      text += `\n🟡 <b>Qo'shilgan adminlar:</b>\n`;
      admins.forEach((a) => {
        text += `• @${a.username || '—'} | <code>${a.telegram_id}</code>\n`;
      });
    } else {
      text += `\n📭 Qo'shilgan adminlar yo'q.`;
    }

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...adminsMenuKeyboard(),
    });
  }

  @Action('admin_mgmt:delete')
  async onAdminDeleteMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const isSuperAdmin = await this.adminsService.isSuperAdmin(ctx.from.id);
    if (!isSuperAdmin) {
      await ctx.answerCbQuery('⛔ Faqat super admin o\'chira oladi!', { show_alert: true });
      return;
    }

    const admins = await this.adminsService.getAll();
    if (admins.length === 0) {
      await ctx.editMessageText('📭 O\'chirish uchun admin yo\'q.', adminsMenuKeyboard());
      return;
    }

    await ctx.editMessageText(
      '🗑️ O\'chirmoqchi bo\'lgan adminni tanlang:',
      deleteAdminKeyboard(
        admins.map((a) => ({
          telegram_id: Number(a.telegram_id),
          username: a.username,
        })),
      ),
    );
  }

  @Action(/^admin_mgmt:delete:(\d+)$/)
  async onAdminDeleteConfirm(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const telegramId = parseInt(((ctx as any).match as RegExpExecArray)[1], 10);

    try {
      await this.adminsService.removeAdmin(telegramId);
      await ctx.editMessageText(
        `✅ Admin <code>${telegramId}</code> o'chirildi!`,
        { parse_mode: 'HTML', ...adminsMenuKeyboard() },
      );
    } catch (err: any) {
      await ctx.editMessageText(`❌ Xatolik: ${(err as Error).message}`, adminsMenuKeyboard());
    }
  }

  // --- Bekor qilish ---
  @Action('cancel')
  async onCancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery('Bekor qilindi');
    ctx.session = {};
    await ctx.editMessageText(
      '🎛️ <b>Admin Panel</b>\n\nAmal bekor qilindi.',
      { parse_mode: 'HTML', ...adminMainKeyboard() },
    );
  }

  // =============================================
  // YORDAMCHI METODLAR
  // =============================================

  private async saveMovie(ctx: BotContext, description: string | null) {
    const { code, name } = ctx.session.movieData;
    const fileId = (ctx.session.movieData as any).file_id;

    if (!code || !name || !fileId) {
      ctx.session = {};
      await ctx.reply('❌ Xatolik: Ma\'lumotlar to\'liq emas. Qaytadan urinib ko\'ring.', {
        ...adminMainKeyboard(),
      });
      return;
    }

    try {
      const movie = await this.moviesService.create({
        code,
        name,
        file_id: fileId,
        description: description || undefined,
      });

      ctx.session = {};
      await ctx.reply(
        `✅ <b>Kino muvaffaqiyatli qo'shildi!</b>\n\n` +
          `🔢 Kod: <code>${movie.code}</code>\n` +
          `🎬 Nomi: ${movie.name}`,
        { parse_mode: 'HTML', ...adminMainKeyboard() },
      );
    } catch (err: any) {
      ctx.session = {};
      await ctx.reply(`❌ Xatolik: ${(err as Error).message}`, {
        ...adminMainKeyboard(),
      });
    }
  }

  private async deleteMovie(ctx: BotContext, code: string) {
    try {
      await this.moviesService.delete(code);
      ctx.session = {};
      await ctx.reply(
        `✅ <b>"${code}"</b> kodli kino o'chirildi!`,
        { parse_mode: 'HTML', ...moviesMenuKeyboard() },
      );
    } catch (err: any) {
      ctx.session = {};
      await ctx.reply(`❌ ${(err as Error).message}`, {
        ...moviesMenuKeyboard(),
      });
    }
  }

  private async handleChannelIdInput(ctx: BotContext, input: string) {
    try {
      // Kanal ma'lumotlarini tekshirish
      const chatInfo = await this.bot.telegram.getChat(input);
      const channelType = ctx.session.channelData?.type || ChannelType.PUBLIC;

      let inviteLink: string | undefined;

      // Maxfiy kanal uchun invite link olish
      if (
        channelType === ChannelType.PRIVATE ||
        channelType === ChannelType.REQUEST
      ) {
        try {
          inviteLink = await this.bot.telegram.exportChatInviteLink(
            chatInfo.id,
          );
        } catch {
          inviteLink = undefined;
        }
      }

      await this.channelsService.addChannel({
        channel_id: chatInfo.id.toString(),
        title: (chatInfo as any).title || input,
        username: (chatInfo as any).username,
        type: channelType,
        invite_link: inviteLink,
      });

      ctx.session = {};
      await ctx.reply(
        `✅ Kanal qo'shildi!\n\n📢 ${(chatInfo as any).title}\nTuri: ${channelType}`,
        { ...channelsMenuKeyboard() },
      );
    } catch (err: any) {
      await ctx.reply(
        `❌ Kanal topilmadi yoki bot kanal adminsi emas!\n\nXato: ${(err as Error).message}\n\nQaytadan kiriting:`,
        cancelKeyboard(),
      );
    }
  }

  private async addAdmin(
    ctx: BotContext,
    telegramId: number,
    username: string,
  ) {
    try {
      await this.adminsService.addAdmin(telegramId, username, ctx.from.id);
      ctx.session = {};
      await ctx.reply(
        `✅ Admin qo'shildi!\n\n👤 @${username || '—'}\n🆔 <code>${telegramId}</code>`,
        { parse_mode: 'HTML', ...adminsMenuKeyboard() },
      );
    } catch (err: any) {
      ctx.session = {};
      await ctx.reply(`❌ ${(err as Error).message}`, {
        ...adminsMenuKeyboard(),
      });
    }
  }

  private async removeAdmin(ctx: BotContext, telegramId: number) {
    try {
      await this.adminsService.removeAdmin(telegramId);
      ctx.session = {};
      await ctx.reply(
        `✅ Admin <code>${telegramId}</code> o'chirildi!`,
        { parse_mode: 'HTML', ...adminsMenuKeyboard() },
      );
    } catch (err: any) {
      ctx.session = {};
      await ctx.reply(`❌ ${(err as Error).message}`, {
        ...adminsMenuKeyboard(),
      });
    }
  }
}
