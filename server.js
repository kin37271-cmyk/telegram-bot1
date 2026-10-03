const express = require('express');
const path = require('path');
const cors = require('cors');
const https = require('https');
const config = require('./config');
const db = require('./data/db');
const TEMPLATES = require('./templates/templatesData');
const { renderSiteHtml } = require('./templates/renderer');
const botManager = require('./services/botManager');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Web App SPA
app.get(['/webapp', '/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'webapp.html'));
});

// Render user's site 24/7 on /site/:slug
app.get(['/site/:slug', '/s/:slug'], (req, res) => {
  const { slug } = req.params;
  const site = db.getSite(slug);

  if (!site) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>Sayt topilmadi</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="bg-slate-950 text-white flex items-center justify-center min-h-screen p-4 text-center">
        <div class="max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl">
          <div class="text-4xl mb-4">🔍</div>
          <h1 class="text-xl font-bold mb-2">Sayt topilmadi</h1>
          <p class="text-slate-400 text-xs mb-6">Ushbu havola bo'yicha veb-sayt mavjud emas yoki o'chirilgan bo'lishi mumkin.</p>
          <a href="https://t.me/MakerrUzbBot" class="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold">🤖 Maker Botga o'tish</a>
        </div>
      </body>
      </html>
    `);
  }

  db.incrementSiteViews(site.id);

  const owner = db.getUser(site.userId);
  if (owner && owner.expires_at && owner.expires_at < Date.now()) {
    return res.send(renderSiteHtml({ ...site, is_active: false }));
  }

  const html = renderSiteHtml(site);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ===================== REST API =====================

// 1. Templates (Saytlar & Botlar)
app.get('/api/templates', (req, res) => {
  res.json(TEMPLATES);
});

app.get('/api/bot-templates', (req, res) => {
  res.json(botManager.BOT_TEMPLATES || []);
});

// 2. User info
app.get('/api/me', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });

  const name = req.query.name || 'Foydalanuvchi';
  const username = req.query.username || '';
  const photoUrl = req.query.photo_url || '';
  const user = db.getOrCreateUser(userId, { name, username, photo_url: photoUrl });

  const remaining = db.getRemainingTime(userId);
  const tariffObj = db.getTariff(user.tariff);
  const detailedUsers = db.getAllUsersDetailed();
  const detailed = detailedUsers.find(u => String(u.id) === String(userId)) || {};

  res.json({
    id: user.id,
    name: user.name,
    username: user.username,
    phone: user.phone || '',
    photo_url: user.photo_url || detailed.photo_url,
    balance: user.balance || 0,
    tariff: user.tariff,
    tariff_name: tariffObj.name,
    expires_at: user.expires_at,
    is_expired: remaining.isExpired,
    remaining_text: remaining.text,
    remaining_days: remaining.days,
    is_admin: String(userId) === String(config.OWNER_ID),
    score: detailed.score || 0,
    activity_level: detailed.activity_level || 'new',
    activity_label: detailed.activity_label || '🌱 Yangi Mijoz',
    rank: detailed.rank || detailedUsers.length,
    tariffs: db.getTariffs()
  });
});

// 2.0 Get public tariffs list
app.get('/api/tariffs', (req, res) => {
  res.json({ success: true, tariffs: db.getTariffs() });
});

// 2.1 Update user phone
app.post('/api/user/phone', (req, res) => {
  const { user_id, phone } = req.body;
  if (!user_id || !phone) {
    return res.status(400).json({ success: false, message: 'user_id va phone kiritilishi shart' });
  }
  const updated = db.setUserPhone(user_id, phone);
  res.json({ success: !!updated, user: updated });
});

// 3. User's sites
app.get('/api/sites', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  const sites = db.getSitesByUser(userId);
  res.json(sites);
});

// 4. Create site
app.post('/api/sites', (req, res) => {
  const { userId, templateId, title, description, phone, telegram, address, services } = req.body;
  if (!userId || !title) {
    return res.status(400).json({ success: false, message: 'Foydalanuvchi va sarlavha kiritilishi shart' });
  }

  const user = db.getUser(userId);
  if (!user) {
    return res.status(400).json({ success: false, message: 'Foydalanuvchi topilmadi' });
  }

  const remaining = db.getRemainingTime(userId);
  if (remaining.isExpired && String(userId) !== String(config.OWNER_ID)) {
    return res.status(403).json({
      success: false,
      message: 'Tarifingiz muddati tugagan! Iltimos, obunani uzaytiring yoki balansni to\'ldiring.'
    });
  }

  const userSites = db.getSitesByUser(userId);
  const tariff = db.getTariff(user.tariff);
  const maxAllowed = tariff.maxSites || 1;

  if (userSites.length >= maxAllowed && String(userId) !== String(config.OWNER_ID)) {
    return res.status(403).json({
      success: false,
      message: `Sizning tarifingizda ko'pi bilan ${maxAllowed} ta sayt yaratish mumkin. Tarifni oshiring!`
    });
  }

  const site = db.createSite({
    userId,
    templateId,
    title,
    description,
    phone,
    telegram,
    address,
    services
  });

  res.json({ success: true, site });
});

// 5. Delete site
app.delete('/api/sites/:id', (req, res) => {
  const siteId = req.params.id;
  const userId = req.query.user_id;
  const success = db.deleteSite(siteId, userId);
  res.json({ success });
});

// 6. User's bots
app.get('/api/bots', (req, res) => {
  const userId = req.query.user_id;
  if (!userId) return res.status(400).json({ error: 'user_id required' });
  const bots = db.getBotsByUser(userId);
  res.json(bots);
});

// 7. Create bot via API (token based)
app.post('/api/bots', async (req, res) => {
  const { userId, token, botType } = req.body;
  if (!userId || !token) {
    return res.status(400).json({ success: false, message: 'Foydalanuvchi va token kiritilishi shart' });
  }

  const user = db.getUser(userId);
  if (!user) {
    return res.status(400).json({ success: false, message: 'Foydalanuvchi topilmadi' });
  }

  const remaining = db.getRemainingTime(userId);
  if (remaining.isExpired && String(userId) !== String(config.OWNER_ID)) {
    return res.status(403).json({
      success: false,
      message: 'Tarifingiz muddati tugagan! Yangi bot yaratish uchun obunani uzaytiring yoki balansni to\'ldiring.'
    });
  }

  const userBots = db.getBotsByUser(userId);
  const tariff = db.getTariff(user.tariff);
  const maxAllowed = tariff.maxBots || 1;

  if (userBots.length >= maxAllowed && String(userId) !== String(config.OWNER_ID)) {
    return res.status(403).json({
      success: false,
      message: `Oddiy mijozlar va "${tariff.name}" tarifida ko'pi bilan ${maxAllowed} ta bot yaratish mumkin! Sizda allaqachon ${userBots.length} ta bot mavjud. Ko'proq bot yaratish uchun tarifni oshiring!`
    });
  }

  const cleanToken = token.trim();
  if (cleanToken === config.BOT_TOKEN || cleanToken.startsWith('8922811264:')) {
    return res.status(400).json({ success: false, message: 'Asosiy Maker Bot tokenini kiritish taqiqlangan! O\'zingiz ochgan yangi bot tokenni kiriting.' });
  }
  const verify = await botManager.verifyToken(cleanToken);
  if (!verify.valid) {
    return res.status(400).json({ success: false, message: 'BotFather tokeni noto\'g\'ri! Qayta tekshiring.' });
  }

  // Check existing token
  const existing = db.getAllBots().find(b => b.token === cleanToken);
  let targetBot;
  if (existing) {
    existing.userId = userId;
    existing.botType = botType || 'weather';
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
      token: cleanToken,
      botType: botType || 'weather',
      botUsername: verify.username,
      botName: verify.firstName
    });
  }

  // Launch bot 24/7
  await botManager.startBot(targetBot);

  res.json({ success: true, bot: targetBot });
});

// 8. Delete bot
app.delete('/api/bots/:id', (req, res) => {
  const botId = req.params.id;
  const userId = req.query.user_id;

  botManager.stopBot(botId);
  const success = db.deleteBot(botId, userId);
  res.json({ success });
});

// 8.1 Toggle bot status (Active / Inactive) for owner & admin
app.post('/api/bots/:id/toggle', async (req, res) => {
  const botId = req.params.id;
  const userId = req.body.userId || req.query.user_id;
  if (!userId) return res.status(400).json({ success: false, message: 'userId talab qilinadi' });

  const botRecord = db.getBot(botId);
  if (!botRecord) return res.status(404).json({ success: false, message: 'Bot topilmadi' });

  if (String(botRecord.userId) !== String(userId) && String(userId) !== String(config.OWNER_ID)) {
    return res.status(403).json({ success: false, message: 'Ruxsat berilmagan' });
  }

  const updated = db.toggleBotStatus(botId);
  if (updated) {
    if (updated.is_active) {
      await botManager.startBot(updated);
    } else {
      botManager.stopBot(updated.id);
    }
    return res.json({ success: true, bot: updated });
  }
  res.status(500).json({ success: false, message: 'Holatni o\'zgartirib bo\'lmadi' });
});

// ===================== ADMIN API =====================

function isAdmin(adminId) {
  return String(adminId) === String(config.OWNER_ID);
}

// Admin stats
app.get('/api/admin/stats', (req, res) => {
  if (!isAdmin(req.query.admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });
  const stats = db.getStats();
  res.json(stats);
});

// Admin users with full rating, photo, phone, and metrics
app.get('/api/admin/users', (req, res) => {
  if (!isAdmin(req.query.admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });
  const users = db.getAllUsersDetailed();
  res.json(users);
});

// Admin rating
app.get('/api/admin/rating', (req, res) => {
  if (!isAdmin(req.query.admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });
  const users = db.getAllUsersDetailed();
  res.json(users);
});

// Admin update user phone
app.post('/api/admin/phone', (req, res) => {
  const { admin_id, target_user_id, phone } = req.body;
  if (!isAdmin(admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const user = db.setUserPhone(target_user_id, phone);
  res.json({ success: !!user, user });
});

// Admin toggle site
app.post('/api/admin/toggle-site', (req, res) => {
  const { admin_id, site_id, is_active } = req.body;
  if (!isAdmin(admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const site = db.toggleSiteStatus(site_id, is_active);
  res.json({ success: !!site, site });
});

// Admin toggle bot
app.post('/api/admin/toggle-bot', (req, res) => {
  const { admin_id, bot_id, is_active } = req.body;
  if (!isAdmin(admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const botRecord = db.toggleBotStatus(bot_id, is_active);
  if (botRecord) {
    if (botRecord.is_active) {
      botManager.startBot(botRecord);
    } else {
      botManager.stopBot(botRecord.id);
    }
  }
  res.json({ success: !!botRecord, bot: botRecord });
});

// Admin balance
app.post('/api/admin/balance', (req, res) => {
  const { admin_id, target_user_id, amount } = req.body;
  if (!isAdmin(admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const user = db.addBalance(target_user_id, amount);
  res.json({ success: !!user, user });
});

// Admin days
app.post('/api/admin/days', (req, res) => {
  const { admin_id, target_user_id, days } = req.body;
  if (!isAdmin(admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const user = db.addDays(target_user_id, days);
  res.json({ success: !!user, user });
});

// Admin set user tariff
app.post('/api/admin/tariff', (req, res) => {
  const { admin_id, target_user_id, tariff, days } = req.body;
  if (!isAdmin(admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  const user = db.setTariff(target_user_id, tariff, days);
  res.json({ success: !!user, user });
});

// Admin get all tariffs
app.get('/api/admin/tariffs', (req, res) => {
  if (!isAdmin(req.query.admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });
  res.json({ success: true, tariffs: db.getTariffs() });
});

// Admin update tariff details (narx, kun, nom, tavsif)
app.post('/api/admin/tariffs', (req, res) => {
  const { admin_id, tariff_id, name, price, days, maxBots, maxSites, description } = req.body;
  if (!isAdmin(admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });
  if (!tariff_id) return res.status(400).json({ error: 'tariff_id talab qilinadi' });

  const updated = db.updateTariff(tariff_id, {
    name,
    price,
    days,
    maxBots,
    maxSites,
    description
  });
  res.json({ success: true, tariff: updated, tariffs: db.getTariffs() });
});

// Admin Broadcast (Xabar tarqatish - Barcha foydalanuvchilarga)
app.post('/api/admin/broadcast', async (req, res) => {
  const { admin_id, message, photo_url } = req.body;
  if (!isAdmin(admin_id)) return res.status(403).json({ error: 'Ruxsat yo\'q' });

  if (!message && !photo_url) {
    return res.status(400).json({ success: false, message: 'Xabar matni yoki rasm kiritilishi shart' });
  }

  const { bot } = require('./bot');
  const allUsers = db.getAllUsersDetailed ? db.getAllUsersDetailed() : [];
  let sent = 0;
  let failed = 0;

  for (const u of allUsers) {
    try {
      if (photo_url) {
        await bot.telegram.sendPhoto(u.id, photo_url, {
          caption: message || '',
          parse_mode: 'HTML'
        });
      } else {
        await bot.telegram.sendMessage(u.id, message, {
          parse_mode: 'HTML'
        });
      }
      sent++;
    } catch (e) {
      failed++;
    }

    if (allUsers.length > 25) {
      await new Promise(r => setTimeout(r, 40));
    }
  }

  res.json({
    success: true,
    total: allUsers.length,
    sent,
    failed
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), time: new Date().toISOString() });
});

function startServer() {
  const port = config.PORT;
  app.listen(port, () => {
    console.log(`🚀 HTTP Server ${port}-portda ishga tushdi! (Web App: /webapp)`);
  });

  if (config.BASE_URL) {
    setInterval(() => {
      https.get(`${config.BASE_URL}/health`, () => {}).on('error', () => {});
    }, 4 * 60 * 1000);
  }
}

module.exports = { app, startServer };
