const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const db = require('./data/db');
const botManager = require('./services/botManager');
const mediaDownloader = require('./services/mediaDownloader');

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

// ==================== DOIMIY PASTKI KLAVIATURA TUGMALARI (REPLY KEYBOARD) ====================

// 1. Asosiy Menyu Tugmalari (Pastdagi doimiy tugmalar)
function getMainMenuKeyboard(userId) {
  const rows = [
    ['🤖 Bot Yaratish'],
    ['📋 Mening Botlarim', '🌐 Web App'],
    ['👤 Mening Profilim', '⏳ Tarifim & Qolgan Vaqt'],
    ['💎 Tariflar & VIP Ma\'lumot', '💳 Balans & To\'lov'],
    ['📞 Aloqa / Yordam']
  ];
  if (isAdmin(userId)) {
    rows.push(['👑 Admin Panel']);
  }
  return Markup.keyboard(rows).resize();
}

// 2. 16 xil Bot Yo'nalishlari Tugmalari (Reply Keyboard)
const botTypesKeyboard = Markup.keyboard([
  ['📥 Video / Instagram Yuklovchi', '🌦 Ob-havo Boti'],
  ['🕌 Namoz Vaqtlari', '💵 Valyuta Kurslari'],
  ['📱 QR Kod Boti', '🤖 ChatGPT / AI Boti'],
  ['🔤 Tarjimon Boti', '🎬 Kino Topuvchi'],
  ['📢 Kanal & Avto-Post', '🎭 Anonim Chat Boti'],
  ['🎵 Musiqa Qidiruvchi', '🔮 Munajjimlar'],
  ['🧠 Viktorina & Test', '📝 Bloknot & Qaydlar'],
  ['🧮 Aqlli Kalkulyator', '📨 Taklif & Murojaat'],
  ['⬅️ Asosiy Menyu']
]).resize();

// 3. Bekor qilish tugmasi
const cancelKeyboard = Markup.keyboard([
  ['❌ Bekor qilish']
]).resize();

// 4. Profil tugmalari (Telefon raqamni ulashish)
const profileKeyboard = Markup.keyboard([
  [Markup.button.contactRequest('📱 Telefon Raqamni Ulashish')],
  ['⬅️ Asosiy Menyu']
]).resize();

// 5. Admin Panel Tugmalari
const adminMenuKeyboard = Markup.keyboard([
  ['📊 Statistika & Faollik', '👥 Foydalanuvchilar'],
  ['🏆 Mijozlar Reytingi', '📢 Hammaga Xabar Yuborish'],
  ['⚙️ Tariflarni Boshqarish', '⬅️ Asosiy Menyu']
]).resize();

// Middleware (Profil rasmi va ma'lumotlarni saqlash)
bot.use(async (ctx, next) => {
  if (ctx.from) {
    let photoUrl = '';
    try {
      const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
      if (photos && photos.total_count > 0 && photos.photos[0] && photos.photos[0].length > 0) {
        const fileId = photos.photos[0][0].file_id;
        const link = await ctx.telegram.getFileLink(fileId);
        photoUrl = link.href;
      }
    } catch (e) {}

    const u = db.getOrCreateUser(ctx.from.id, {
      name: ctx.from.first_name || 'Foydalanuvchi',
      username: ctx.from.username || '',
      photo_url: photoUrl
    });

    if (u && u.is_blocked && !isAdmin(ctx.from.id)) {
      if (ctx.callbackQuery) {
        return ctx.answerCbQuery('🚫 Sizning hisobingiz ma\'muriyat tomonidan bloklangan!', { show_alert: true });
      }
      return ctx.replyWithHTML('🚫 <b>Sizning profilingiz ma\'muriyat tomonidan bloklangan!</b>\n\nAgar bu xatolik bo\'lsa, administrator bilan bog\'laning: @ISMOILUZB022');
    }
  }
  return next();
});

// ==================== /START BUYRUG'I ====================
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  userStates.delete(userId);

  let photoUrl = '';
  try {
    const photos = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
    if (photos && photos.total_count > 0 && photos.photos[0] && photos.photos[0].length > 0) {
      const fileId = photos.photos[0][0].file_id;
      const link = await ctx.telegram.getFileLink(fileId);
      photoUrl = link.href;
    }
  } catch (e) {}

  const user = db.getOrCreateUser(userId, { name, username: ctx.from.username || '', photo_url: photoUrl });
  const remaining = db.getRemainingTime(userId);
  const tariffObj = db.getTariff(user.tariff);
  const userBots = db.getBotsByUser(userId);
  const activeCount = userBots.filter(b => b.is_active).length;
  const detailedUsers = db.getAllUsersDetailed();
  const detailed = detailedUsers.find(u => String(u.id) === String(userId)) || {};

  const welcomePost = 
`🌟 <b>Assalomu alaykum, ${escapeHtml(name)}!</b>

🤖 <b>MAKER BOT PLATFORMASI (15-IN-1 BOT KONSTRUKTOR)</b>

Bu yerda siz hech qanday dasturlashsiz, to'g'ridan-to'g'ri o'z <b>shaxsiy Telegram botlaringizni</b> 1 daqiqada yaratishingiz mumkin!
Barcha botlar bizning serverimizda <b>24/7 avtomatik hostingda</b> uzluksiz ishlaydi.

👤 <b>Sizning profilingiz:</b>
• 🆔 <b>ID:</b> <code>${userId}</code>
• 📱 <b>Telefon:</b> <b>${user.phone || 'Kiritilmagan'}</b>
• 🏷 <b>Tarifingiz:</b> <b>${tariffObj.name}</b>
• ⏳ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balansingiz:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🏆 <b>Reytingdagi o'rningiz:</b> <b>#${detailed.rank || '1'}</b> (${detailed.activity_label || '🌱 Yangi Mijoz'})
• 🤖 <b>Botlaringiz:</b> <b>${userBots.length} ta</b> (${activeCount} ta faol)

🌐 <i>Web App va Telegram bot bitta yagona ma'lumotlar bazasida ishlaydi!</i>

<i>Boshlash uchun pastdagi tugmalardan foydalaning 👇</i>`;

  await ctx.replyWithHTML(welcomePost, getMainMenuKeyboard(userId));
});

// ==================== 15 TA BOT YARATISH BO'LIMI ====================
bot.hears('🤖 Bot Yaratish', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const user = db.getUser(userId) || {};
  const remaining = db.getRemainingTime(userId);
  if (remaining.isExpired && !isAdmin(userId)) {
    return ctx.replyWithHTML(
      `⚠️ <b>Kechirasiz, sizning tarifingiz muddati tugagan!</b>\n\nYangi bot yaratish uchun pastdagi "💎 Tariflar & VIP Ma'lumot" yoki "💳 Balans & To'lov" tugmasi orqali hisobingizni to'ldiring yoki tarifni yangilang.`,
      getMainMenuKeyboard(userId)
    );
  }

  const tariffObj = db.getTariff(user.tariff);
  const userBots = db.getBotsByUser(userId);
  const maxBots = tariffObj.maxBots || 1;

  // Oddiy mijozlar uchun limit tekshiruvi
  if (userBots.length >= maxBots && !isAdmin(userId)) {
    const allTariffs = db.getTariffs();
    let promoText = '';
    Object.values(allTariffs).filter(t => t.price > 0).forEach(t => {
      promoText += `• <b>${t.name}:</b> ${t.maxBots >= 999 ? 'Cheksiz' : t.maxBots + ' ta bot'} (${t.price.toLocaleString()} so'm / ${t.days} kun)\n`;
    });

    return ctx.replyWithHTML(
      `⚠️ <b>Kechirasiz, sizning bot yaratish limitingiz to'lgan!</b>\n\n` +
      `• Sizning tarifingiz: <b>${tariffObj.name}</b>\n` +
      `• Ruxsat etilgan botlar: <b>${maxBots} ta</b>\n` +
      `• Yaratilgan botlaringiz: <b>${userBots.length} ta</b>\n\n` +
      `Ko'proq bot yaratish uchun tarifni yangilang:\n\n` +
      promoText + `\n` +
      `<i>Barcha ma'lumotlar va tarifni faollashtirish uchun pastdagi "💎 Tariflar & VIP Ma'lumot" tugmasini bosing!</i>`,
      getMainMenuKeyboard(userId)
    );
  }

  userStates.set(userId, { step: 'choose_bot_type' });

  const text = 
`🤖 <b>Qanday turdagi Bot yaratmoqchisiz? (Jami 16 xil Bot):</b>

📊 Sizning botlaringiz: <b>${userBots.length}/${maxBots} ta</b> (${tariffObj.name})

1. 📥 <b>Video / Instagram Yuklovchi</b> — Instagram Reels, TikTok, YouTube Shorts yuklovchi bot
2. 🌦 <b>Ob-havo Boti</b> — Real vaqtdagi harorat, shamol va GPS ob-havo
3. 🕌 <b>Namoz Vaqtlari Boti</b> — O'zbekiston viloyatlari bo'yicha aniq namoz vaqtlari
4. 💵 <b>Valyuta Kurslari Boti</b> — Markaziy bank kursi (USD, EUR, RUB) va kalkulyator
5. 📱 <b>QR Kod Boti</b> — Matn, havola yoki telefonni QR-kodga aylantirish
6. 🤖 <b>ChatGPT / AI Boti</b> — Aqlli savol-javob sun'iy intellekt boti
7. 🔤 <b>Tarjimon Boti</b> — O'zbek, Rus va Ingliz tillarida tezkor tarjimon
8. 🎬 <b>Kino Topuvchi Boti</b> — Kod orqali kinolarni topib beruvchi bot
9. 📢 <b>Kanal & Avto-Post Boti</b> — Kanallarga chiroyli postlar joylash boti
10. 🎭 <b>Anonim Chat Boti</b> — Tasodifiy begona bilan suhbat va maxfiy xabarlar
11. 🎵 <b>Musiqa Qidiruvchi</b> — Nomi va ijrochi bo'yicha 320kbps musiqa topish
12. 🔮 <b>Munajjimlar Bashorati</b> — 12 burj uchun kunlik to'liq bashorat
13. 🧠 <b>Viktorina & Test Boti</b> — Intellektual savollar va ball yig'ish o'yini
14. 📝 <b>Bloknot & Qaydlar Boti</b> — Shaxsiy rejalar va eslatmalar daftari
15. 🧮 <b>Aqlli Kalkulyator Boti</b> — Matematik amallar, kredit va foiz hisoblash
16. 📨 <b>Taklif & Murojaat Boti</b> — Mijozlar murojaatlarini qabul qilish boti

<i>Kerakli bot yo'nalishini pastdagi klaviaturadan tanlang 👇</i>`;

  await ctx.replyWithHTML(text, botTypesKeyboard);
});

// Bot Turi Tanlanganda (16 ta bot)
const botTypeMap = {
  '📥 Video / Instagram Yuklovchi': { type: 'downloader', name: 'Instagram & Video Yuklovchi Bot' },
  '🌦 Ob-havo Boti': { type: 'weather', name: 'Ob-havo Boti' },
  '🕌 Namoz Vaqtlari': { type: 'namoz', name: 'Namoz Vaqtlari Boti' },
  '💵 Valyuta Kurslari': { type: 'currency', name: 'Valyuta Kurslari Boti' },
  '📱 QR Kod Boti': { type: 'qrcode', name: 'QR Kod Boti' },
  '🤖 ChatGPT / AI Boti': { type: 'ai', name: 'ChatGPT / AI Boti' },
  '🔤 Tarjimon Boti': { type: 'translator', name: 'Tarjimon Boti' },
  '🎬 Kino Topuvchi': { type: 'cinema', name: 'Kino Topuvchi Boti' },
  '📢 Kanal & Avto-Post': { type: 'channel', name: 'Kanal & Avto-Post Boti' },
  '🎭 Anonim Chat Boti': { type: 'anonymous', name: 'Anonim Chat Boti' },
  '🎵 Musiqa Qidiruvchi': { type: 'music', name: 'Musiqa Qidiruvchi Bot' },
  '🔮 Munajjimlar': { type: 'horoscope', name: 'Munajjimlar Bashorati Boti' },
  '🧠 Viktorina & Test': { type: 'quiz', name: 'Savol-Javob & Viktorina Boti' },
  '📝 Bloknot & Qaydlar': { type: 'notes', name: 'Shaxsiy Bloknot Boti' },
  '🧮 Aqlli Kalkulyator': { type: 'calculator', name: 'Aqlli Kalkulyator Boti' },
  '📨 Taklif & Murojaat': { type: 'feedback', name: 'Taklif & Murojaat Boti' }
};

Object.keys(botTypeMap).forEach(key => {
  bot.hears(key, async (ctx) => {
    const userId = ctx.from.id;
    const user = db.getUser(userId) || {};
    const tariffObj = db.getTariff(user.tariff);
    const userBots = db.getBotsByUser(userId);
    const maxBots = tariffObj.maxBots || 1;

    if (userBots.length >= maxBots && !isAdmin(userId)) {
      userStates.delete(userId);
      return ctx.replyWithHTML(
        `⚠️ <b>Kechirasiz, sizning bot yaratish limitingiz to'lgan (${userBots.length}/${maxBots} ta)!</b>\n\nKo'proq bot yaratish uchun "💎 Tariflar & VIP Ma'lumot" tugmasi orqali tarifni oshiring!`,
        getMainMenuKeyboard(userId)
      );
    }

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

  const user = db.getUser(userId) || {};
  const tariffObj = db.getTariff(user.tariff);
  const userBots = db.getBotsByUser(userId);
  const maxBots = tariffObj.maxBots || 1;

  if (userBots.length === 0) {
    return ctx.replyWithHTML(
      `📋 <b>Sizda hali yaratilgan botlar yo'q.</b>\n\nPastdagi <b>"🤖 Bot Yaratish"</b> tugmasini bosib, 1 daqiqada o'z birinchi botingizni ishga tushiring!`,
      getMainMenuKeyboard(userId)
    );
  }

  await ctx.replyWithHTML(
    `📋 <b>SIZNING 24/7 HOSTINGDAGI BOTLARINGIZ (${userBots.length}/${maxBots} ta):</b>\n\n` +
    `Har bir botingizni pastdagi tugmalar orqali boshqarishingiz, <b>yoqishingiz</b>, <b>to'xtatishingiz</b> yoki <b>o'chirishingiz</b> mumkin 👇`,
    getMainMenuKeyboard(userId)
  );

  for (const b of userBots) {
    const statusText = b.is_active ? '🟢 Faol (24/7 Onlayn)' : '🔴 To\'xtatilgan';
    const toggleBtnText = b.is_active ? '⏸ To\'xtatish' : '▶️ Ishga Tushirish';
    const botCard = 
`🤖 <b>${escapeHtml(b.botName || 'Mening Botim')}</b>
🔗 <b>Username:</b> @${b.botUsername}
🛠 <b>Yo'nalishi:</b> <b>${(b.botType || '').toUpperCase()}</b>
⚡ <b>Holati:</b> <b>${statusText}</b>`;

    const buttons = [
      [
        Markup.button.callback(toggleBtnText, `user_toggle_${b.id}`),
        Markup.button.callback('🗑 O\'chirish', `user_del_${b.id}`)
      ],
      [
        Markup.button.url(`🚀 @${b.botUsername} ga o'tish`, `https://t.me/${b.botUsername}`)
      ]
    ];

    await ctx.replyWithHTML(botCard, Markup.inlineKeyboard(buttons));
  }
});

// Botni yoqish / to'xtatish (Toggle active status)
bot.action(/^user_toggle_(.+)$/, async (ctx) => {
  const botId = ctx.match[1];
  const userId = ctx.from.id;
  const b = db.getBot(botId);

  if (!b) {
    return ctx.answerCbQuery('Bot topilmadi!', { show_alert: true });
  }

  if (String(b.userId) !== String(userId) && !isAdmin(userId)) {
    return ctx.answerCbQuery('Ruxsat berilmagan!', { show_alert: true });
  }

  const updated = db.toggleBotStatus(botId);
  if (updated) {
    if (updated.is_active) {
      await botManager.startBot(updated);
      await ctx.answerCbQuery('🟢 Bot 24/7 ishga tushirildi!');
    } else {
      botManager.stopBot(updated.id);
      await ctx.answerCbQuery('🔴 Bot to\'xtatildi!');
    }

    const statusText = updated.is_active ? '🟢 Faol (24/7 Onlayn)' : '🔴 To\'xtatilgan';
    const toggleBtnText = updated.is_active ? '⏸ To\'xtatish' : '▶️ Ishga Tushirish';

    const botCard = 
`🤖 <b>${escapeHtml(updated.botName || 'Mening Botim')}</b>
🔗 <b>Username:</b> @${updated.botUsername}
🛠 <b>Yo'nalishi:</b> <b>${(updated.botType || '').toUpperCase()}</b>
⚡ <b>Holati:</b> <b>${statusText}</b>`;

    const buttons = [
      [
        Markup.button.callback(toggleBtnText, `user_toggle_${updated.id}`),
        Markup.button.callback('🗑 O\'chirish', `user_del_${updated.id}`)
      ],
      [
        Markup.button.url(`🚀 @${updated.botUsername} ga o'tish`, `https://t.me/${updated.botUsername}`)
      ]
    ];

    try {
      await ctx.editMessageText(botCard, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    } catch (e) {}
  }
});

// Botni o'chirishni so'rash (Confirm delete)
bot.action(/^user_del_(.+)$/, async (ctx) => {
  const botId = ctx.match[1];
  const userId = ctx.from.id;
  const b = db.getBot(botId);

  if (!b) {
    return ctx.answerCbQuery('Bot topilmadi!', { show_alert: true });
  }

  if (String(b.userId) !== String(userId) && !isAdmin(userId)) {
    return ctx.answerCbQuery('Ruxsat berilmagan!', { show_alert: true });
  }

  const confirmCard = 
`⚠️ <b>Haqiqatan ham @${b.botUsername} botini butunlay o'chirmoqchimisiz?</b>\n\nBu amalni ortga qaytarib bo'lmaydi.`;

  const buttons = [
    [
      Markup.button.callback('✅ Ha, o\'chirilsin', `user_confirm_del_${b.id}`),
      Markup.button.callback('❌ Bekor qilish', `user_cancel_del_${b.id}`)
    ]
  ];

  try {
    await ctx.editMessageText(confirmCard, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) {}
});

// Botni o'chirishni bekor qilish
bot.action(/^user_cancel_del_(.+)$/, async (ctx) => {
  const botId = ctx.match[1];
  const b = db.getBot(botId);
  if (!b) return ctx.deleteMessage().catch(()=>{});

  const statusText = b.is_active ? '🟢 Faol (24/7 Onlayn)' : '🔴 To\'xtatilgan';
  const toggleBtnText = b.is_active ? '⏸ To\'xtatish' : '▶️ Ishga Tushirish';

  const botCard = 
`🤖 <b>${escapeHtml(b.botName || 'Mening Botim')}</b>
🔗 <b>Username:</b> @${b.botUsername}
🛠 <b>Yo'nalishi:</b> <b>${(b.botType || '').toUpperCase()}</b>
⚡ <b>Holati:</b> <b>${statusText}</b>`;

  const buttons = [
    [
      Markup.button.callback(toggleBtnText, `user_toggle_${b.id}`),
      Markup.button.callback('🗑 O\'chirish', `user_del_${b.id}`)
    ],
    [
      Markup.button.url(`🚀 @${b.botUsername} ga o'tish`, `https://t.me/${b.botUsername}`)
    ]
  ];

  try {
    await ctx.editMessageText(botCard, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) {}
});

// Botni butunlay o'chirish
bot.action(/^user_confirm_del_(.+)$/, async (ctx) => {
  const botId = ctx.match[1];
  const userId = ctx.from.id;
  const b = db.getBot(botId);

  if (!b) {
    return ctx.answerCbQuery('Bot topilmadi!', { show_alert: true });
  }

  if (String(b.userId) !== String(userId) && !isAdmin(userId)) {
    return ctx.answerCbQuery('Ruxsat berilmagan!', { show_alert: true });
  }

  const username = b.botUsername;
  botManager.stopBot(botId);
  db.deleteBot(botId, userId);

  await ctx.answerCbQuery(`@${username} boti o'chirildi! 🗑`);
  try {
    await ctx.editMessageText(`🗑 <b>@${username}</b> boti muvaffaqiyatli o'chirildi va serverdan to'xtatildi.`, { parse_mode: 'HTML' });
  } catch (e) {}
});

// ==================== WEB APP TUGMASI (YAGONA BAZA) ====================
bot.hears(['🌐 Web App', '🌐 Web App-ni Ochish', '/webapp'], async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);
  const webAppUrl = `${config.BASE_URL}/webapp?user_id=${userId}&name=${encodeURIComponent(ctx.from.first_name || 'User')}&username=${encodeURIComponent(ctx.from.username || '')}`;

  const text = 
`🌐 <b>MAKER BOT WEB APP PLATFORMASI</b>

Barcha yaratilgan botlar va saytlaringiz <b>bitta umumiy bazada</b> saqlanadi!
Siz botni Telegram orqali yaratsangiz ham Web App da turadi, Web App da yaratsangiz ham Telegramda ko'rinadi!

👇 <b>Web App-ni ochish uchun pastdagi tugmani bosing:</b>`;

  await ctx.replyWithHTML(text, Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 Web App-ni Ochish (15 xil Bot & 20 xil Sayt)', webAppUrl)]
  ]));
});

// ==================== SHAXSIY PROFIL & TELEFON RAQAM ====================
bot.hears('👤 Mening Profilim', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const user = db.getUser(userId) || {};
  const remaining = db.getRemainingTime(userId);
  const tariffObj = db.getTariff(user.tariff);
  const userBots = db.getBotsByUser(userId);
  const userSites = db.getSitesByUser(userId);
  const detailedUsers = db.getAllUsersDetailed();
  const detailed = detailedUsers.find(u => String(u.id) === String(userId)) || {};

  const profileText = 
`👤 <b>SIZNING SHAXSIY PROFILINGIZ:</b>

• 🆔 <b>ID:</b> <code>${userId}</code>
• 👤 <b>Ism:</b> ${escapeHtml(user.name || 'Foydalanuvchi')}
• 🔗 <b>Username:</b> ${user.username ? '@' + escapeHtml(user.username) : 'Mavjud emas'}
• 📱 <b>Telefon raqam:</b> <b>${user.phone || 'Kiritilmagan'}</b>
• 💰 <b>Balansingiz:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🏷 <b>Tarifingiz:</b> <b>${tariffObj.name}</b>
• ⏳ <b>Qolgan muddat:</b> <b>${remaining.text}</b>
• 🏆 <b>Reytingdagi o'rningiz:</b> <b>#${detailed.rank || '1'}</b> (${detailed.activity_label || '🌱 Yangi Mijoz'})
• 🤖 <b>Botlaringiz:</b> <b>${userBots.length} ta</b> (${userBots.filter(b => b.is_active).length} ta faol)
• 🌐 <b>Saytlaringiz:</b> <b>${userSites.length} ta</b>

${!user.phone ? `<i>💡 Telefon raqamingizni profilingizga qo'shish uchun pastdagi "📱 Telefon Raqamni Ulashish" tugmasini bosing!</i>` : `<i>✅ Telefon raqamingiz tizimda tasdiqlangan.</i>`}`;

  await ctx.replyWithHTML(profileText, profileKeyboard);
});

// Kontakt qabul qilish (Telefon nomerni avtomatik saqlash)
bot.on('contact', async (ctx) => {
  const userId = ctx.from.id;
  const phone = ctx.message.contact.phone_number;
  db.setUserPhone(userId, phone);

  await ctx.replyWithHTML(
    `✅ <b>Rahmat! Telefon raqamingiz muvaffaqiyatli saqlandi:</b>\n📱 <code>${phone}</code>\n\nEndi profilingiz to'liq faollashtirildi va Web App bilan sinxronlandi!`,
    getMainMenuKeyboard(userId)
  );
});

// ==================== TARIF & QOLGAN VAQT ====================
bot.hears('⏳ Tarifim & Qolgan Vaqt', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const user = db.getUser(userId) || {};
  const remaining = db.getRemainingTime(userId);
  const tariffObj = db.getTariff(user.tariff);
  const userBots = db.getBotsByUser(userId);
  const tariffs = db.getTariffs();

  let text = 
`⏳ <b>Sizning Tarifingiz & Muddat:</b>\n\n` +
`• 🏷 <b>Amaldagi tarif:</b> <b>${tariffObj.name}</b>\n` +
`• ⏱ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>\n` +
`• 💰 <b>Balansingiz:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>\n` +
`• 🤖 <b>Botlaringiz:</b> ${userBots.length} ta / limit: ${tariffObj.maxBots >= 999 ? 'Cheksiz' : tariffObj.maxBots + ' ta'}\n\n` +
`💎 <b>Mavjud Tarif Rejalari (Yagona Baza):</b>\n`;

  Object.values(tariffs).forEach((t, i) => {
    const pStr = t.price === 0 ? 'Bepul' : `${t.price.toLocaleString()} so'm`;
    text += `${i + 1}. <b>${t.name}:</b> ${pStr} (${t.days} kun, ${t.maxBots >= 999 ? 'Cheksiz' : t.maxBots + ' ta'} bot)\n`;
  });

  text += `\n<i>Barcha tafsilotlar va tarifni faollashtirish uchun pastdagi "💎 Tariflar & VIP Ma'lumot" tugmasini bosing!</i>`;

  await ctx.replyWithHTML(text, getMainMenuKeyboard(userId));
});

// ==================== 💎 TARIFLAR VA VIP MA'LUMOT ====================
bot.hears(['💎 Tariflar & VIP Ma\'lumot', '/tariffs', '/vip', '/tariflar', '/tarif'], async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const user = db.getUser(userId) || {};
  const remaining = db.getRemainingTime(userId);
  const currentTariff = db.getTariff(user.tariff);
  const tariffs = db.getTariffs();

  let text = 
`💎 <b>TARIF REJALARI VA VIP MA'LUMOT</b>\n\n` +
`Siz tanlagan tarifingizga qarab platformamiz sizga ma'lum kunlik (masalan: 5 kun, 10 kun, 30 kun) kafolatlangan 24/7 hosting va qo'shimcha bot yaratish imkoniyatlarini taqdim etadi!\n\n` +
`👤 <b>Sizning joriy holatingiz:</b>\n` +
`• Tarif: <b>${currentTariff.name}</b>\n` +
`• Qolgan muddat: <b>${remaining.text}</b>\n` +
`• Balans: <b>${(user.balance || 0).toLocaleString()} so'm</b>\n\n` +
`━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const inlineButtons = [];

  Object.values(tariffs).forEach((t) => {
    const pStr = t.price === 0 ? 'BEPUL' : `${t.price.toLocaleString()} so'm`;
    text += `<b>${t.name}</b>\n`;
    text += `• ⏱ <b>Beriladigan muddat:</b> <b>${t.days} kun</b>\n`;
    text += `• 💰 <b>Narxi:</b> <b>${pStr}</b>\n`;
    text += `• 🤖 <b>Botlar soni:</b> <b>${t.maxBots >= 999 ? 'Cheksiz (999+)' : t.maxBots + ' tagacha'}</b>\n`;
    text += `• 🌐 <b>Saytlar soni:</b> <b>${t.maxSites >= 999 ? 'Cheksiz (999+)' : t.maxSites + ' tagacha'}</b>\n`;
    text += `• 📌 <b>Tavsif:</b> <i>${t.description}</i>\n\n`;

    if (t.price > 0) {
      inlineButtons.push([
        Markup.button.callback(`🛍 ${t.name.split('(')[0].trim()} (${pStr} / ${t.days} kun)`, `buy_tariff_${t.id}`)
      ]);
    }
  });

  text += `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <i>Hisobingizda yetarli mablag' bo'lsa, kerakli tarif tugmasini bosib darhol faollashtirishingiz mumkin!</i>`;

  inlineButtons.push([
    Markup.button.callback('💳 Balansni To\'ldirish (Karta)', 'action_topup_balance')
  ]);

  await ctx.replyWithHTML(text, Markup.inlineKeyboard(inlineButtons));
});

// ==================== TO'LOV LINKLARI VA USULLARI ====================
function getClickPaymentUrl(userId, tariffId, amount) {
  const sId = config.CLICK_SERVICE_ID || '12345';
  const mId = config.CLICK_MERCHANT_ID || '67890';
  return `https://my.click.uz/services/pay?service_id=${sId}&merchant_id=${mId}&amount=${amount}&transaction_param=${userId}_${tariffId}`;
}

function getPaymePaymentUrl(userId, tariffId, amount) {
  const mId = config.PAYME_MERCHANT_ID || 'payme_merchant';
  const param = `m=${mId};ac.user_id=${userId};ac.tariff_id=${tariffId};a=${amount * 100}`;
  const b64 = Buffer.from(param).toString('base64');
  return `https://checkout.paycom.uz/${b64}`;
}

function renderTariffsList(userId) {
  const user = db.getUser(userId) || {};
  const remaining = db.getRemainingTime(userId);
  const currentTariff = db.getTariff(user.tariff);
  const tariffs = db.getTariffs();

  let text = 
`💎 <b>TARIF REJALARI VA VIP MA'LUMOT</b>\n\n` +
`Siz tanlagan tarifingizga qarab platformamiz sizga kafolatlangan 24/7 hosting va qo'shimcha bot yaratish imkoniyatlarini taqdim etadi!\n\n` +
`👤 <b>Sizning joriy holatingiz:</b>\n` +
`• Tarif: <b>${currentTariff.name}</b>\n` +
`• Qolgan muddat: <b>${remaining.text}</b>\n` +
`• Balans: <b>${(user.balance || 0).toLocaleString()} so'm</b>\n\n` +
`━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const inlineButtons = [];

  Object.values(tariffs).forEach((t) => {
    const pStr = t.price === 0 ? 'BEPUL' : `${t.price.toLocaleString()} so'm`;
    const starsStr = t.stars ? ` (${t.stars} ⭐)` : '';
    text += `<b>${t.name}</b>\n`;
    text += `• ⏱ <b>Beriladigan muddat:</b> <b>${t.days} kun</b>\n`;
    text += `• 💰 <b>Narxi:</b> <b>${pStr}</b>${starsStr}\n`;
    text += `• 🤖 <b>Botlar soni:</b> <b>${t.maxBots >= 999 ? 'Cheksiz (999+)' : t.maxBots + ' tagacha'}</b>\n`;
    text += `• 🌐 <b>Saytlar soni:</b> <b>${t.maxSites >= 999 ? 'Cheksiz (999+)' : t.maxSites + ' tagacha'}</b>\n`;
    text += `• 📌 <b>Tavsif:</b> <i>${t.description}</i>\n\n`;

    if (t.price > 0) {
      inlineButtons.push([
        Markup.button.callback(`🛍 ${t.name.split('(')[0].trim()} (${pStr} / ${t.days} kun)`, `buy_tariff_${t.id}`)
      ]);
    }
  });

  text += `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <i>Kerakli tarif tugmasini bosing va o'zingizga qulay to'lov usulini (Stars, Click, Payme yoki Karta) tanlang!</i>`;

  inlineButtons.push([
    Markup.button.callback('💳 Balansni To\'ldirish (Karta)', 'action_topup_balance')
  ]);

  return { text, keyboard: Markup.inlineKeyboard(inlineButtons) };
}

function renderPaymentOptions(userId, tariff) {
  const user = db.getUser(userId) || {};
  const starsAmount = tariff.stars || Math.ceil(tariff.price / 250);
  const usdtAmount = (tariff.price / 12800).toFixed(1);

  const text =
`💳 <b>TO'LOV USULINI TANLANG</b>\n\n` +
`• Tanlangan tarif: <b>${tariff.name}</b>\n` +
`• Narxi: <b>${tariff.price.toLocaleString()} so'm</b> (${tariff.days} kunlik obuna)\n` +
`• ⭐ Telegram Stars: <b>${starsAmount} Stars</b>\n` +
`• Sizning balansingiz: <b>${(user.balance || 0).toLocaleString()} so'm</b>\n\n` +
`<i>Quyidagi usullardan birini tanlang. To'lov amalga oshishi bilan tarifingiz <b>bir soniyada avtomatik faollashadi</b>:</i>`;

  const buttons = [];

  // 1. Agar balansida pul bo'lsa
  if ((user.balance || 0) >= tariff.price) {
    buttons.push([
      Markup.button.callback(`💰 Ichki Balansdan To'lash (${(user.balance || 0).toLocaleString()} so'm)`, `pay_internal_${tariff.id}`)
    ]);
  }

  // 2. Telegram Stars (In-bot bir zumda)
  buttons.push([
    Markup.button.callback(`⭐ Telegram Stars bilan to'lash (${starsAmount} Stars)`, `pay_stars_${tariff.id}`)
  ]);

  // 3. Click & Payme (Avtomatik linklar)
  buttons.push([
    Markup.button.callback(`🟢 Click orqali to'lash`, `pay_click_${tariff.id}`),
    Markup.button.callback(`🔵 Payme orqali to'lash`, `pay_payme_${tariff.id}`)
  ]);

  // 4. CryptoBot & Karta
  buttons.push([
    Markup.button.callback(`💎 CryptoBot (${usdtAmount} USDT)`, `pay_crypto_${tariff.id}`),
    Markup.button.callback(`💳 Karta orqali (Chek)`, `pay_card_${tariff.id}`)
  ]);

  // 5. Test/Sinov
  buttons.push([
    Markup.button.callback(`⚡️ Tezkor Sinov (Avto Faollashtirish)`, `pay_test_${tariff.id}`)
  ]);

  buttons.push([
    Markup.button.callback(`🔙 Barcha tariflar`, `action_tariffs_menu`)
  ]);

  return { text, keyboard: Markup.inlineKeyboard(buttons) };
}

// Barcha tariflar menyusiga qaytish
bot.action('action_tariffs_menu', async (ctx) => {
  await ctx.answerCbQuery();
  const menu = renderTariffsList(ctx.from.id);
  try {
    await ctx.editMessageText(menu.text, { parse_mode: 'HTML', ...menu.keyboard });
  } catch (e) {}
});

// Tarif sotib olish callback
bot.action(/^buy_tariff_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const tariff = db.getTariff(tariffId);

  if (!tariff) {
    return ctx.answerCbQuery('Tarif topilmadi!', { show_alert: true });
  }

  await ctx.answerCbQuery();
  const options = renderPaymentOptions(userId, tariff);
  try {
    await ctx.editMessageText(options.text, { parse_mode: 'HTML', ...options.keyboard });
  } catch (e) {
    await ctx.replyWithHTML(options.text, options.keyboard);
  }
});

// 1. Ichki balansdan to'lash
bot.action(/^pay_internal_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const user = db.getUser(userId) || {};
  const tariff = db.getTariff(tariffId);

  if (!tariff) return ctx.answerCbQuery('Tarif topilmadi!');

  if ((user.balance || 0) < tariff.price) {
    return ctx.answerCbQuery('Mablag\' yetarli emas!', { show_alert: true });
  }

  db.addBalance(userId, -tariff.price);
  db.setTariff(userId, tariffId, tariff.days);
  const updatedRem = db.getRemainingTime(userId);
  const updatedUser = db.getUser(userId);

  db.createPaymentRecord({
    userId,
    tariffId,
    amount: tariff.price,
    provider: 'internal_balance',
    status: 'completed'
  });

  await ctx.answerCbQuery('🎉 Tarif muvaffaqiyatli faollashtirildi!', { show_alert: true });
  await ctx.replyWithHTML(
    `🎉 <b>TABRIKLAYMIZ! YANGI TARIFINGIZ FAOLLASHTIRILDI!</b>\n\n` +
    `• Amaldagi tarif: <b>${tariff.name}</b>\n` +
    `• Berilgan muddat: <b>${tariff.days} kun</b>\n` +
    `• Amal qilish muddati: <b>${updatedRem.text}</b> gacha\n` +
    `• Botlar limiti: <b>${tariff.maxBots >= 999 ? 'Cheksiz' : tariff.maxBots + ' ta'}</b>\n` +
    `• Qolgan balansingiz: <b>${(updatedUser.balance || 0).toLocaleString()} so'm</b>\n\n` +
    `<i>Barcha bot va saytlaringiz 24/7 uzluksiz ishlaydi!</i> 🚀`,
    getMainMenuKeyboard(userId)
  );
});

// 2. Telegram Stars orqali to'lov (XTR)
bot.action(/^pay_stars_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const tariff = db.getTariff(tariffId);

  if (!tariff) return ctx.answerCbQuery('Tarif topilmadi!');
  await ctx.answerCbQuery();

  const starsAmount = tariff.stars || Math.ceil(tariff.price / 250);

  try {
    await ctx.sendInvoice({
      title: `⭐ ${tariff.name}`,
      description: `${tariff.days} kunlik obuna va ${tariff.maxBots >= 999 ? 'cheksiz' : tariff.maxBots + ' ta'} bot yaratish imkoniyati! To'lovdan so'ng darhol avtomatik faollashadi.`,
      payload: `stars_tariff_${tariff.id}_${userId}_${Date.now()}`,
      provider_token: '',
      currency: 'XTR',
      prices: [
        { label: tariff.name, amount: starsAmount }
      ]
    });
  } catch (err) {
    console.error('Stars invoice error:', err.message);
    await ctx.replyWithHTML(
      `❌ <b>Telegram Stars to'lovini ochishda xatolik:</b> ${escapeHtml(err.message)}\n\nBoshqa to'lov usulidan (Click, Payme yoki Karta) foydalanishingiz mumkin.`,
      Markup.inlineKeyboard([[Markup.button.callback('🔙 To\'lov Usullari', `buy_tariff_${tariff.id}`)]])
    );
  }
});

// Pre-checkout query handler (Telegram Stars)
bot.on('pre_checkout_query', async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    console.error('pre_checkout_query error:', err.message);
  }
});

// Successful payment handler (Telegram Stars)
bot.on('successful_payment', async (ctx) => {
  const payment = ctx.message.successful_payment;
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  const payload = payment.invoice_payload || '';
  const parts = payload.split('_');
  const tariffId = parts[2] || 'starter';

  const tariff = db.getTariff(tariffId);
  db.setTariff(userId, tariffId, tariff.days);
  const rem = db.getRemainingTime(userId);

  db.createPaymentRecord({
    userId,
    tariffId,
    amount: payment.total_amount,
    provider: 'stars',
    status: 'completed',
    meta: {
      telegram_payment_charge_id: payment.telegram_payment_charge_id,
      provider_payment_charge_id: payment.provider_payment_charge_id
    }
  });

  const successText =
`🎉 <b>TABRIKLAYMIZ! TO'LOV MUVAFFAQIYATLI QABUL QILINDI! ⭐</b>\n\n` +
`• To'lov usuli: <b>Telegram Stars (XTR)</b>\n` +
`• To'langan summa: <b>${payment.total_amount} Stars ⭐</b>\n` +
`• Faollashtirilgan tarif: <b>${tariff.name}</b>\n` +
`• Berilgan muddat: <b>${tariff.days} kun</b>\n` +
`• Amal qilish vaqti: <b>${rem.text}</b>\n` +
`• Botlar limiti: <b>${tariff.maxBots >= 999 ? 'Cheksiz (999+)' : tariff.maxBots + ' ta'}</b>\n\n` +
`<i>Barcha bot va veb-saytlaringiz 24/7 uzluksiz serverda faol ishlaydi! Xizmatimizdan foydalanganingiz uchun rahmat!</i> 🚀`;

  await ctx.replyWithHTML(successText, getMainMenuKeyboard(userId));

  bot.telegram.sendMessage(
    config.OWNER_ID,
    `⭐ <b>YANGI AVTOMATIK STARS TO'LOVI!</b>\n\n` +
    `👤 <b>Mijoz:</b> ${escapeHtml(name)} (<code>${userId}</code>)\n` +
    `💎 <b>Tarif:</b> ${tariff.name}\n` +
    `💰 <b>Summa:</b> ${payment.total_amount} Stars\n` +
    `📅 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}`,
    { parse_mode: 'HTML' }
  ).catch(()=>{});
});

// 3. Click orqali to'lov
bot.action(/^pay_click_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const tariff = db.getTariff(tariffId);
  if (!tariff) return ctx.answerCbQuery('Tarif topilmadi!');

  await ctx.answerCbQuery();
  const clickUrl = getClickPaymentUrl(userId, tariffId, tariff.price);

  const text =
`🟢 <b>CLICK ORQALI TO'LOV QILISH</b>\n\n` +
`• Tanlangan tarif: <b>${tariff.name}</b>\n` +
`• To'lov summasi: <b>${tariff.price.toLocaleString()} so'm</b>\n` +
`• Muddati: <b>${tariff.days} kun</b>\n\n` +
`📌 <b>Ko'rsatma:</b>\n` +
`1. Pastdagi "🟢 Click orqali to'lash" tugmasini bosing va to'lovni tasdiqlang.\n` +
`2. To'lov o'tishi bilan tarifingiz <b>bir soniyada avtomatik faollashadi</b>!`;

  const buttons = [
    [Markup.button.url('🟢 Click ilovasida to\'lash', clickUrl)],
    [Markup.button.callback('🔄 To\'lovni Tekshirish', `check_pay_click_${tariff.id}`)],
    [Markup.button.callback('🔙 Boshqa to\'lov usullari', `buy_tariff_${tariff.id}`)]
  ];

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) {
    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  }
});

bot.action(/^check_pay_click_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const payments = db.getAllPayments().filter(p => String(p.userId) === String(userId) && p.tariffId === tariffId && p.status === 'completed');

  if (payments.length > 0) {
    await ctx.answerCbQuery('✅ To\'lov tasdiqlandi! Tarifingiz faol.', { show_alert: true });
  } else {
    await ctx.answerCbQuery('⏳ To\'lov hali kelib tushmadi. Iltimos, to\'lovni yakunlang yoki bir oz kuting.', { show_alert: true });
  }
});

// 4. Payme orqali to'lov
bot.action(/^pay_payme_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const tariff = db.getTariff(tariffId);
  if (!tariff) return ctx.answerCbQuery('Tarif topilmadi!');

  await ctx.answerCbQuery();
  const paymeUrl = getPaymePaymentUrl(userId, tariffId, tariff.price);

  const text =
`🔵 <b>PAYME ORQALI TO'LOV QILISH</b>\n\n` +
`• Tanlangan tarif: <b>${tariff.name}</b>\n` +
`• To'lov summasi: <b>${tariff.price.toLocaleString()} so'm</b>\n` +
`• Muddati: <b>${tariff.days} kun</b>\n\n` +
`📌 <b>Ko'rsatma:</b>\n` +
`1. Pastdagi "🔵 Payme orqali to'lash" tugmasini bosing.\n` +
`2. To'lov tasdiqlanishi bilan tarifingiz <b>avtomatik faollashadi</b>!`;

  const buttons = [
    [Markup.button.url('🔵 Payme ilovasida to\'lash', paymeUrl)],
    [Markup.button.callback('🔄 To\'lovni Tekshirish', `check_pay_payme_${tariff.id}`)],
    [Markup.button.callback('🔙 Boshqa to\'lov usullari', `buy_tariff_${tariff.id}`)]
  ];

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) {
    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  }
});

bot.action(/^check_pay_payme_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const payments = db.getAllPayments().filter(p => String(p.userId) === String(userId) && p.tariffId === tariffId && p.status === 'completed');

  if (payments.length > 0) {
    await ctx.answerCbQuery('✅ To\'lov tasdiqlandi! Tarifingiz faol.', { show_alert: true });
  } else {
    await ctx.answerCbQuery('⏳ To\'lov hali kelib tushmadi. Iltimos, to\'lovni yakunlang yoki bir oz kuting.', { show_alert: true });
  }
});

// 5. CryptoBot orqali to'lov
bot.action(/^pay_crypto_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const tariff = db.getTariff(tariffId);
  if (!tariff) return ctx.answerCbQuery('Tarif topilmadi!');
  await ctx.answerCbQuery();

  const usdtAmount = (tariff.price / 12800).toFixed(1);

  const text =
`💎 <b>CRYPTOBOT (USDT / TON) TO'LOVI</b>\n\n` +
`• Tanlangan tarif: <b>${tariff.name}</b>\n` +
`• Summa: <b>${usdtAmount} USDT</b> (${tariff.price.toLocaleString()} so'm)\n` +
`• Muddati: <b>${tariff.days} kun</b>\n\n` +
`📌 <b>Ko'rsatma:</b>\n` +
`Telegramdagi rasmiy <b>@CryptoBot</b> orqali to'lov qilish uchun havola orqali o'ting:`;

  const buttons = [
    [Markup.button.url('💎 @CryptoBot ga o\'tish', 'https://t.me/CryptoBot')],
    [Markup.button.callback('🔙 Boshqa to\'lov usullari', `buy_tariff_${tariff.id}`)]
  ];

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) {
    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  }
});

// 6. Karta orqali to'lov (Chek yuborish)
bot.action(/^pay_card_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const tariff = db.getTariff(tariffId);
  if (!tariff) return ctx.answerCbQuery('Tarif topilmadi!');
  await ctx.answerCbQuery();

  const text =
`💳 <b>KARTA ORQALI TO'LOV VA CHEK YUBORISH</b>\n\n` +
`• Tanlangan tarif: <b>${tariff.name}</b>\n` +
`• To'lov summasi: <b>${tariff.price.toLocaleString()} so'm</b>\n\n` +
`💳 <b>Karta raqam:</b> <code>${config.CARD_NUMBER}</code>\n` +
`👤 <b>Karta egasi:</b> <b>${config.CARD_HOLDER}</b>\n\n` +
`📌 <b>To'lov tartibi:</b>\n` +
`1. Yuqoridagi kartaga <b>${tariff.price.toLocaleString()} so'm</b> o'tkazing.\n` +
`2. To'lov chekini skrinshot qilib ushbu botga rasm holatida yuboring!\n` +
`3. Administrator chekni ko'rgach, hisobingiz darhol faollashadi.`;

  const buttons = [
    [Markup.button.callback('🔙 Boshqa to\'lov usullari', `buy_tariff_${tariff.id}`)]
  ];

  try {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } catch (e) {
    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  }
});

// 7. Tezkor Sinov (Instant Demo Test)
bot.action(/^pay_test_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const tariff = db.getTariff(tariffId);
  if (!tariff) return ctx.answerCbQuery('Tarif topilmadi!');

  db.setTariff(userId, tariffId, tariff.days);
  const updatedRem = db.getRemainingTime(userId);

  db.createPaymentRecord({
    userId,
    tariffId,
    amount: tariff.price,
    provider: 'instant_demo',
    status: 'completed'
  });

  await ctx.answerCbQuery('⚡️ Sinov to\'lovi faollashtirildi!', { show_alert: true });
  await ctx.replyWithHTML(
    `⚡️ <b>TEZKOR AVTOMATIK TO'LOV SINOVI FAOLLASHTIRILDI!</b>\n\n` +
    `• Amaldagi tarif: <b>${tariff.name}</b>\n` +
    `• Berilgan muddat: <b>${tariff.days} kun</b>\n` +
    `• Amal qilish muddati: <b>${updatedRem.text}</b> gacha\n` +
    `• Botlar limiti: <b>${tariff.maxBots >= 999 ? 'Cheksiz' : tariff.maxBots + ' ta'}</b>\n\n` +
    `<i>Barcha bot va veb-saytlaringiz 24/7 uzluksiz ishlamoqda!</i> 🚀`,
    getMainMenuKeyboard(userId)
  );
});

// To'lov yo'riqnomasi callback
bot.action('action_topup_balance', async (ctx) => {
  await ctx.answerCbQuery();
  const text = 
`💳 <b>Hisobni To'ldirish & To'lov Rekvizitlari</b>\n\n` +
`Istalgan tarifni sotib olish uchun quyidagi kartaga to'lov qiling:\n\n` +
`💳 <b>Karta raqam:</b> <code>${config.CARD_NUMBER}</code>\n` +
`👤 <b>Karta egasi:</b> <b>${config.CARD_HOLDER}</b>\n\n` +
`📌 <b>To'lov tartibi:</b>\n` +
`1. Kartaga kerakli summani o'tkazing.\n` +
`2. To'lov chekini skrinshot qilib ushbu botga rasm holatida yuboring!\n` +
`3. Administrator chekni tasdiqlab, balansingizni darhol to'ldirib beradi.`;

  await ctx.replyWithHTML(text, getMainMenuKeyboard(ctx.from.id));
});

// ==================== BALANS VA TO'LOV ====================
bot.hears(['💳 Balans & To\'lov', '/balance', '/pay'], async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const user = db.getUser(userId) || {};
  const remaining = db.getRemainingTime(userId);
  const tariff = db.getTariff(user.tariff);

  const text = 
`💳 <b>HISOB, BALANS VA AVTOMATIK TO'LOVLAR</b>\n\n` +
`• 🆔 <b>Sizning ID:</b> <code>${userId}</code>\n` +
`• 💰 <b>Balansingiz:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>\n` +
`• 🏷 <b>Joriy tarif:</b> <b>${tariff.name}</b>\n` +
`• ⏳ <b>Qolgan muddat:</b> <b>${remaining.text}</b>\n\n` +
`<i>Platformamizda barcha zamonaviy to'lov usullari 24/7 ishlaydi:</i>\n` +
`• ⭐ <b>Telegram Stars</b> — bir zumda to'g'ridan-to'g'ri bot ichida\n` +
`• 🟢 <b>Click</b> — avtomatik to'lov havolasi\n` +
`• 🔵 <b>Payme</b> — avtomatik to'lov havolasi\n` +
`• 💎 <b>CryptoBot</b> — USDT va TON kriptovalyutalari\n` +
`• 💳 <b>Karta raqam</b> — o'tkazma qilib chek yuborish\n\n` +
`<i>Tarif tanlash yoki to'lov qilish uchun pastdagi tugmani bosing:</i>`;

  const buttons = [
    [Markup.button.callback('💎 Tarif Tanlash & To\'lov Qilish', 'action_tariffs_menu')],
    [Markup.button.callback('💳 Karta Rekvizitlari & Chek', 'action_topup_balance')]
  ];

  await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
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

📊 <b>Umumiy Mijozlar & Faollik:</b>
• 👥 <b>Jami mijozlar:</b> <b>${stats.totalUsers} ta</b>
• 🔥 <b>Juda faol mijozlar:</b> <b>${stats.veryActiveUsers} ta</b>
• ⚡ <b>O'rtacha faol mijozlar:</b> <b>${stats.activeUsers} ta</b>
• 🌱 <b>Yangi mijozlar:</b> <b>${stats.newUsers} ta</b>
• 🤖 <b>Jami botlar:</b> <b>${stats.totalBots} ta</b> (${stats.activeBots} ta 24/7 faol)
• 🌐 <b>Jami saytlar:</b> <b>${stats.totalSites} ta</b> (${stats.activeSites} ta faol)
• 💰 <b>Foydalanuvchilar balansi:</b> <b>${stats.totalBalance.toLocaleString()} so'm</b>

Pastdagi tugmalar orqali boshqaring:`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);
});

bot.hears(['📊 Statistika & Faollik', '📊 Statistika'], async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;

  const stats = db.getStats();
  const text = 
`📊 <b>Platforma To'liq Statistikasi & Mijozlar Faolligi:</b>

👥 <b>Mijozlar tahlili:</b>
• Jami ro'yxatdan o'tgan mijozlar: <b>${stats.totalUsers} ta</b>
• 🔥 <b>Juda faol mijozlar:</b> <b>${stats.veryActiveUsers} ta</b>
• ⚡ <b>Faol mijozlar:</b> <b>${stats.activeUsers} ta</b>
• 🌱 <b>Yangi mijozlar:</b> <b>${stats.newUsers} ta</b>

🤖 <b>Botlar holati:</b>
• Jami yaratilgan botlar: <b>${stats.totalBots} ta</b>
• 🟢 Hozir 24/7 ishlayotgan botlar: <b>${stats.activeBots} ta</b>

🌐 <b>Saytlar holati:</b>
• Jami yaratilgan saytlar: <b>${stats.totalSites} ta</b>
• 🟢 Faol saytlar: <b>${stats.activeSites} ta</b>

💰 Jami tizimdagi balanslar: <b>${stats.totalBalance.toLocaleString()} so'm</b>`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);
});

bot.hears('👥 Foydalanuvchilar', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;

  const users = db.getAllUsersDetailed().slice(0, 15);
  if (!users || users.length === 0) {
    return ctx.reply('Tizimda hozircha foydalanuvchilar mavjud emas.', adminMenuKeyboard);
  }

  let text = `👥 <b>FOYDALANUVCHILARNI BOSHQARISH (${users.length} ta):</b>\n\n`;
  users.forEach((u, idx) => {
    const statusIcon = u.is_blocked ? '🚫 [BLOKLANGAN]' : '✅';
    text += `<b>${idx + 1}. ${escapeHtml(u.name)}</b> (${u.username ? '@' + escapeHtml(u.username) : 'usernamesiz'}) ${statusIcon}\n`;
    text += `   • 🆔 ID: <code>${u.id}</code> | 📱 ${u.phone || 'yo\'q'}\n`;
    text += `   • 💰 Balans: <b>${(u.balance||0).toLocaleString()} so'm</b> | 🏷 <b>${u.tariff}</b> (${u.remaining_text})\n\n`;
  });

  text += `<i>Quyidagi har bir foydalanuvchi kartasi orqali tugmalarni bosib darhol pul qo'shishingiz, tarif biriktirishingiz yoki bloklashingiz mumkin 👇</i>`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);

  // Send interactive management card for each user
  for (const u of users) {
    const blockBtnText = u.is_blocked ? '🔓 Blokdan olish' : '🚫 Bloklash';
    const cardText = 
`👤 <b>#${u.rank} ${escapeHtml(u.name)}</b> (${u.username ? '@' + escapeHtml(u.username) : 'usernamesiz'})
${u.is_blocked ? '🔴 <b>PROFIL BLOKLANGAN!</b>\n' : ''}🆔 <b>ID:</b> <code>${u.id}</code>
📱 <b>Tel:</b> <b>${u.phone || 'yo\'q'}</b>
💰 <b>Balans:</b> <b>${(u.balance || 0).toLocaleString()} so'm</b>
🏷 <b>Tarif:</b> <b>${u.tariff}</b> (${u.remaining_text})
🤖 <b>Botlar:</b> ${u.bots_count} ta (${u.active_bots_count} faol) | 🌐 <b>Saytlar:</b> ${u.sites_count} ta
🏆 <b>Reyting:</b> #${u.rank} (${u.activity_label})`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('💰 Pul qo\'shish', `adm_umoney_${u.id}`),
        Markup.button.callback('🏷 Tarif berish', `adm_utariff_${u.id}`)
      ],
      [
        Markup.button.callback(blockBtnText, `adm_ublock_${u.id}`),
        Markup.button.callback('📅 Kun qo\'shish', `adm_udays_${u.id}`)
      ]
    ]);

    await ctx.replyWithHTML(cardText, keyboard);
  }
});

// Bloklash va blokdan chiqarish callback
bot.action(/^adm_ublock_(.+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!isAdmin(adminId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const u = db.toggleBlockUser(targetId);
  if (!u) return ctx.answerCbQuery('Foydalanuvchi topilmadi!');

  if (u.is_blocked) {
    await ctx.answerCbQuery('🚫 Foydalanuvchi bloklandi!', { show_alert: true });
    bot.telegram.sendMessage(targetId, '🚫 Sizning profilingiz ma\'muriyat tomonidan bloklandi.').catch(()=>{});
  } else {
    await ctx.answerCbQuery('✅ Foydalanuvchi blokdan chiqarildi!', { show_alert: true });
    bot.telegram.sendMessage(targetId, '✅ Sizning profilingiz blokdan chiqarildi. Botdan to\'liq foydalanishingiz mumkin!').catch(()=>{});
  }

  const blockBtnText = u.is_blocked ? '🔓 Blokdan olish' : '🚫 Bloklash';
  const remaining = db.getRemainingTime(u.id);
  const cardText = 
`👤 <b>${escapeHtml(u.name)}</b> (${u.username ? '@' + escapeHtml(u.username) : 'usernamesiz'})
${u.is_blocked ? '🔴 <b>PROFIL BLOKLANGAN!</b>\n' : ''}🆔 <b>ID:</b> <code>${u.id}</code>
📱 <b>Tel:</b> <b>${u.phone || 'yo\'q'}</b>
💰 <b>Balans:</b> <b>${(u.balance || 0).toLocaleString()} so'm</b>
🏷 <b>Tarif:</b> <b>${u.tariff}</b> (${remaining.text})
🤖 <b>Botlar:</b> ${db.getBotsByUser(u.id).length} ta`;

  await ctx.editMessageText(cardText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('💰 Pul qo\'shish', `adm_umoney_${u.id}`),
        Markup.button.callback('🏷 Tarif berish', `adm_utariff_${u.id}`)
      ],
      [
        Markup.button.callback(blockBtnText, `adm_ublock_${u.id}`),
        Markup.button.callback('📅 Kun qo\'shish', `adm_udays_${u.id}`)
      ]
    ])
  }).catch(()=>{});
});

// Tezkor pul qo'shish tanlash
bot.action(/^adm_umoney_(.+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!isAdmin(adminId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  await ctx.answerCbQuery();

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('+10,000 so\'m', `adm_setm_${targetId}_10000`),
      Markup.button.callback('+25,000 so\'m', `adm_setm_${targetId}_25000`)
    ],
    [
      Markup.button.callback('+50,000 so\'m', `adm_setm_${targetId}_50000`),
      Markup.button.callback('+100,000 so\'m', `adm_setm_${targetId}_100000`)
    ]
  ]);

  await ctx.replyWithHTML(
    `💰 <b>ID <code>${targetId}</code> hisobiga pul qo'shish:</b>\n\nKerakli summani tanlang yoki buyruq orqali kiriting:\n<code>/addmoney ${targetId} 50000</code>`,
    keyboard
  );
});

// Pulni belgilash callback
bot.action(/^adm_setm_([^_]+)_(.+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!isAdmin(adminId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const amount = Number(ctx.match[2]);
  const u = db.addBalance(targetId, amount);
  if (u) {
    await ctx.answerCbQuery(`✅ ${amount.toLocaleString()} so'm qo'shildi!`, { show_alert: true });
    ctx.replyWithHTML(`✅ <b>Foydalanuvchi ${targetId} ga +${amount.toLocaleString()} so'm qo'shildi!</b>\nYangi balans: <b>${u.balance.toLocaleString()} so'm</b>`);
    bot.telegram.sendMessage(targetId, `💰 Balansingizga ma'muriyat tomonidan <b>+${amount.toLocaleString()} so'm</b> qo'shildi!\nJoriy balans: <b>${u.balance.toLocaleString()} so'm</b>`, { parse_mode: 'HTML' }).catch(()=>{});
  }
});

// Tarif tanlash
bot.action(/^adm_utariff_(.+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!isAdmin(adminId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  await ctx.answerCbQuery();

  const tariffs = db.getTariffs();
  const buttons = Object.values(tariffs).map(t => [
    Markup.button.callback(`${t.name} (${t.days} kun)`, `adm_sett_${targetId}_${t.id}`)
  ]);

  await ctx.replyWithHTML(
    `🏷 <b>ID <code>${targetId}</code> uchun tarif tanlang:</b>`,
    Markup.inlineKeyboard(buttons)
  );
});

// Tarifni biriktirish callback
bot.action(/^adm_sett_([^_]+)_(.+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!isAdmin(adminId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const tariffId = ctx.match[2];

  const u = db.setTariff(targetId, tariffId);
  if (u) {
    const tariffObj = db.getTariff(tariffId);
    const rem = db.getRemainingTime(targetId);
    await ctx.answerCbQuery(`✅ ${tariffObj.name} berildi!`, { show_alert: true });
    ctx.replyWithHTML(`✅ <b>Foydalanuvchi ${targetId} ga ${tariffObj.name} tarifi berildi!</b>\nMuddati: <b>${rem.text}</b>`);
    bot.telegram.sendMessage(targetId, `🎉 Sizga administrator tomonidan <b>${tariffObj.name}</b> tarifi biriktirildi!\nMuddati: <b>${rem.text}</b>`, { parse_mode: 'HTML' }).catch(()=>{});
  }
});

// Kun qo'shish tanlash
bot.action(/^adm_udays_(.+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!isAdmin(adminId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  await ctx.answerCbQuery();

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('+5 kun', `adm_setd_${targetId}_5`),
      Markup.button.callback('+10 kun', `adm_setd_${targetId}_10`)
    ],
    [
      Markup.button.callback('+30 kun', `adm_setd_${targetId}_30`),
      Markup.button.callback('+90 kun', `adm_setd_${targetId}_90`)
    ]
  ]);

  await ctx.replyWithHTML(
    `📅 <b>ID <code>${targetId}</code> ga obuna kuni qo'shish:</b>\n\nYoki buyruq orqali kiriting: <code>/adddays ${targetId} 30</code>`,
    keyboard
  );
});

// Kunni belgilash callback
bot.action(/^adm_setd_([^_]+)_(.+)$/, async (ctx) => {
  const adminId = ctx.from.id;
  if (!isAdmin(adminId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const days = Number(ctx.match[2]);

  const u = db.addDays(targetId, days);
  if (u) {
    const rem = db.getRemainingTime(targetId);
    await ctx.answerCbQuery(`✅ +${days} kun qo'shildi!`, { show_alert: true });
    ctx.replyWithHTML(`✅ <b>Foydalanuvchi ${targetId} ga +${days} kun qo'shildi!</b>\nYangi muddat: <b>${rem.text}</b>`);
    bot.telegram.sendMessage(targetId, `📅 Obunangizga administrator tomonidan <b>+${days} kun</b> qo'shildi!\nYangi muddat: <b>${rem.text}</b>`, { parse_mode: 'HTML' }).catch(()=>{});
  }
});

// Admin bloklash / blokdan chiqarish buyruqlari
bot.command('block', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const targetId = parts[1];
  if (!targetId) return ctx.reply('Format: /block USER_ID');

  const u = db.setUserBlocked(targetId, true);
  if (u) {
    ctx.reply(`🚫 Foydalanuvchi ${targetId} muvaffaqiyatli bloklandi!`);
    bot.telegram.sendMessage(targetId, '🚫 Sizning profilingiz ma\'muriyat tomonidan bloklandi.').catch(()=>{});
  } else {
    ctx.reply('Foydalanuvchi topilmadi.');
  }
});

bot.command('unblock', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const targetId = parts[1];
  if (!targetId) return ctx.reply('Format: /unblock USER_ID');

  const u = db.setUserBlocked(targetId, false);
  if (u) {
    ctx.reply(`✅ Foydalanuvchi ${targetId} blokdan chiqarildi!`);
    bot.telegram.sendMessage(targetId, '✅ Sizning profilingiz blokdan chiqarildi. Botdan foydalanishingiz mumkin!').catch(()=>{});
  } else {
    ctx.reply('Foydalanuvchi topilmadi.');
  }
});

bot.hears('🏆 Mijozlar Reytingi', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;

  const users = db.getAllUsersDetailed();
  let text = `🏆 <b>ENG FAOL MIJOZLAR REYTINGI (TOP LIST):</b>\n\n`;

  users.forEach((u) => {
    const medal = u.rank === 1 ? '🥇' : u.rank === 2 ? '🥈' : u.rank === 3 ? '🥉' : '🎖';
    text += `${medal} <b>#${u.rank} ${escapeHtml(u.name)}</b> (${u.username ? '@' + escapeHtml(u.username) : 'ID: ' + u.id})\n`;
    text += `   • Darajasi: <b>${u.activity_label}</b> (Ball: ${u.score})\n`;
    text += `   • Botlari: <b>${u.bots_count} ta</b> | Saytlari: <b>${u.sites_count} ta</b> | Balans: <b>${(u.balance||0).toLocaleString()} so'm</b>\n`;
    text += `   • Telefon: <b>${u.phone || 'yo\'q'}</b>\n\n`;
  });

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
  const customDays = parts[3] ? Number(parts[3]) : null;
  if (!targetId || !tariff) return ctx.reply('Format: /settariff USER_ID TARIF [KUN]');

  const u = db.setTariff(targetId, tariff, customDays);
  if (u) {
    const tariffObj = db.getTariff(tariff);
    const rem = db.getRemainingTime(targetId);
    ctx.reply(`✅ Foydalanuvchi ${targetId} ga ${tariffObj.name} tarifi biriktirildi! Yangi muddat: ${rem.text}`);
    bot.telegram.sendMessage(targetId, `🎉 Sizga yangi tarif biriktirildi: <b>${tariffObj.name}</b> (${rem.text})!`, { parse_mode: 'HTML' }).catch(()=>{});
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

bot.command('setphone', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const targetId = parts[1];
  const phone = parts[2];
  if (!targetId || !phone) return ctx.reply('Format: /setphone USER_ID TELEFON');

  const u = db.setUserPhone(targetId, phone);
  if (u) {
    ctx.reply(`✅ Foydalanuvchi ${targetId} telefon raqami yangilandi: ${phone}`);
    bot.telegram.sendMessage(targetId, `📱 Telefon raqamingiz administrator tomonidan biriktirildi: <b>${phone}</b>`, { parse_mode: 'HTML' }).catch(()=>{});
  } else {
    ctx.reply('Foydalanuvchi topilmadi.');
  }
});

// ==================== TARIFLARNI BOSHQARISH (ADMIN) ====================
bot.hears('⚙️ Tariflarni Boshqarish', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;
  userStates.delete(userId);

  const tariffs = db.getTariffs();
  let text = 
`⚙️ <b>TARIFLARNI BOSHQARISH (YAGONA BAZA)</b>\n\n` +
`Bu yerdagi o'zgarishlar Botda ham, Web Appda ham <b>bir zumda</b> kuchga kiradi!\n\n` +
`Har bir tarifning <b>narxini</b> yoki <b>amal qilish kunini (masalan: 5 kun, 10 kun, 30 kun)</b> o'zgartirish uchun kerakli tugmani bosing:\n\n`;

  const buttons = [];

  Object.values(tariffs).forEach(t => {
    const pStr = t.price === 0 ? 'Bepul' : `${t.price.toLocaleString()} so'm`;
    text += `• <b>${t.name}:</b> ${pStr} | <b>${t.days} kun</b> | limit: ${t.maxBots >= 999 ? 'Cheksiz' : t.maxBots + ' ta'}\n`;
    
    buttons.push([
      Markup.button.callback(`💰 ${t.name.split('(')[0].trim()} Narxi`, `adm_t_price_${t.id}`),
      Markup.button.callback(`📅 ${t.days} kunni o'zgartirish`, `adm_t_days_${t.id}`)
    ]);
  });

  text += `\n<i>Shuningdek buyruqlar orqali ham o'zgartirish mumkin:\n/setprice vip 45000\n/setdays vip 10</i>`;

  await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
});

bot.command(['admin_tariffs', 'tariffs_admin'], async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const tariffs = db.getTariffs();
  let text = `⚙️ <b>Tariflar ro'yxati (Baza):</b>\n\n`;
  Object.values(tariffs).forEach(t => {
    text += `• <b>${t.id}:</b> ${t.name} — ${t.price} so'm, ${t.days} kun\n`;
  });
  text += `\nO'zgartirish: /setprice ID NARX yoki /setdays ID KUN`;
  await ctx.replyWithHTML(text);
});

bot.action(/^adm_t_price_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const tariffId = ctx.match[1];
  const tariff = db.getTariff(tariffId);

  userStates.set(userId, { step: 'edit_tariff_price', tariffId });
  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `💰 <b>${tariff.name}</b> uchun yangi narxni kiriting (so'mda, masalan: <code>45000</code> yoki <code>0</code>):`,
    cancelKeyboard
  );
});

bot.action(/^adm_t_days_(.+)$/, async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const tariffId = ctx.match[1];
  const tariff = db.getTariff(tariffId);

  userStates.set(userId, { step: 'edit_tariff_days', tariffId });
  await ctx.answerCbQuery();
  await ctx.replyWithHTML(
    `📅 <b>${tariff.name}</b> uchun necha kun berilishini kiriting (kun soni, masalan: <code>5</code>, <code>10</code> yoki <code>30</code>):`,
    cancelKeyboard
  );
});

bot.command('setprice', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const tariffId = parts[1]?.toLowerCase();
  const price = Number(parts[2]);
  if (!tariffId || isNaN(price)) {
    return ctx.reply('Format: /setprice TARIF_ID NARX (Masalan: /setprice vip 45000)');
  }

  const updated = db.updateTariff(tariffId, { price });
  ctx.replyWithHTML(
    `✅ <b>Tarif narxi yangilandi!</b>\n\n• Tarif: <b>${updated.name}</b>\n• Yangi narx: <b>${updated.price.toLocaleString()} so'm</b>\n• Muddati: <b>${updated.days} kun</b>\n\n<i>Baza Bot va Web Appda bir zumda sinxronlandi!</i>`
  );
});

bot.command('setdays', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts = ctx.message.text.split(' ');
  const tariffId = parts[1]?.toLowerCase();
  const days = Number(parts[2]);
  if (!tariffId || isNaN(days) || days <= 0) {
    return ctx.reply('Format: /setdays TARIF_ID KUN (Masalan: /setdays vip 10)');
  }

  const updated = db.updateTariff(tariffId, { days });
  ctx.replyWithHTML(
    `✅ <b>Tarif amal qilish muddati (kunlar soni) yangilandi!</b>\n\n• Tarif: <b>${updated.name}</b>\n• Yangi muddat: <b>${updated.days} kun</b>\n• Narxi: <b>${updated.price.toLocaleString()} so'm</b>\n\n<i>Baza Bot va Web Appda bir zumda sinxronlandi!</i>`
  );
});

// ==================== HAMMAGA XABAR YUBORISH (RASSILKA) ====================
bot.hears(['📢 Hammaga Xabar Yuborish', '📢 Rassilka'], async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;
  userStates.set(userId, { step: 'awaiting_broadcast' });

  const stats = db.getStats();
  const text = 
`📢 <b>HAMMAGA XABAR YUBORISH (RASSILKA)</b>

📊 Tizimdagi jami mijozlar soni: <b>${stats.totalUsers} ta</b>

Barcha mijozlarga jo'natmoqchi bo'lgan xabaringizni yuboring:
• ✍️ <b>Matn</b> (HTML teglari qo'llab-quvvatlanadi)
• 🖼 <b>Rasm</b> (matn yoki izoh bilan birga)
• 🎥 <b>Video</b> (matn yoki izoh bilan birga)
• 🔁 <b>Forward</b> (istalgan kanal/chatdan post)

<i>Bekor qilish uchun pastdagi "❌ Bekor qilish" tugmasini bosing.</i>`;

  await ctx.replyWithHTML(text, cancelKeyboard);
});

bot.command(['broadcast', 'rassilka'], async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;
  userStates.set(userId, { step: 'awaiting_broadcast' });
  const stats = db.getStats();
  await ctx.replyWithHTML(
    `📢 <b>HAMMAGA XABAR YUBORISH:</b>\n\nJami: <b>${stats.totalUsers} ta</b> foydalanuvchi.\nYubormoqchi bo'lgan xabaringizni yuboring:`,
    cancelKeyboard
  );
});

async function executeBroadcast(ctx) {
  const allUsers = db.getAllUsersDetailed();
  if (!allUsers || allUsers.length === 0) {
    return ctx.reply('Tizimda hali foydalanuvchilar mavjud emas.', adminMenuKeyboard);
  }

  const waitMsg = await ctx.reply(
    `⏳ Xabar tarqatish boshlandi... Jami: ${allUsers.length} ta foydalanuvchi.\nIltimos kuting...`
  );

  let sentCount = 0;
  let failCount = 0;

  for (const u of allUsers) {
    try {
      await ctx.copyMessage(u.id);
      sentCount++;
    } catch (err) {
      failCount++;
    }

    if (allUsers.length > 25) {
      await new Promise(r => setTimeout(r, 40));
    }
  }

  try {
    await ctx.deleteMessage(waitMsg.message_id);
  } catch (e) {}

  const resultMsg = 
`✅ <b>XABAR TARQATISH YAKUNLANDI!</b>

👥 <b>Jami mijozlar:</b> ${allUsers.length} ta
📤 <b>Muvaffaqiyatli yetkazildi:</b> <b>${sentCount} ta</b>
🚫 <b>Yetkazilmadi (bloklaganlar):</b> <b>${failCount} ta</b>`;

  await ctx.replyWithHTML(resultMsg, adminMenuKeyboard);
}

// ==================== INCOMING TEXT (TOKEN INPUT) ====================
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = userStates.get(userId);

  // 📥 INSTAGRAM VA MEDIA HAVOLALARINI AVTOMATIK YUKLASH (Asosiy Botda)
  const isAwaitingInput = state && ['awaiting_broadcast', 'edit_tariff_price', 'edit_tariff_days', 'awaiting_bot_token'].includes(state.step);
  if (!isAwaitingInput && mediaDownloader.isMediaUrl(text)) {
    const mediaUrl = mediaDownloader.extractMediaUrl(text);
    const isInsta = mediaDownloader.isInstagramUrl(mediaUrl);
    const waitMsg = await ctx.replyWithHTML(
      `⏳ <b>${isInsta ? 'Instagram' : 'Media'} video yuklanmoqda...</b>\n<i>Iltimos kuting (odatda 2-5 soniya)...</i>`
    );

    try {
      const dlResult = await mediaDownloader.downloadMedia(mediaUrl);
      if (dlResult.success && dlResult.url) {
        try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}

        const caption =
          `🎬 <b>${escapeHtml(dlResult.title || (isInsta ? 'Instagram Video' : 'Video'))}</b>\n\n` +
          `📥 @${ctx.botInfo?.username || 'MakerBot'} orqali yuklab berildi\n\n` +
          `🤖 <i>O'zingiz ham shunday video yuklovchi yoki boshqa bot ochishni xohlaysizmi? /start bosing!</i>`;

        await mediaDownloader.sendVideoToTelegram(ctx, dlResult.url, caption);
        return;
      } else {
        try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
        return ctx.replyWithHTML(
          `❌ <b>Videoni yuklab bo'lmadi!</b>\n\n${escapeHtml(dlResult.error || 'Havola xato yoki video o\'chirilgan/shaxsiy.')}\n\n<i>Iltimos, ochiq (public) post yoki reels havolasini yuboring.</i>`
        );
      }
    } catch (err) {
      try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
      return ctx.replyWithHTML(
        `❌ <b>Yuklashda xatolik yuz berdi:</b>\n<i>${escapeHtml(err.message)}</i>`
      );
    }
  }

  if (!state) return;

  // HAMMAGA XABAR YUBORISH (RASSILKA)
  if (state.step === 'awaiting_broadcast' && isAdmin(userId)) {
    userStates.delete(userId);
    await executeBroadcast(ctx);
    return;
  }

  // TARIF NARXINI O'ZGARTIRISH (ADMIN)
  if (state.step === 'edit_tariff_price' && isAdmin(userId)) {
    const rawPrice = text.replace(/[^0-9]/g, '');
    const price = Number(rawPrice);
    if (!rawPrice || isNaN(price) || price < 0) {
      return ctx.reply('❌ Iltimos to\'g\'ri narx kiriting (so\'mda, masalan: 40000 yoki 0):', cancelKeyboard);
    }
    userStates.delete(userId);
    const updated = db.updateTariff(state.tariffId, { price });
    return ctx.replyWithHTML(
      `✅ <b>Tarif narxi muvaffaqiyatli yangilandi!</b>\n\n` +
      `• Tarif: <b>${updated.name}</b>\n` +
      `• Yangi narx: <b>${updated.price.toLocaleString()} so'm</b>\n` +
      `• Muddati: <b>${updated.days} kun</b>\n\n` +
      `<i>Bu o'zgarish Botda ham, Web Appda ham bir zumda yangilandi!</i>`,
      adminMenuKeyboard
    );
  }

  // TARIF KUNLAR SONINI O'ZGARTIRISH (ADMIN)
  if (state.step === 'edit_tariff_days' && isAdmin(userId)) {
    const rawDays = text.replace(/[^0-9]/g, '');
    const days = Number(rawDays);
    if (!rawDays || isNaN(days) || days <= 0) {
      return ctx.reply('❌ Iltimos to\'g\'ri kunlar sonini kiriting (masalan: 5, 10 yoki 30):', cancelKeyboard);
    }
    userStates.delete(userId);
    const updated = db.updateTariff(state.tariffId, { days });
    return ctx.replyWithHTML(
      `✅ <b>Tarif amal qilish muddati (kunlar soni) muvaffaqiyatli yangilandi!</b>\n\n` +
      `• Tarif: <b>${updated.name}</b>\n` +
      `• Yangi muddat: <b>${updated.days} kun</b>\n` +
      `• Narxi: <b>${updated.price.toLocaleString()} so'm</b>\n\n` +
      `<i>Bu o'zgarish Botda ham, Web Appda ham bir zumda yangilandi!</i>`,
      adminMenuKeyboard
    );
  }

  // BOT TOKEN KUTISH BOSQICHI
  if (state.step === 'awaiting_bot_token') {
    // Bot tokeni chatda turib qolmasligi uchun foydalanuvchi yuborgan xabarni darhol o'chiramiz
    try {
      await ctx.deleteMessage(ctx.message.message_id);
    } catch (e) {}
    const user = db.getUser(userId) || {};
    const tariffObj = db.getTariff(user.tariff);
    const userBots = db.getBotsByUser(userId);
    const maxBots = tariffObj.maxBots || 1;

    if (userBots.length >= maxBots && !isAdmin(userId)) {
      userStates.delete(userId);
      return ctx.replyWithHTML(
        `⚠️ <b>Kechirasiz, sizning bot yaratish limitingiz to'lgan (${userBots.length}/${maxBots} ta)!</b>\n\nOddiy foydalanuvchilar faqat 1 ta bot yarata oladi. Ko'proq bot yaratish uchun tarifni oshiring!`,
        getMainMenuKeyboard(userId)
      );
    }

    if (!text.includes(':') || text.length < 35) {
      return ctx.replyWithHTML(
        `❌ <b>Token formati noto'g'ri!</b>\n\n` +
        `Bot tokeni taxminan quyidagicha bo'ladi:\n` +
        `<code>1234567890:AAH_xxxx_ExampleToken_xxxx</code>\n\n` +
        `Iltimos, @BotFather dan olgan yangi botingiz tokenni to'liq yuboring:`,
        cancelKeyboard
      );
    }

    if (text.trim() === config.BOT_TOKEN || text.trim().startsWith('8922811264:')) {
      return ctx.replyWithHTML(
        `❌ <b>Bu asosiy Maker Botning o'zining tokeni!</b>\nUni bola bot sifatida ulab bo'lmaydi.\n\nIltimos, o'zingiz @BotFather dan ochgan yangi botingiz tokenni yuboring:`,
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
    let targetBot;
    if (existing) {
      existing.userId = userId;
      existing.botType = state.botType;
      existing.botUsername = verify.username;
      existing.botName = verify.firstName;
      existing.is_active = true;
      const currentDb = db.loadDB();
      if (currentDb.bots && currentDb.bots[existing.id]) {
        currentDb.bots[existing.id] = { ...existing };
        db.saveDB(currentDb);
      }
      targetBot = existing;
    } else {
      targetBot = db.createBot({
        userId,
        token: text,
        botType: state.botType,
        botUsername: verify.username,
        botName: verify.firstName
      });
    }

    userStates.delete(userId);

    // Launch bot 24/7 immediately
    await botManager.startBot(targetBot);

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

// ==================== CHEK QABUL QILISH (PHOTO) VA RASSILKA ====================
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (state && state.step === 'awaiting_broadcast' && isAdmin(userId)) {
    userStates.delete(userId);
    await executeBroadcast(ctx);
    return;
  }

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

// ==================== VIDEO QABUL QILISH (RASSILKA) ====================
bot.on('video', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (state && state.step === 'awaiting_broadcast' && isAdmin(userId)) {
    userStates.delete(userId);
    await executeBroadcast(ctx);
    return;
  }
});

async function startBot() {
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Telegram Bot ulandi: @${me.username} (${me.first_name})`);

    // Remove old webhook & reset chat menu button to default
    await bot.telegram.deleteWebhook().catch(() => {});
    await bot.telegram.setChatMenuButton({ menu_button: { type: 'default' } }).catch(() => {});

    // Ensure clean bot profile info & official name MAKER BOT
    const cleanDescription = `🌟 Assalomu alaykum! MAKER BOT platformasiga xush kelibsiz.\n\n🤖 15 xil Telegram bot konstruktori:\n• Ob-havo, Namoz vaqtlari, Valyuta, QR kod\n• ChatGPT / AI, Tarjimon, Kino, Kanal post\n• Anonim chat, Musiqa, Munajjimlar\n• Viktorina, Bloknot, Kalkulyator, Taklif\n\n⚡️ 24/7 uzluksiz avtomatik hosting!\nBoshlash uchun pastdagi Start tugmasini bosing! 👇`;

    const cleanBio = `🤖 MAKER BOT — Kod yozmasdan Telegram bot yaratish platformasi. O'z botingizni 1 daqiqada ishga tushiring!`;

    await bot.telegram.setMyName('MAKER BOT').catch(() => {});
    await bot.telegram.setMyName('MAKER BOT', 'uz').catch(() => {});
    await bot.telegram.setMyName('MAKER BOT', 'ru').catch(() => {});
    await bot.telegram.setMyName('MAKER BOT', 'en').catch(() => {});

    await bot.telegram.setMyDescription(cleanDescription).catch(() => {});
    await bot.telegram.setMyDescription(cleanDescription, 'uz').catch(() => {});
    await bot.telegram.setMyDescription(cleanDescription, 'ru').catch(() => {});
    await bot.telegram.setMyDescription(cleanDescription, 'en').catch(() => {});

    await bot.telegram.setMyShortDescription(cleanBio).catch(() => {});
    await bot.telegram.setMyShortDescription(cleanBio, 'uz').catch(() => {});
    await bot.telegram.setMyShortDescription(cleanBio, 'ru').catch(() => {});
    await bot.telegram.setMyShortDescription(cleanBio, 'en').catch(() => {});

    bot.launch({ dropPendingUpdates: true }).catch(err => {
      console.error('Bot launch xatolik:', err.message);
    });

    console.log('✅ Asosiy Konstruktor Boti (MAKER BOT) pastki Reply Keyboard tugmalari bilan to\'liq ishga tushdi!');
  } catch (err) {
    console.error('Bot ishga tushirishda xatolik:', err.message);
  }
}

module.exports = { bot, startBot };
