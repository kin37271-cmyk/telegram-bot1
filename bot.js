const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const db = require('./data/db');
const botManager = require('./services/botManager');

const bot = new Telegraf(config.BOT_TOKEN);

// User state tracker for in-bot dialogs: userId -> { step, botType, botTypeName }
const userStates = new Map();

// Helper to escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Admin check
function isAdmin(userId) {
  return String(userId) === String(config.OWNER_ID);
}

// ==================== DOIMIY PASTKI KLAVIATURA TUGMALARI (REPLY KEYBOARD) ====================

// 1. Asosiy Menyu Tugmalari (Pastdagi doimiy tugmalar)
function getMainMenuKeyboard(userId) {
  const rows = [
    ['🤖 Bot Yaratish'],
    ['📋 Mening Botlarim', '⏳ Tarifim & Qolgan Vaqt'],
    ['💳 Balans & To\'lov', '📞 Aloqa / Yordam']
  ];
  if (isAdmin(userId)) {
    rows.push(['👑 Admin Panel']);
  }
  return Markup.keyboard(rows).resize();
}

// 2. Bot Yo'nalishlari Tugmalari
const botTypesKeyboard = Markup.keyboard([
  ['🌦 Ob-havo Boti', '🕌 Namoz Vaqtlari'],
  ['💵 Valyuta Kurslari', '📱 QR Kod Boti'],
  ['🤖 ChatGPT / AI Boti', '🔤 Tarjimon Boti'],
  ['🎬 Kino Topuvchi', '📢 Kanal & Avto-Post'],
  ['⬅️ Asosiy Menyu']
]).resize();

// 3. Bekor qilish tugmasi
const cancelKeyboard = Markup.keyboard([
  ['❌ Bekor qilish']
]).resize();

// 4. Admin Panel Tugmalari
const adminMenuKeyboard = Markup.keyboard([
  ['📊 Statistika', '👥 Foydalanuvchilar'],
  ['⬅️ Asosiy Menyu']
]).resize();

// Middleware
bot.use(async (ctx, next) => {
  if (ctx.from) {
    db.getOrCreateUser(ctx.from.id, {
      name: ctx.from.first_name || 'Foydalanuvchi',
      username: ctx.from.username || ''
    });
  }
  return next();
});

// ==================== /START BUYRUG'I ====================
// Post tashlanadi, lekin post ichida inline tugma bo'lmaydi.
// Tugmalar faqat pastda (Reply Keyboard) chiqadi!
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  userStates.delete(userId);

  const user = db.getOrCreateUser(userId, { name, username: ctx.from.username || '' });
  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;
  const userBots = db.getBotsByUser(userId);
  const activeCount = userBots.filter(b => b.is_active).length;

  const welcomePost = 
`🌟 <b>Assalomu alaykum, ${escapeHtml(name)}!</b>

🤖 <b>TELEGRAM BOT MAKER (KONSTRUKTOR)GA XUSH KELIBSIZ!</b>

Bu yerda siz hech qanday dasturlashsiz, to'g'ridan-to'g'ri bot ichida o'z <b>shaxsiy Telegram botlaringizni</b> yaratishingiz mumkin.

Barcha yaratilgan botlar bizning serverimizda <b>24/7 avtomatik hostingda</b> uzluksiz ishlaydi!

👤 <b>Sizning profilingiz:</b>
• 🆔 <b>ID:</b> <code>${userId}</code>
• 🏷 <b>Tarifingiz:</b> <b>${tariffObj.name}</b>
• ⏳ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balansingiz:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🤖 <b>Botlaringiz:</b> <b>${userBots.length} ta</b> (${activeCount} ta faol)

<i>Boshlash uchun pastdagi tugmalardan foydalaning 👇</i>`;

  // DIQQAT: Post ichida inline button yo'q! Tugmalar pastki klaviaturada chiqadi!
  await ctx.replyWithHTML(welcomePost, getMainMenuKeyboard(userId));
});

// ==================== BOT YARATISH BO'LIMI ====================
bot.hears('🤖 Bot Yaratish', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const remaining = db.getRemainingTime(userId);
  if (remaining.isExpired && !isAdmin(userId)) {
    return ctx.replyWithHTML(
      `⚠️ <b>Kechirasiz, sizning tarifingiz muddati tugagan!</b>\n\nYangi bot yaratish uchun pastdagi "💳 Balans & To'lov" tugmasi orqali hisobingizni to'ldiring yoki tarifni yangilang.`,
      getMainMenuKeyboard(userId)
    );
  }

  userStates.set(userId, { step: 'choose_bot_type' });

  const text = 
`🤖 <b>Qanday turdagi Bot yaratmoqchisiz?</b>

Pastdagi klaviatura orqali kerakli bot yo'nalishini tanlang:

1. 🌦 <b>Ob-havo Boti</b> — Shaharlar harorati, namlik, shamol va GPS orqali real vaqtdagi ob-havo
2. 🕌 <b>Namoz Vaqtlari Boti</b> — O'zbekiston viloyatlari bo'yicha aniq namoz vaqtlari
3. 💵 <b>Valyuta Kurslari Boti</b> — Markaziy bank kursi (USD, EUR, RUB, KZT) va kalkulyator
4. 📱 <b>QR Kod Boti</b> — Matn, havola yoki telefonni QR-kodga aylantirish
5. 🤖 <b>ChatGPT / AI Boti</b> — Aqlli savol-javob sun'iy intellekt boti
6. 🔤 <b>Tarjimon Boti</b> — O'zbek, Rus va Ingliz tillarida tezkor tarjimon
7. 🎬 <b>Kino Topuvchi Boti</b> — Kod orqali kinolarni topib beruvchi bot
8. 📢 <b>Kanal & Avto-Post Boti</b> — Kanallarga chiroyli postlar joylash boti`;

  await ctx.replyWithHTML(text, botTypesKeyboard);
});

// Bot Turi Tanlanganda
const botTypeMap = {
  '🌦 Ob-havo Boti': { type: 'weather', name: 'Ob-havo Boti' },
  '🕌 Namoz Vaqtlari': { type: 'namoz', name: 'Namoz Vaqtlari Boti' },
  '💵 Valyuta Kurslari': { type: 'currency', name: 'Valyuta Kurslari Boti' },
  '📱 QR Kod Boti': { type: 'qrcode', name: 'QR Kod Boti' },
  '🤖 ChatGPT / AI Boti': { type: 'ai', name: 'ChatGPT / AI Boti' },
  '🔤 Tarjimon Boti': { type: 'translator', name: 'Tarjimon Boti' },
  '🎬 Kino Topuvchi': { type: 'cinema', name: 'Kino Topuvchi Boti' },
  '📢 Kanal & Avto-Post': { type: 'channel', name: 'Kanal & Avto-Post Boti' }
};

Object.keys(botTypeMap).forEach(key => {
  bot.hears(key, async (ctx) => {
    const userId = ctx.from.id;
    const selected = botTypeMap[key];

    userStates.set(userId, { step: 'awaiting_bot_token', botType: selected.type, botTypeName: selected.name });

    const text = 
`🎯 <b>Tanlandi: ${selected.name}</b>

Endi yangi botingizning <b>API TOKEN</b>ini yuboring!

📌 <b>Token olish yo'riqnomasi:</b>
1. Telegramda <b>@BotFather</b> ga kiring.
2. <code>/newbot</code> yozing va botingizga nom bering.
3. BotFather bergan HTTP API tokenni (masalan: <code>1234567890:AAH...</code>) nusxalab, shu yerga xabar sifatida yuboring!

<i>Tokenni yuborishingiz bilan u darhol 24/7 ishga tushadi!</i>`;

    await ctx.replyWithHTML(text, cancelKeyboard);
  });
});

// ==================== MENING BOTLARIM ====================
bot.hears('📋 Mening Botlarim', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const userBots = db.getBotsByUser(userId);

  if (userBots.length === 0) {
    return ctx.replyWithHTML(
      `📋 <b>Sizda hali yaratilgan botlar yo'q.</b>\n\nPastdagi <b>"🤖 Bot Yaratish"</b> tugmasini bosib, 1 daqiqada o'z birinchi botingizni ishga tushiring!`,
      getMainMenuKeyboard(userId)
    );
  }

  let text = `📋 <b>Sizning 24/7 Hostingdagi Botlaringiz (${userBots.length} ta):</b>\n\n`;

  userBots.forEach((b, idx) => {
    const status = b.is_active ? '🟢 Faol (24/7 Online)' : '🔴 To\'xtatilgan';
    text += `${idx + 1}. <b>${escapeHtml(b.botName)}</b>\n`;
    text += `   • Havola: @${b.botUsername}\n`;
    text += `   • Turi: <b>${b.botType.toUpperCase()}</b>\n`;
    text += `   • Holati: ${status}\n\n`;
  });

  text += `<i>Yangi bot qo'shish uchun "🤖 Bot Yaratish" tugmasini bosing.</i>`;

  await ctx.replyWithHTML(text, getMainMenuKeyboard(userId));
});

// ==================== TARIF & QOLGAN VAQT ====================
bot.hears('⏳ Tarifim & Qolgan Vaqt', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const user = db.getUser(userId);
  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;
  const userBots = db.getBotsByUser(userId);

  const text = 
`⏳ <b>Sizning Tarifingiz & Muddat:</b>

• 🏷 <b>Amaldagi tarif:</b> <b>${tariffObj.name}</b>
• ⏱ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balansingiz:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🤖 <b>Botlaringiz:</b> ${userBots.length} ta / limit: ${tariffObj.maxSites} ta

💎 <b>Mavjud Tarif Rejalari:</b>
1. <b>🎁 Bepul Sinov:</b> 3 kun (1 ta bot)
2. <b>🌱 Starter (1 oylik):</b> 15,000 so'm (3 ta bot)
3. <b>⭐ Pro Standart (1 oylik):</b> 25,000 so'm (10 ta bot)
4. <b>💼 Business (3 oylik):</b> 60,000 so'm (25 ta bot)
5. <b>👑 VIP Lifetime (Umrbod):</b> 150,000 so'm (Cheksiz botlar)

<i>Hisobni to'ldirish uchun pastdagi "💳 Balans & To'lov" tugmasini bosing.</i>`;

  await ctx.replyWithHTML(text, getMainMenuKeyboard(userId));
});

// ==================== BALANS VA TO'LOV ====================
bot.hears('💳 Balans & To\'lov', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const text = 
`💳 <b>Hisobni To'ldirish & To'lov</b>

Tarif sotib olish yoki balansni to'ldirish uchun quyidagi kartaga to'lov qiling:

💳 <b>Karta raqam:</b> <code>${config.CARD_NUMBER}</code>
👤 <b>Karta egasi:</b> <b>${config.CARD_HOLDER}</b>

📌 <b>To'lov tartibi:</b>
1. Yuqoridagi kartaga kerakli summani o'tkazing (masalan, 15,000 yoki 25,000 so'm).
2. To'lov chekini skrinshot qilib to'g'ridan-to'g'ri ushbu botga rasm holatida yuboring!
3. Administrator chekni tasdiqlab, balansingiz yoki tarifingizni darhol yangilab beradi.`;

  await ctx.replyWithHTML(text, getMainMenuKeyboard(userId));
});

// ==================== ALOQA VA YORDAM ====================
bot.hears('📞 Aloqa / Yordam', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const text = 
`📞 <b>Qo'llab-quvvatlash va Aloqa</b>

Savollaringiz yoki takliflaringiz bo'lsa, administrator bilan bog'lanishingiz mumkin:

👤 <b>Administrator:</b> @ismoiluzb022
⏰ <b>Ish vaqti:</b> 24/7 Online
🤖 <b>Texnik xizmat:</b> Maker Bot Platformasi`;

  await ctx.replyWithHTML(text, getMainMenuKeyboard(userId));
});

// ==================== ASOSIY MENYUGA QAYTISH / BEKOR QILISH ====================
bot.hears(['⬅️ Asosiy Menyu', '❌ Bekor qilish'], async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);
  await ctx.reply('Bosh menyudasiz. Kerakli bo\'limni tanlang:', getMainMenuKeyboard(userId));
});

// ==================== ADMIN PANEL (REPLY BUTTON) ====================
bot.hears('👑 Admin Panel', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return ctx.reply('Ruxsat yo\'q!');
  userStates.delete(userId);

  const stats = db.getStats();
  const text = 
`👑 <b>ADMIN BOSHQARUV PANELI</b>

📊 <b>Umumiy Statistika:</b>
• 👥 <b>Jami foydalanuvchilar:</b> ${stats.totalUsers} ta
• 🤖 <b>Jami botlar:</b> ${stats.totalBots} ta (${stats.activeBots} faol)

Pastdagi tugmalar orqali boshqaring:`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);
});

bot.hears('📊 Statistika', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;

  const stats = db.getStats();
  const text = 
`📊 <b>Platforma To'liq Statistikasi:</b>
• 👥 Foydalanuvchilar: <b>${stats.totalUsers} ta</b>
• 🤖 Yaratilgan botlar: <b>${stats.totalBots} ta</b> (Faol: ${stats.activeBots} ta)`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);
});

bot.hears('👥 Foydalanuvchilar', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;

  const users = db.getAllUsers().slice(-10).reverse();
  let text = `👥 <b>Oxirgi 10 ta foydalanuvchi:</b>\n\n`;

  users.forEach(u => {
    const userBots = db.getBotsByUser(u.id);
    const rem = db.getRemainingTime(u.id);
    text += `• <b>${escapeHtml(u.name)}</b> (@${u.username || 'yo\'q'})\n  🆔 ID: <code>${u.id}</code> | Balans: ${(u.balance||0).toLocaleString()} so'm\n  Tarif: ${u.tariff} (${rem.text})\n  Botlar: ${userBots.length} ta\n\n`;
  });

  text += `<i>Boshqaruv buyruqlari:\n/addmoney ID SUMMA\n/adddays ID KUN\n/settariff ID TARIF\n/togglebot BOT_ID</i>`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);
});

// Admin buyruqlari
bot.command('addmoney', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const targetId = parts[1];
  const amount = Number(parts[2]);
  if (!targetId || isNaN(amount)) return ctx.reply('Format: /addmoney USER_ID SUMMA');

  const u = db.addBalance(targetId, amount);
  if (u) {
    ctx.reply(`✅ Foydalanuvchi ${targetId} ga ${amount} so'm qo'shildi! Yangi balans: ${u.balance} so'm.`);
    bot.telegram.sendMessage(targetId, `💰 Balansingizga ${amount.toLocaleString()} so'm qo'shildi! Joriy balans: ${u.balance.toLocaleString()} so'm.`).catch(()=>{});
  } else {
    ctx.reply('Foydalanuvchi topilmadi.');
  }
});

bot.command('adddays', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const targetId = parts[1];
  const days = Number(parts[2]);
  if (!targetId || isNaN(days)) return ctx.reply('Format: /adddays USER_ID KUN');

  const u = db.addDays(targetId, days);
  if (u) {
    const rem = db.getRemainingTime(targetId);
    ctx.reply(`✅ Foydalanuvchi ${targetId} ga ${days} kun qo'shildi! Yangi muddat: ${rem.text}.`);
    bot.telegram.sendMessage(targetId, `📅 Obunangizga ${days} kun qo'shildi! Yangi muddat: ${rem.text}.`).catch(()=>{});
  } else {
    ctx.reply('Foydalanuvchi topilmadi.');
  }
});

bot.command('settariff', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const targetId = parts[1];
  const tariff = parts[2];
  if (!targetId || !tariff) return ctx.reply('Format: /settariff USER_ID TARIF');

  const u = db.setTariff(targetId, tariff);
  if (u) {
    const tariffObj = config.TARIFFS[tariff] || { name: tariff };
    ctx.reply(`✅ Foydalanuvchi ${targetId} ga ${tariffObj.name} tarifi biriktirildi!`);
    bot.telegram.sendMessage(targetId, `🎉 Sizga yangi tarif biriktirildi: <b>${tariffObj.name}</b>!`, { parse_mode: 'HTML' }).catch(()=>{});
  } else {
    ctx.reply('Foydalanuvchi topilmadi.');
  }
});

bot.command('togglebot', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const botId = parts[1];
  if (!botId) return ctx.reply('Format: /togglebot BOT_ID');

  const b = db.toggleBotStatus(botId);
  if (b) {
    if (b.is_active) {
      await botManager.startBot(b);
    } else {
      botManager.stopBot(b.id);
    }
    ctx.reply(`✅ Bot ${b.botUsername} holati: ${b.is_active ? 'Faol qilindi 🟢' : 'To\'xtatildi 🔴'}`);
  } else {
    ctx.reply('Bot topilmadi.');
  }
});

// ==================== INCOMING TEXT (TOKEN INPUT) ====================
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = userStates.get(userId);

  if (!state) return;

  // BOT TOKEN KUTISH BOSQICHI
  if (state.step === 'awaiting_bot_token') {
    if (!text.includes(':') || text.length < 35) {
      return ctx.replyWithHTML(
        `❌ <b>Token formati noto'g'ri!</b>\n\n` +
        `Bot tokeni taxminan quyidagicha bo'ladi:\n` +
        `<code>8922811264:AAH_PTU_mS38bMfS8HDryVX8pjdhZXdrrvU</code>\n\n` +
        `Iltimos, @BotFather dan olgan tokenni to'liq yuboring:`,
        cancelKeyboard
      );
    }

    const waitMsg = await ctx.reply('⏳ Token tekshirilmoqda va botingiz ishga tushirilmoqda...');

    const verify = await botManager.verifyToken(text);
    if (!verify.valid) {
      return ctx.replyWithHTML(
        `❌ <b>Token yaroqsiz!</b>\nTelegram xatosi: ${verify.error}\n\nIltimos, to'g'ri tokenni yuboring:`,
        cancelKeyboard
      );
    }

    const existing = db.getAllBots().find(b => b.token === text);
    if (existing) {
      userStates.delete(userId);
      return ctx.reply(`⚠️ Ushbu bot allaqachon tizimda mavjud: @${existing.botUsername}`, getMainMenuKeyboard(userId));
    }

    const newBot = db.createBot({
      userId,
      token: text,
      botType: state.botType,
      botUsername: verify.username,
      botName: verify.firstName
    });

    userStates.delete(userId);

    // Launch bot 24/7 immediately
    await botManager.startBot(newBot);

    try { ctx.deleteMessage(waitMsg.message_id); } catch (e) {}

    const successMsg = 
`🎉 <b>TABRIKLAYMIZ! BOTINGIZ 24/7 ISHGA TUSHDI!</b>

🤖 <b>Bot nomi:</b> ${escapeHtml(verify.firstName)}
🔗 <b>Havola:</b> @${verify.username}
🛠 <b>Yo'nalishi:</b> ${state.botTypeName || state.botType}
⚡ <b>Holati:</b> 24/7 Avto Hostingda Faol 🟢

Hoziroq @${verify.username} ga kirib <b>/start</b> bosib sinab ko'rishingiz mumkin!`;

    return ctx.replyWithHTML(successMsg, getMainMenuKeyboard(userId));
  }
});

// ==================== CHEK QABUL QILISH (PHOTO) ====================
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  const username = ctx.from.username ? `@${ctx.from.username}` : 'Mavjud emas';
  const photo = ctx.message.photo[ctx.message.photo.length - 1];

  await ctx.reply('✅ To\'lov chekingiz qabul qilindi! Administratorga yuborildi, tez orada tekshirib balansingiz yangilanadi.', getMainMenuKeyboard(userId));

  const adminMsg = 
`🔔 <b>YANGI TO'LOV CHEKI KELDI!</b>

👤 <b>Foydalanuvchi:</b> ${escapeHtml(name)} (${username})
🆔 <b>ID:</b> <code>${userId}</code>
📅 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}

<i>Hisobga pul yoki muddat qo'shish uchun:</i>
<code>/addmoney ${userId} 15000</code>
<code>/adddays ${userId} 30</code>
<code>/settariff ${userId} starter</code>`;

  await bot.telegram.sendPhoto(config.OWNER_ID, photo.file_id, {
    caption: adminMsg,
    parse_mode: 'HTML'
  }).catch(e => console.error('Admin xabarida xatolik:', e.message));
});

async function startBot() {
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Telegram Bot ulandi: @${me.username} (${me.first_name})`);

    // Remove old webhook & reset chat menu button to default
    await bot.telegram.deleteWebhook().catch(() => {});
    await bot.telegram.setChatMenuButton({ menu_button: { type: 'default' } }).catch(() => {});

    bot.launch({ dropPendingUpdates: true }).catch(err => {
      console.error('Bot launch xatolik:', err.message);
    });

    console.log('✅ Asosiy Konstruktor Boti pastki Reply Keyboard tugmalari bilan to\'liq ishga tushdi!');
  } catch (err) {
    console.error('Bot ishga tushirishda xatolik:', err.message);
  }
}

module.exports = { bot, startBot };
