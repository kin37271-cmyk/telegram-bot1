const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getInitialDB() {
  return {
    users: {},
    sites: {},
    bots: {},
    payments: {},
    settings: {
      owner_id: config.OWNER_ID,
      card_number: config.CARD_NUMBER,
      card_holder: config.CARD_HOLDER
    }
  };
}

let memoryDB = null;

function loadDB() {
  if (memoryDB) return memoryDB;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      memoryDB = { ...getInitialDB(), ...data };
      if (!memoryDB.bots) memoryDB.bots = {};
      return memoryDB;
    }
  } catch (err) {
    console.error('Baza yuklashda xatolik:', err.message);
  }
  memoryDB = getInitialDB();
  saveDB(memoryDB);
  return memoryDB;
}

function saveDB(db) {
  try {
    memoryDB = db;
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Bazaga yozishda xatolik:', err.message);
  }
}

const dbManager = {
  loadDB,
  saveDB,

  getUser(userId) {
    const db = loadDB();
    return db.users[userId] || null;
  },

  getOrCreateUser(userId, profile = {}) {
    const db = loadDB();
    const strId = String(userId);
    if (!db.users[strId]) {
      const trialDays = config.TRIAL_DAYS || 3;
      const expiresAt = Date.now() + (trialDays * 24 * 60 * 60 * 1000);

      db.users[strId] = {
        id: userId,
        name: profile.name || 'Foydalanuvchi',
        username: profile.username || '',
        phone: profile.phone || '',
        photo_url: profile.photo_url || '',
        balance: 0,
        tariff: 'trial',
        trial_used: true,
        expires_at: expiresAt,
        is_blocked: false,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      };
      saveDB(db);
    } else {
      let changed = false;
      const u = db.users[strId];
      if (profile.name && u.name !== profile.name) {
        u.name = profile.name;
        changed = true;
      }
      if (profile.username && u.username !== profile.username) {
        u.username = profile.username;
        changed = true;
      }
      if (profile.phone && u.phone !== profile.phone) {
        u.phone = profile.phone;
        changed = true;
      }
      if (profile.photo_url && u.photo_url !== profile.photo_url) {
        u.photo_url = profile.photo_url;
        changed = true;
      }
      u.last_active = new Date().toISOString();
      changed = true;
      if (changed) saveDB(db);
    }
    return db.users[strId];
  },

  setUserPhone(userId, phone) {
    const db = loadDB();
    const strId = String(userId);
    if (db.users[strId]) {
      db.users[strId].phone = String(phone).trim();
      db.users[strId].last_active = new Date().toISOString();
      saveDB(db);
      return db.users[strId];
    }
    return null;
  },

  setUserPhoto(userId, photoUrl) {
    const db = loadDB();
    const strId = String(userId);
    if (db.users[strId]) {
      db.users[strId].photo_url = photoUrl;
      saveDB(db);
      return db.users[strId];
    }
    return null;
  },

  updateUser(userId, data) {
    const db = loadDB();
    const strId = String(userId);
    if (db.users[strId]) {
      db.users[strId] = { ...db.users[strId], ...data, last_active: new Date().toISOString() };
      saveDB(db);
      return db.users[strId];
    }
    return null;
  },

  getAllUsers() {
    const db = loadDB();
    return Object.values(db.users);
  },

  getRemainingTime(userId) {
    const user = this.getUser(userId);
    if (!user) return { days: 0, hours: 0, isExpired: true, text: 'Mavjud emas' };

    const now = Date.now();
    const diff = user.expires_at - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, isExpired: true, text: 'Muddati tugagan ❌' };
    }

    const totalHours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let text = '';
    if (days > 0) {
      text = `${days} kun, ${hours} soat`;
    } else {
      text = `${hours} soat, ${minutes} daqiqa`;
    }

    return { days, hours, minutes, totalHours, isExpired: false, text };
  },

  addBalance(userId, amount) {
    const db = loadDB();
    const strId = String(userId);
    const user = db.users[strId];
    if (!user) return null;
    user.balance = Math.max(0, (user.balance || 0) + Number(amount));
    user.last_active = new Date().toISOString();
    saveDB(db);
    return user;
  },

  addDays(userId, days) {
    const db = loadDB();
    const user = db.users[userId];
    if (!user) return null;
    const currentExpiry = Math.max(Date.now(), user.expires_at || Date.now());
    user.expires_at = currentExpiry + (Number(days) * 24 * 60 * 60 * 1000);
    saveDB(db);
    return user;
  },

  setTariff(userId, tariffId, customDays = null) {
    const db = loadDB();
    const user = db.users[userId];
    if (!user) return null;

    const tariff = config.TARIFFS[tariffId];
    if (tariff) {
      user.tariff = tariffId;
      const days = customDays !== null ? Number(customDays) : tariff.days;
      user.expires_at = Date.now() + (days * 24 * 60 * 60 * 1000);
      saveDB(db);
    } else if (tariffId === 'none' || tariffId === 'free') {
      user.tariff = 'none';
      user.expires_at = Date.now();
      saveDB(db);
    }
    return user;
  },

  // SITES
  createSite(siteData) {
    const db = loadDB();
    const id = 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const slug = (siteData.slug || siteData.title || 'site')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-') + '-' + Math.random().toString(36).substr(2, 4);

    const site = {
      id,
      slug,
      userId: siteData.userId,
      templateId: siteData.templateId || 'portfolio',
      title: siteData.title || 'Mening Saytim',
      description: siteData.description || 'Zamonaviy rasmiy veb-sayt',
      phone: siteData.phone || '+998901234567',
      telegram: siteData.telegram || '',
      instagram: siteData.instagram || '',
      address: siteData.address || '',
      bannerUrl: siteData.bannerUrl || '',
      services: siteData.services || [],
      priceRange: siteData.priceRange || '',
      is_active: true,
      views: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.sites[id] = site;
    saveDB(db);
    return site;
  },

  getSite(idOrSlug) {
    const db = loadDB();
    if (db.sites[idOrSlug]) return db.sites[idOrSlug];
    return Object.values(db.sites).find(s => s.slug === idOrSlug || s.id === idOrSlug) || null;
  },

  getSitesByUser(userId) {
    const db = loadDB();
    return Object.values(db.sites).filter(s => String(s.userId) === String(userId));
  },

  getAllSites() {
    const db = loadDB();
    return Object.values(db.sites);
  },

  toggleSiteStatus(siteId, isActive) {
    const db = loadDB();
    if (db.sites[siteId]) {
      db.sites[siteId].is_active = typeof isActive === 'boolean' ? isActive : !db.sites[siteId].is_active;
      db.sites[siteId].updated_at = new Date().toISOString();
      saveDB(db);
      return db.sites[siteId];
    }
    return null;
  },

  deleteSite(siteId, userId = null) {
    const db = loadDB();
    if (db.sites[siteId]) {
      if (userId && String(db.sites[siteId].userId) !== String(userId)) {
        return false;
      }
      delete db.sites[siteId];
      saveDB(db);
      return true;
    }
    return false;
  },

  incrementSiteViews(siteId) {
    const db = loadDB();
    if (db.sites[siteId]) {
      db.sites[siteId].views = (db.sites[siteId].views || 0) + 1;
      saveDB(db);
    }
  },

  // BOTS
  createBot(botData) {
    const db = loadDB();
    const id = 'bot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const newBot = {
      id,
      userId: botData.userId,
      token: botData.token,
      botType: botData.botType || 'weather',
      botUsername: botData.botUsername || '',
      botName: botData.botName || 'Mening Botim',
      is_active: true,
      created_at: new Date().toISOString()
    };
    db.bots[id] = newBot;
    saveDB(db);
    return newBot;
  },

  getBotsByUser(userId) {
    const db = loadDB();
    return Object.values(db.bots || {}).filter(b => String(b.userId) === String(userId));
  },

  getAllBots() {
    const db = loadDB();
    return Object.values(db.bots || {});
  },

  getBot(id) {
    const db = loadDB();
    return db.bots[id] || null;
  },

  toggleBotStatus(botId, isActive) {
    const db = loadDB();
    if (db.bots && db.bots[botId]) {
      db.bots[botId].is_active = typeof isActive === 'boolean' ? isActive : !db.bots[botId].is_active;
      saveDB(db);
      return db.bots[botId];
    }
    return null;
  },

  deleteBot(botId, userId = null) {
    const db = loadDB();
    if (db.bots && db.bots[botId]) {
      if (userId && String(db.bots[botId].userId) !== String(userId)) {
        return false;
      }
      delete db.bots[botId];
      saveDB(db);
      return true;
    }
    return false;
  },

  getStats() {
    const db = loadDB();
    const users = Object.values(db.users);
    const sites = Object.values(db.sites);
    const activeSites = sites.filter(s => s.is_active);
    const bots = Object.values(db.bots || {});
    const activeBots = bots.filter(b => b.is_active);

    const detailedUsers = this.getAllUsersDetailed();
    const veryActiveCount = detailedUsers.filter(u => u.activity_level === 'very_active').length;
    const activeCount = detailedUsers.filter(u => u.activity_level === 'active').length;
    const newCount = detailedUsers.filter(u => u.activity_level === 'new').length;
    const totalBalance = users.reduce((sum, u) => sum + (u.balance || 0), 0);

    return {
      totalUsers: users.length,
      veryActiveUsers: veryActiveCount,
      activeUsers: activeCount,
      newUsers: newCount,
      totalSites: sites.length,
      activeSites: activeSites.length,
      inactiveSites: sites.length - activeSites.length,
      totalBots: bots.length,
      activeBots: activeBots.length,
      inactiveBots: bots.length - activeBots.length,
      totalBalance
    };
  },

  calculateUserScore(user, bots, sites) {
    const activeBots = bots.filter(b => b.is_active).length;
    const activeSites = sites.filter(s => s.is_active).length;
    const balanceScore = Math.min(100, Math.floor((user.balance || 0) / 1000));
    const tariffScore = (user.tariff && user.tariff !== 'trial' && user.tariff !== 'none') ? 50 : 10;

    const score = (bots.length * 30) + (activeBots * 20) + (sites.length * 25) + (activeSites * 15) + balanceScore + tariffScore;

    let activity_level = 'new';
    let activity_label = '🌱 Yangi Mijoz';
    let activity_badge = 'bg-slate-800 text-slate-300';

    if (score >= 45 || activeBots > 0 || bots.length >= 2 || (user.balance || 0) >= 20000) {
      activity_level = 'very_active';
      activity_label = '🔥 Juda Faol';
      activity_badge = 'bg-red-500/20 text-red-400 border border-red-500/30';
    } else if (score >= 20 || bots.length > 0 || sites.length > 0) {
      activity_level = 'active';
      activity_label = '⚡ Faol Mijoz';
      activity_badge = 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    }

    return { score, activity_level, activity_label, activity_badge, activeBots, activeSites };
  },

  getAllUsersDetailed() {
    const db = loadDB();
    const users = Object.values(db.users);

    const detailed = users.map(u => {
      const bots = Object.values(db.bots || {}).filter(b => String(b.userId) === String(u.id));
      const sites = Object.values(db.sites || {}).filter(s => String(s.userId) === String(u.id));
      const remaining = this.getRemainingTime(u.id);
      const metrics = this.calculateUserScore(u, bots, sites);

      // Default photo fallback
      const photo = u.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=1e293b&color=38bdf8&bold=true`;

      return {
        id: u.id,
        name: u.name || 'Foydalanuvchi',
        username: u.username || '',
        phone: u.phone || '',
        photo_url: photo,
        balance: u.balance || 0,
        tariff: u.tariff || 'trial',
        tariff_name: (config.TARIFFS[u.tariff] || {}).name || u.tariff || 'Sinov',
        expires_at: u.expires_at,
        is_expired: remaining.isExpired,
        remaining_text: remaining.text,
        remaining_days: remaining.days,
        created_at: u.created_at,
        last_active: u.last_active || u.created_at,
        bots,
        sites,
        bots_count: bots.length,
        active_bots_count: metrics.activeBots,
        sites_count: sites.length,
        active_sites_count: metrics.activeSites,
        score: metrics.score,
        activity_level: metrics.activity_level,
        activity_label: metrics.activity_label,
        activity_badge: metrics.activity_badge
      };
    });

    // Sort by score descending (Rating)
    detailed.sort((a, b) => b.score - a.score || b.balance - a.balance);

    // Assign ranking #1, #2, ...
    return detailed.map((u, idx) => ({
      ...u,
      rank: idx + 1
    }));
  }
};

module.exports = dbManager;
