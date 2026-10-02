const { Telegraf, Markup } = require('telegraf');
const config = require('./config');
const db = require('./data/db');
const TEMPLATES = require('./templates/templatesData');

const bot = new Telegraf(config.BOT_TOKEN);

const WEBAPP_URL = `${config.BASE_URL}/webapp`;

// Middleware to track users and log
bot.use(async (ctx, next) => {
  if (ctx.from) {
    db.getOrCreateUser(ctx.from.id, {
      name: ctx.from.first_name || 'Foydalanuvchi',
      username: ctx.from.username || ''
    });
  }
  return next();
});

// Helper for admin check
function isAdmin(userId) {
  return String(userId) === String(config.OWNER_ID);
}

// ==================== /START COMMAND ====================
bot.command('start', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  const user = db.getOrCreateUser(userId, { name, username: ctx.from.username || '' });

  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;
  const sites = db.getSitesByUser(userId);
  const activeCount = sites.filter(s => s.is_active).length;

  const webAppWithUser = `${WEBAPP_URL}?user_id=${userId}&name=${encodeURIComponent(name)}&username=${encodeURIComponent(ctx.from.username || '')}`;

  const welcomeText = 
`🌟 <b>Assalomu alaykum, ${escapeHtml(name)}!</b>

🚀 <b>MAKER BOT — 20-in-1 Professional Sayt Konstruktoriga xush kelibsiz!</b>

Bu yerda siz o'z biznesingiz yoki xizmatlaringiz uchun <b>20 xil zamonaviy sayt</b> yaratishingiz mumkin. Har bir sayt avtomatik tarzda <b>24/7 bepul hostingda</b> ishga tushadi!

👤 <b>Sizning profilingiz:</b>
• 🆔 <b>ID:</b> <code>${userId}</code>
• 🏷 <b>Tarif:</b> <b>${tariffObj.name}</b>
• ⏳ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balans:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🌐 <b>Saytlaringiz:</b> <b>${sites.length} ta</b> (${activeCount} ta faol)

Quyidagi tugmalardan birini tanlang:`;

  const inlineButtons = [
    [Markup.button.webApp('🚀 Web App (20 ta Sayt Konstruktori)', webAppWithUser)],
    [
      Markup.button.callback('➕ Sayt Yaratish', 'btn_create_site'),
      Markup.button.callback('📂 Mening Saytlarim', 'btn_my_sites')
    ],
    [
      Markup.button.callback('⏳ Tarifim & Muddat', 'btn_my_tariff'),
      Markup.button.callback('💳 Balans & To\'lov', 'btn_pay')
    ]
  ];

  if (isAdmin(userId)) {
    inlineButtons.push([Markup.button.callback('👑 Admin Boshqaruv Paneli', 'btn_admin_menu')]);
  }

  await ctx.replyWithHTML(welcomeText, Markup.inlineKeyboard(inlineButtons));
});

// ==================== MENING SAYTLARIM ====================
bot.action('btn_my_sites', async (ctx) => {
  const userId = ctx.from.id;
  const sites = db.getSitesByUser(userId);

  if (sites.length === 0) {
    return ctx.editMessageText(
      `📂 <b>Sizda hali yaratilgan saytlar yo'q.</b>\n\nPastdagi tugmani bosib, 20 xil zamonaviy shablondan birini tanlang va 1 daqiqada o'z saytingizga ega bo'ling!`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Sayt Yaratish', 'btn_create_site')],
          [Markup.button.callback('⬅️ Asosiy Menyu', 'btn_main_menu')]
        ])
      }
    );
  }

  let text = `📂 <b>Sizning 24/7 Hostingdagi Saytlaringiz:</b>\n\n`;
  const buttons = [];

  sites.forEach((s, idx) => {
    const fullUrl = `${config.BASE_URL}/site/${s.slug}`;
    const status = s.is_active ? '🟢 Faol' : '🔴 To\'xtatilgan';
    text += `${idx + 1}. <b>${escapeHtml(s.title)}</b> (${status})\n`;
    text += `🔗 Havola: ${fullUrl}\n\n`;

    buttons.push([Markup.button.url(`🌐 ${s.title} (Ochish)`, fullUrl)]);
  });

  buttons.push([
    Markup.button.callback('➕ Yangi Sayt', 'btn_create_site'),
    Markup.button.callback('⬅️ Menyu', 'btn_main_menu')
  ]);

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...Markup.inlineKeyboard(buttons)
  });
});

// ==================== SAYT YARATISH ====================
bot.action('btn_create_site', async (ctx) => {
  const userId = ctx.from.id;
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

Eng qulay va tezkor usul — <b>Web App</b> orqali shablonlarni ko'rish va 1 marta bosishda sayt yaratish:

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

Pastdagi tugmani bosing va o'z saytingizni yarating:`;

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

  let text = 
`⏳ <b>Sizning Tarifingiz & Muddat:</b>

• 🏷 <b>Amaldagi tarif:</b> <b>${tariffObj.name}</b>
• ⏱ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balans:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 📌 <b>Sayt limiti:</b> ${tariffObj.maxSites} tagacha sayt

💎 <b>Mavjud Tarif Rejalari:</b>
1. <b>🌱 Starter (1 oylik):</b> 15,000 so'm (3 ta sayt)
2. <b>⭐ Pro Standart (1 oylik):</b> 25,000 so'm (10 ta sayt)
3. <b>💼 Business (3 oylik):</b> 60,000 so'm (25 ta sayt)
4. <b>👑 VIP Lifetime (Umrbod):</b> 150,000 so'm (Cheksiz saytlar)

Tarifni faollashtirish uchun pastdagi to'lov tugmasini bosing:`;

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
  const name = ctx.from.first_name || 'Foydalanuvchi';
  const user = db.getUser(userId);
  const remaining = db.getRemainingTime(userId);
  const tariffObj = config.TARIFFS[user.tariff] || config.TARIFFS.trial;
  const sites = db.getSitesByUser(userId);

  const webAppWithUser = `${WEBAPP_URL}?user_id=${userId}&name=${encodeURIComponent(name)}`;

  const text = 
`🌟 <b>Asosiy Menyu:</b>

• 🆔 <b>ID:</b> <code>${userId}</code>
• 🏷 <b>Tarif:</b> <b>${tariffObj.name}</b>
• ⏳ <b>Qolgan vaqt:</b> <b>${remaining.text}</b>
• 💰 <b>Balans:</b> <b>${(user.balance || 0).toLocaleString()} so'm</b>
• 🌐 <b>Saytlar:</b> <b>${sites.length} ta</b>`;

  const inlineButtons = [
    [Markup.button.webApp('🚀 Web App (20 ta Sayt Konstruktori)', webAppWithUser)],
    [
      Markup.button.callback('➕ Sayt Yaratish', 'btn_create_site'),
      Markup.button.callback('📂 Mening Saytlarim', 'btn_my_sites')
    ],
    [
      Markup.button.callback('⏳ Tarifim & Muddat', 'btn_my_tariff'),
      Markup.button.callback('💳 Balans & To\'lov', 'btn_pay')
    ]
  ];

  if (isAdmin(userId)) {
    inlineButtons.push([Markup.button.callback('👑 Admin Boshqaruv Paneli', 'btn_admin_menu')]);
  }

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(inlineButtons)
  });
});

// ==================== CHEK QABUL QILISH (PHOTO) ====================
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'Foydalanuvchi';
  const username = ctx.from.username ? `@${ctx.from.username}` : 'Mavjud emas';
  const photo = ctx.message.photo[ctx.message.photo.length - 1];

  await ctx.reply('✅ To\'lov chekingiz qabul qilindi! Administratorga yuborildi, tez orada tekshirib balansingiz yangilanadi.');

  // Notify admin
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

// Admin menu
bot.action('btn_admin_menu', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');

  const stats = db.getStats();
  const text = 
`👑 <b>ADMIN BOSHQARUV PANELI</b>

📊 <b>Umumiy Statistika:</b>
• 👥 <b>Jami foydalanuvchilar:</b> ${stats.totalUsers} ta
• 🌐 <b>Jami saytlar:</b> ${stats.totalSites} ta
• 🟢 <b>Faol saytlar:</b> ${stats.activeSites} ta
• 🔴 <b>To'xtatilgan saytlar:</b> ${stats.inactiveSites} ta

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

// Admin: Users list
bot.action('adm_users_list', async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');

  const users = db.getAllUsers().slice(-10).reverse(); // Last 10 users
  let text = `👥 <b>Oxirgi 10 ta foydalanuvchi:</b>\n\n`;

  const buttons = [];
  users.forEach(u => {
    const sites = db.getSitesByUser(u.id);
    const rem = db.getRemainingTime(u.id);
    text += `• <b>${escapeHtml(u.name)}</b> (ID: <code>${u.id}</code>) | ${u.tariff} (${rem.text}) | Saytlar: ${sites.length} ta\n`;
    buttons.push([Markup.button.callback(`👤 ${u.name} (Boshqarish)`, `adm_manage_user_${u.id}`)]);
  });

  buttons.push([Markup.button.callback('⬅️ Admin Menyu', 'btn_admin_menu')]);

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Admin: Manage single user
bot.action(/adm_manage_user_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  const user = db.getUser(targetId);
  if (!user) return ctx.answerCbQuery('Foydalanuvchi topilmadi');

  const sites = db.getSitesByUser(targetId);
  const rem = db.getRemainingTime(targetId);

  let text = 
`👤 <b>Foydalanuvchi Ma'lumotlari:</b>
• <b>Ism:</b> ${escapeHtml(user.name)} (@${user.username || 'yo\'q'})
• <b>ID:</b> <code>${user.id}</code>
• <b>Balans:</b> ${(user.balance || 0).toLocaleString()} so'm
• <b>Tarif:</b> ${user.tariff}
• <b>Muddat:</b> ${rem.text}
• <b>Saytlari:</b> ${sites.length} ta\n\n`;

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

  if (sites.length > 0) {
    sites.forEach(s => {
      const toggleAction = `adm_toggle_site_${s.id}_${targetId}`;
      const statusIcon = s.is_active ? '🟢 Faol (O\'chirish)' : '🔴 To\'xtatilgan (Yoqish)';
      buttons.push([Markup.button.callback(`Sayt: ${s.title.slice(0, 15)} -> ${statusIcon}`, toggleAction)]);
    });
  }

  buttons.push([Markup.button.callback('⬅️ Foydalanuvchilar', 'adm_users_list')]);

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons)
  });
});

// Admin: Toggle user site
bot.action(/adm_toggle_site_([^_]+)_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const siteId = ctx.match[1];
  const targetId = ctx.match[2];

  const site = db.toggleSiteStatus(siteId);
  await ctx.answerCbQuery(site ? `Sayt holati: ${site.is_active ? 'Faol qilindi 🟢' : 'To\'xtatildi 🔴'}` : 'Xatolik');

  // Refresh user manage view
  ctx.match = [null, targetId];
  return bot.handleUpdate({
    ...ctx.update,
    callback_query: { ...ctx.callback_query, data: `adm_manage_user_${targetId}` }
  });
});

// Admin: Balance update callback
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

// Admin: Days update callback
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

// Admin: Tariff set callback
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

// Admin: Reject payment
bot.action(/adm_reject_(\d+)/, async (ctx) => {
  if (!isAdmin(ctx.from.id)) return ctx.answerCbQuery('Ruxsat yo\'q!');
  const targetId = ctx.match[1];
  await ctx.answerCbQuery('Rad etildi');
  await bot.telegram.sendMessage(targetId, '❌ To\'lov chekingiz tasdiqlanmadi. Iltimos, ma\'lumotlarni qayta tekshirib yuboring yoki administrator bilan bog\'laning.').catch(() => {});
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function startBot() {
  try {
    const me = await bot.telegram.getMe();
    console.log(`🤖 Telegram Bot ulandi: @${me.username} (${me.first_name})`);

    // Set Menu Button to open Web App
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

    console.log('✅ Bot muvaffaqiyatli ishga tushdi va Web Appga ulandi!');
  } catch (err) {
    console.error('Bot ishga tushirishda xatolik:', err.message);
  }
}

module.exports = { bot, startBot };
