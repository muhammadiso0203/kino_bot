import { Markup } from 'telegraf';

/**
 * Admin bosh menyu klaviaturasi
 */
export const adminMainKeyboard = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('🎬 Kinolar', 'admin:movies'),
      Markup.button.callback('📢 Kanallar', 'admin:channels'),
    ],
    [
      Markup.button.callback('📨 Xabar yuborish', 'admin:broadcast'),
      Markup.button.callback('📊 Statistika', 'admin:stats'),
    ],
    [Markup.button.callback('👑 Adminlar', 'admin:admins')],
  ]);

/**
 * Kinolar menyusi
 */
export const moviesMenuKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('➕ Kino qo\'shish', 'movie:add')],
    [Markup.button.callback('🗑️ Kino o\'chirish', 'movie:delete')],
    [Markup.button.callback('📋 Barcha kinolar', 'movie:list')],
    [Markup.button.callback('◀️ Orqaga', 'admin:back')],
  ]);

/**
 * Kanallar menyusi
 */
export const channelsMenuKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('➕ Kanal qo\'shish', 'channel:add')],
    [Markup.button.callback('🗑️ Kanal o\'chirish', 'channel:delete')],
    [Markup.button.callback('📋 Kanallar ro\'yxati', 'channel:list')],
    [Markup.button.callback('◀️ Orqaga', 'admin:back')],
  ]);

/**
 * Adminlar menyusi
 */
export const adminsMenuKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('➕ Admin qo\'shish', 'admin_mgmt:add')],
    [Markup.button.callback('🗑️ Admin o\'chirish', 'admin_mgmt:delete')],
    [Markup.button.callback('📋 Adminlar ro\'yxati', 'admin_mgmt:list')],
    [Markup.button.callback('◀️ Orqaga', 'admin:back')],
  ]);

/**
 * Kanal turi tanlash
 */
export const channelTypeKeyboard = () =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback('🌐 Ommaviy', 'channel_type:public'),
      Markup.button.callback('🔒 Maxfiy', 'channel_type:private'),
    ],
    [Markup.button.callback('📬 So\'rovli', 'channel_type:request')],
    [Markup.button.callback('❌ Bekor qilish', 'cancel')],
  ]);

/**
 * Kanal o'chirish tugmachalari
 */
export const deleteChannelKeyboard = (
  channels: { id: number; title: string }[],
) =>
  Markup.inlineKeyboard([
    ...channels.map((ch) => [
      Markup.button.callback(
        `🗑️ ${ch.title}`,
        `channel:delete:${ch.id}`,
      ),
    ]),
    [Markup.button.callback('◀️ Orqaga', 'admin:channels')],
  ]);

/**
 * Admin o'chirish tugmachalari
 */
export const deleteAdminKeyboard = (
  admins: { telegram_id: number; username: string }[],
) =>
  Markup.inlineKeyboard([
    ...admins.map((a) => [
      Markup.button.callback(
        `🗑️ @${a.username || a.telegram_id}`,
        `admin_mgmt:delete:${a.telegram_id}`,
      ),
    ]),
    [Markup.button.callback('◀️ Orqaga', 'admin:admins')],
  ]);

/**
 * Bekor qilish tugmasi
 */
export const cancelKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.callback('❌ Bekor qilish', 'cancel')],
  ]);

/**
 * Obuna tekshirish tugmasi
 */
export const subscribeCheckKeyboard = (
  channels: { title: string; username?: string; invite_link?: string }[],
) => {
  const urlButtons = channels.map((ch) => {
    const url = ch.invite_link
      ? ch.invite_link
      : ch.username
      ? `https://t.me/${ch.username.replace('@', '')}`
      : 'https://t.me';
    return [{ text: `📢 ${ch.title}`, url, style: 'danger' } as any];
  });

  return Markup.inlineKeyboard([
    ...urlButtons,
    [{ text: '✅ Obunani tekshirish', callback_data: 'check:subscription', style: 'primary' } as any],
  ] as any);
};

