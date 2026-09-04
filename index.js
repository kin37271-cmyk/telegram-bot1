const { Telegraf } = require('telegraf');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const config = require('./config');
const db = require('./database/db');
const botManager = require('./core/botManager');

const fs = require('fs');

const logFile = path.join(__dirname, 'data/app.log');
function logToFile(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
  try {
    fs.appendFileSync(logFile, line, 'utf-8');
  } catch (e) {}
}

const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { origLog(...args); logToFile('[INFO]', ...args); };
console.error = (...args) => { origErr(...args); logToFile('[ERROR]', ...args); };

process.on('exit', (code) => {
  logToFile('[EXIT]', `Jarayon to'xtadi, kod: ${code}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection ushlandi:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception ushlandi:', err?.message || err);
});

// Event loopni hech qachon o'chib qolmasligi uchun doimiy yurak urishi (Keep-alive heartbeat)
setInterval(() => {}, 30000);

// Render.com va bulutli hostinglar uchun HTTP server (Port bind)
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>🚀 Maker Bot Konstruktori 24/7 Online ishlamoqda!</h1><p>Status: OK</p>');
}).listen(PORT, () => {
  console.log(`🌐 HTTP Server ishga tushdi (Port: ${PORT}) — Render.com ga to'liq tayyor!`);
});

async function main() {
  console.log('====================================================');
  console.log('🚀 TELEGRAM BOT KONSTRUKTORI (15-IN-1 PLATFORMA)   ');
  console.log('====================================================');

  if (!config.BOT_TOKEN || config.BOT_TOKEN === '7123456789:AAExampleTokenFromBotFather') {
    console.log('⚠️ DIQQAT: .env faylida asosiy bot tokeni (BOT_TOKEN) kiritilmagan!');
    console.log('📌 Iltimos, .env faylini oching va @BotFather dan olgan BOT_TOKEN va OWNER_ID ni yozing.');
    console.log('👉 Misol:');
    console.log('   BOT_TOKEN=123456789:AAHxxxxxxxxxxxxxxxxxxxx');
    console.log('   OWNER_ID=123456789');
    console.log('====================================================');
    console.log('Tizim token kiritilishini kutmoqda...');
    return;
  }

  try {
    const mainBot = new Telegraf(config.BOT_TOKEN);

    // Asosiy bot ma'lumotlarini olish
    const me = await mainBot.telegram.getMe();
    console.log(`🤖 Asosiy Bot ulandi: @${me.username} (${me.first_name})`);

    // Xavfsiz callback query va log middleware
    mainBot.use(async (ctx, next) => {
      if (ctx.callbackQuery) {
        const origAnswer = ctx.answerCbQuery.bind(ctx);
        ctx.answerCbQuery = async (...args) => {
          try {
            return await origAnswer(...args);
          } catch (e) {
            return false;
          }
        };
      }

      // Xavfsiz xabar yuborish (parse_mode Markdown xatosi bo'lsa avtomatik toza matnda yuboradi)
      const origReply = ctx.reply.bind(ctx);
      ctx.reply = async (text, extra = {}) => {
        try {
          return await origReply(text, extra);
        } catch (err) {
          if (err.message && err.message.includes("can't parse entities")) {
            const plain = { ...extra };
            delete plain.parse_mode;
            return await origReply(text.replace(/[*_`\[\]]/g, ''), plain);
          }
          console.error('Xabar yuborishda xatolik:', err.message);
        }
      };

      const u = ctx.from;
      const text = ctx.message?.text || (ctx.callbackQuery ? `Tugma: ${ctx.callbackQuery.data}` : ctx.updateType);
      console.log(`📩 [Xabar] @${u?.username || u?.id} (${u?.first_name}): ${text}`);
      return next();
    });

    // Handlerlarni ulash
    require('./handlers/userHandlers')(mainBot);
    require('./handlers/tariffHandlers')(mainBot);
    require('./handlers/adminHandlers')(mainBot);

    // Xatoliklarni ushlash
    mainBot.catch((err, ctx) => {
      console.error('Asosiy botda xatolik:', err.message);
    });

    // Asosiy botni ishga tushirish (fondagi polling)
    mainBot.launch().catch(err => {
      console.error('Asosiy bot to\'xtatildi yoki xatolik:', err.message);
    });
    console.log('🚀 Asosiy Konstruktor Boti muvaffaqiyatli ishga tushdi!');

    // Bazadagi barcha mijoz botlarini fonda ishga tushirish
    await botManager.startAllActiveBots();

    console.log('✨ Tizim to\'liq ish holatida! Telegram orqali botingizni sinab ko\'rishingiz mumkin.');

    // To'xtatish signallari
    process.once('SIGINT', () => {
      console.log('Tizim to\'xtatilmoqda (SIGINT)...');
      mainBot.stop('SIGINT');
      process.exit(0);
    });
    process.once('SIGTERM', () => {
      console.log('Tizim to\'xtatilmoqda (SIGTERM)...');
      mainBot.stop('SIGTERM');
      process.exit(0);
    });

  } catch (err) {
    console.error('❌ Botni ishga tushirishda xatolik yuz berdi:', err.message);
  }
}

main();
