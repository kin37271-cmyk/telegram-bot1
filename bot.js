const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const db = require('./data/db');
const botManager = require('./services/botManager');

const bot = new Telegraf(config.BOT_TOKEN);

// User state tracker: userId -> { step, botType, templateId, siteTitle, ... }
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

// ==================== KEYBOARDS (DOIMIY PASTKI TUGMALAR) ====================

// Asosiy Menyu Tugmalari (Pastda turadigan Reply Keyboard)
function getMainMenuKeyboard(userId) {
  const rows = [
    ['🤖 Bot Yaratish', '🌐 Sayt Yaratish'],
    ['📂 Mening Loyihalarim', '⏳ Tarifim & Qolgan Vaqt'],
    ['💳 Balans & To\'lov']
  ];
  if (isAdmin(userId)) {
    rows.push(['👑 Admin Panel']);
  }
  return Markup.keyboard(rows).resize();
}

// Bot Yo'nalishlari Tugmalari
const botTypesKeyboard = Markup.keyboard([
  ['🌦 Ob-havo Boti', '🕌 Namoz Vaqtlari'],
  ['💵 Valyuta Kurslari', '📱 QR Kod Boti'],
  ['🤖 ChatGPT / AI Boti', '🔤 Tarjimon Boti'],
  ['⬅️ Asosiy Menyu']
]).resize();

// Sayt Yo'nalishlari Tugmalari
const siteTemplatesKeyboard = Markup.keyboard([
  ['💻 Shaxsiy Portfolio', '🍽 Restoran & Kafe'],
  ['🛍 Kiyim Do\'koni', '🍔 Fast Food & Burger'],
  ['💈 Barbershop & Salon', '📚 O\'quv Markazi'],
  ['🚗 Avtoservis', '🦷 Stomatologiya'],
  ['🚀 IT Agentlik', '🎮 PUBG & O\'yinlar'],
  ['⬅️ Asosiy Menyu']
]).resize();

// Bekor qilish tugmasi
const cancelKeyboard = Markup.keyboard([
  ['❌ Bekor qilish']
]).resize();

// Admin Panel Tugmalari
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
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  userStates.delete(userId);

  const user = db.getOrCreateUser(userId, { name, username: ctx.from.username || '' });
  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;
  const sites = db.getSitesByUser(userId);
  const bots = db.getBotsByUser(userId);

  const welcomeText = 
`🌟 <b>Assalomu alaykum, ${escapeHtml(name)}!</b>

🚀 <b>MAKER BOT PLATFORMASIGA XUSH KELIBSIZ!</b>

Bu yerda siz to'g'ridan-to'g'ri bot ichida:
• 🤖 <b>Professional Telegram Botlar</b> (Ob-havo, Namoz, Kurslar, QR, AI...)
• 🌐 <b>20 xil zamonaviy Saytlar</b> yaratishingiz mumkin!

Barcha yaratilgan bot va saytlar <b>24/7 avto hostingda</b> uzluksiz ishlaydi.

👤 <b>Sizning profilingiz:</b>
• 🆔 <b>ID:</b> <code>${userId}</code>
• 🏷 <b>Tarifingiz:</b> <b>${tariffObj.name}</b>
• ⏳ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balans:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🤖 <b>Botlaringiz:</b> <b>${bots.length} ta</b>
• 🌐 <b>Saytlaringiz:</b> <b>${sites.length} ta</b>

<i>Pastdagi tugmalardan keraklisini bosing:</i>`;

  await ctx.replyWithHTML(welcomeText, getMainMenuKeyboard(userId));
});

// ==================== BOT YARATISH ====================
bot.hears('🤖 Bot Yaratish', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const remaining = db.getRemainingTime(userId);
  if (remaining.isExpired && !isAdmin(userId)) {
    return ctx.reply(
      `⚠️ Kechirasiz, sizning tarifingiz muddati tugagan!\nYangi bot yaratish uchun tarifni uzaytiring yoki hisobingizni to'ldiring.`,
      getMainMenuKeyboard(userId)
    );
  }

  userStates.set(userId, { step: 'choose_bot_type' });

  const text = 
`🤖 <b>Qanday turdagi Bot yaratmoqchisiz?</b>

Pastdagi tugmalardan birini tanlang:

1. 🌦 <b>Ob-havo Boti</b> — O'zbekiston va dunyo shaharlari harorati, namlik, shamol va GPS orqali aniqlash
2. 🕌 <b>Namoz Vaqtlari</b> — Viloyatlar bo'yicha aniq namoz vaqtlari
3. 💵 <b>Valyuta Kurslari</b> — Markaziy bank kursi (USD, EUR, RUB, KZT) va kalkulyator
4. 📱 <b>QR Kod Boti</b> — Matn va linklarni QR-kodga aylantirish
5. 🤖 <b>ChatGPT / AI Boti</b> — Aqlli savol-javob yordamchisi
6. 🔤 <b>Tarjimon Boti</b> — O'zbek, Rus va Ingliz tillarida tarjimon`;

  await ctx.replyWithHTML(text, botTypesKeyboard);
});

// Bot Turi Tanlanganda
const botTypeMap = {
  '🌦 Ob-havo Boti': { type: 'weather', name: 'Ob-havo Boti' },
  '🕌 Namoz Vaqtlari': { type: 'namoz', name: 'Namoz Vaqtlari Boti' },
  '💵 Valyuta Kurslari': { type: 'currency', name: 'Valyuta Kurslari Boti' },
  '📱 QR Kod Boti': { type: 'qrcode', name: 'QR Kod Boti' },
  '🤖 ChatGPT / AI Boti': { type: 'ai', name: 'ChatGPT / AI Boti' },
  '🔤 Tarjimon Boti': { type: 'translator', name: 'Tarjimon Boti' }
};

Object.keys(botTypeMap).forEach(key => {
  bot.hears(key, async (ctx) => {
    const userId = ctx.from.id;
    const selected = botTypeMap[key];

    userStates.set(userId, { step: 'awaiting_bot_token', botType: selected.type, botTypeName: selected.name });

    const text = 
`🎯 <b>Tanlandi: ${selected.name}</b>

Endi yangi botingizning <b>API TOKEN</b>ini yuboring!

📌 <b>Token olish juda oson:</b>
1. Telegramda <b>@BotFather</b> ga kiring.
2. <code>/newbot</code> yozing va botingizga nom bering.
3. BotFather bergan HTTP API tokenni (masalan: <code>1234567890:AAH...</code>) nusxalab, shu yerga xabar sifatida yuboring!

<i>Bot tokenini yuborishingiz bilan u darhol 24/7 ishga tushiriladi!</i>`;

    await ctx.replyWithHTML(text, cancelKeyboard);
  });
});

// ==================== SAYT YARATISH ====================
bot.hears('🌐 Sayt Yaratish', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const remaining = db.getRemainingTime(userId);
  if (remaining.isExpired && !isAdmin(userId)) {
    return ctx.reply(
      `⚠️ Kechirasiz, sizning tarifingiz muddati tugagan!\nYangi sayt yaratish uchun tarifni uzaytiring.`,
      getMainMenuKeyboard(userId)
    );
  }

  userStates.set(userId, { step: 'choose_site_template' });

  const text = 
`🌐 <b>Qaysi yo'nalishda Veb-sayt yaratmoqchisiz?</b>

Pastdagi tugmalardan kerakli sohani tanlang:`;

  await ctx.replyWithHTML(text, siteTemplatesKeyboard);
});

// Sayt Shabloni Tanlanganda
const siteTemplateMap = {
  '💻 Shaxsiy Portfolio': 'portfolio',
  '🍽 Restoran & Kafe': 'restaurant',
  '🛍 Kiyim Do\'koni': 'shop',
  '🍔 Fast Food & Burger': 'fastfood',
  '💈 Barbershop & Salon': 'barbershop',
  '📚 O\'quv Markazi': 'education',
  '🚗 Avtoservis': 'autoservice',
  '🦷 Stomatologiya': 'clinic',
  '🚀 IT Agentlik': 'agency',
  '🎮 PUBG & O\'yinlar': 'gaming'
};

Object.keys(siteTemplateMap).forEach(key => {
  bot.hears(key, async (ctx) => {
    const userId = ctx.from.id;
    const templateId = siteTemplateMap[key];

    userStates.set(userId, { step: 'awaiting_site_title', templateId, templateName: key });

    await ctx.replyWithHTML(
      `🎯 <b>Tanlandi: ${key}</b>\n\n` +
      `Saytingiz yoki biznesingiz <b>nomini</b> yozing:\n` +
      `<i>(Masalan: Rayhon Osh Markazi yoki Ismoil Portfolio)</i>`,
      cancelKeyboard
    );
  });
});

// ==================== MENING LOYIHALARIM ====================
bot.hears('📂 Mening Loyihalarim', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const sites = db.getSitesByUser(userId);
  const bots = db.getBotsByUser(userId);

  if (sites.length === 0 && bots.length === 0) {
    return ctx.reply(
      `📂 <b>Sizda hali yaratilgan bot yoki saytlar yo'q.</b>\n\nPastdagi "🤖 Bot Yaratish" yoki "🌐 Sayt Yaratish" tugmalarini bosib, darhol o'z loyihangizni boshlang!`,
      { parse_mode: 'HTML', ...getMainMenuKeyboard(userId) }
    );
  }

  let text = `📂 <b>Sizning 24/7 Hostingdagi Loyihalaringiz:</b>\n\n`;

  if (bots.length > 0) {
    text += `🤖 <b>Telegram Botlar (${bots.length} ta):</b>\n`;
    bots.forEach((b, idx) => {
      const status = b.is_active ? '🟢 Faol' : '🔴 To\'xtatilgan';
      text += `${idx + 1}. <b>${escapeHtml(b.botName)}</b> (@${b.botUsername}) — ${status}\n`;
      text += `👉 Kirish: @${b.botUsername}\n\n`;
    });
  }

  if (sites.length > 0) {
    text += `🌐 <b>Veb-saytlar (${sites.length} ta):</b>\n`;
    sites.forEach((s, idx) => {
      const fullUrl = `${config.BASE_URL}/site/${s.slug}`;
      const status = s.is_active ? '🟢 Faol' : '🔴 To\'xtatilgan';
      text += `${idx + 1}. <b>${escapeHtml(s.title)}</b> — ${status}\n`;
      text += `👉 Havola: ${fullUrl}\n\n`;
    });
  }

  await ctx.replyWithHTML(text, { disable_web_page_preview: true, ...getMainMenuKeyboard(userId) });
});

// ==================== TARIF & QOLGAN VAQT ====================
bot.hears('⏳ Tarifim & Qolgan Vaqt', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const user = db.getUser(userId);
  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;
  const sites = db.getSitesByUser(userId);
  const bots = db.getBotsByUser(userId);

  const text = 
`⏳ <b>Sizning Tarifingiz & Muddat:</b>

• 🏷 <b>Amaldagi tarif:</b> <b>${tariffObj.name}</b>
• ⏱ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balansingiz:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🤖 <b>Botlar:</b> ${bots.length} ta
• 🌐 <b>Saytlar:</b> ${sites.length} ta

💎 <b>Mavjud Tarif Rejalari:</b>
1. <b>🎁 Bepul Sinov:</b> 3 kun (1 ta loyiha)
2. <b>🌱 Starter (1 oylik):</b> 15,000 so'm (3 ta loyiha)
3. <b>⭐ Pro Standart (1 oylik):</b> 25,000 so'm (10 ta loyiha)
4. <b>💼 Business (3 oylik):</b> 60,000 so'm (25 ta loyiha)
5. <b>👑 VIP Lifetime (Umrbod):</b> 150,000 so'm (Cheksiz loyihalar)

<i>Hisobni to'ldirish uchun pastdagi "💳 Balans & To'lov" tugmasini bosing.</i>`;

  await ctx.replyWithHTML(text, getMainMenuKeyboard(userId));
});

// ==================== BALANS VA TO'LOV ====================
bot.hears('💳 Balans & To\'lov', async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);

  const text = 
`💳 <b>Hisobni To'ldirish & To'lov</b>

Tarif sotib olish uchun quyidagi kartaga to'lov qiling:

💳 <b>Karta:</b> <code>${config.CARD_NUMBER}</code>
👤 <b>Karta egasi:</b> <b>${config.CARD_HOLDER}</b>

📌 <b>To'lov tartibi:</b>
1. Yuqoridagi kartaga kerakli summani o'tkazing (masalan, 15,000 yoki 25,000 so'm).
2. To'lov chekini skrinshot qilib ushbu botga rasm holatida yuboring!
3. Administrator chekni tasdiqlab, balansingiz yoki tarifingizni darhol yangilab beradi.`;

  await ctx.replyWithHTML(text, getMainMenuKeyboard(userId));
});

// ==================== ASOSIY MENYUGA QAYTISH / BEKOR QILISH ====================
bot.hears(['⬅️ Asosiy Menyu', '❌ Bekor qilish'], async (ctx) => {
  const userId = ctx.from.id;
  userStates.delete(userId);
  await ctx.reply('Asosiy menyudasiz. Kerakli bo\'limni tanlang:', getMainMenuKeyboard(userId));
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
• 🌐 <b>Jami saytlar:</b> ${stats.totalSites} ta (${stats.activeSites} faol)
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
• 🌐 Yaratilgan saytlar: <b>${stats.totalSites} ta</b> (Faol: ${stats.activeSites})
• 🤖 Yaratilgan botlar: <b>${stats.totalBots} ta</b> (Faol: ${stats.activeBots})`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);
});

bot.hears('👥 Foydalanuvchilar', async (ctx) => {
  const userId = ctx.from.id;
  if (!isAdmin(userId)) return;

  const users = db.getAllUsers().slice(-10).reverse();
  let text = `👥 <b>Oxirgi 10 ta foydalanuvchi:</b>\n\n`;

  users.forEach(u => {
    const sites = db.getSitesByUser(u.id);
    const bots = db.getBotsByUser(u.id);
    const rem = db.getRemainingTime(u.id);
    text += `• <b>${escapeHtml(u.name)}</b> (@${u.username || 'yo\'q'})\n  🆔 ID: <code>${u.id}</code> | Balans: ${(u.balance||0).toLocaleString()} so'm\n  Tarif: ${u.tariff} (${rem.text})\n  Saytlar: ${sites.length} ta, Botlar: ${bots.length} ta\n\n`;
  });

  text += `<i>Boshqarish uchun buyruqlar:\n/addmoney ID SUMMA\n/adddays ID KUN\n/settariff ID TARIF (starter, pro, vip)</i>`;

  await ctx.replyWithHTML(text, adminMenuKeyboard);
});

// Admin tezkor buyruqlari
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

// ==================== INCOMING TEXT (DIALOG STEPS) ====================
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();
  const state = userStates.get(userId);

  if (!state) return;

  // 1. BOT TOKEN KUTISH BOSQICHI
  if (state.step === 'awaiting_bot_token') {
    if (!text.includes(':') || text.length < 35) {
      return ctx.replyWithHTML(
        `❌ <b>Token formati noto'g'ri!</b>\n\n` +
        `Bot tokeni taxminan quyidagicha ko'rinishda bo'ladi:\n` +
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

    // Launch bot 24/7
    await botManager.startBot(newBot);

    try { ctx.deleteMessage(waitMsg.message_id); } catch (e) {}

    const successMsg = 
`🎉 <b>TABRIKLAYMIZ! BOTINGIZ ISHGA TUSHDI!</b>

🤖 <b>Bot nomi:</b> ${escapeHtml(verify.firstName)}
🔗 <b>Havola:</b> @${verify.username}
🛠 <b>Yo'nalishi:</b> ${state.botTypeName || state.botType}
⚡ <b>Holati:</b> 24/7 Avto Hostingda Faol 🟢

Hoziroq @${verify.username} ga kirib <b>/start</b> bosib sinab ko'rishingiz mumkin!`;

    return ctx.replyWithHTML(successMsg, getMainMenuKeyboard(userId));
  }

  // 2. SAYT NOMI KUTISH BOSQICHI
  if (state.step === 'awaiting_site_title') {
    state.siteTitle = text;
    state.step = 'awaiting_site_phone';
    userStates.set(userId, state);

    return ctx.replyWithHTML(
      `✅ Sayt nomi: <b>${escapeHtml(text)}</b>\n\n` +
      `Endi mijozlar bog'lanishi uchun <b>telefon raqamingizni</b> yozing:\n` +
      `<i>(Masalan: +998901234567)</i>`,
      cancelKeyboard
    );
  }

  // 3. SAYT TELEFON RAQAM KUTISH BOSQICHI
  if (state.step === 'awaiting_site_phone') {
    state.sitePhone = text;

    const newSite = db.createSite({
      userId,
      templateId: state.templateId || 'portfolio',
      title: state.siteTitle,
      description: `${state.siteTitle} — 24/7 professional rasmiy veb-sayti.`,
      phone: state.sitePhone,
      telegram: ctx.from.username ? `@${ctx.from.username}` : ''
    });

    userStates.delete(userId);

    const fullUrl = `${config.BASE_URL}/site/${newSite.slug}`;

    const successMsg = 
`🎉 <b>TABRIKLAYMIZ! VEB-SAYTINGIZ TAYYOR!</b>

🌐 <b>Sayt nomi:</b> ${escapeHtml(newSite.title)}
🔗 <b>24/7 Doimiy Havolangiz:</b>
${fullUrl}

⚡ <b>Holati:</b> 24/7 Avto Hostingda Faol 🟢
Saytingiz har qanday telefon va kompyuterga 100% moslashgan va tezkor ishlaydi!`;

    return ctx.replyWithHTML(successMsg, { disable_web_page_preview: false, ...getMainMenuKeyboard(userId) });
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

<i>Hisobiga pul qo'shish uchun:</i>
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

    // Remove any previous webhook
    await bot.telegram.deleteWebhook().catch(() => {});

    bot.launch({ dropPendingUpdates: true }).catch(err => {
      console.error('Bot launch xatolik:', err.message);
    });

    console.log('✅ Asosiy Bot pastki Reply Keyboard tugmalari bilan to\'liq ishga tushdi!');
  } catch (err) {
    console.error('Bot ishga tushirishda xatolik:', err.message);
  }
}

module.exports = { bot, startBot };
