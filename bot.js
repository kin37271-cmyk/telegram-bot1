const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const db = require('./data/db');
const botManager = require('./services/botManager');

const bot = new Telegraf(config.BOT_TOKEN);

const WEBAPP_URL = `${config.BASE_URL}/webapp`;

// In-memory map for user conversation state: userId -> { step, botType }
const userCreationStates = new Map();

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

// ==================== /START COMMAND ====================
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  userCreationStates.delete(userId); // reset any pending state

  const user = db.getOrCreateUser(userId, { name, username: ctx.from.username || '' });
  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;
  const sites = db.getSitesByUser(userId);
  const userBots = db.getBotsByUser(userId);

  const webAppWithUser = `${WEBAPP_URL}?user_id=${userId}&name=${encodeURIComponent(name)}&username=${encodeURIComponent(ctx.from.username || '')}`;

  const welcomeText = 
`🌟 <b>Assalomu alaykum, ${escapeHtml(name)}!</b>

🚀 <b>MAKER BOT — Sayt & Bot Konstruktoriga xush kelibsiz!</b>

Bu yerda siz o'z biznesingiz uchun <b>20 xil zamonaviy sayt</b> va professional <b>Telegram Botlar</b> yaratishingiz mumkin. Barcha sayt va botlar <b>24/7 avto hostingda</b> uzluksiz ishlaydi!

👤 <b>Sizning profilingiz:</b>
• 🆔 <b>ID:</b> <code>${userId}</code>
• 🏷 <b>Tarif:</b> <b>${tariffObj.name}</b>
• ⏳ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balans:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🌐 <b>Saytlaringiz:</b> <b>${sites.length} ta</b>
• 🤖 <b>Botlaringiz:</b> <b>${userBots.length} ta</b>

Quyidagi bo'limlardan birini tanlang:`;

  const inlineButtons = [
    [Markup.button.webApp('🚀 Web App (20 ta Sayt Konstruktori)', webAppWithUser)],
    [
      Markup.button.callback('🤖 Bot Yaratish', 'btn_create_bot'),
      Markup.button.callback('🌐 Sayt Yaratish', 'btn_create_site')
    ],
    [
      Markup.button.callback('📂 Mening Botlarim & Saytlarim', 'btn_my_assets'),
      Markup.button.callback('⏳ Tarif & Muddat', 'btn_my_tariff')
    ],
    [Markup.button.callback('💳 Balans & To\'lov', 'btn_pay')]
  ];

  if (isAdmin(userId)) {
    inlineButtons.push([Markup.button.callback('👑 Admin Boshqaruv Paneli', 'btn_admin_menu')]);
  }

  await ctx.replyWithHTML(welcomeText, Markup.inlineKeyboard(inlineButtons));
});

// ==================== BOT YARATISH BO'LIMI ====================
bot.action('btn_create_bot', async (ctx) => {
  const userId = ctx.from.id;
  userCreationStates.delete(userId);

  const remaining = db.getRemainingTime(userId);
  if (remaining.isExpired && !isAdmin(userId)) {
    return ctx.editMessageText(
      `⚠️ <b>Kechirasiz, sizning tarifingiz muddati tugagan!</b>\n\nYangi bot yaratish uchun iltimos, tarifni uzaytiring yoki hisobingizni to'ldiring.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💳 Balans & To\'lov', 'btn_pay')],
          [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
        ])
      }
    );
  }

  const text = 
`🤖 <b>Qanday turdagi Bot yaratmoqchisiz?</b>

O'zingizga kerakli bot yo'nalishini tanlang:`;

  const buttons = [
    [
      Markup.button.callback('🌦 Ob-havo Boti', 'pick_bot_weather'),
      Markup.button.callback('🕌 Namoz Vaqtlari Boti', 'pick_bot_namoz')
    ],
    [
      Markup.button.callback('💵 Valyuta Kurslari Boti', 'pick_bot_currency'),
      Markup.button.callback('📱 QR Kod Boti', 'pick_bot_qrcode')
    ],
    [
      Markup.button.callback('🤖 ChatGPT / AI Yordamchi', 'pick_bot_ai'),
      Markup.button.callback('🔤 Tarjimon Boti', 'pick_bot_translator')
    ],
    [Markup.button.callback('⬅️ Orqaga', 'btn_main_menu')]
  ];

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Bot Type Selected -> Ask Token
bot.action(/pick_bot_([a-z_]+)/, async (ctx) => {
  const botType = ctx.match[1];
  const userId = ctx.from.id;

  const typeNames = {
    weather: '🌦 Ob-havo Boti',
    namoz: '🕌 Namoz Vaqtlari Boti',
    currency: '💵 Valyuta Kurslari Boti',
    qrcode: '📱 QR Kod Boti',
    ai: '🤖 ChatGPT / AI Boti',
    translator: '🔤 Tarjimon Boti'
  };

  userCreationStates.set(userId, { step: 'awaiting_token', botType });

  const text = 
`🎯 <b>Tanlandi: ${typeNames[botType] || botType}</b>

Endi yangi botingizning <b>API TOKEN</b>ini yuboring!

📌 <b>Tokenni olish yo'riqnomasi:</b>
1. Telegramda <b>@BotFather</b> botiga kiring.
2. <code>/newbot</code> buyrug'ini yuboring va botingizga nom bering.
3. BotFather bergan HTTP API tokenni (masalan: <code>1234567890:AAH...</code>) nusxalab, shu yerga xabar sifatida yuboring!

<i>Bot avtomatik tarzda 24/7 serverimizda ishga tushadi!</i>`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.url('👉 @BotFather ga o\'tish', 'https://t.me/BotFather')],
      [Markup.button.callback('❌ Bekor qilish', 'btn_main_menu')]
    ])
  });
});

// ==================== MENING ASSETLARIM (BOTLAR & SAYTLAR) ====================
bot.action('btn_my_assets', async (ctx) => {
  const userId = ctx.from.id;
  const sites = db.getSitesByUser(userId);
  const bots = db.getBotsByUser(userId);

  if (sites.length === 0 && bots.length === 0) {
    return ctx.editMessageText(
      `📂 <b>Sizda hali yaratilgan bot yoki saytlar yo'q.</b>\n\nPastdagi tugmalar orqali 1 daqiqada o'z botingiz yoki saytingizni ishga tushiring!`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🤖 Bot Yaratish', 'btn_create_bot'),
            Markup.button.callback('🌐 Sayt Yaratish', 'btn_create_site')
          ],
          [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
        ])
      }
    );
  }

  let text = `📂 <b>Sizning 24/7 Faol Loyihalaringiz:</b>\n\n`;
  const buttons = [];

  if (bots.length > 0) {
    text += `🤖 <b>Telegram Botlaringiz (${bots.length} ta):</b>\n`;
    bots.forEach((b, idx) => {
      const status = b.is_active ? '🟢 Faol' : '🔴 To\'xtatilgan';
      text += `${idx + 1}. <b>${escapeHtml(b.botName)}</b> (@${b.botUsername}) — ${status}\n`;
      buttons.push([Markup.button.url(`🤖 @${b.botUsername} ga o'tish`, `https://t.me/${b.botUsername}`)]);
    });
    text += `\n`;
  }

  if (sites.length > 0) {
    text += `🌐 <b>Veb-saytlaringiz (${sites.length} ta):</b>\n`;
    sites.forEach((s, idx) => {
      const fullUrl = `${config.BASE_URL}/site/${s.slug}`;
      const status = s.is_active ? '🟢 Faol' : '🔴 To\'xtatilgan';
      text += `${idx + 1}. <b>${escapeHtml(s.title)}</b> — ${status}\n`;
      buttons.push([Markup.button.url(`🌐 ${s.title} (Ko'rish)`, fullUrl)]);
    });
  }

  buttons.push([
    Markup.button.callback('➕ Yangi Bot', 'btn_create_bot'),
    Markup.button.callback('➕ Yangi Sayt', 'btn_create_site')
  ]);
  buttons.push([Markup.button.callback('⬅️ Menyu', 'btn_main_menu')]);

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...Markup.inlineKeyboard(buttons)
  });
});

// ==================== SAYT YARATISH ====================
bot.action('btn_create_site', async (ctx) => {
  const userId = ctx.from.id;
  userCreationStates.delete(userId);

  const remaining = db.getRemainingTime(userId);
  if (remaining.isExpired && !isAdmin(userId)) {
    return ctx.editMessageText(
      `⚠️ <b>Kechirasiz, sizning tarifingiz muddati tugagan!</b>\n\nYangi sayt yaratish uchun iltimos, tarifni uzaytiring yoki hisobingizni to'ldiring.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💳 Balans & To\'lov', 'btn_pay')],
          [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
        ])
      }
    );
  }

  const webAppWithUser = `${WEBAPP_URL}?user_id=${userId}&name=${encodeURIComponent(ctx.from.first_name || '')}`;

  const text = 
`🚀 <b>20 xil Zamonaviy Sayt Yaratish:</b>

Eng qulay usul — <b>Web App</b> orqali 20 ta shablonni ko'rish va 1 marta bosishda sayt yaratish:

1. 💻 Shaxsiy Portfolio
2. 🍽 Restoran & Kafe
3. 🛍 Kiyim & Mahsulotlar do'koni
4. 🍔 Fast Food & Burger
5. 💈 Barbershop & Salon
6. 📚 O'quv Markazi & Kurslar
7. 🚗 Avtoservis & Detailing
8. 🦷 Stomatologiya & Klinika
9. 🚀 IT Agentlik & Marketing
10. 🏗 Qurilish & Interyer dizayn
... va boshqa 20 xil zamonaviy yo'nalishlar!

Pastdagi tugmani bosing va saytingizni ishga tushiring:`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.webApp('📱 Web Appda Sayt Yaratish', webAppWithUser)],
      [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
    ])
  });
});

// ==================== TARIF & QOLGAN VAQT ====================
bot.action('btn_my_tariff', async (ctx) => {
  const userId = ctx.from.id;
  const user = db.getUser(userId);
  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;

  const text = 
`⏳ <b>Sizning Tarifingiz & Muddat:</b>

• 🏷 <b>Amaldagi tarif:</b> <b>${tariffObj.name}</b>
• ⏱ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balans:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 📌 <b>Limit:</b> ${tariffObj.maxSites} tagacha sayt / bot

💎 <b>Mavjud Tarif Rejalari:</b>
1. <b>🌱 Starter (1 oylik):</b> 15,000 so'm (3 ta loyiha)
2. <b>⭐ Pro Standart (1 oylik):</b> 25,000 so'm (10 ta loyiha)
3. <b>💼 Business (3 oylik):</b> 60,000 so'm (25 ta loyiha)
4. <b>👑 VIP Lifetime (Umrbod):</b> 150,000 so'm (Cheksiz loyihalar)

Tarifni faollashtirish uchun hisobingizni to'ldiring:`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('💳 Balans To\'ldirish / To\'lov', 'btn_pay')],
      [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
    ])
  });
});

// ==================== TO'LOV VA REKVIZITLAR ====================
bot.action('btn_pay', async (ctx) => {
  const text = 
`💳 <b>Hisobni To'ldirish & To'lov</b>

Tarif sotib olish uchun quyidagi rekvizitlarga to'lov qiling:

💳 <b>Karta:</b> <code>${config.CARD_NUMBER}</code>
👤 <b>Karta egasi:</b> <b>${config.CARD_HOLDER}</b>

📌 <b>To'lov tartibi:</b>
1. Yuqoridagi kartaga kerakli summani o'tkazing (masalan, 15 000 yoki 25 000 so'm).
2. To'lov chekini skrinshot qilib ushbu botga rasm holatida yuboring!
3. Administrator chekni tekshirib, hisobingizga pul yoki tarifni darhol biriktirib beradi.`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('⏳ Tariflar Ro\'yxati', 'btn_my_tariff')],
      [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
    ])
  });
});

// ==================== ASOSIY MENYU ====================
bot.action('btn_main_menu', async (ctx) => {
  const userId = ctx.from.id;
  userCreationStates.delete(userId);

  const name = ctx.from.first_name || 'Foydalanuvchi';
  const user = db.getUser(userId);
  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;
  const sites = db.getSitesByUser(userId);
  const bots = db.getBotsByUser(userId);

  const webAppWithUser = `${WEBAPP_URL}?user_id=${userId}&name=${encodeURIComponent(name)}`;

  const text = 
`🌟 <b>Asosiy Menyu:</b>

• 🆔 <b>ID:</b> <code>${userId}</code>
• 🏷 <b>Tarif:</b> <b>${tariffObj.name}</b>
• ⏳ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balans:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🌐 <b>Saytlaringiz:</b> <b>${sites.length} ta</b>
• 🤖 <b>Botlaringiz:</b> <b>${bots.length} ta</b>`;

  const inlineButtons = [
    [Markup.button.webApp('🚀 Web App (20 ta Sayt Konstruktori)', webAppWithUser)],
    [
      Markup.button.callback('🤖 Bot Yaratish', 'btn_create_bot'),
      Markup.button.callback('🌐 Sayt Yaratish', 'btn_create_site')
    ],
    [
      Markup.button.callback('📂 Mening Loyihalarim', 'btn_my_assets'),
      Markup.button.callback('⏳ Tarif & Muddat', 'btn_my_tariff')
    ],
    [Markup.button.callback('💳 Balans & To\'lov', 'btn_pay')]
  ];

  if (isAdmin(userId)) {
    inlineButtons.push([Markup.button.callback('👑 Admin Boshqaruv Paneli', 'btn_admin_menu')]);
  }

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(inlineButtons)
  });
});

// ==================== INCOMING TEXT (TOKEN INPUT) ====================
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();

  // If user is awaiting bot token
  const state = userCreationStates.get(userId);
  if (state && state.step === 'awaiting_token') {
    // Check if token format matches Telegram bot token
    if (!text.includes(':') || text.length < 35) {
      return ctx.reply(
        '❌ <b>Token formati noto\'g\'ri!</b>\n\n' +
        'Bot tokeni taxminan quyidagicha ko\'rinishda bo\'ladi:\n' +
        '<code>8922811264:AAH_PTU_mS38bMfS8HDryVX8pjdhZXdrrvU</code>\n\n' +
        'Iltimos, @BotFather dan olgan tokenni to\'liq yuboring:',
        { parse_mode: 'HTML' }
      );
    }

    const waitMsg = await ctx.reply('⏳ Token tekshirilmoqda va botingiz ishga tushirilmoqda...');

    const verify = await botManager.verifyToken(text);
    if (!verify.valid) {
      return ctx.reply(`❌ <b>Token yaroqsiz!</b>\nTelegram API xatosi: ${verify.error}\n\nIltimos, to'g'ri tokenni yuboring:`, { parse_mode: 'HTML' });
    }

    // Check if duplicate token
    const existing = db.getAllBots().find(b => b.token === text);
    if (existing) {
      userCreationStates.delete(userId);
      return ctx.reply(`⚠️ Ushbu bot allaqachon tizimda ro'yxatdan o'tgan: @${existing.botUsername}`);
    }

    const newBot = db.createBot({
      userId,
      token: text,
      botType: state.botType,
      botUsername: verify.username,
      botName: verify.firstName
    });

    userCreationStates.delete(userId);

    // Launch bot
    await botManager.startBot(newBot);

    try { ctx.deleteMessage(waitMsg.message_id); } catch (e) {}

    const successMsg = 
`🎉 <b>TABRIKLAYMIZ! BOTINGIZ ISHGA TUSHDI!</b>

🤖 <b>Bot nomi:</b> ${escapeHtml(verify.firstName)}
🔗 <b>Havola:</b> @${verify.username}
🛠 <b>Turi:</b> ${state.botType.toUpperCase()}
⚡ <b>Holati:</b> 24/7 Avto Hostingda Faol 🟢

Botingizga kirib <b>/start</b> bosib darhol sinab ko'rishingiz mumkin!`;

    return ctx.replyWithHTML(successMsg, Markup.inlineKeyboard([
      [Markup.button.url(`👉 @${verify.username} ga o'tish`, `https://t.me/${verify.username}`)],
      [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
    ]));
  }
});

// ==================== CHEK QABUL QILISH (PHOTO) ====================
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  const username = ctx.from.username ? `@${ctx.from.username}` : 'Mavjud emas';
  const photo = ctx.message.photo[ctx.message.photo.length - 1];

  await ctx.reply('✅ To\'lov chekingiz qabul qilindi! Administratorga yuborildi, tez orada tekshirib balansingiz yangilanadi.');

  const adminMsg = 
`🔔 <b>YANGI TO'LOV CHEKI KELDI!</b>

👤 <b>Foydalanuvchi:</b> ${escapeHtml(name)} (${username})
🆔 <b>ID:</b> <code>${userId}</code>
📅 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}`;

  const adminButtons = [
    [
      Markup.button.callback(`➕ 15,000 so'm`, `adm_add_bal_${userId}_15000`),
      Markup.button.callback(`➕ 25,000 so'm`, `adm_add_bal_${userId}_25000`)
    ],
    [
      Markup.button.callback(`🌱 Starter (1 oy)`, `adm_set_tar_${userId}_starter`),
      Markup.button.callback(`⭐ Pro (1 oy)`, `adm_set_tar_${userId}_pro`)
    ],
    [
      Markup.button.callback(`👑 VIP Lifetime`, `adm_set_tar_${userId}_vip`),
      Markup.button.callback(`❌ Rad etish`, `adm_reject_${userId}`)
    ]
  ];

  await bot.telegram.sendPhoto(config.OWNER_ID, photo.file_id, {
    caption: adminMsg,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(adminButtons)
  }).catch(e => console.error('Admin xabarida xatolik:', e.message));
});

// ==================== ADMIN ACTIONS ====================

bot.action('btn_admin_menu', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');

  const stats = db.getStats();
  const text = 
`👑 <b>ADMIN BOSHQARUV PANELI</b>

📊 <b>Umumiy Statistika:</b>
• 👥 <b>Jami foydalanuvchilar:</b> ${stats.totalUsers} ta
• 🌐 <b>Jami saytlar:</b> ${stats.totalSites} ta (${stats.activeSites} faol)
• 🤖 <b>Jami botlar:</b> ${stats.totalBots} ta (${stats.activeBots} faol)

Quyidagi amallardan birini tanlang:`;

  const webAppAdmin = `${WEBAPP_URL}?user_id=${ctx.from.id}&admin=1`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.webApp('📱 Web App Admin Paneli', webAppAdmin)],
      [Markup.button.callback('👥 Foydalanuvchilar Ro\'yxati', 'adm_users_list')],
      [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
    ])
  });
});

bot.action('adm_users_list', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');

  const users = db.getAllUsers().slice(-10).reverse();
  let text = `👥 <b>Oxirgi 10 ta foydalanuvchi:</b>\n\n`;

  const buttons = [];
  users.forEach(u => {
    const sites = db.getSitesByUser(u.id);
    const userBots = db.getBotsByUser(u.id);
    const rem = db.getRemainingTime(u.id);
    text += `• <b>${escapeHtml(u.name)}</b> (ID: <code>${u.id}</code>) | ${u.tariff} (${rem.text}) | Sayt: ${sites.length}, Bot: ${userBots.length}\n`;
    buttons.push([Markup.button.callback(`👤 ${u.name} (Boshqarish)`, `adm_manage_user_${u.id}`)]);
  });

  buttons.push([Markup.button.callback('⬅️ Admin Menyu', 'btn_admin_menu')]);

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

bot.action(/adm_manage_user_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const user = db.getUser(targetId);
  if (!user) return ctx.answerCbQuery('Foydalanuvchi topilmadi');

  const sites = db.getSitesByUser(targetId);
  const userBots = db.getBotsByUser(targetId);
  const rem = db.getRemainingTime(targetId);

  let text = 
`👤 <b>Foydalanuvchi:</b>
• <b>Ism:</b> ${escapeHtml(user.name)} (@${user.username || 'yo\'q'})
• <b>ID:</b> <code>${user.id}</code>
• <b>Balans:</b> ${(user.balance || 0).toLocaleString()} so'm
• <b>Tarif:</b> ${user.tariff} (${rem.text})
• <b>Loyihalari:</b> ${sites.length} ta sayt, ${userBots.length} ta bot\n\n`;

  const buttons = [
    [
      Markup.button.callback('➕ 10k so\'m', `adm_add_bal_${targetId}_10000`),
      Markup.button.callback('➖ 10k so\'m', `adm_add_bal_${targetId}_-10000`)
    ],
    [
      Markup.button.callback('➕ 3 kun', `adm_add_days_${targetId}_3`),
      Markup.button.callback('➕ 30 kun', `adm_add_days_${targetId}_30`),
      Markup.button.callback('➖ 5 kun', `adm_add_days_${targetId}_-5`)
    ],
    [
      Markup.button.callback('🌱 Starter', `adm_set_tar_${targetId}_starter`),
      Markup.button.callback('⭐ Pro', `adm_set_tar_${targetId}_pro`),
      Markup.button.callback('👑 VIP', `adm_set_tar_${targetId}_vip`)
    ]
  ];

  if (userBots.length > 0) {
    userBots.forEach(b => {
      const toggleAction = `adm_toggle_bot_${b.id}_${targetId}`;
      const statusIcon = b.is_active ? '🟢 Faol (O\'chirish)' : '🔴 To\'xtatilgan (Yoqish)';
      buttons.push([Markup.button.callback(`Bot: @${b.botUsername} -> ${statusIcon}`, toggleAction)]);
    });
  }

  if (sites.length > 0) {
    sites.forEach(s => {
      const toggleAction = `adm_toggle_site_${s.id}_${targetId}`;
      const statusIcon = s.is_active ? '🟢 Faol (O\'chirish)' : '🔴 To\'xtatilgan (Yoqish)';
      buttons.push([Markup.button.callback(`Sayt: ${s.title.slice(0, 12)} -> ${statusIcon}`, toggleAction)]);
    });
  }

  buttons.push([Markup.button.callback('⬅️ Foydalanuvchilar', 'adm_users_list')]);

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Admin toggle bot
bot.action(/adm_toggle_bot_([^_]+)_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const botId = ctx.match[1];
  const targetId = ctx.match[2];

  const botRecord = db.toggleBotStatus(botId);
  if (botRecord) {
    if (botRecord.is_active) {
      await botManager.startBot(botRecord);
    } else {
      botManager.stopBot(botRecord.id);
    }
  }

  await ctx.answerCbQuery(botRecord ? `Bot holati: ${botRecord.is_active ? 'Faol 🟢' : 'To\'xtatildi 🔴'}` : 'Xato');

  ctx.match = [null, targetId];
  return bot.handleUpdate({
    ...ctx.update,
    callback_query: { ...ctx.callback_query, data: `adm_manage_user_${targetId}` }
  });
});

// Admin toggle site
bot.action(/adm_toggle_site_([^_]+)_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const siteId = ctx.match[1];
  const targetId = ctx.match[2];

  const site = db.toggleSiteStatus(siteId);
  await ctx.answerCbQuery(site ? `Sayt holati: ${site.is_active ? 'Faol 🟢' : 'To\'xtatildi 🔴'}` : 'Xato');

  ctx.match = [null, targetId];
  return bot.handleUpdate({
    ...ctx.update,
    callback_query: { ...ctx.callback_query, data: `adm_manage_user_${targetId}` }
  });
});

// Admin balance update
bot.action(/adm_add_bal_(\d+)_(-?\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const amount = Number(ctx.match[2]);

  const user = db.addBalance(targetId, amount);
  if (user) {
    await ctx.answerCbQuery(`Balans: ${amount > 0 ? '+' : ''}${amount} so'm`);
    await bot.telegram.sendMessage(targetId, `💰 Balansingizga ${amount > 0 ? '+' : ''}${amount.toLocaleString()} so'm qo'shildi! Joriy balans: ${user.balance.toLocaleString()} so'm.`).catch(() => {});
  }
});

// Admin days update
bot.action(/adm_add_days_(\d+)_(-?\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const days = Number(ctx.match[2]);

  const user = db.addDays(targetId, days);
  if (user) {
    const rem = db.getRemainingTime(targetId);
    await ctx.answerCbQuery(`Muddat: ${days > 0 ? '+' : ''}${days} kun`);
    await bot.telegram.sendMessage(targetId, `📅 Obunangizga ${days > 0 ? '+' : ''}${days} kun qo'shildi! Yangi muddat: ${rem.text}.`).catch(() => {});
  }
});

// Admin tariff set
bot.action(/adm_set_tar_(\d+)_([a-z_]+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const tariff = ctx.match[2];

  const user = db.setTariff(targetId, tariff);
  if (user) {
    const tariffObj = config.TARIFFS[tariff] || { name: tariff };
    await ctx.answerCbQuery(`Tarif: ${tariffObj.name} biriktirildi!`);
    await bot.telegram.sendMessage(targetId, `🎉 Tabriklaymiz! Sizga yangi tarif biriktirildi: <b>${tariffObj.name}</b>!`, { parse_mode: 'HTML' }).catch(() => {});
  }
});

// Admin reject payment
bot.action(/adm_reject_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  await ctx.answerCbQuery('Rad etildi');
  await bot.telegram.sendMessage(targetId, '❌ To\'lov chekingiz tasdiqlanmadi. Iltimos, ma\'lumotlarni qayta tekshirib yuboring yoki administrator bilan bog\'laning.').catch(() => {});
});

async function startBot() {
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Telegram Bot ulandi: @${me.username} (${me.first_name})`);

    // Set Menu Button
    await bot.telegram.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: '🚀 Web App',
        web_app: { url: WEBAPP_URL }
      }
    }).catch(e => console.log('Menu button xatolik:', e.message));

    bot.launch({ dropPendingUpdates: true }).catch(err => {
      console.error('Bot launch xatolik:', err.message);
    });

    console.log('✅ Asosiy Bot muvaffaqiyatli ishga tushdi!');
  } catch (err) {
    console.error('Bot ishga tushirishda xatolik:', err.message);
  }
}

module.exports = { bot, startBot };
