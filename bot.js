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

// 2. 16 ta Bot Yo'nalishlari Tugmalari (Reply Keyboard)
const botTypesKeyboard = Markup.keyboard([
  ['🌦 Ob-havo Boti', '🕌 Namoz Vaqtlari'],
  ['💵 Valyuta Kurslari', '📱 QR Kod Boti'],
  ['🤖 ChatGPT / AI Boti', '🔤 Tarjimon Boti'],
  ['🎬 Kino Topuvchi', '📢 Kanal & Avto-Post'],
  ['🎭 Anonim Chat Boti', '📥 Video Yuklovchi'],
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

    db.getOrCreateUser(ctx.from.id, {
      name: ctx.from.first_name || 'Foydalanuvchi',
      username: ctx.from.username || '',
      photo_url: photoUrl
    });
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

🤖 <b>MAKER BOT PLATFORMASI (16-IN-1 BOT KONSTRUKTOR)</b>

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

// ==================== 16 TA BOT YARATISH BO'LIMI ====================
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

1. 🌦 <b>Ob-havo Boti</b> — Real vaqtdagi harorat, shamol va GPS ob-havo
2. 🕌 <b>Namoz Vaqtlari Boti</b> — O'zbekiston viloyatlari bo'yicha aniq namoz vaqtlari
3. 💵 <b>Valyuta Kurslari Boti</b> — Markaziy bank kursi (USD, EUR, RUB) va kalkulyator
4. 📱 <b>QR Kod Boti</b> — Matn, havola yoki telefonni QR-kodga aylantirish
5. 🤖 <b>ChatGPT / AI Boti</b> — Aqlli savol-javob sun'iy intellekt boti
6. 🔤 <b>Tarjimon Boti</b> — O'zbek, Rus va Ingliz tillarida tezkor tarjimon
7. 🎬 <b>Kino Topuvchi Boti</b> — Kod orqali kinolarni topib beruvchi bot
8. 📢 <b>Kanal & Avto-Post Boti</b> — Kanallarga chiroyli postlar joylash boti
9. 🎭 <b>Anonim Chat Boti</b> — Tasodifiy begona bilan suhbat va maxfiy xabarlar
10. 📥 <b>Video Yuklovchi</b> — Instagram Reels, TikTok (suvsiz) va YouTube
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
  '🌦 Ob-havo Boti': { type: 'weather', name: 'Ob-havo Boti' },
  '🕌 Namoz Vaqtlari': { type: 'namoz', name: 'Namoz Vaqtlari Boti' },
  '💵 Valyuta Kurslari': { type: 'currency', name: 'Valyuta Kurslari Boti' },
  '📱 QR Kod Boti': { type: 'qrcode', name: 'QR Kod Boti' },
  '🤖 ChatGPT / AI Boti': { type: 'ai', name: 'ChatGPT / AI Boti' },
  '🔤 Tarjimon Boti': { type: 'translator', name: 'Tarjimon Boti' },
  '🎬 Kino Topuvchi': { type: 'cinema', name: 'Kino Topuvchi Boti' },
  '📢 Kanal & Avto-Post': { type: 'channel', name: 'Kanal & Avto-Post Boti' },
  '🎭 Anonim Chat Boti': { type: 'anonymous', name: 'Anonim Chat Boti' },
  '📥 Video Yuklovchi': { type: 'downloader', name: 'Media & Video Yuklovchi' },
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
    [Markup.button.webApp('🚀 Web App-ni Ochish (16 xil Bot & 20 xil Sayt)', webAppUrl)]
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

// Tarif sotib olish callback
bot.action(/^buy_tariff_(.+)$/, async (ctx) => {
  const tariffId = ctx.match[1];
  const userId = ctx.from.id;
  const user = db.getUser(userId) || {};
  const tariffs = db.getTariffs();
  const tariff = tariffs[tariffId];

  if (!tariff) {
    return ctx.answerCbQuery('Tarif topilmadi!', { show_alert: true });
  }

  const currentBalance = user.balance || 0;
  if (currentBalance < tariff.price) {
    const diff = tariff.price - currentBalance;
    await ctx.answerCbQuery('Mablag\' yetarli emas!', { show_alert: true });
    return ctx.replyWithHTML(
      `⚠️ <b>Mablag'ingiz yetarli emas!</b>\n\n` +
      `• Tanlangan tarif: <b>${tariff.name}</b>\n` +
      `• Narxi: <b>${tariff.price.toLocaleString()} so'm</b> (${tariff.days} kunlik obuna)\n` +
      `• Sizning balansingiz: <b>${currentBalance.toLocaleString()} so'm</b>\n` +
      `• Yetishmayotgan summa: <b>${diff.toLocaleString()} so'm</b>\n\n` +
      `💳 <i>To'lov qilish uchun pastdagi kartaga pul o'tkazing va chekni botga yuboring:</i>\n` +
      `💳 Karta: <code>${config.CARD_NUMBER}</code>\n` +
      `👤 Egasi: <b>${config.CARD_HOLDER}</b>`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💳 To\'lov Yo\'riqnomasi', 'action_topup_balance')]
      ])
    );
  }

  // Balansdan yechish va tarif biriktirish
  db.addBalance(userId, -tariff.price);
  db.setTariff(userId, tariffId, tariff.days);
  const updatedRem = db.getRemainingTime(userId);
  const updatedUser = db.getUser(userId);

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

  const users = db.getAllUsersDetailed().slice(0, 10);
  let text = `👥 <b>Foydalanuvchilar Ro'yxati (Top 10):</b>\n\n`;

  users.forEach((u, idx) => {
    const phoneStr = u.phone ? `📱 ${u.phone}` : '📱 Telefon: yo\'q';
    text += `<b>${idx + 1}. ${escapeHtml(u.name)}</b> (${u.username ? '@' + escapeHtml(u.username) : 'usernamesiz'})\n`;
    text += `   • 🆔 ID: <code>${u.id}</code> | ${phoneStr}\n`;
    text += `   • 💰 Balans: <b>${(u.balance||0).toLocaleString()} so'm</b> | Tarif: <b>${u.tariff}</b> (${u.remaining_text})\n`;
    text += `   • 🤖 Botlar: <b>${u.bots_count} ta</b> (${u.active_bots_count} faol) | 🌐 Saytlar: <b>${u.sites_count} ta</b>\n`;
    text += `   • 🏆 Reyting: <b>#${u.rank}</b> (${u.activity_label})\n\n`;
  });

  text += `<i>Boshqaruv buyruqlari:\n/addmoney ID SUMMA\n/adddays ID KUN\n/settariff ID TARIF\n/setphone ID TEL\n/togglebot BOT_ID</i>`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);
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
    const cleanDescription = `🤖 MAKER BOT — Telegram Botlar Konstruktori!

Bu bot orqali siz o'zingizning shaxsiy Telegram botingizni 1 daqiqada bepul va oson yaratishingiz mumkin.

🚀 16 xil turdagi professional botlar:
• 🌦 Ob-havo & 🕌 Namoz Vaqtlari
• 💵 Valyuta & 📱 QR Kod
• 🤖 ChatGPT / AI & 🔤 Tarjimon
• 🎬 Kino & 📢 Avto-Post
• 📥 Video Yuklovchi (Instagram, TikTok, YouTube)
• 🎵 Musiqa Qidiruvchi (320kbps MP3)
• 🔮 Munajjimlar & 🧠 Viktorina
• 📝 Bloknot & 🧮 Kalkulyator
• 📨 Taklif & Murojaat

Quyidagi "Start" tugmasini bosing va o'z botingizni yarating! 👇`;

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
