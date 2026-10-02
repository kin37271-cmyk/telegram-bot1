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
    if (!db.users[userId]) {
      const trialDays = config.TRIAL_DAYS || 3;
      const expiresAt = Date.now() + (trialDays * 24 * 60 * 60 * 1000);

      db.users[userId] = {
        id: userId,
        name: profile.name || 'Foydalanuvchi',
        username: profile.username || '',
        balance: 0,
        tariff: 'trial',
        trial_used: true,
        expires_at: expiresAt,
        is_blocked: false,
        created_at: new Date().toISOString()
      };
      saveDB(db);
    } else {
      let changed = false;
      if (profile.name && db.users[userId].name !== profile.name) {
        db.users[userId].name = profile.name;
        changed = true;
      }
      if (profile.username && db.users[userId].username !== profile.username) {
        db.users[userId].username = profile.username;
        changed = true;
      }
      if (changed) saveDB(db);
    }
    return db.users[userId];
  },

  updateUser(userId, data) {
    const db = loadDB();
    if (db.users[userId]) {
      db.users[userId] = { ...db.users[userId], ...data };
      saveDB(db);
      return db.users[userId];
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
    const user = db.users[userId];
    if (!user) return null;
    user.balance = Math.max(0, (user.balance || 0) + Number(amount));
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
      user.expires_at = Date.now(); // expired
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

  getStats() {
    const db = loadDB();
    const users = Object.values(db.users);
    const sites = Object.values(db.sites);
    const activeSites = sites.filter(s => s.is_active);

    return {
      totalUsers: users.length,
      totalSites: sites.length,
      activeSites: activeSites.length,
      inactiveSites: sites.length - activeSites.length
    };
  }
};

module.exports = dbManager;
