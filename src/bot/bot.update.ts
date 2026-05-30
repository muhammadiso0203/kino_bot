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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JoinRequestEntity } from '../entities/join-request.entity';
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
  moviePaginationKeyboard,
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
    title?: string;
    username?: string;
    invite_link?: string;
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
    @InjectRepository(JoinRequestEntity)
    private readonly joinRequestRepository: Repository<JoinRequestEntity>,
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

  @On('chat_join_request')
  async onChatJoinRequest(@Ctx() ctx: BotContext) {
    try {
      const update = (ctx.update as any).chat_join_request;
      if (!update) return;

      const chatId = update.chat.id.toString();
      const userId = update.from.id.toString();

      // Zayavkani bazaga saqlash, lekin QABUL QILMASLIK
      const exists = await this.joinRequestRepository.findOne({
        where: { user_id: userId, channel_id: chatId },
      });

      if (!exists) {
        try {
          await this.joinRequestRepository.save({
            user_id: userId,
            channel_id: chatId,
          });
        } catch (err: any) {
          if (err.code !== '23505') {
            throw err;
          }
        }
      }

      // Foydalanuvchini bazaga qo'shish/yangilash
      await this.usersService.findOrCreate({
        id: userId,
        username: update.from.username,
        first_name: update.from.first_name,
        last_name: update.from.last_name,
      });
      
    } catch (err) {
      this.logger.error('chat_join_request handler xatosi:', err);
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

      case 'channel:add:title':
        ctx.session.channelData.title = text.trim();
        if (ctx.session.channelData.type === ChannelType.REQUEST) {
          ctx.session.step = 'channel:add:link';
          await ctx.reply(
            `✅ Nom saqlandi: <b>${text.trim()}</b>\n\n🔗 Endi bot orqali kirish uchun shu kanalning zayavka (join request) ssilkasini yuboring:\n(Eslatma: ssilkani o'zingiz yaratib shu yerga tashlang)`,
            { parse_mode: 'HTML', ...cancelKeyboard() },
          );
        } else {
          await this.finalizeChannelAdd(ctx, ctx.session.channelData.invite_link);
        }
        break;

      case 'channel:add:link':
        if (!text.trim().startsWith('http')) {
          await ctx.reply('❌ Noto\'g\'ri ssilka formati. Iltimos, kanal ssilkasini yuboring (http...):', cancelKeyboard());
          return;
        }
        await this.finalizeChannelAdd(ctx, text.trim());
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
      const thumbnailId = video.thumbnail?.file_id;

      // file_id ni saqlash uchun vaqtincha sessionga
      ctx.session.movieData = ctx.session.movieData || {};
      (ctx.session.movieData as any).file_id = fileId;
      (ctx.session.movieData as any).thumbnail_id = thumbnailId;

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
      await this.safeEditMessageText(ctx, 
        '⚠️ Siz hali quyidagi kanallarga obuna bo\'lmadingiz:',
        subscribeCheckKeyboard(notSubscribed),
      );
    } else {
      await this.safeEditMessageText(ctx, 
        '✅ Rahmat! Endi kino kodini yuboring va kinoni topib beraman.',
      );
    }
  }

  // --- Admin asosiy menyu ---
  @Action('admin:back')
  async onAdminBack(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = {};
    await this.safeEditMessageText(ctx, 
      '🎛️ <b>Admin Panel</b>\n\nQuyidagi bo\'limlardan birini tanlang:',
      { parse_mode: 'HTML', ...adminMainKeyboard() },
    );
  }

  // --- Kinolar ---
  @Action('admin:movies')
  async onMoviesMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = {};
    await this.safeEditMessageText(ctx, 
      '🎬 <b>Kinolar boshqaruvi</b>\n\nNimani qilmoqchisiz?',
      { parse_mode: 'HTML', ...moviesMenuKeyboard() },
    );
  }

  @Action('movie:add')
  async onMovieAdd(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = { step: 'movie:add:code' };
    await this.safeEditMessageText(ctx, 
      '🔢 Kino kodini kiriting (masalan: 1234):',
      cancelKeyboard(),
    );
  }

  @Action('movie:delete')
  async onMovieDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = { step: 'movie:delete:code' };
    await this.safeEditMessageText(ctx, 
      '🗑️ O\'chirmoqchi bo\'lgan kinoning kodini kiriting:',
      cancelKeyboard(),
    );
  }

  @Action(/^movie:list:(\d+)$/)
  async onMovieList(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const match = (ctx as any).match;
    const page = parseInt(match[1], 10) || 1;
    const limit = 10;
    const [movies, total] = await this.moviesService.getAll(page, limit);

    if (movies.length === 0 && page === 1) {
      await this.safeEditMessageText(ctx, '📭 Kinolar bazasi bo\'sh.', moviesMenuKeyboard());
      return;
    }

    const totalPages = Math.ceil(total / limit);
    let text = `🎬 <b>Kinolar ro'yxati</b> (Jami: ${total}, Sahifa: ${page}/${totalPages})\n\n`;
    
    movies.forEach((m, i) => {
      const index = (page - 1) * limit + i + 1;
      text += `${index}. <code>${m.code}</code> — : ${m.name} (📥 ${m.view_count})\n`;
    });

    await this.safeEditMessageText(ctx, text, {
      parse_mode: 'HTML',
      ...moviePaginationKeyboard(page, totalPages),
    });
  }

  // --- Kanallar ---
  @Action('admin:channels')
  async onChannelsMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = {};
    await this.safeEditMessageText(ctx, 
      '📢 <b>Kanallar boshqaruvi</b>\n\nNimani qilmoqchisiz?',
      { parse_mode: 'HTML', ...channelsMenuKeyboard() },
    );
  }

  @Action('channel:add')
  async onChannelAdd(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = { step: 'channel:add:type' };
    await this.safeEditMessageText(ctx, 
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
    if (type === ChannelType.BOT) {
      await this.safeEditMessageText(ctx, 
        '🔗 Bot taklif havolasini (referal ssilkasini) kiriting:\n\n' +
          '• Masalan: https://t.me/username_bot?start=ref_code',
        cancelKeyboard(),
      );
    } else {
      await this.safeEditMessageText(ctx, 
        '🔗 Kanal ID yoki username kiriting:\n\n' +
          '• Ommaviy kanal: @username yoki -100xxxx\n' +
          '• Maxfiy/So\'rovli kanal: -100xxxx (ID)',
        cancelKeyboard(),
      );
    }
  }

  @Action('channel:list')
  async onChannelList(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const channels = await this.channelsService.getAll();

    if (channels.length === 0) {
      await this.safeEditMessageText(ctx, '📭 Kanallar yo\'q.', channelsMenuKeyboard());
      return;
    }

    let text = `📢 <b>Majburiy kanallar</b> (${channels.length} ta)\n\n`;
    channels.forEach((ch, i) => {
      const typeLabel =
        ch.type === ChannelType.PUBLIC
          ? '🌐'
          : ch.type === ChannelType.PRIVATE
          ? '🔒'
          : ch.type === ChannelType.REQUEST
          ? '📬'
          : ch.type === ChannelType.BOT
          ? '🤖'
          : '📢';
      text += `${i + 1}. ${typeLabel} ${ch.title}`;
      if (ch.username) text += ` (@${ch.username})`;
      text += `\n   ID: ${ch.channel_id}\n\n`;
    });

    await this.safeEditMessageText(ctx, text, {
      parse_mode: 'HTML',
      ...channelsMenuKeyboard(),
    });
  }

  @Action('channel:delete')
  async onChannelDelete(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    const channels = await this.channelsService.getAll();

    if (channels.length === 0) {
      await this.safeEditMessageText(ctx, '📭 O\'chirish uchun kanal yo\'q.', channelsMenuKeyboard());
      return;
    }

    await this.safeEditMessageText(ctx, 
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
      await this.safeEditMessageText(ctx, 
        `✅ <b>${channel?.title}</b> kanali o'chirildi!`,
        { parse_mode: 'HTML', ...channelsMenuKeyboard() },
      );
    } catch (err: any) {
      await this.safeEditMessageText(ctx, `❌ Xatolik: ${(err as Error).message}`, channelsMenuKeyboard());
    }
  }

  // --- Broadcast ---
  @Action('admin:broadcast')
  async onBroadcastMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = { step: 'broadcast:message' };
    const total = await this.usersService.getTotalCount();
    await this.safeEditMessageText(ctx, 
      `📨 <b>Ommaviy xabar</b>\n\n👥 Jami foydalanuvchilar: ${total}\n\nYubormoqchi bo'lgan xabaringizni kiriting:\n<i>(HTML formatini ham ishlatishingiz mumkin)</i>`,
      { parse_mode: 'HTML', ...cancelKeyboard() },
    );
  }

  @Action('broadcast:send')
  async onBroadcastSend(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery('⏳ Xabar yuborilmoqda...');
    const message = ctx.session.broadcastMessage;

    if (!message) {
      await this.safeEditMessageText(ctx, '❌ Xabar topilmadi!');
      return;
    }

    await this.safeEditMessageText(ctx, '⏳ Xabar yuborilmoqda, iltimos kuting...');

    ctx.session = {};
    const result = await this.botService.broadcast(message);

    await this.safeEditMessageText(ctx, 
      `📊 <b>Broadcast natijasi:</b>\n\n✅ Muvaffaqiyatli: ${result.success}\n❌ Xato: ${result.failed}`,
      { parse_mode: 'HTML', ...adminMainKeyboard() },
    );
  }

  // --- Statistika ---
  @Action('admin:stats')
  async onStats(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();

    const [totalUsers, todayUsers, totalMovies, activeUsers, blockedUsers, topMovies] =
      await Promise.all([
        this.usersService.getTotalCount(),
        this.usersService.getTodayCount(),
        this.moviesService.getTotalCount(),
        this.usersService.getActiveCount(),
        this.usersService.getBlockedCount(),
        this.moviesService.getTopMovies(5),
      ]);

    let text =
      `📊 <b>Statistika</b>\n\n` +
      `👥 Jami foydalanuvchilar: <b>${totalUsers}</b>\n` +
      `✨ Bugun qo'shilganlar: <b>${todayUsers}</b>\n` +
      `🔥 7 kun ichida faol foydalanuvchilar: <b>${activeUsers}</b>\n` +
      `🚫 Botni bloklaganlar: <b>${blockedUsers}</b>\n` +
      `🎬 Jami kinolar: <b>${totalMovies}</b>\n\n`;

    if (topMovies.length > 0) {
      text += `🏆 <b>Top kinolar:</b>\n`;
      topMovies.forEach((m, i) => {
        text += `${i + 1}. ${m.name} (Yuklanganlar: ${m.view_count})\n`;
      });
    }

    await this.safeEditMessageText(ctx, text, {
      parse_mode: 'HTML',
      ...adminMainKeyboard(),
    });
  }

  // --- Adminlar ---
  @Action('admin:admins')
  async onAdminsMenu(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery();
    ctx.session = {};
    await this.safeEditMessageText(ctx, 
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
    await this.safeEditMessageText(ctx, 
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

    await this.safeEditMessageText(ctx, text, {
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
      await this.safeEditMessageText(ctx, '📭 O\'chirish uchun admin yo\'q.', adminsMenuKeyboard());
      return;
    }

    await this.safeEditMessageText(ctx, 
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
      await this.safeEditMessageText(ctx, 
        `✅ Admin <code>${telegramId}</code> o'chirildi!`,
        { parse_mode: 'HTML', ...adminsMenuKeyboard() },
      );
    } catch (err: any) {
      await this.safeEditMessageText(ctx, `❌ Xatolik: ${(err as Error).message}`, adminsMenuKeyboard());
    }
  }

  // --- Bekor qilish ---
  @Action('cancel')
  async onCancel(@Ctx() ctx: BotContext) {
    await ctx.answerCbQuery('Bekor qilindi');
    ctx.session = {};
    await this.safeEditMessageText(ctx, 
      '🎛️ <b>Admin Panel</b>\n\nAmal bekor qilindi.',
      { parse_mode: 'HTML', ...adminMainKeyboard() },
    );
  }

  // =============================================
  // YORDAMCHI METODLAR
  // =============================================


  // =============================================
  // XAVFSIZ EDIT MESSAGE
  // =============================================
  private async safeEditMessageText(ctx: BotContext, text: string, extra?: any) {
    try {
      await ctx.editMessageText(text, extra);
    } catch (e: any) {
      if (!e.message?.includes('message is not modified')) {
        this.logger.error('editMessageText xatosi:', e);
      }
    }
  }

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

      const channelId = process.env.MOVIES_CHANNEL_ID;
      if (channelId) {
        try {
          const caption =
            `🎬 <b>${movie.name}</b>\n\n` +
            `🔢 Kod: <code>${movie.code}</code>\n\n` +
            (movie.description ? `${movie.description}` : '');

          const thumbnailId = (ctx.session.movieData as any).thumbnail_id;

          if (thumbnailId) {
            try {
              // Thumbnail file_id ni to'g'ridan-to'g'ri sendPhoto ga berib bo'lmaydi, URL ni olamiz
              const fileUrl = await this.bot.telegram.getFileLink(thumbnailId);
              await this.bot.telegram.sendPhoto(channelId, { url: fileUrl.toString() }, {
                caption,
                parse_mode: 'HTML',
              });
            } catch (err) {
              // URL olish yoki rasm yuborishda xato bo'lsa, oddiy xabar yuboramiz
              await this.bot.telegram.sendMessage(channelId, caption, {
                parse_mode: 'HTML',
              });
            }
          } else {
            await this.bot.telegram.sendMessage(channelId, caption, {
              parse_mode: 'HTML',
            });
          }
        } catch (e) {
          this.logger.error('Kanalga xabar yuborishda xatolik:', e);
        }
      }

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
      const channelType = ctx.session.channelData?.type || ChannelType.PUBLIC;
      let targetInput = input.trim();
      let inviteLink: string | undefined;

      if (channelType === ChannelType.BOT) {
        // Havoladan bot username'ini ajratib olish
        const regex = /(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{5,32})/i;
        const match = targetInput.match(regex);
        let username = '';
        if (match) {
          username = match[1];
          inviteLink = targetInput;
        } else if (targetInput.startsWith('@')) {
          username = targetInput.replace('@', '');
          inviteLink = `https://t.me/${username}`;
        } else if (/^[a-zA-Z0-9_]{5,32}$/.test(targetInput)) {
          username = targetInput;
          inviteLink = `https://t.me/${username}`;
        } else {
          await ctx.reply('❌ Noto\'g\'ri bot havolasi yoki username. Iltimos bot taklif havolasini yuboring:\n(Masalan: https://t.me/username_bot?start=ref_code)', cancelKeyboard());
          return;
        }
        targetInput = username;
      }

      // Kanal ma'lumotlarini tekshirish
      let chatInfo: any;
      if (channelType === ChannelType.BOT) {
        // Botlarni getChat orqali tekshirish imkonsiz, shuning uchun mock qilamiz
        chatInfo = {
          id: targetInput,
          first_name: targetInput,
          username: targetInput,
        };
      } else {
        // Ommaviy kanallar uchun username bo'lsa va @ bilan boshlanmasa, @ qo'shamiz
        if (!targetInput.startsWith('-') && !targetInput.startsWith('@')) {
          targetInput = `@${targetInput}`;
        }
        chatInfo = await this.bot.telegram.getChat(targetInput);
      }

      if (!ctx.session.channelData) ctx.session.channelData = {};
      ctx.session.channelData.channel_id = chatInfo.id.toString();
      ctx.session.channelData.title = (chatInfo as any).title || (chatInfo as any).first_name || targetInput;
      ctx.session.channelData.username = (chatInfo as any).username;
      ctx.session.channelData.type = channelType;
      if (inviteLink) {
        ctx.session.channelData.invite_link = inviteLink;
      }

      if (channelType === ChannelType.PRIVATE) {
        try {
          inviteLink = await this.bot.telegram.exportChatInviteLink(
            chatInfo.id,
          );
          ctx.session.channelData.invite_link = inviteLink;
        } catch (err) {
          this.logger.error('Invite link olishda xato:', err);
        }
      }

      const isBot = channelType === ChannelType.BOT;
      const typeLabel = isBot ? '🤖' : '📢';
      const nameLabel = isBot ? 'Bot' : 'Kanal';
      const displayName = (chatInfo as any).title || (chatInfo as any).first_name || targetInput;

      ctx.session.step = 'channel:add:title';
      await ctx.reply(
        `✅ ${nameLabel} topildi: ${typeLabel} <b>${displayName}</b>\n\n` +
        `📝 Tugma uchun nom kiriting (hozirgi nomi: <code>${displayName}</code>):`,
        { parse_mode: 'HTML', ...cancelKeyboard() },
      );
    } catch (err: any) {
      const isBot = ctx.session.channelData?.type === ChannelType.BOT;
      const errorMsg = isBot 
        ? '❌ Bot topilmadi! Iltimos, havola to\'g\'riligini tekshiring.'
        : '❌ Kanal topilmadi yoki bot kanal adminsi emas!';
      await ctx.reply(
        `${errorMsg}\n\nXato: ${(err as Error).message}\n\nQaytadan kiriting:`,
        cancelKeyboard(),
      );
    }
  }

  private async finalizeChannelAdd(ctx: BotContext, link?: string) {
    try {
      const data = ctx.session.channelData;
      if (!data || !data.channel_id) {
        ctx.session = {};
        await ctx.reply("❌ Ma'lumot topilmadi, iltimos boshqatdan qo'shing.", { parse_mode: 'HTML', ...adminMainKeyboard() });
        return;
      }
      
      await this.channelsService.addChannel({
        channel_id: data.channel_id,
        title: data.title || 'Kanal',
        username: data.username,
        type: data.type || ChannelType.REQUEST,
        invite_link: link || data.invite_link,
      });

      ctx.session = {};
      await ctx.reply(
        `✅ Kanal muvaffaqiyatli qo'shildi!\n\n📢 ${data.title}\nTuri: ${data.type}`,
        { ...channelsMenuKeyboard() },
      );
    } catch (err: any) {
      ctx.session = {};
      await ctx.reply(
        `❌ Kanal qo'shishda xato: ${(err as Error).message}`,
        { ...channelsMenuKeyboard() },
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
