const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
bot.on('chat_join_request', (ctx) => console.log('chat_join_request', ctx.update));
bot.on('chat_member', (ctx) => console.log('chat_member', ctx.update));
bot.on('my_chat_member', (ctx) => console.log('my_chat_member', ctx.update));
bot.on('message', (ctx) => console.log('message', ctx.update));
bot.launch();
