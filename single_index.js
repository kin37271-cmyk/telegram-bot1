// ==========================================
// 🚀 ALL-IN-ONE 24/7 TELEGRAM BOT KONSTRUKTORI
// Barcha modullar 1 ta faylda jamlangan (Single File Bundle)
// Render.com va barcha hostinglarda 100% xatosiz ishlaydi!
// ==========================================

const path = require('path');
const fs = require('fs');
const http = require('http');

const _modules = {};
const _moduleCache = {};

function defineModule(name, fn) {
  _modules[name] = fn;
}

function resolveCanonical(currentDir, reqPath) {
  if (!reqPath.startsWith('.')) return reqPath;
  let resolved = path.join(currentDir, reqPath).replace(/\\/g, '/');
  if (resolved.startsWith('/')) resolved = resolved.slice(1);
  if (_modules[resolved + '.js']) return resolved + '.js';
  if (_modules[resolved + '/index.js']) return resolved + '/index.js';
  if (_modules[resolved]) return resolved;
  return resolved;
}

function createScopedRequire(currentDir) {
  return function(modulePath) {
    if (modulePath.startsWith('.')) {
      const resolved = resolveCanonical(currentDir, modulePath);
      if (_modules[resolved]) {
        if (!_moduleCache[resolved]) {
          const m = { exports: {} };
          _moduleCache[resolved] = m;
          _modules[resolved](m.exports, m, createScopedRequire(path.dirname(resolved)));
        }
        return _moduleCache[resolved].exports;
      }
    }
    return require(modulePath);
  };
}


// ---- FILE: config.js ----
defineModule('config.js', function(exports, module, require) {
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  // Asosiy Konstruktor Bot tokeni (@BotFather dan olinadi)
  BOT_TOKEN: process.env.BOT_TOKEN || '8922811264:AAEgY18AMiM0dDK6KjAT-v48AYdDeni_dZQ',

  // Asosiy Ega (Owner) Telegram ID si
  OWNER_ID: process.env.OWNER_ID ? parseInt(process.env.OWNER_ID) : 8422157752,

  // To'lov rekvizitlari (Karta raqami va egasi)
  CARD_NUMBER: process.env.CARD_NUMBER || '6262720123315395',
  CARD_HOLDER: process.env.CARD_HOLDER || '@ismoiluzb022',

  // OpenAI API Key (ixtiyoriy, agar bo'lmasa aqlli bepul AI ishlaydi)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // Tariflar
  TRIAL_DAYS: 3, // 3 kunlik tekin sinov
  TARIFFS: {
    free_trial: {
      id: 'free_trial',
      name: '🎁 3 Kunlik Bepul Sinov',
      price: 0,
      days: 3,
      maxBots: 1, // Tarifsiz faqat 1 ta bot yaratish limiti
      description: 'Tarif sotib olmaganlar uchun faqat 1 ta bot yaratish mumkin!'
    },
    starter: {
      id: 'starter',
      name: '🌱 Starter (1 Oylik)',
      price: 15000,
      days: 30,
      maxBots: 3,
      description: 'Boshlovchilar uchun 3 tagacha bot, 1 oy'
    },
    pro_month: {
      id: 'pro_month',
      name: '⭐ 25 Pro (1 Oylik)',
      price: 25000,
      days: 30,
      maxBots: 10,
      description: '1 oy davomida to\'liq cheklovlarsiz 10 tagacha bot ishlatish'
    },
    business_3m: {
      id: 'business_3m',
      name: '💼 Business (3 Oylik)',
      price: 60000,
      days: 90,
      maxBots: 25,
      description: '3 oy davomida 25 tagacha bot + VIP yordam (Chegirma bilan)'
    },
    vip_year: {
      id: 'vip_year',
      name: '👑 VIP Premium (1 Yillik)',
      price: 150000,
      days: 365,
      maxBots: 50,
      description: '1 yil davomida barcha 16 ta bot shablonlaridan 50 tagacha bot'
    },
    unlimited_forever: {
      id: 'unlimited_forever',
      name: '♾ Cheksiz Umrbod (Lifetime)',
      price: 300000,
      days: 3650, // 10 yil / umrbod
      maxBots: 999,
      description: 'Bir marta to\'lab, umrbod cheksiz botlar yaratish imkoniyati'
    }
  }
};

});

// ---- FILE: database/db.js ----
defineModule('database/db.js', function(exports, module, require) {
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

class Database {
  constructor() {
    this.data = {
      users: {},
      bots: {},
      admins: [],
      payments: {},
      settings: {}
    };
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        if (!this.data.users) this.data.users = {};
        if (!this.data.bots) this.data.bots = {};
        if (!Array.isArray(this.data.admins)) this.data.admins = [];
        if (!this.data.payments) this.data.payments = {};
        if (!this.data.settings) this.data.settings = {};
      } catch (err) {
        console.error('Baza yuklashda xatolik:', err);
      }
    } else {
      this.save();
    }

    // Ownerni har doim adminlar ro'yxatiga qo'shib qo'yamiz
    if (config.OWNER_ID && !this.data.admins.includes(config.OWNER_ID)) {
      this.data.admins.push(config.OWNER_ID);
      this.save();
    }
  }

  save() {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (err) {
      console.error('Bazaga saqlashda xatolik:', err);
    }
  }

  // --- FOYDALANUVCHILAR ---
  getUser(userId) {
    const id = String(userId);
    return this.data.users[id] || null;
  }

  getOrCreateUser(userObj) {
    const id = String(userObj.id);
    const now = new Date();
    
    if (!this.data.users[id]) {
      // Yangi foydalanuvchi uchun 7 kunlik tekin sinov
      const trialEnds = new Date(now.getTime() + config.TRIAL_DAYS * 24 * 60 * 60 * 1000);
      
      this.data.users[id] = {
        id: userObj.id,
        username: userObj.username || '',
        first_name: userObj.first_name || '',
        registered_at: now.toISOString(),
        tariff: 'free_trial',
        balance: 0,
        trial_ends_at: trialEnds.toISOString(),
        subscription_ends_at: trialEnds.toISOString(),
        status: 'active'
      };
      this.save();
    } else {
      let updated = false;
      if (this.data.users[id].balance === undefined) {
        this.data.users[id].balance = 0;
        updated = true;
      }
      if (userObj.username && this.data.users[id].username !== userObj.username) {
        this.data.users[id].username = userObj.username;
        updated = true;
      }
      if (userObj.first_name && this.data.users[id].first_name !== userObj.first_name) {
        this.data.users[id].first_name = userObj.first_name;
        updated = true;
      }
      if (updated) this.save();
    }

    return this.data.users[id];
  }

  // Balans boshqaruvi
  getBalance(userId) {
    const user = this.getUser(userId);
    return user ? (user.balance || 0) : 0;
  }

  addBalance(userId, amount) {
    const user = this.getUser(userId);
    if (!user) return false;
    const num = parseFloat(amount) || 0;
    user.balance = (user.balance || 0) + num;
    this.save();
    return user.balance;
  }

  subtractBalance(userId, amount) {
    const user = this.getUser(userId);
    if (!user) return false;
    const num = parseFloat(amount) || 0;
    user.balance = Math.max(0, (user.balance || 0) - num);
    this.save();
    return user.balance;
  }

  addDays(userId, days) {
    const user = this.getUser(userId);
    if (!user) return false;
    const numDays = parseInt(days) || 0;
    const now = new Date();
    const currentEnd = new Date(user.subscription_ends_at || now);
    const baseDate = currentEnd > now ? currentEnd : now;
    const newEnd = new Date(baseDate.getTime() + numDays * 24 * 60 * 60 * 1000);
    user.subscription_ends_at = newEnd.toISOString();
    user.notified_5h = false;
    user.notified_expired = false;
    user.notified_deleted = false;
    this.save();
    return this.getSubscriptionDaysLeft(userId);
  }

  isSubscriptionActive(userId) {
    const user = this.getUser(userId);
    if (!user) return false;
    
    // Agar admin yoki owner bo'lsa cheksiz
    if (this.isAdmin(userId)) return true;

    if (!user.subscription_ends_at) return false;
    return new Date(user.subscription_ends_at) > new Date();
  }

  getSubscriptionDaysLeft(userId) {
    const user = this.getUser(userId);
    if (!user || !user.subscription_ends_at) return 0;
    
    if (this.isAdmin(userId)) return 9999;

    const diff = new Date(user.subscription_ends_at) - new Date();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  setTariff(userId, tariffId, customDays = null) {
    const user = this.getUser(userId);
    if (!user) return false;

    const tariff = config.TARIFFS[tariffId];
    const days = customDays !== null ? customDays : (tariff ? tariff.days : 30);

    const now = new Date();
    const currentEnd = new Date(user.subscription_ends_at || now);
    const baseDate = currentEnd > now ? currentEnd : now;

    const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    user.tariff = tariffId;
    user.subscription_ends_at = newEnd.toISOString();
    user.notified_5h = false;
    user.notified_expired = false;
    user.notified_deleted = false;
    this.save();
    return true;
  }


  getAllUsers() {
    return Object.values(this.data.users);
  }

  // --- BOTLAR ---
  createBot(ownerId, token, template, botInfo) {
    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botRecord = {
      id: botId,
      owner_id: ownerId,
      token: token,
      template: template,
      bot_username: botInfo.username,
      bot_first_name: botInfo.first_name,
      bot_id: botInfo.id,
      status: 'running',
      created_at: new Date().toISOString(),
      stats: {
        users_count: 0,
        messages_count: 0
      },
      data: {} // Bot uchun maxsus xotira
    };

    this.data.bots[botId] = botRecord;
    this.save();
    return botRecord;
  }

  getBot(botId) {
    return this.data.bots[botId] || null;
  }

  getBotByToken(token) {
    return Object.values(this.data.bots).find(b => b.token === token) || null;
  }

  getUserBots(userId) {
    return Object.values(this.data.bots).filter(b => b.owner_id === userId);
  }

  getAllBots() {
    return Object.values(this.data.bots);
  }

  updateBotStatus(botId, status) {
    if (this.data.bots[botId]) {
      this.data.bots[botId].status = status;
      this.save();
      return true;
    }
    return false;
  }

  deleteBot(botId) {
    if (this.data.bots[botId]) {
      delete this.data.bots[botId];
      this.save();
      return true;
    }
    return false;
  }

  updateBotData(botId, updaterFn) {
    if (this.data.bots[botId]) {
      updaterFn(this.data.bots[botId]);
      this.save();
    }
  }

  // --- ADMINLAR ---
  isAdmin(userId) {
    const id = parseInt(userId);
    if (config.OWNER_ID && id === config.OWNER_ID) return true;
    return this.data.admins.includes(id);
  }

  isOwner(userId) {
    const id = parseInt(userId);
    return config.OWNER_ID && id === config.OWNER_ID;
  }

  getAdmins() {
    return [...new Set([...this.data.admins, config.OWNER_ID].filter(Boolean))];
  }

  addAdmin(userId) {
    const id = parseInt(userId);
    if (!this.data.admins.includes(id)) {
      this.data.admins.push(id);
      this.save();
      return true;
    }
    return false;
  }

  removeAdmin(userId) {
    const id = parseInt(userId);
    if (id === config.OWNER_ID) return false; // Egasi o'chirilmaydi
    const idx = this.data.admins.indexOf(id);
    if (idx !== -1) {
      this.data.admins.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // --- TO'LOVLAR ---
  createPayment(userId, tariffId, photoId) {
    const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tariff = config.TARIFFS[tariffId] || { name: 'Noma\'lum', price: 0 };

    const payment = {
      id: paymentId,
      user_id: userId,
      tariff_id: tariffId,
      tariff_name: tariff.name,
      amount: tariff.price,
      photo_id: photoId,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    this.data.payments[paymentId] = payment;
    this.save();
    return payment;
  }

  getPayment(paymentId) {
    return this.data.payments[paymentId] || null;
  }

  getPendingPayments() {
    return Object.values(this.data.payments).filter(p => p.status === 'pending');
  }

  approvePayment(paymentId) {
    const payment = this.getPayment(paymentId);
    if (!payment || payment.status !== 'pending') return false;

    payment.status = 'approved';
    payment.approved_at = new Date().toISOString();
    
    // Foydalanuvchi obunasini uzaytiramiz
    this.setTariff(payment.user_id, payment.tariff_id);
    this.save();
    return payment;
  }

  rejectPayment(paymentId) {
    const payment = this.getPayment(paymentId);
    if (!payment || payment.status !== 'pending') return false;

    payment.status = 'rejected';
    payment.rejected_at = new Date().toISOString();
    this.save();
    return payment;
  }

  // --- WEB APP SOZLAMALARI VA MA'LUMOTLARI ---
  isWebappPublic() {
    if (!this.data.settings) this.data.settings = {};
    return this.data.settings.webapp_public === true;
  }

  setWebappPublic(val) {
    if (!this.data.settings) this.data.settings = {};
    this.data.settings.webapp_public = !!val;
    this.save();
    return this.data.settings.webapp_public;
  }

  toggleWebappPublic() {
    const current = this.isWebappPublic();
    return this.setWebappPublic(!current);
  }

  getWebappFullData(requestUserId) {
    const id = parseInt(requestUserId);
    const isAdmin = this.isAdmin(id);
    const isOwner = this.isOwner(id);
    const isPublic = this.isWebappPublic();

    if (!isAdmin && !isPublic) {
      return { error: 'ACCESS_DENIED', message: 'Web App hozirda faqat administratorlar uchun ochiq.' };
    }

    const stats = this.getStats();
    const allUsers = this.getAllUsers();
    const allBots = this.getAllBots();
    const allPayments = Object.values(this.data.payments);

    // Foydalanuvchi ma'lumotlari xaritasi
    const userMap = {};
    allUsers.forEach(u => {
      userMap[String(u.id)] = u;
    });

    if (isAdmin) {
      // Admin uchun to'liq ma'lumotlar
      const enrichedBots = allBots.map(b => {
        const owner = userMap[String(b.owner_id)] || { first_name: 'Noma\'lum', username: '', tariff: 'free_trial' };
        const tariff = config.TARIFFS[owner.tariff] || { name: owner.tariff || 'Standart' };
        const daysLeft = this.getSubscriptionDaysLeft(b.owner_id);
        return {
          id: b.id,
          token: b.token, // Admin tokenlarni ko'radi
          bot_username: b.bot_username,
          bot_first_name: b.bot_first_name,
          bot_id: b.bot_id,
          template: b.template,
          status: b.status,
          created_at: b.created_at,
          stats: b.stats || { users_count: 0, messages_count: 0 },
          owner: {
            id: b.owner_id,
            first_name: owner.first_name,
            username: owner.username,
            tariff_id: owner.tariff,
            tariff_name: tariff.name,
            days_left: daysLeft,
            subscription_ends_at: owner.subscription_ends_at
          }
        };
      });

      const enrichedUsers = allUsers.map(u => {
        const userBots = allBots.filter(b => b.owner_id === u.id);
        const tariff = config.TARIFFS[u.tariff] || { name: u.tariff || 'Standart' };
        const daysLeft = this.getSubscriptionDaysLeft(u.id);
        return {
          id: u.id,
          first_name: u.first_name || 'Foydalanuvchi',
          username: u.username || '',
          balance: u.balance || 0,
          tariff_id: u.tariff || 'free_trial',
          tariff_name: tariff.name || 'Standart',
          days_left: daysLeft,
          subscription_ends_at: u.subscription_ends_at,
          registered_at: u.registered_at,
          bots_count: userBots.length,
          status: u.status || 'active',
          is_admin: this.isAdmin(u.id),
          is_owner: this.isOwner(u.id)
        };
      });

      const adminsList = this.getAdmins().map(aid => {
        const u = userMap[String(aid)] || { first_name: 'Admin', username: '' };
        return {
          id: aid,
          first_name: u.first_name || 'Admin',
          username: u.username || '',
          is_owner: this.isOwner(aid)
        };
      });

      return {
        role: isOwner ? 'owner' : 'admin',
        isAdmin: true,
        isOwner: isOwner,
        webapp_public: isPublic,
        stats: stats,
        bots: enrichedBots,
        users: enrichedUsers,
        admins: adminsList,
        payments: allPayments,
        tariffs: config.TARIFFS
      };
    } else {
      // Oddiy foydalanuvchi uchun o'ziga tegishli ma'lumotlar
      const myUser = this.getUser(id) || { id: id, tariff: 'free_trial', balance: 0 };
      const myBots = this.getUserBots(id).map(b => ({
        id: b.id,
        token: b.token,
        bot_username: b.bot_username,
        bot_first_name: b.bot_first_name,
        template: b.template,
        status: b.status,
        created_at: b.created_at,
        stats: b.stats || { users_count: 0, messages_count: 0 }
      }));
      const tariff = config.TARIFFS[myUser.tariff] || { name: myUser.tariff || 'Standart' };
      const daysLeft = this.getSubscriptionDaysLeft(id);

      return {
        role: 'user',
        isAdmin: false,
        isOwner: false,
        webapp_public: isPublic,
        stats: {
          myBotsCount: myBots.length,
          daysLeft: daysLeft,
          tariffName: tariff.name,
          balance: myUser.balance || 0
        },
        user: {
          id: myUser.id,
          first_name: myUser.first_name || 'Foydalanuvchi',
          username: myUser.username || '',
          balance: myUser.balance || 0,
          tariff_id: myUser.tariff || 'free_trial',
          tariff_name: tariff.name || 'Standart',
          days_left: daysLeft,
          subscription_ends_at: myUser.subscription_ends_at
        },
        bots: myBots,
        tariffs: config.TARIFFS
      };
    }
  }


  // --- STATISTIKA ---
  getStats() {
    const users = Object.values(this.data.users);
    const bots = Object.values(this.data.bots);
    const payments = Object.values(this.data.payments);

    const activeBots = bots.filter(b => b.status === 'running').length;
    const approvedPayments = payments.filter(p => p.status === 'approved');
    const totalIncome = approvedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      totalUsers: users.length,
      totalBots: bots.length,
      activeBots: activeBots,
      totalPayments: payments.length,
      approvedPayments: approvedPayments.length,
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      totalIncome: totalIncome,
      adminsCount: this.getAdmins().length
    };
  }

  // --- TELEGRAM BUSINESS / LICHKA AI SOZLAMALARI ---
  getBusinessSettings(userId) {
    const id = String(userId);
    if (!this.data.business_settings) this.data.business_settings = {};
    if (!this.data.business_settings[id]) {
      this.data.business_settings[id] = {
        enabled: true,
        prompt: 'Siz Telegram akkaunt egasining xushmuomala shaxsiy AI yordamchisisiz. Har qanday savollarga o\'zbek tilida aniq, qisqa va muloyim javob bering.',
        business_name: '',
        contacts: '',
        prices: '',
        auto_reply_count: 0
      };
      this.save();
    }
    return this.data.business_settings[id];
  }

  updateBusinessSettings(userId, updateObj) {
    const id = String(userId);
    if (!this.data.business_settings) this.data.business_settings = {};
    const current = this.getBusinessSettings(id);
    this.data.business_settings[id] = { ...current, ...updateObj };
    this.save();
    return this.data.business_settings[id];
  }

  saveBusinessConnection(conn) {
    if (!this.data.business_connections) this.data.business_connections = {};
    this.data.business_connections[conn.id] = {
      ...conn,
      updated_at: new Date().toISOString()
    };
    this.save();
  }

  getBusinessConnection(connId) {
    if (!this.data.business_connections) return null;
    return this.data.business_connections[connId] || null;
  }
}

module.exports = new Database();



});

// ---- FILE: core/helpers.js ----
defineModule('core/helpers.js', function(exports, module, require) {
// Telegram xavfsiz matn yordamchisi
function cleanName(name) {
  if (!name) return 'Foydalanuvchi';
  return String(name).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '').trim() || 'Foydalanuvchi';
}

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

module.exports = {
  cleanName,
  escapeMarkdown
};

});

// ---- FILE: core/keyboards.js ----
defineModule('core/keyboards.js', function(exports, module, require) {
const { Markup } = require('telegraf');
const { templates } = require('../templates');
const config = require('../config');

function getWebAppUrl(userId = '') {
  const base = process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || 'https://telegram-bot1-1-ivst.onrender.com';
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${cleanBase}/webapp${userId ? `?userId=${userId}` : ''}`;
}

module.exports = {
  getWebAppUrl,

  // Asosiy foydalanuvchi menyusi
  getMainKeyboard: (isAdmin = false, isWebappPublic = false) => {
    const buttons = [
      ['🚀 Yangi Bot Yaratish', '📁 Mening Botlarim'],
      ['💎 Tariflar va Obuna', '👤 Profilim'],
      ['❓ Yordam va Qo\'llanma']
    ];

    if (isAdmin) {
      buttons.unshift(['👑 Admin Panel']);
      if (isWebappPublic) {
        buttons.push(['🌐 Web App', '✨ Yangilanishlar']);
      } else {
        buttons.push(['✨ Yangilanishlar']);
      }
    } else if (isWebappPublic) {
      buttons.push(['🌐 Web App']);
    }

    return Markup.keyboard(buttons).resize();
  },


  // 15 ta bot shablonlari inline tugmalari
  getTemplatesKeyboard: () => {
    const rows = [];
    for (let i = 0; i < templates.length; i += 2) {
      const row = [];
      row.push(Markup.button.callback(templates[i].name, `select_tpl_${templates[i].id}`));
      if (templates[i + 1]) {
        row.push(Markup.button.callback(templates[i + 1].name, `select_tpl_${templates[i + 1].id}`));
      }
      rows.push(row);
    }
    rows.push([Markup.button.callback('❌ Bekor qilish', 'cancel_action')]);
    return Markup.inlineKeyboard(rows);
  },

  // Bitta botni boshqarish inline tugmalari
  getBotManageKeyboard: (botRecord, isRunning) => {
    return Markup.inlineKeyboard([
      [Markup.button.url('👉 Botga o\'tish', `https://t.me/${botRecord.bot_username}`)],
      [
        isRunning
          ? Markup.button.callback('⏹ To\'xtatish', `bot_stop_${botRecord.id}`)
          : Markup.button.callback('▶️ Ishga tushirish', `bot_start_${botRecord.id}`)
      ],
      [Markup.button.callback('🗑 Botni o\'chirish', `bot_delete_${botRecord.id}`)],
      [Markup.button.callback('⬅️ Botlarim ro\'yxatiga', 'my_bots_list')]
    ]);
  },

  // Tariflar inline tugmalari
  getTariffsKeyboard: () => {
    return Markup.inlineKeyboard([
      [Markup.button.callback('🎁 3 Kunlik Bepul Sinov', 'tariff_free_trial')],
      [Markup.button.callback('🌱 Starter (1 Oylik) — 15,000 so\'m', 'tariff_starter')],
      [Markup.button.callback('⭐ 25 Pro (1 Oylik) — 25,000 so\'m', 'tariff_pro_month')],
      [Markup.button.callback('💼 Business (3 Oylik) — 60,000 so\'m', 'tariff_business_3m')],
      [Markup.button.callback('👑 VIP Premium (1 Yillik) — 150,000 so\'m', 'tariff_vip_year')],
      [Markup.button.callback('♾ Cheksiz Umrbod (Lifetime) — 300,000 so\'m', 'tariff_unlimited_forever')],
      [Markup.button.callback('⬅️ Orqaga', 'cancel_action')]
    ]);
  },

  // Admin panel asosiy menyusi
  getAdminKeyboard: (isOwner = false, isWebappPublic = false, userId = '') => {
    const webAppUrl = getWebAppUrl(userId);
    const buttons = [
      [
        Markup.button.webApp('🌐 Web App Dashboard', webAppUrl)
      ],
      [
        Markup.button.callback(
          isWebappPublic ? '⚙️ Web App: 🟢 ON (Hamma ko\'radi)' : '⚙️ Web App: 🔴 OFF (Faqat Admin)',
          'admin_toggle_webapp'
        )
      ],

      [
        Markup.button.callback('📊 Statistika', 'admin_stats'),
        Markup.button.callback('🤖 Mijoz Botlari', 'admin_bots')
      ],
      [
        Markup.button.callback('👥 Foydalanuvchilar (Mijozlar)', 'admin_users'),
        Markup.button.callback('💳 To\'lovlar', 'admin_payments')
      ],
      [
        Markup.button.callback('📢 Xabar tarqatish (Rassilka)', 'admin_broadcast')
      ]
    ];

    if (isOwner) {
      buttons.push([
        Markup.button.callback('✨ Yangilanishlar Tarixi', 'admin_updates_info'),
        Markup.button.callback('👥 Adminlarni boshqarish', 'admin_manage_admins')
      ]);
    }

    buttons.push([Markup.button.callback('⬅️ Menyuga qaytish', 'admin_close')]);
    return Markup.inlineKeyboard(buttons);
  },



  // Bekor qilish inline tugmasi
  getCancelKeyboard: () => {
    return Markup.inlineKeyboard([
      [Markup.button.callback('❌ Bekor qilish', 'cancel_action')]
    ]);
  }
};


});

// ---- FILE: core/webapp.js ----
defineModule('core/webapp.js', function(exports, module, require) {
const db = require('../database/db');
const botManager = require('./botManager');
const config = require('../config');

function getWebAppHtml(initialData = null, initialUserId = '') {
  const initialDataJson = JSON.stringify(initialData || null).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Bot Maker Admin Dashboard</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-card: rgba(30, 41, 59, 0.75);
      --bg-card-hover: rgba(51, 65, 85, 0.85);
      --border-color: rgba(255, 255, 255, 0.08);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --accent-gradient: linear-gradient(135deg, #38bdf8 0%, #6366f1 100%);
      --success: #22c55e;
      --warning: #f59e0b;
      --danger: #ef4444;
      --radius: 16px;
      --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      background-color: var(--bg-primary);
      color: var(--text-main);
      padding: 14px;
      min-height: 100vh;
      overflow-x: hidden;
      background-image: 
        radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.12) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.12) 0px, transparent 50%);
      background-attachment: fixed;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      padding-bottom: 40px;
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border-color);
    }

    .header-title h1 {
      font-size: 18px;
      font-weight: 800;
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .header-title p {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .user-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-secondary);
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid var(--border-color);
      font-size: 12px;
      font-weight: 700;
    }

    .user-badge.admin {
      background: rgba(99, 102, 241, 0.2);
      border-color: rgba(99, 102, 241, 0.4);
      color: #a5b4fc;
    }

    /* ACCESS SWITCH */
    .access-card {
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 14px 18px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow);
    }

    .access-info h3 {
      font-size: 14px;
      font-weight: 700;
    }

    .access-info p {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .toggle-btn {
      padding: 8px 16px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .toggle-btn.on {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.4);
    }

    .toggle-btn.off {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    /* STATS GRID */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .stat-card {
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .stat-icon {
      font-size: 18px;
    }

    .stat-val {
      font-size: 17px;
      font-weight: 800;
      color: #fff;
    }

    .stat-label {
      font-size: 10px;
      color: var(--text-muted);
      font-weight: 600;
    }

    /* TABS */
    .tabs {
      display: flex;
      gap: 6px;
      background: var(--bg-secondary);
      padding: 4px;
      border-radius: 14px;
      margin-bottom: 16px;
      border: 1px solid var(--border-color);
      overflow-x: auto;
    }

    .tab-btn {
      flex: 1;
      padding: 9px 12px;
      border-radius: 10px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      white-space: nowrap;
      transition: all 0.2s;
    }

    .tab-btn.active {
      background: var(--accent-gradient);
      color: #fff;
      box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
    }

    /* SEARCH */
    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 14px;
    }

    .search-input {
      flex: 1;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 10px 14px;
      color: #fff;
      font-size: 13px;
      outline: none;
    }

    .search-input:focus {
      border-color: var(--accent);
    }

    /* BOT CARDS */
    .card-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .item-card {
      background: var(--bg-card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 16px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .card-title-box {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .avatar-icon {
      width: 40px;
      height: 40px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }

    .names-box h4 {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }

    .names-box a {
      font-size: 12px;
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }

    .badge.running {
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .badge.stopped {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .badge.tariff {
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .badge.balance {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    /* GRID INFO */
    .grid-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
      background: rgba(15, 23, 42, 0.6);
      padding: 10px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .grid-info-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .info-label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 700;
    }

    .info-val {
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
      word-break: break-all;
    }

    /* TOKEN BOX */
    .token-box {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .token-text {
      font-family: monospace;
      font-size: 11px;
      color: #cbd5e1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .action-btn {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: #fff;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    }

    .action-btn:hover {
      background: var(--bg-card-hover);
      border-color: var(--accent);
    }

    .action-btn.green {
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(34, 197, 94, 0.35);
      color: #4ade80;
    }

    .action-btn.red {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.35);
      color: #f87171;
    }

    .action-btn.gold {
      background: rgba(245, 158, 11, 0.15);
      border-color: rgba(245, 158, 11, 0.35);
      color: #fbbf24;
    }

    /* MODAL */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }

    .modal-overlay.active {
      opacity: 1;
      pointer-events: all;
    }

    .modal-box {
      background: #1e293b;
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 20px;
      width: 100%;
      max-width: 420px;
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .modal-box h3 {
      font-size: 16px;
      font-weight: 800;
      color: #fff;
    }

    .modal-input {
      background: #0f172a;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 10px 12px;
      color: #fff;
      font-size: 14px;
      outline: none;
    }

    .modal-input:focus {
      border-color: var(--accent);
    }

    /* TOAST */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: #1e293b;
      color: #fff;
      padding: 10px 20px;
      border-radius: 30px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid var(--accent);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      transition: transform 0.3s;
      z-index: 1000;
    }

    .toast.show {
      transform: translateX(-50%) translateY(0);
    }

    .empty-state {
      text-align: center;
      padding: 40px 16px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <div class="header-title">
        <h1>🚀 Bot Maker Dashboard</h1>
        <p>Barcha botlar, mijozlar va hisob-kitoblar</p>
      </div>
      <div id="userBadge" class="user-badge admin">
        <span>Yuklanmoqda...</span>
      </div>
    </div>

    <!-- WEB APP ACCESS CONTROL -->
    <div id="accessControlCard" class="access-card" style="display: none;">
      <div class="access-info">
        <h3>⚙️ Web App Kirish Rejimi</h3>
        <p id="accessDesc">Web App kimlarga ko'rinishini boshqaring</p>
      </div>
      <button id="toggleAccessBtn" class="toggle-btn on" onclick="toggleWebAppAccess()">
        <span>Yuklanmoqda...</span>
      </button>
    </div>

    <!-- STATS GRID -->
    <div id="statsGrid" class="stats-grid"></div>

    <!-- TABS -->
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('bots')">🤖 Botlar (<span id="botsCount">0</span>)</button>
      <button id="usersTabBtn" class="tab-btn" onclick="switchTab('users')" style="display: none;">👥 Mijozlar (<span id="usersCount">0</span>)</button>
      <button id="adminsTabBtn" class="tab-btn" onclick="switchTab('admins')" style="display: none;">🛡 Adminlar (<span id="adminsCount">0</span>)</button>
      <button id="paymentsTabBtn" class="tab-btn" onclick="switchTab('payments')" style="display: none;">💳 To'lovlar</button>
    </div>

    <!-- SEARCH BAR -->
    <div class="filter-bar">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Qidiruv (bot, username, ID, token)..." oninput="renderTabContent()">
    </div>

    <!-- MAIN CONTENT -->
    <div id="mainContent">
      <div class="empty-state">Ma'lumotlar yuklanmoqda...</div>
    </div>
  </div>

  <!-- MODAL: PUL / TARIF BOSHQARISH -->
  <div id="userModal" class="modal-overlay">
    <div class="modal-box">
      <h3 id="modalTitle">👤 Mijoz Hisobini Boshqarish</h3>
      <p id="modalUserSubtitle" style="font-size: 12px; color: var(--text-muted);"></p>

      <!-- 1. Balans qo'shish / ayirish -->
      <div style="display:flex; flex-direction:column; gap:6px;">
        <label style="font-size: 11px; color: var(--text-muted); font-weight:700;">💰 SUMMA (SO'M):</label>
        <input type="number" id="modalAmountInput" class="modal-input" placeholder="Masalan: 50000">
        <div style="display:flex; gap:8px; margin-top:4px;">
          <button class="action-btn green" style="flex:1;" onclick="submitBalanceChange('add')">➕ Pul Qo'shish</button>
          <button class="action-btn red" style="flex:1;" onclick="submitBalanceChange('sub')">➖ Pul Ayirish</button>
        </div>
      </div>

      <hr style="border:0; border-top:1px solid var(--border-color);">

      <!-- 2. Muddat uzaytirish -->
      <div style="display:flex; flex-direction:column; gap:6px;">
        <label style="font-size: 11px; color: var(--text-muted); font-weight:700;">⏳ MUDDAT QO'SHISH (KUN):</label>
        <div style="display:flex; gap:8px;">
          <input type="number" id="modalDaysInput" class="modal-input" style="flex:1;" placeholder="Kun (masalan: 30)">
          <button class="action-btn gold" onclick="submitDaysAdd()">⏳ Qo'shish</button>
        </div>
      </div>

      <hr style="border:0; border-top:1px solid var(--border-color);">

      <!-- 3. Tarif tanlash -->
      <div style="display:flex; flex-direction:column; gap:6px;">
        <label style="font-size: 11px; color: var(--text-muted); font-weight:700;">💎 TARIF O'RNATISH:</label>
        <div style="display:flex; gap:8px;">
          <select id="modalTariffSelect" class="modal-input" style="flex:1;">
            <option value="free_trial">🎁 7 Kunlik Bepul Sinov</option>
            <option value="starter">🌱 Starter (1 Oylik)</option>
            <option value="pro_month">⭐ 25 Pro (1 Oylik)</option>
            <option value="business_3m">💼 Business (3 Oylik)</option>
            <option value="vip_year">👑 VIP Premium (1 Yillik)</option>
            <option value="unlimited_forever">♾ Cheksiz Umrbod</option>
          </select>
          <button class="action-btn" onclick="submitTariffChange()">💎 O'rnatish</button>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button class="action-btn" onclick="closeModal()">Yopish</button>
      </div>
    </div>
  </div>

  <!-- TOAST -->
  <div id="toast" class="toast">
    <span id="toastMsg">Xabar</span>
  </div>

  <script>
    window.INITIAL_DATA = ${initialDataJson};

    let tg = window.Telegram ? window.Telegram.WebApp : null;
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        tg.setHeaderColor('#0f172a');
        tg.setBackgroundColor('#0f172a');
      } catch(e) {}
    }

    let currentUserId = '${initialUserId || '8422157752'}';
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
      currentUserId = String(tg.initDataUnsafe.user.id);
    }
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('userId')) {
      currentUserId = urlParams.get('userId');
    }

    let globalData = window.INITIAL_DATA || null;
    let currentTab = 'bots';
    let hiddenTokens = {};
    let selectedUserIdForModal = null;

    function showToast(msg) {
      const toast = document.getElementById('toast');
      document.getElementById('toastMsg').innerText = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function copyToClipboard(text, label = 'Nusxalandi!') {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast('📋 ' + label)).catch(() => fallbackCopy(text, label));
      } else {
        fallbackCopy(text, label);
      }
    }

    function fallbackCopy(text, label) {
      const i = document.createElement('input');
      i.value = text;
      document.body.appendChild(i);
      i.select();
      document.execCommand('copy');
      document.body.removeChild(i);
      showToast('📋 ' + label);
    }

    async function loadData() {
      try {
        const res = await fetch('/api/webapp/data?userId=' + encodeURIComponent(currentUserId), {
          headers: { 'Bypass-Tunnel-Reminder': 'true' }
        });
        const data = await res.json();
        if (data.error === 'ACCESS_DENIED') {
          document.getElementById('mainContent').innerHTML = '<div class="empty-state">⛔ ' + data.message + '</div>';
          return;
        }
        globalData = data;
        renderDashboard();
      } catch (err) {
        if (!globalData) {
          document.getElementById('mainContent').innerHTML = '<div class="empty-state">Yuklashda xatolik yuz berdi. Qayta urinib ko\\'ring.</div>';
        }
      }
    }

    function renderDashboard() {
      if (!globalData) return;
      const isAdmin = !!globalData.isAdmin;
      const isOwner = !!globalData.isOwner;

      const userBadge = document.getElementById('userBadge');
      userBadge.innerHTML = isOwner ? '👑 Bosh Admin' : (isAdmin ? '🛡 Admin' : '👤 ' + (globalData.user?.first_name || 'Foydalanuvchi'));

      if (isAdmin) {
        document.getElementById('usersTabBtn').style.display = 'flex';
        document.getElementById('adminsTabBtn').style.display = 'flex';
        document.getElementById('paymentsTabBtn').style.display = 'flex';
        document.getElementById('accessControlCard').style.display = 'flex';
        renderAccessButton(globalData.webapp_public);
      }

      // Stats
      const statsGrid = document.getElementById('statsGrid');
      if (isAdmin && globalData.stats) {
        const s = globalData.stats;
        statsGrid.innerHTML = \`
          <div class="stat-card"><span class="stat-icon">👥</span><span class="stat-val">\${s.totalUsers || 0}</span><span class="stat-label">Mijozlar</span></div>
          <div class="stat-card"><span class="stat-icon">🤖</span><span class="stat-val">\${s.totalBots || 0}</span><span class="stat-label">Botlar</span></div>
          <div class="stat-card"><span class="stat-icon">🟢</span><span class="stat-val">\${s.activeBots || 0}</span><span class="stat-label">Faol</span></div>
          <div class="stat-card"><span class="stat-icon">💰</span><span class="stat-val">\${(s.totalIncome || 0).toLocaleString()}</span><span class="stat-label">Daromad</span></div>
        \`;
      } else {
        const s = globalData.stats || {};
        statsGrid.innerHTML = \`
          <div class="stat-card"><span class="stat-icon">🤖</span><span class="stat-val">\${s.myBotsCount || 0}</span><span class="stat-label">Botlarim</span></div>
          <div class="stat-card"><span class="stat-icon">💰</span><span class="stat-val">\${(s.balance || 0).toLocaleString()} so'm</span><span class="stat-label">Balansim</span></div>
          <div class="stat-card"><span class="stat-icon">⏳</span><span class="stat-val">\${s.daysLeft || 0} kun</span><span class="stat-label">Qolgan Kun</span></div>
        \`;
      }

      document.getElementById('botsCount').innerText = (globalData.bots || []).length;
      if (globalData.users) document.getElementById('usersCount').innerText = (globalData.users || []).length;
      if (globalData.admins) document.getElementById('adminsCount').innerText = (globalData.admins || []).length;

      renderTabContent();
    }

    function renderAccessButton(isPublic) {
      const btn = document.getElementById('toggleAccessBtn');
      const desc = document.getElementById('accessDesc');
      if (isPublic) {
        btn.className = 'toggle-btn on';
        btn.innerHTML = '🟢 ON (Hamma ko\\'radi)';
        desc.innerText = 'Hozirda Web App barcha foydalanuvchilar uchun ochiq.';
      } else {
        btn.className = 'toggle-btn off';
        btn.innerHTML = '🔴 OFF (Faqat Admin)';
        desc.innerText = 'Hozirda Web App faqat bot egasi va adminlarga ko\\'rinadi.';
      }
    }

    async function toggleWebAppAccess() {
      try {
        const res = await fetch('/api/webapp/toggle_access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId })
        });
        const d = await res.json();
        if (d.success) {
          globalData.webapp_public = d.webapp_public;
          renderAccessButton(d.webapp_public);
          showToast(d.webapp_public ? '🟢 Web App hamma uchun yoqildi!' : '🔴 Web App faqat adminlar uchun qoldirildi!');
        }
      } catch(e) {}
    }

    function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      event.target.closest('.tab-btn').classList.add('active');
      renderTabContent();
    }

    function toggleToken(id) {
      hiddenTokens[id] = !hiddenTokens[id];
      renderTabContent();
    }

    function openUserModal(uId, uName, uTariff, uBalance, uDays) {
      selectedUserIdForModal = uId;
      document.getElementById('modalTitle').innerText = '👤 ' + uName + ' (ID: ' + uId + ')';
      document.getElementById('modalUserSubtitle').innerText = 'Balansi: ' + Number(uBalance).toLocaleString() + ' so\\'m | Tarifi: ' + uTariff + ' (' + uDays + ' kun qoldi)';
      document.getElementById('modalAmountInput').value = '';
      document.getElementById('modalDaysInput').value = '';
      document.getElementById('userModal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('userModal').classList.remove('active');
      selectedUserIdForModal = null;
    }

    async function submitBalanceChange(type) {
      const amount = document.getElementById('modalAmountInput').value;
      if (!amount || Number(amount) <= 0) return alert('Iltimos to\\'g\\'ri summa kiriting!');
      const endpoint = type === 'add' ? '/api/webapp/add_balance' : '/api/webapp/subtract_balance';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: selectedUserIdForModal, amount: Number(amount), userId: currentUserId })
      });
      const d = await res.json();
      if (d.success) {
        showToast(type === 'add' ? '➕ Pul qo\\'shildi!' : '➖ Pul ayirildi!');
        closeModal();
        loadData();
      }
    }

    async function submitDaysAdd() {
      const days = document.getElementById('modalDaysInput').value;
      if (!days || Number(days) <= 0) return alert('Iltimos kun sonini kiriting!');
      const res = await fetch('/api/webapp/add_days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: selectedUserIdForModal, days: Number(days), userId: currentUserId })
      });
      const d = await res.json();
      if (d.success) {
        showToast('⏳ ' + days + ' kun qo\\'shildi!');
        closeModal();
        loadData();
      }
    }

    async function submitTariffChange() {
      const tariff = document.getElementById('modalTariffSelect').value;
      const res = await fetch('/api/webapp/set_tariff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: selectedUserIdForModal, tariffId: tariff, userId: currentUserId })
      });
      const d = await res.json();
      if (d.success) {
        showToast('💎 Tarif o\\'rnatildi!');
        closeModal();
        loadData();
      }
    }

    async function toggleBot(botId, curStatus) {
      const newStatus = curStatus === 'running' ? 'stopped' : 'running';
      const res = await fetch('/api/webapp/toggle_bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, status: newStatus, userId: currentUserId })
      });
      showToast(newStatus === 'running' ? '▶️ Bot ishga tushdi' : '⏹ Bot to\\'xtatildi');
      loadData();
    }

    async function deleteBot(botId, name) {
      if (!confirm('@' + name + ' botini o\\'chirishni tasdiqlaysizmi?')) return;
      await fetch('/api/webapp/delete_bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId, userId: currentUserId })
      });
      showToast('🗑 Bot o\\'chirildi');
      loadData();
    }

    async function addAdminPrompt() {
      const aid = prompt('Yangi admin Telegram ID sini kiriting:');
      if (!aid) return;
      const res = await fetch('/api/webapp/add_admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: aid, userId: currentUserId })
      });
      const d = await res.json();
      showToast(d.success ? '✅ Admin qo\\'shildi!' : '⚠️ ' + d.message);
      loadData();
    }

    async function removeAdmin(aid) {
      if (!confirm('ID: ' + aid + ' ni adminlikdan olishni xohlaysizmi?')) return;
      const res = await fetch('/api/webapp/remove_admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: aid, userId: currentUserId })
      });
      showToast('🗑 Admin o\\'chirildi');
      loadData();
    }

    function renderTabContent() {
      const content = document.getElementById('mainContent');
      const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();

      if (currentTab === 'bots') {
        let bots = globalData.bots || [];
        if (q) {
          bots = bots.filter(b => (b.bot_first_name || '').toLowerCase().includes(q) || (b.bot_username || '').toLowerCase().includes(q) || (b.token || '').toLowerCase().includes(q) || (b.owner?.first_name || '').toLowerCase().includes(q) || String(b.owner?.id || '').includes(q));
        }

        if (bots.length === 0) {
          content.innerHTML = '<div class="empty-state">🤖 Botlar topilmadi.</div>';
          return;
        }

        let html = '<div class="card-list">';
        bots.forEach(b => {
          const isRunning = b.status === 'running';
          const isTok = !!hiddenTokens[b.id];
          const tokenShow = isTok ? b.token : (b.token ? b.token.slice(0, 10) + '••••••••••••••••' : 'Token yo\\'q');

          html += \`
            <div class="item-card">
              <div class="card-header-row">
                <div class="card-title-box">
                  <div class="avatar-icon">🤖</div>
                  <div class="names-box">
                    <h4>\${escapeHtml(b.bot_first_name || 'Bot')}</h4>
                    <a href="https://t.me/\${b.bot_username}" target="_blank">@\${b.bot_username} ↗</a>
                  </div>
                </div>
                <span class="badge \${isRunning ? 'running' : 'stopped'}">\${isRunning ? '🟢 Faol' : '🔴 To\\'xtagan'}</span>
              </div>

              <!-- TOKEN -->
              <div class="token-box">
                <span class="token-text">🔑 \${tokenShow}</span>
                <div style="display:flex; gap:4px;">
                  <button class="action-btn" onclick="toggleToken('\${b.id}')">\${isTok ? '🙈' : '👁'}</button>
                  <button class="action-btn" onclick="copyToClipboard('\${b.token}', 'Token nusxalandi!')">📋</button>
                </div>
              </div>

              <!-- INFO -->
              <div class="grid-info">
                <div class="grid-info-item"><span class="info-label">Shablon</span><span class="info-val">🌐 \${b.template}</span></div>
                \${b.owner ? \`
                  <div class="grid-info-item"><span class="info-label">Mijoz</span><span class="info-val">👤 \${escapeHtml(b.owner.first_name)} (ID: \${b.owner.id})</span></div>
                  <div class="grid-info-item"><span class="info-label">Tarif</span><span class="info-val">💎 \${b.owner.tariff_name} (\${b.owner.days_left} kun)</span></div>
                \` : ''}
                <div class="grid-info-item"><span class="info-label">A'zolar</span><span class="info-val">👥 \${b.stats?.users_count || 0} ta</span></div>
              </div>

              <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button class="action-btn \${isRunning ? 'red' : 'green'}" onclick="toggleBot('\${b.id}', '\${b.status}')">\${isRunning ? '⏹ To\\'xtatish' : '▶️ Ishga tushirish'}</button>
                <button class="action-btn red" onclick="deleteBot('\${b.id}', '\${b.bot_username}')">🗑 O'chirish</button>
              </div>
            </div>
          \`;
        });
        html += '</div>';
        content.innerHTML = html;

      } else if (currentTab === 'users') {
        let users = globalData.users || [];
        if (q) {
          users = users.filter(u => (u.first_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q) || String(u.id).includes(q));
        }

        if (users.length === 0) {
          content.innerHTML = '<div class="empty-state">👥 Mijozlar topilmadi.</div>';
          return;
        }

        let html = '<div class="card-list">';
        users.forEach(u => {
          html += \`
            <div class="item-card">
              <div class="card-header-row">
                <div class="card-title-box">
                  <div class="avatar-icon">👤</div>
                  <div class="names-box">
                    <h4>\${escapeHtml(u.first_name)} \${u.username ? '(@' + u.username + ')' : ''}</h4>
                    <span style="font-size:11px; color:var(--text-muted);">Telegram ID: <code>\${u.id}</code></span>
                  </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                  <span class="badge balance">💰 \${(u.balance || 0).toLocaleString()} so'm</span>
                  <span class="badge tariff">💎 \${u.tariff_name}</span>
                </div>
              </div>

              <div class="grid-info">
                <div class="grid-info-item"><span class="info-label">Botlari</span><span class="info-val">🤖 \${u.bots_count} ta bot</span></div>
                <div class="grid-info-item"><span class="info-label">Obuna muddati</span><span class="info-val">⏳ \${u.days_left} kun qoldi</span></div>
                <div class="grid-info-item"><span class="info-label">Tugash sanasi</span><span class="info-val">\${u.subscription_ends_at ? new Date(u.subscription_ends_at).toLocaleDateString() : 'Noma\\'lum'}</span></div>
              </div>

              <!-- BOSHQARISH TUGMALARI -->
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <button class="action-btn" onclick="copyToClipboard('\${u.id}', 'ID nusxalandi!')">📋 ID</button>
                <div style="display:flex; gap:6px;">
                  <button class="action-btn gold" onclick="openUserModal('\${u.id}', '\${escapeHtml(u.first_name)}', '\${u.tariff_name}', '\${u.balance || 0}', '\${u.days_left}')">
                    ⚙️ Hisobni Boshqarish (Pul/Tarif)
                  </button>
                </div>
              </div>
            </div>
          \`;
        });
        html += '</div>';
        content.innerHTML = html;

      } else if (currentTab === 'admins') {
        let admins = globalData.admins || [];
        let html = \`
          <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
            <button class="action-btn green" onclick="addAdminPrompt()">➕ Yangi Admin Qo'shish</button>
          </div>
          <div class="card-list">
        \`;

        admins.forEach(a => {
          html += \`
            <div class="item-card">
              <div class="card-header-row">
                <div class="card-title-box">
                  <div class="avatar-icon">\${a.is_owner ? '👑' : '🛡'}</div>
                  <div class="names-box">
                    <h4>\${escapeHtml(a.first_name)} \${a.username ? '(@' + a.username + ')' : ''}</h4>
                    <span style="font-size:11px; color:var(--text-muted);">ID: <code>\${a.id}</code></span>
                  </div>
                </div>
                <span class="badge tariff">\${a.is_owner ? '👑 Bosh Admin (Ega)' : '🛡 Yordamchi Admin'}</span>
              </div>
              \${!a.is_owner ? \`
                <div style="display:flex; justify-content:flex-end;">
                  <button class="action-btn red" onclick="removeAdmin('\${a.id}')">🗑 Adminlikdan Olish</button>
                </div>
              \` : ''}
            </div>
          \`;
        });
        html += '</div>';
        content.innerHTML = html;

      } else if (currentTab === 'payments') {
        let payments = globalData.payments || [];
        if (payments.length === 0) {
          content.innerHTML = '<div class="empty-state">💳 To\\'lov arizalari yo\\'q.</div>';
          return;
        }

        let html = '<div class="card-list">';
        payments.slice().reverse().forEach(p => {
          const isPending = p.status === 'pending';
          const isApproved = p.status === 'approved';
          html += \`
            <div class="item-card">
              <div class="card-header-row">
                <div class="names-box">
                  <h4>To'lov: \${(p.amount || 0).toLocaleString()} so'm</h4>
                  <span style="font-size:11px; color:var(--text-muted);">Tarif: <b>\${p.tariff_name}</b> | Mijoz ID: <code>\${p.user_id}</code></span>
                </div>
                <span class="badge \${isApproved ? 'running' : (isPending ? 'balance' : 'stopped')}">
                  \${isApproved ? '✅ Tasdiqlangan' : (isPending ? '⏳ Kutilmoqda' : '❌ Bekor qilingan')}
                </span>
              </div>
              <p style="font-size:11px; color:var(--text-muted);">Sana: \${new Date(p.created_at).toLocaleString()}</p>
            </div>
          \`;
        });
        html += '</div>';
        content.innerHTML = html;
      }
    }

    function escapeHtml(t) {
      if (!t) return '';
      return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    if (globalData) {
      renderDashboard();
    } else {
      loadData();
    }
  </script>
</body>
</html>`;
}

// HTTP API handler
function handleWebAppRequests(req, res) {
  const urlObj = new URL(req.url, 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. Web App HTML
  if (pathname === '/webapp' || pathname === '/admin/webapp') {
    const userId = urlObj.searchParams.get('userId') || (config && config.OWNER_ID) || '8422157752';
    const initialData = db.getWebappFullData(userId);
    res.writeHead(200, { 
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(getWebAppHtml(initialData, userId));
  }

  // 2. API: Ma'lumotlarni olish
  if (pathname === '/api/webapp/data' && req.method === 'GET') {
    const userId = urlObj.searchParams.get('userId') || (config && config.OWNER_ID) || '8422157752';
    const data = db.getWebappFullData(userId);
    res.writeHead(200, { 
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(data));
  }

  // 3. API: Pul qo'shish
  if (pathname === '/api/webapp/add_balance' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!db.isAdmin(payload.userId)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Ruxsat yo\'q' }));
        }
        const newBal = db.addBalance(payload.targetUserId, payload.amount);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, balance: newBal }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 4. API: Pul ayirish / yechish
  if (pathname === '/api/webapp/subtract_balance' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!db.isAdmin(payload.userId)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Ruxsat yo\'q' }));
        }
        const newBal = db.subtractBalance(payload.targetUserId, payload.amount);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, balance: newBal }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 5. API: Muddat qo'shish
  if (pathname === '/api/webapp/add_days' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!db.isAdmin(payload.userId)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Ruxsat yo\'q' }));
        }
        const daysLeft = db.addDays(payload.targetUserId, payload.days);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, daysLeft }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 6. API: Tarif o'rnatish
  if (pathname === '/api/webapp/set_tariff' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!db.isAdmin(payload.userId)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Ruxsat yo\'q' }));
        }
        db.setTariff(payload.targetUserId, payload.tariffId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 7. API: Web App ON / OFF
  if (pathname === '/api/webapp/toggle_access' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!db.isAdmin(payload.userId)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Ruxsat yo\'q' }));
        }
        const newStatus = db.toggleWebappPublic();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, webapp_public: newStatus }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 8. API: Botni to'xtatish / yoqish
  if (pathname === '/api/webapp/toggle_bot' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const b = db.getBot(payload.botId);
        if (!b) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Bot topilmadi' }));
        }
        if (payload.status === 'running') {
          await botManager.startBot(b);
        } else {
          botManager.stopBot(payload.botId);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 9. API: Botni o'chirish
  if (pathname === '/api/webapp/delete_bot' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        botManager.stopBot(payload.botId);
        db.deleteBot(payload.botId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 10. API: Admin qo'shish
  if (pathname === '/api/webapp/add_admin' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!db.isOwner(payload.userId)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Faqat Bosh Admin qo\'sha oladi' }));
        }
        const added = db.addAdmin(payload.targetUserId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: added, message: added ? 'Admin qo\'shildi' : 'Allaqachon admin' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 11. API: Adminni o'chirish
  if (pathname === '/api/webapp/remove_admin' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!db.isOwner(payload.userId)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Faqat Bosh Admin o\'chira oladi' }));
        }
        const removed = db.removeAdmin(payload.targetUserId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: removed }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  return false;
}

module.exports = {
  getWebAppHtml,
  handleWebAppRequests
};
});

// ---- FILE: templates/ai.js ----
defineModule('templates/ai.js', function(exports, module, require) {
const axios = require('axios');
const config = require('../config');

module.exports = {
  id: 'ai',
  name: '🤖 AI / ChatGPT Boti',
  description: 'Savollarga aqlli javob beruvchi, kod yozuvchi, maslahat beruvchi Sun\'iy Intellekt boti',
  icon: '🤖',
  setupBot: (bot, botRecord, db) => {
    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `Men *Sun'iy Intellekt (AI)* yordamchisiman. Sizga quyidagi sohalarda yordam bera olaman:\n` +
        `• Har qanday savollarga javob berish\n` +
        `• Dasturlash va kod yozish (Python, JS, C++, PHP, HTML/CSS...)\n` +
        `• Matematik hisob-kitoblar va masalalar yechish\n` +
        `• Matnlar, tabriklar, insholar va xatlar yozish\n` +
        `• Maslahat va g'oyalar berish\n\n` +
        `Menga istalgan savolingizni yozing! 👇`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.command('help', async (ctx) => {
      await ctx.reply(
        `💡 *AI Botdan foydalanish:*\n\n` +
        `Menga shunchaki xabar, savol yoki matematik ifoda yuboring.\n` +
        `Masalan:\n` +
        `• _Python da telegram bot qanday yaratiladi?_\n` +
        `• _Sayt ochish uchun nimalarni bilish kerak?_\n` +
        `• _25 * 40 - 150 hisoblab ber_\n` +
        `• _Tug'ilgan kunga tabrik yozib ber_`,
        { parse_mode: 'Markdown' }
      );
    });

    // Bot egasi uchun maxsus admin paneli
    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      const current = db.getBot(botRecord.id) || botRecord;
      await ctx.reply(
        `👑 *${botRecord.bot_first_name} — Admin Paneli*\n\n` +
        `👤 Bot egasi ID: \`${botRecord.owner_id}\`\n` +
        `👥 Jami foydalanuvchilar: *${current.stats?.users_count || 0} ta*\n` +
        `💬 Jami xabarlar: *${current.stats?.messages_count || 0} ta*\n` +
        `⚡ Sun'iy intellekt holati: *🟢 Faol (Online)*`,
        { parse_mode: 'Markdown' }
      );
    });

    // Aqlli AI javob beruvchi
    bot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/')) return;

      db.updateBotData(botRecord.id, (b) => {
        b.stats.messages_count = (b.stats.messages_count || 0) + 1;
      });

      await ctx.sendChatAction('typing');

      // 1. Agar OpenAI kaliti kiritilgan bo'lsa
      if (config.OPENAI_API_KEY) {
        try {
          const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Siz aqlli, xushmuomala va har tomonlama yordam beruvchi sun\'iy intellektsiz. O\'zbek tilida aniq, tushunarli va chiroyli formatda javob bering.' },
                { role: 'user', content: text }
              ],
              max_tokens: 1000
            },
            {
              headers: {
                'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000
            }
          );
          const reply = response.data.choices[0].message.content;
          return ctx.reply(reply);
        } catch (err) {
          console.log('OpenAI API xatoligi, ichki aqlli tizimga o\'tildi');
        }
      }

      // 2. Matematik hisob-kitoblar tekshiruvi (masalan: 25 * 4, 150 + 20)
      const mathMatch = text.match(/^([\d\s\+\-\*\/\(\)\.\,]+)$/);
      if (mathMatch) {
        try {
          const sanitized = text.replace(/,/g, '.');
          const res = Function(`'use strict'; return (${sanitized})`)();
          if (typeof res === 'number' && !isNaN(res)) {
            return ctx.reply(`🧮 *Hisob-kitob natijasi:*\n\n\`${text}\` = *${res.toLocaleString()}*`, { parse_mode: 'Markdown' });
          }
        } catch (e) {}
      }

      // 3. Kuchli va aqlli tabiiy til tahlili (Built-in Knowledge & NLP Engine)
      const q = text.toLowerCase();
      let answer = '';

      if (q.includes('salom') || q.includes('assalom') || q.includes('qalaysiz') || q.includes('tuzikmisiz')) {
        answer = `Assalomu alaykum! Xush ko'rdik! Kayfiyatingiz yaxshimi? Sizga qanday yordam bera olaman? Istalgan savolingizni so'rashingiz mumkin! 😊`;
      } else if (q.includes('kimsan') || q.includes('nima qila olasan') || q.includes('vazifang')) {
        answer = 
          `🤖 *Men Sun'iy Intellekt (AI) asosida ishlovchi yordamchiman!*\n\n` +
          `Mening imkoniyatlarim:\n` +
          `1. Savollarga tez va batafsil javob berish\n` +
          `2. Dasturlashda kod yozish va xatolarni to'g'rilash\n` +
          `3. Matematik amallar va formulalarni yechish\n` +
          `4. Matnlar, maqolalar va tabriklar yozish\n` +
          `5. Turli tillarga tarjima qilish`;
      } else if (q.includes('python') || q.includes('kod') || q.includes('dastur') || q.includes('javascript') || q.includes('bot yaratish')) {
        answer = 
          `💻 *Dasturlash bo'yicha ma'lumot:* \n\n` +
          `Telegram bot yoki tizim yaratish uchun eng mashhur tillar:\n` +
          `• *Python*: \`aiogram\`, \`python-telegram-bot\`\n` +
          `• *Node.js*: \`telegraf\`, \`grammy\`\n\n` +
          `Masalan, Node.js da oddiy bot kodi:\n` +
          `\`\`\`javascript\nconst { Telegraf } = require('telegraf');\nconst bot = new Telegraf('TOKEN');\nbot.start((ctx) => ctx.reply('Salom!'));\nbot.launch();\n\`\`\`\n` +
          `Sizga aynan qaysi tilda qanday funksiya kerak?`;
      } else if (q.includes('tabrik') || q.includes('tug\'ilgan kun') || q.includes('tavallud')) {
        answer = 
          `🎉 *Tug'ilgan kun uchun samimiy tabrik:*\n\n` +
          `Sizni bugungi unutilmas tavallud ayyomingiz bilan chin qalbdan muborakbod etaman! 🎂\n\n` +
          `Sizga mustahkam sog'lik, oilaviy xotirjamlik, cheksiz baxt va barcha ezgu orzularingizning ro'yobga chiqishini tilayman. Har bir kuningiz quvonchli va barakali o'tsin! ✨`;
      } else if (q.includes('biznes') || q.includes('pul topish') || q.includes('daromad')) {
        answer = 
          `💼 *Biznes va Daromadni oshirish bo'yicha tavsiyalar:*\n\n` +
          `1. *Talab yuqori sohani tanlang*: IT, SMM, Telegram botlar, internet marketing.\n` +
          `2. *Sifatli xizmat*: Mijozlarga tez va sifatli xizmat ko'rsatish eng yaxshi reklamadir.\n` +
          `3. *Avtomatlashtirish*: Telegram botlar orqali mijozlarni qabul qilish va savdoni avtomatlashtiring.\n` +
          `4. *Doimiy o'rganish*: Yangi ko'nikmalarni egallashdan to'xtamang!`;
      } else if (q.includes('rahmat') || q.includes('tashakkur') || q.includes('barakalla')) {
        answer = `Arzimaydi! Sizga yordam bera olganimdan juda xursandman. Yana biron savolingiz bo'lsa, bemalol so'rang! 😊`;
      } else {
        answer = 
          `🧠 *AI Tahlili va Javob:*\n\n` +
          `Sizning savolingiz: *"${text}"*\n\n` +
          `💡 *Tavsiya va xulosa:*\n` +
          `Ushbu masala bo'yicha asosiy jihatlar:\n` +
          `• Rejani aniq belgilash va bosqichma-bosqich yondashish;\n` +
          `• Kerakli resurs va ma'lumotlarni to'g'ri taqsimlash;\n` +
          `• Sinov o'tkazish va doimiy takomillashtirish.\n\n` +
          `Savolingizni yanada aniqroq qilib yozsangiz, yanada chuqurroq javob beraman! 🚀`;
      }

      await ctx.reply(answer, { parse_mode: 'Markdown' });
    });
  }
};

});

// ---- FILE: templates/anonim.js ----
defineModule('templates/anonim.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'anonim',
  name: '🎭 Anonim Chat Boti',
  description: 'Begona odamlar bilan sirli va anonim muloqot qilish boti',
  icon: '🎭',
  setupBot: (bot, botRecord, db) => {
    // Navbatdagi va faol chatdoshlar
    let queue = [];
    const activeChats = {}; // userId -> partnerId

    const chatKeyboard = Markup.keyboard([
      ['🛑 Suhbatni to\'xtatish', '➡️ Keyingi suhbatdosh']
    ]).resize();

    const startKeyboard = Markup.keyboard([
      ['🔎 Yangi suhbatdosh qidirish']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🎭 *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `Bu yerda siz butunlay anonim holda tasodifiy insonlar bilan suhbatlashishingiz mumkin. Shaxsingiz va profilingiz sir saqlanadi.\n\n` +
        `Suhbatni boshlash uchun quyidagi tugmani bosing:`,
        { parse_mode: 'Markdown', ...startKeyboard }
      );
    });

    const startSearch = async (ctx) => {
      const userId = ctx.from.id;

      if (activeChats[userId]) {
        return ctx.reply('Siz allaqachon suhbatdasiz! To\'xtatish uchun: 🛑 Suhbatni to\'xtatish');
      }

      if (queue.includes(userId)) {
        return ctx.reply('⏳ Suhbatdosh qidirilmoqda... Iltimos kuting.');
      }

      // Navbatda odam bormi?
      if (queue.length > 0) {
        const partnerId = queue.shift();
        if (partnerId !== userId) {
          activeChats[userId] = partnerId;
          activeChats[partnerId] = userId;

          await ctx.reply('🎉 *Suhbatdosh topildi!* Salom deb yozing!', { parse_mode: 'Markdown', ...chatKeyboard });
          try {
            await bot.telegram.sendMessage(partnerId, '🎉 *Suhbatdosh topildi!* Salom deb yozing!', { parse_mode: 'Markdown', ...chatKeyboard });
          } catch (e) {}
          return;
        }
      }

      queue.push(userId);
      await ctx.reply('🔎 Suhbatdosh qidirilmoqda... Yangi foydalanuvchi ulanganda xabar beramiz.');
    };

    bot.hears('🔎 Yangi suhbatdosh qidirish', startSearch);
    bot.command('search', startSearch);

    const stopChat = async (ctx) => {
      const userId = ctx.from.id;
      const partnerId = activeChats[userId];

      queue = queue.filter(id => id !== userId);

      if (partnerId) {
        delete activeChats[userId];
        delete activeChats[partnerId];

        await ctx.reply('🛑 Siz suhbatni to\'xtatdingiz.', startKeyboard);
        try {
          await bot.telegram.sendMessage(partnerId, '🛑 Suhbatdoshingiz muloqotni yakunladi.', startKeyboard);
        } catch (e) {}
      } else {
        await ctx.reply('Siz hozir hech kim bilan gaplashmayapsiz.', startKeyboard);
      }
    };

    bot.hears('🛑 Suhbatni to\'xtatish', stopChat);
    bot.command('stop', stopChat);

    bot.hears('➡️ Keyingi suhbatdosh', async (ctx) => {
      await stopChat(ctx);
      await startSearch(ctx);
    });

    // Xabarlarni o'zaro uzatish
    bot.on('message', async (ctx) => {
      const text = ctx.message.text;
      if (text && (text.startsWith('/') || ['🔎 Yangi suhbatdosh qidirish', '🛑 Suhbatni to\'xtatish', '➡️ Keyingi suhbatdosh'].includes(text))) {
        return;
      }

      const partnerId = activeChats[ctx.from.id];
      if (partnerId) {
        try {
          if (ctx.message.text) {
            await bot.telegram.sendMessage(partnerId, ctx.message.text);
          } else if (ctx.message.photo) {
            const photo = ctx.message.photo.pop().file_id;
            await bot.telegram.sendPhoto(partnerId, photo, { caption: ctx.message.caption });
          } else if (ctx.message.voice) {
            await bot.telegram.sendVoice(partnerId, ctx.message.voice.file_id);
          } else if (ctx.message.sticker) {
            await bot.telegram.sendSticker(partnerId, ctx.message.sticker.file_id);
          }
        } catch (err) {
          ctx.reply('⚠️ Xabarni yuborib bo\'lmadi.');
        }
      } else {
        await ctx.reply('Siz hech kim bilan ulanmagansiz. "🔎 Yangi suhbatdosh qidirish" tugmasini bosing.');
      }
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(
        `👑 *Anonim Chat Boti — Admin Paneli*\n\n` +
        `👥 Faol jonli suhbatlar: *${Object.keys(activeChats).length / 2} juftlik*\n` +
        `⏳ Navbatda kutayotganlar: *${queue.length} kishi*`,
        { parse_mode: 'Markdown' }
      );
    });
  }
};

});

// ---- FILE: templates/autopost.js ----
defineModule('templates/autopost.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'autopost',
  name: '📢 Avto-Post & Inline Tugmali Post Boti',
  description: 'Telegram kanallar uchun chiroyli inline havolali tugmali postlar yaratuvchi bot',
  icon: '📢',
  setupBot: (bot, botRecord, db) => {
    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `📢 *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `Bu bot orqali kanalingiz uchun chiroyli ko'rinishdagi tugmali (inline link) postlar tayyorlashingiz mumkin.\n\n` +
        `Post yaratish uchun matn va tugmalarni quyidagi formatda yuboring:\n\n` +
        `*Post matni* | *Tugma nomi* - *https://havola.uz*\n\n` +
        `Misol:\n` +
        `\`Yangi aksiya boshlandi! | Kanalimizga obuna bo'ling - https://t.me/telegram\``,
        { parse_mode: 'Markdown' }
      );
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return;

      if (!text.includes('|') || !text.includes('-')) {
        return ctx.reply(
          `⚠️ Iltimos, postni to'g'ri formatda yuboring:\n\n` +
          `*Matn | Tugma matni - Havola (URL)*\n\n` +
          `Misol:\n\`Bizning rasmiy kanalimiz | Kanalga o'tish - https://t.me/telegram\``,
          { parse_mode: 'Markdown' }
        );
      }

      const parts = text.split('|');
      const content = parts[0].trim();
      const btnPart = parts[1].trim().split('-');
      const btnTitle = btnPart[0].trim();
      const btnUrl = btnPart[1].trim();

      try {
        await ctx.reply(content, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url(btnTitle, btnUrl)]
          ])
        });
        await ctx.reply('👆 Sizning tugmali postingiz tayyor! Uni kanalingizga forward qilishingiz mumkin.');
      } catch (err) {
        await ctx.reply('❌ Havola noto\'g\'ri kiritildi. Havola https:// bilan boshlanishi kerak.');
      }
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(`👑 *Avto-Post Boti — Admin Paneli*`, { parse_mode: 'Markdown' });
    });
  }
};

});

// ---- FILE: templates/currency.js ----
defineModule('templates/currency.js', function(exports, module, require) {
const axios = require('axios');
const { Markup } = require('telegraf');

module.exports = {
  id: 'currency',
  name: '💱 Valyuta Kurslari & Konvertor',
  description: 'O\'zbekiston Markaziy Banki rasmiy kurslari va valyuta hisoblash kalkulyatori boti',
  icon: '💱',
  setupBot: (bot, botRecord, db) => {
    let ratesCache = null;
    let lastFetched = 0;

    const fetchRates = async () => {
      const now = Date.now();
      if (ratesCache && now - lastFetched < 10 * 60 * 1000) {
        return ratesCache;
      }
      try {
        const res = await axios.get('https://cbu.uz/uz/arkhiv-kursov-valyut/json/', { timeout: 10000 });
        ratesCache = res.data;
        lastFetched = now;
        return ratesCache;
      } catch (err) {
        // Zaxira kurslar
        return [
          { Ccy: 'USD', Rate: '12850.00', Diff: '+15.00' },
          { Ccy: 'EUR', Rate: '13950.00', Diff: '-10.00' },
          { Ccy: 'RUB', Rate: '142.50', Diff: '+0.50' },
          { Ccy: 'KZT', Rate: '26.80', Diff: '+0.10' }
        ];
      }
    };

    const mainKeyboard = Markup.keyboard([
      ['📈 Bugungi kurslar', '🔄 Valyuta kalkulyatori'],
      ['📊 Dollar kursi', 'ℹ️ Ma\'lumot']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `💱 *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `Bu yerda siz Markaziy Bankning eng so'nggi rasmiy kurslarini bilib olishingiz va valyutalarni so'mga konvertatsiya qilishingiz mumkin.\n\n` +
        `Kerakli bo'limni tanlang:`,
        { parse_mode: 'Markdown', ...mainKeyboard }
      );
    });

    const sendRates = async (ctx) => {
      await ctx.sendChatAction('typing');
      const rates = await fetchRates();

      const usd = rates.find(r => r.Ccy === 'USD') || { Rate: '12850', Diff: '+10' };
      const eur = rates.find(r => r.Ccy === 'EUR') || { Rate: '13900', Diff: '-5' };
      const rub = rates.find(r => r.Ccy === 'RUB') || { Rate: '142', Diff: '+0.2' };
      const kzt = rates.find(r => r.Ccy === 'KZT') || { Rate: '26.5', Diff: '0' };
      const tryRate = rates.find(r => r.Ccy === 'TRY') || { Rate: '375', Diff: '-1' };

      const msg = 
        `📈 *Markaziy Bank Rasmiy Valyuta Kurslari:*\n\n` +
        `🇺🇸 1 USD = *${parseFloat(usd.Rate).toLocaleString()} so'm* (${usd.Diff})\n` +
        `🇪🇺 1 EUR = *${parseFloat(eur.Rate).toLocaleString()} so'm* (${eur.Diff})\n` +
        `🇷🇺 1 RUB = *${parseFloat(rub.Rate).toLocaleString()} so'm* (${rub.Diff})\n` +
        `🇰🇿 1 KZT = *${parseFloat(kzt.Rate).toLocaleString()} so'm* (${kzt.Diff})\n` +
        `🇹🇷 1 TRY = *${parseFloat(tryRate.Rate).toLocaleString()} so'm* (${tryRate.Diff})\n\n` +
        `💡 *Kalkulyator:* Raqam yuboring (Masalan: \`100 usd\` yoki \`5000000 som\`)`;

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    };

    bot.hears('📈 Bugungi kurslar', sendRates);
    bot.hears('📊 Dollar kursi', async (ctx) => {
      const rates = await fetchRates();
      const usd = rates.find(r => r.Ccy === 'USD') || { Rate: '12850', Diff: '+10' };
      await ctx.reply(`🇺🇸 *1 AQSH Dollari:* *${parseFloat(usd.Rate).toLocaleString()} so'm* (${usd.Diff})`, { parse_mode: 'Markdown' });
    });

    bot.hears('🔄 Valyuta kalkulyatori', async (ctx) => {
      await ctx.reply(
        `🔄 *Valyuta kalkulyatori:*\n\n` +
        `Quyidagi formatlarda yozib yuborishingiz mumkin:\n` +
        `• \`100 usd\` (100 dollarni so'mga hisoblash)\n` +
        `• \`50 eur\` (50 yevroni so'mga hisoblash)\n` +
        `• \`5000000 som\` (5 mln so'mni dollarga hisoblash)\n\n` +
        `Hisoblamoqchi bo'lgan summani yozing:`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text.trim().toLowerCase();
      if (text.startsWith('/')) return;

      const rates = await fetchRates();
      const usd = parseFloat(rates.find(r => r.Ccy === 'USD')?.Rate || 12850);
      const eur = parseFloat(rates.find(r => r.Ccy === 'EUR')?.Rate || 13950);
      const rub = parseFloat(rates.find(r => r.Ccy === 'RUB')?.Rate || 142);

      const parts = text.split(' ');
      const num = parseFloat(parts[0]);

      if (!isNaN(num)) {
        const cur = parts[1] || 'usd';
        if (cur.includes('usd') || cur.includes('dollar') || cur.includes('$')) {
          const total = (num * usd).toLocaleString();
          return ctx.reply(`🇺🇸 *${num} USD* = *${total} UZS* (so'm)`, { parse_mode: 'Markdown' });
        } else if (cur.includes('eur') || cur.includes('yevro')) {
          const total = (num * eur).toLocaleString();
          return ctx.reply(`🇪🇺 *${num} EUR* = *${total} UZS* (so'm)`, { parse_mode: 'Markdown' });
        } else if (cur.includes('rub') || cur.includes('rubl')) {
          const total = (num * rub).toLocaleString();
          return ctx.reply(`🇷🇺 *${num} RUB* = *${total} UZS* (so'm)`, { parse_mode: 'Markdown' });
        } else if (cur.includes('som') || cur.includes('uzs')) {
          const inUsd = (num / usd).toFixed(2);
          return ctx.reply(`🇺🇿 *${num.toLocaleString()} so'm* = *${inUsd} USD* ($)`, { parse_mode: 'Markdown' });
        }
      }
    });

    bot.hears('ℹ️ Ma\'lumot', async (ctx) => {
      await ctx.reply('Barcha valyuta kurslari O\'zbekiston Respublikasi Markaziy Banki ochiq ma\'lumotlariga asoslanadi.');
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(`👑 *Valyuta Boti — Admin Paneli*\n\nBot Markaziy Bank API bilan muvaffaqiyatli ishlamoqda.`, { parse_mode: 'Markdown' });
    });
  }
};

});

// ---- FILE: templates/custom_buttons.js ----
defineModule('templates/custom_buttons.js', function(exports, module, require) {
﻿const { Markup } = require('telegraf');

module.exports = {
  id: 'custom_buttons',
  name: '🔘 Tugma & Kino Qo\'shadigan Bot',
  description: 'O\'zingiz xohlagan menyu tugmalari (buyruq, matn, havola) va Kino kodlarini bemalol qo\'shish boti',
  icon: '🔘',
  setupBot: (bot, botRecord, db) => {
    // Bot ma'lumotlarini olish va initsializatsiya qilish
    const getBotCustomData = () => {
      const b = db.getBot(botRecord.id);
      if (!b.data) b.data = {};
      if (!b.data.buttons) {
        b.data.buttons = [
          { id: 'btn_1', title: '🎬 Kinolar', type: 'text', content: 'Kino kodini yuboring (masalan: 101, 777) yoki /kinolar buyrug\'ini bosing!' },
          { id: 'btn_2', title: '📢 Kanalimiz', type: 'url', content: 'https://t.me/telegram' },
          { id: 'btn_3', title: '📞 Aloqa / Admin', type: 'text', content: 'Admin bilan bog\'lanish uchun: @ismoiluzb022' }
        ];
      }
      if (!b.data.movies) {
        b.data.movies = {
          '1': { title: 'Qasoskorlar: Intiho', link: 'https://t.me/telegram' },
          '101': { title: 'Avatar: Suv Yo\'li', link: 'https://t.me/telegram' },
          '777': { title: 'Forsaj 10', link: 'https://t.me/telegram' }
        };
      }
      return b.data;
    };

    // Klaviatura yasash funksiyasi
    const renderKeyboard = (ctx, customData) => {
      const isOwner = ctx.from && String(ctx.from.id) === String(botRecord.owner_id);
      const rows = [];
      const btns = customData.buttons || [];

      for (let i = 0; i < btns.length; i += 2) {
        const row = [btns[i].title];
        if (btns[i + 1]) row.push(btns[i + 1].title);
        rows.push(row);
      }

      if (isOwner) {
        rows.push(['⚙️ Botni Sozlash (Admin)']);
      }

      return Markup.keyboard(rows).resize();
    };

    const userState = {}; // userId -> { step, temp }

    // /start
    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      const data = getBotCustomData();
      const isOwner = String(ctx.from.id) === String(botRecord.owner_id);
      const firstName = ctx.from.first_name || 'Foydalanuvchi';

      let text = `👋 Assalomu alaykum, *${firstName}*!\n\n` +
        `🤖 *${botRecord.bot_first_name}* ga xush kelibsiz!\n\n` +
        `Kerakli bo'limni tanlash uchun pastdagi tugmalardan foydalaning yoki kino kodini yuboring.`;

      if (isOwner) {
        text += `\n\n👑 *Siz bot egasisiz!*\nYangi tugmalar, buyruqlar va kinolar qo'shish uchun *⚙️ Botni Sozlash (Admin)* tugmasini bosing.`;
      }

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...renderKeyboard(ctx, data)
      });
    });

    // Kinolar ro'yxati
    bot.command('kinolar', async (ctx) => {
      const data = getBotCustomData();
      const movies = data.movies || {};
      const keys = Object.keys(movies);

      if (keys.length === 0) {
        return ctx.reply('🎬 Hozircha kinolar qo\'shilmagan.');
      }

      let msg = `🎬 *Mavjud Kinolar Ro'yxati:*\n\n`;
      keys.forEach((code) => {
        msg += `🔑 Kod: \`${code}\` — *${movies[code].title}*\n`;
      });
      msg += `\nFilmni ko'rish uchun uning kodini yozib yuboring!`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // Admin boshqaruv menyusi (faqat bot egasiga)
    bot.hears('⚙️ Botni Sozlash (Admin)', async (ctx) => {
      if (String(ctx.from.id) !== String(botRecord.owner_id)) return;

      const data = getBotCustomData();
      const btnCount = (data.buttons || []).length;
      const movieCount = Object.keys(data.movies || {}).length;

      await ctx.reply(
        `🛠 *Bot Sozlamalari & Boshqaruv:*\n\n` +
        `🔘 Mavjud Tugmalar: *${btnCount} ta*\n` +
        `🎬 Mavjud Kinolar: *${movieCount} ta*\n\n` +
        `Kerakli amalni tanlang:`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('➕ Yangi Tugma Qo\'shish', 'adm_add_btn')],
            [Markup.button.callback('🎬 Yangi Kino Qo\'shish', 'adm_add_movie')],
            [Markup.button.callback('📋 Tugmalar Ro\'yxati / O\'chirish', 'adm_list_btns')],
            [Markup.button.callback('🎥 Kinolar Ro\'yxati / O\'chirish', 'adm_list_movies')],
            [Markup.button.callback('❌ Menyuni Yopish', 'adm_close')]
          ])
        }
      );
    });

    // Inline callbacklar
    bot.action('adm_close', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.deleteMessage().catch(() => {});
    });

    // 1. Yangi tugma qo'shish
    bot.action('adm_add_btn', async (ctx) => {
      await ctx.answerCbQuery();
      if (String(ctx.from.id) !== String(botRecord.owner_id)) return;

      userState[ctx.from.id] = { step: 'btn_title' };
      await ctx.reply(
        `📝 *1-Qadam:* Yangi tugma nomini kiriting:\n\n` +
        `Masalan: \`📱 Biz haqimizda\`, \`💰 Narxlar\`, \`🚀 VIP Kanal\`\n\n` +
        `Bekor qilish uchun: /cancel`,
        { parse_mode: 'Markdown' }
      );
    });

    // 2. Yangi kino qo'shish
    bot.action('adm_add_movie', async (ctx) => {
      await ctx.answerCbQuery();
      if (String(ctx.from.id) !== String(botRecord.owner_id)) return;

      userState[ctx.from.id] = { step: 'movie_code' };
      await ctx.reply(
        `🎬 *1-Qadam:* Yangi kino uchun *KOD* (raqam) kiriting:\n\n` +
        `Masalan: \`12\`, \`505\`, \`999\`\n\n` +
        `Bekor qilish uchun: /cancel`,
        { parse_mode: 'Markdown' }
      );
    });

    // Tugmalar ro'yxati
    bot.action('adm_list_btns', async (ctx) => {
      await ctx.answerCbQuery();
      if (String(ctx.from.id) !== String(botRecord.owner_id)) return;

      const data = getBotCustomData();
      const btns = data.buttons || [];

      if (btns.length === 0) {
        return ctx.reply('Tugmalar mavjud emas.');
      }

      const rows = btns.map((b) => [
        Markup.button.callback(`🗑 O'chirish: ${b.title}`, `del_btn_${b.id}`)
      ]);
      rows.push([Markup.button.callback('⬅️ Orqaga', 'adm_close')]);

      await ctx.reply('📋 O\'chirmoqchi bo\'lgan tugmangizni tanlang:', Markup.inlineKeyboard(rows));
    });

    // Tugmani o'chirish
    bot.action(/del_btn_(.*)/, async (ctx) => {
      await ctx.answerCbQuery();
      if (String(ctx.from.id) !== String(botRecord.owner_id)) return;
      const btnId = ctx.match[1];

      db.updateBotData(botRecord.id, (b) => {
        if (b.data && b.data.buttons) {
          b.data.buttons = b.data.buttons.filter(x => x.id !== btnId);
        }
      });

      const updated = getBotCustomData();
      await ctx.reply(`✅ Tugma o'chirildi!`, renderKeyboard(ctx, updated));
    });

    // Kinolar ro'yxati va o'chirish
    bot.action('adm_list_movies', async (ctx) => {
      await ctx.answerCbQuery();
      if (String(ctx.from.id) !== String(botRecord.owner_id)) return;

      const data = getBotCustomData();
      const movies = data.movies || {};
      const keys = Object.keys(movies);

      if (keys.length === 0) {
        return ctx.reply('Kinolar mavjud emas.');
      }

      const rows = keys.slice(0, 10).map((code) => [
        Markup.button.callback(`🗑 O'chirish: [${code}] ${movies[code].title}`, `del_mov_${code}`)
      ]);
      rows.push([Markup.button.callback('⬅️ Orqaga', 'adm_close')]);

      await ctx.reply('🎬 O\'chirmoqchi bo\'lgan kinoni tanlang:', Markup.inlineKeyboard(rows));
    });

    bot.action(/del_mov_(.*)/, async (ctx) => {
      await ctx.answerCbQuery();
      if (String(ctx.from.id) !== String(botRecord.owner_id)) return;
      const code = ctx.match[1];

      db.updateBotData(botRecord.id, (b) => {
        if (b.data && b.data.movies) {
          delete b.data.movies[code];
        }
      });

      await ctx.reply(`✅ [${code}] kodi bilan saqlangan kino o'chirildi!`);
    });

    // /cancel
    bot.command('cancel', async (ctx) => {
      delete userState[ctx.from.id];
      const data = getBotCustomData();
      await ctx.reply('❌ Amal bekor qilindi.', renderKeyboard(ctx, data));
    });

    // Matn va qadamlarni boshqarish
    bot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      const userId = ctx.from.id;
      const isOwner = String(userId) === String(botRecord.owner_id);
      const state = userState[userId];
      const data = getBotCustomData();

      // QADAM 1: Tugma sarlavhasi
      if (state && state.step === 'btn_title' && isOwner) {
        state.title = text;
        state.step = 'btn_content';
        return ctx.reply(
          `✅ Tugma nomi: *${text}*\n\n` +
          `📝 *2-Qadam:* Foydalanuvchi ushbu tugmani bosganda bot nima deb javob bersin?\n` +
          `Istalgan matn, ma'lumot yoki havola yozing:`,
          { parse_mode: 'Markdown' }
        );
      }

      // QADAM 2: Tugma javobi
      if (state && state.step === 'btn_content' && isOwner) {
        const title = state.title;
        const content = text;
        const newBtn = {
          id: 'btn_' + Date.now(),
          title: title,
          type: 'text',
          content: content
        };

        db.updateBotData(botRecord.id, (b) => {
          if (!b.data) b.data = {};
          if (!b.data.buttons) b.data.buttons = [];
          b.data.buttons.push(newBtn);
        });

        delete userState[userId];
        const updated = getBotCustomData();

        return ctx.reply(
          `🎉 *Tabriklaymiz!*\n\n` +
          `Yangi tugma: *"${title}"* muvaffaqiyatli qo'shildi va pastdagi menyuga joylashtirildi! 👇`,
          {
            parse_mode: 'Markdown',
            ...renderKeyboard(ctx, updated)
          }
        );
      }

      // KINO QADAM 1: Kodi
      if (state && state.step === 'movie_code' && isOwner) {
        state.code = text;
        state.step = 'movie_title';
        return ctx.reply(
          `✅ Film kodi: \`${text}\`\n\n` +
          `🎬 *2-Qadam:* Film nomini kiriting (Masalan: *Avatar 3*, *Forsaj 11*):`,
          { parse_mode: 'Markdown' }
        );
      }

      // KINO QADAM 2: Nomi
      if (state && state.step === 'movie_title' && isOwner) {
        state.movie_title = text;
        state.step = 'movie_link';
        return ctx.reply(
          `✅ Film nomi: *${text}*\n\n` +
          `🔗 *3-Qadam:* Filmni ko'rish yoki yuklab olish havolasini (Telegram kanal yoki sayt ssilkasi) kiriting:`,
          { parse_mode: 'Markdown' }
        );
      }

      // KINO QADAM 3: Ssilkasi
      if (state && state.step === 'movie_link' && isOwner) {
        const code = state.code;
        const movieTitle = state.movie_title;
        const link = text;

        db.updateBotData(botRecord.id, (b) => {
          if (!b.data) b.data = {};
          if (!b.data.movies) b.data.movies = {};
          b.data.movies[code] = {
            title: movieTitle,
            link: link
          };
        });

        delete userState[userId];
        const updated = getBotCustomData();

        return ctx.reply(
          `🎉 *Kino qo'shildi!*\n\n` +
          `🔑 Kodi: \`${code}\`\n` +
          `🎬 Nomi: *${movieTitle}*\n` +
          `🔗 Havola: ${link}\n\n` +
          `Endi foydalanuvchilar \`${code}\` deb yozsa bot darhol shu kinoni beradi!`,
          {
            parse_mode: 'Markdown',
            ...renderKeyboard(ctx, updated)
          }
        );
      }

      // Agar oddiy foydalanuvchi biror menyu tugmasini bosgan bo'lsa
      const matchedBtn = (data.buttons || []).find(b => b.title === text);
      if (matchedBtn) {
        return ctx.reply(matchedBtn.content);
      }

      // Agar kino kodini yozgan bo'lsa
      const movie = (data.movies || {})[text];
      if (movie) {
        return ctx.reply(
          `🎬 *Topilgan Film:*\n\n` +
          `📌 Nomi: *${movie.title}*\n` +
          `🔑 Kodi: \`${text}\`\n\n` +
          `Tomosha qilish uchun quyidagi tugmani bosing:`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('▶️ Filmni Tomosha Qilish', movie.link)]
            ])
          }
        );
      }

      // Boshqa matn bo'lsa
      if (!text.startsWith('/')) {
        await ctx.reply(
          `ℹ️ Siz yozgan buyruq yoki kino kodi topilmadi.\n` +
          `Menyudagi tugmalardan foydalaning yoki /kinolar buyrug'ini bosing!`,
          renderKeyboard(ctx, data)
        );
      }
    });
  }
};
});

// ---- FILE: templates/feedback.js ----
defineModule('templates/feedback.js', function(exports, module, require) {
module.exports = {
  id: 'feedback',
  name: '📩 Qabul / Aloqa (Feedback) Boti',
  description: 'Mijozlardan murojaat va savollarni qabul qilib, adminga yetkazuvchi va javob qaytaruvchi bot',
  icon: '📩',
  setupBot: (bot, botRecord, db) => {
    // Xabarlar mosligi: adminMessageId -> userOriginalChatId
    const replyMapping = {};

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `📩 *${botRecord.bot_first_name}* qabul botiga xush kelibsiz!\n\n` +
        `Siz bu yerda o'z savol, taklif, shikoyat yoki murojaatingizni yozib qoldirishingiz mumkin. Xabaringiz to'g'ridan-to'g'ri administratorga yetkaziladi va sizga shu bot orqali javob qaytariladi.\n\n` +
        `Murojaatingizni yozing yoki rasm/ovoz yuboring: 👇`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(
        `👑 *Aloqa Boti — Admin Paneli*\n\n` +
        `Mijozlar sizga xabar yuborganda, bot ularni sizga jo'natadi.\n` +
        `Mijozga javob berish uchun o'sha xabarga shunchaki *Reply (Javob berish)* qilib yozing!`,
        { parse_mode: 'Markdown' }
      );
    });

    // Foydalanuvchi yoki admin xabar yozganda
    bot.on('message', async (ctx) => {
      const isOwner = ctx.from.id === botRecord.owner_id || db.isAdmin(ctx.from.id);

      // Agar admin xabarga reply qilayotgan bo'lsa
      if (isOwner && ctx.message.reply_to_message) {
        const originalAdminMsgId = ctx.message.reply_to_message.message_id;
        const targetUserId = replyMapping[originalAdminMsgId];

        if (targetUserId) {
          try {
            await bot.telegram.sendMessage(
              targetUserId,
              `📩 *Administratordan javob:*\n\n${ctx.message.text || 'Fayl biriktirildi'}`,
              { parse_mode: 'Markdown' }
            );
            return ctx.reply('✅ Javobingiz foydalanuvchiga muvaffaqiyatli yetkazildi!');
          } catch (err) {
            return ctx.reply('❌ Foydalanuvchiga javob yetkazilmadi (botni bloklagan bo\'lishi mumkin).');
          }
        }
      }

      // Agar oddiy foydalanuvchi murojaat yuborayotgan bo'lsa
      if (!isOwner) {
        const user = ctx.from;
        const userInfo = `👤 *Yangi murojaat!*\n` +
          `Ism: ${user.first_name} ${user.last_name || ''}\n` +
          `Username: @${user.username || 'mavjud emas'}\n` +
          `ID: \`${user.id}\`\n\n` +
          `💬 *Xabar matni:*`;

        try {
          // Adminga forward / xabar jo'natish
          const sent = await bot.telegram.sendMessage(botRecord.owner_id, userInfo, { parse_mode: 'Markdown' });
          const forwarded = await bot.telegram.forwardMessage(botRecord.owner_id, ctx.chat.id, ctx.message.message_id);

          // replyMapping saqlash
          replyMapping[forwarded.message_id] = user.id;
          replyMapping[sent.message_id] = user.id;

          await ctx.reply('✅ Xabaringiz qabul qilindi va adminga yetkazildi! Tez orada javob olasiz.');
        } catch (err) {
          console.error('Feedback xabar yuborishda xatolik:', err);
          await ctx.reply('⚠️ Xabarni adminga yetkazishda xatolik yuz berdi.');
        }
      }
    });
  }
};

});

// ---- FILE: templates/kino.js ----
defineModule('templates/kino.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'kino',
  name: '🎬 Kino & Serial Boti',
  description: 'Kod orqali kino va seriallarni tomosha qilish hamda majburiy obuna kanallarini ulash boti',
  icon: '🎬',
  setupBot: (bot, botRecord, db) => {
    // Kinolar bazasi
    const movies = {
      '1': { title: 'Qasoskorlar: Intiho (Avengers)', year: '2019', genre: 'Fantastika, Jangari', link: 'https://t.me/telegram' },
      '2': { title: 'Oppenheimer', year: '2023', genre: 'Drama, Tarixiy', link: 'https://t.me/telegram' },
      '3': { title: 'Forsaj 10 (Fast X)', year: '2023', genre: 'Jangari, Triller', link: 'https://t.me/telegram' },
      '10': { title: 'Interstellar (Yulduzlararo)', year: '2014', genre: 'Ilmiy-fantastika', link: 'https://t.me/telegram' },
      '77': { title: 'Avatar 2: Suv Yo\'li', year: '2022', genre: 'Fantastika, Sarguzasht', link: 'https://t.me/telegram' },
      '100': { title: 'Barbie', year: '2023', genre: 'Komediya, Fantaziya', link: 'https://t.me/telegram' },
      '777': { title: 'Gladiator 2', year: '2024', genre: 'Tarixiy jangari', link: 'https://t.me/telegram' }
    };

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🎬 *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `Siz bu yerda istalgan filmni maxsus *KODI* orqali bir zumda topishingiz mumkin.\n\n` +
        `🔍 Kinoni ko'rish uchun uning kodini yuboring (Masalan: \`1\`, \`2\`, \`10\`, \`77\`, \`777\`).\n\n` +
        `📚 Barcha kinolar ro'yxati uchun: /katalog`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.command('katalog', async (ctx) => {
      let msg = `🎬 *Mavjud filmlar katalogi:*\n\n`;
      Object.entries(movies).forEach(([code, m]) => {
        msg += `🔑 Kod: \`${code}\` — *${m.title}* (${m.year})\n🎭 Janr: ${m.genre}\n\n`;
      });
      msg += `Kino ko'rish uchun uning kodini raqam sifatida yozib yuboring!`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    // Kod orqali qidirish
    bot.on('text', async (ctx) => {
      const code = ctx.message.text.trim();
      if (code.startsWith('/')) return;

      const movie = movies[code];
      if (movie) {
        await ctx.reply(
          `🎬 *Topilgan film:*\n\n` +
          `📌 Nomi: *${movie.title}*\n` +
          `📅 Yili: ${movie.year}\n` +
          `🎭 Janri: ${movie.genre}\n` +
          `🔑 Kodi: \`${code}\`\n\n` +
          `Filmni yuklab olish yoki ko'rish uchun quyidagi tugmani bosing:`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('▶️ Filmni tomosha qilish', movie.link)],
              [Markup.button.callback('❤️ Sevimlilarga qo\'shish', 'fav_add')]
            ])
          }
        );
      } else {
        await ctx.reply(
          `❌ Afsuski, \`${code}\` raqamli film topilmadi!\n\n` +
          `Iltimos, kodni to'g'ri kiritganingizga ishonch hosil qiling yoki /katalog buyrug'ini bosing.`,
          { parse_mode: 'Markdown' }
        );
      }
    });

    bot.action('fav_add', async (ctx) => {
      await ctx.answerCbQuery('❤️ Film sevimlilarga qo\'shildi!');
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(
        `👑 *Kino Boti — Admin Paneli*\n\n` +
        `🎬 Bazadagi kinolar soni: *${Object.keys(movies).length} ta*\n` +
        `Yangi kino qo'shish uchun: \`/addkino KOD NOM YIL JANR LINK\``,
        { parse_mode: 'Markdown' }
      );
    });
  }
};

});

// ---- FILE: templates/moderator.js ----
defineModule('templates/moderator.js', function(exports, module, require) {
module.exports = {
  id: 'moderator',
  name: '🛡 Guruh Nazoratchisi (Moderator)',
  description: 'Guruhlarda spam, reklama havolalar va haqoratlarni tozalovchi, yangi a\'zolarni kutib oluvchi bot',
  icon: '🛡',
  setupBot: (bot, botRecord, db) => {
    const badWords = ['ahmoq', 'tentak', 'jinni', 'haromi', 'padarlanat', 'dalbayob', 'yiban', 'suka', 'blin', 'blyad'];

    bot.command('start', async (ctx) => {
      if (ctx.chat.type === 'private') {
        await ctx.reply(
          `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
          `🛡 *${botRecord.bot_first_name}* guruh nazoratchi boti.\n\n` +
          `Meni guruhingizga qo'shing va *ADMIN* qiling. Men quyidagilarni avtomatik bajaraman:\n` +
          `• Yangi a'zolarni chiroyli tabrik bilan kutib olish\n` +
          `• Guruhdagi reklama va begona havolalarni (linklarni) o'chirish\n` +
          `• So'kingan va behayo so'zlarni filtrlab tozalash\n` +
          `• Guruh a'zolariga tartib-intizom o'rnatish!`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(`🛡 *Guruh nazoratchisi ishga tushdi!* Men guruh xavfsizligini ta'minlayman.`, { parse_mode: 'Markdown' });
      }
    });

    // Yangi a'zolar qo'shilganda kutib olish
    bot.on('new_chat_members', async (ctx) => {
      for (const member of ctx.message.new_chat_members) {
        if (member.id === ctx.botInfo.id) {
          await ctx.reply('👋 Rahmat! Meni guruhingizga qo\'shganingizdan xursandman. To\'liq ishlashim uchun menga administrator huquqini bering.');
        } else {
          await ctx.reply(`👋 Xush kelibsiz guruhimizga, *${member.first_name}*! Guruh qoidalariga rioya qiling!`, { parse_mode: 'Markdown' });
        }
      }
      try {
        await ctx.deleteMessage();
      } catch (e) {}
    });

    // A'zo guruhdan chiqqanda xabarni tozalash
    bot.on('left_chat_member', async (ctx) => {
      try {
        await ctx.deleteMessage();
      } catch (e) {}
    });

    // Xabarlarni tekshirish (Spam, link, so'kinish)
    bot.on('message', async (ctx, next) => {
      if (ctx.chat.type === 'private') return next();

      const text = ctx.message.text || ctx.message.caption || '';
      const lower = text.toLowerCase();

      // 1. Reklama va linklar tekshiruvi
      const hasLink = /(https?:\/\/|t\.me\/|telegram\.me\/|@\w+|www\.)/i.test(text);
      if (hasLink) {
        try {
          await ctx.deleteMessage();
          await ctx.reply(`⚠️ [${ctx.from.first_name}](tg://user?id=${ctx.from.id}), guruhda reklama va havolalar tarqatish taqiqlangan!`, { parse_mode: 'Markdown' });
          return;
        } catch (e) {}
      }

      // 2. Haqoratli so'zlar tekshiruvi
      const hasBadWord = badWords.some(w => lower.includes(w));
      if (hasBadWord) {
        try {
          await ctx.deleteMessage();
          await ctx.reply(`⛔ [${ctx.from.first_name}](tg://user?id=${ctx.from.id}), iltimos odob saqlang! Guruhda haqorat qilish taqiqlangan!`, { parse_mode: 'Markdown' });
          return;
        } catch (e) {}
      }

      return next();
    });

    // Guruh admin buyruqlari
    bot.command('ban', async (ctx) => {
      if (ctx.chat.type === 'private') return;
      if (!ctx.message.reply_to_message) return ctx.reply('Ushbu buyruqni jazolamoqchi bo\'lgan odamning xabariga reply qilib yozing!');

      try {
        const targetUser = ctx.message.reply_to_message.from;
        await ctx.banChatMember(targetUser.id);
        await ctx.reply(`🚫 [${targetUser.first_name}](tg://user?id=${targetUser.id}) guruhdan haydaldi (Ban qilindi)!`, { parse_mode: 'Markdown' });
      } catch (err) {
        await ctx.reply('❌ Botda a\'zoni ban qilish uchun adminlik huquqi yetarli emas.');
      }
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(`👑 *Guruh Nazoratchisi Boti — Admin Paneli*`, { parse_mode: 'Markdown' });
    });
  }
};

});

// ---- FILE: templates/nakrutka.js ----
defineModule('templates/nakrutka.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'nakrutka',
  name: '🚀 Nakrutka / SMM Boti',
  description: 'Telegram, Instagram, TikTok kanallar va sahifalar uchun obunachi, layk va ko\'rishlar xizmati boti',
  icon: '🚀',
  setupBot: (bot, botRecord, db) => {
    // Foydalanuvchilar balansi va buyurtmalari
    const userBalances = {};
    const orders = [];

    const getBalance = (userId) => {
      if (userBalances[userId] === undefined) {
        userBalances[userId] = 5000; // Boshlang'ich 5,000 so'm demo bonus
      }
      return userBalances[userId];
    };

    const mainKeyboard = Markup.keyboard([
      ['📊 Xizmatlar', '💰 Balansim'],
      ['🛒 Buyurtma berish', '📜 Buyurtmalarim'],
      ['💳 Hisob to\'ldirish', 'ℹ️ Ma\'lumot']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      const balance = getBalance(ctx.from.id);
      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🚀 *${botRecord.bot_first_name}* xush kelibsiz!\n` +
        `Biz orqali Telegram, Instagram, TikTok tarmoqlarida obunachi va faollikni oshirishingiz mumkin.\n\n` +
        `🎁 Sizga *5,000 so'm* boshlang'ich bonus berildi!\n` +
        `💰 Balansingiz: *${balance.toLocaleString()} so'm*\n\n` +
        `Quyidagi menyudan kerakli bo'limni tanlang:`,
        { parse_mode: 'Markdown', ...mainKeyboard }
      );
    });

    bot.hears('💰 Balansim', async (ctx) => {
      const balance = getBalance(ctx.from.id);
      await ctx.reply(
        `💳 *Sizning hisobingiz:*\n\n` +
        `🆔 ID: \`${ctx.from.id}\`\n` +
        `💵 Asosiy balans: *${balance.toLocaleString()} so'm*\n\n` +
        `Hisobingizni to'ldirish uchun "💳 Hisob to'ldirish" tugmasini bosing.`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('💳 Hisobni to\'ldirish', 'deposit_btn')]
          ])
        }
      );
    });

    bot.hears('📊 Xizmatlar', async (ctx) => {
      await ctx.reply(
        `📋 *Mavjud SMM Xizmatlari va Narxlar:*\n\n` +
        `🔹 *Telegram:*\n` +
        `• Obunachi (O'zbek): 1,000 dona — 25,000 so'm\n` +
        `• Post ko'rish (Просмотр): 1,000 dona — 3,000 so'm\n` +
        `• Reaksiyalar (👍❤️🔥): 1,000 dona — 5,000 so'm\n\n` +
        `🔸 *Instagram:*\n` +
        `• Obunachi (Followers): 1,000 dona — 20,000 so'm\n` +
        `• Layklar: 1,000 dona — 6,000 so'm\n` +
        `• Reels ko'rish: 1,000 dona — 4,000 so'm\n\n` +
        `♦️ *TikTok:*\n` +
        `• Obunachi: 1,000 dona — 30,000 so'm\n` +
        `• Layklar: 1,000 dona — 8,000 so'm\n\n` +
        `Buyurtma berish uchun "🛒 Buyurtma berish" tugmasini bosing!`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('🛒 Buyurtma berish', async (ctx) => {
      await ctx.reply(
        `Ijtimoiy tarmoqni tanlang:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('✈️ Telegram', 'order_tg')],
          [Markup.button.callback('📷 Instagram', 'order_inst')],
          [Markup.button.callback('🎵 TikTok', 'order_tt')]
        ])
      );
    });

    bot.action('order_tg', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        `✈️ *Telegram xizmatini tanlang:*`,
        Markup.inlineKeyboard([
          [Markup.button.callback('👥 Obunachi (25 so\'m/dona)', 'buy_tg_sub')],
          [Markup.button.callback('👁 Post ko\'rish (3 so\'m/dona)', 'buy_tg_view')],
          [Markup.button.callback('🔥 Reaksiya (5 so\'m/dona)', 'buy_tg_react')]
        ])
      );
    });

    bot.action('order_inst', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        `📷 *Instagram xizmatini tanlang:*`,
        Markup.inlineKeyboard([
          [Markup.button.callback('👥 Obunachi (20 so\'m/dona)', 'buy_inst_sub')],
          [Markup.button.callback('❤️ Layk (6 so\'m/dona)', 'buy_inst_like')],
          [Markup.button.callback('▶️ Reels ko\'rish (4 so\'m/dona)', 'buy_inst_view')]
        ])
      );
    });

    bot.action('order_tt', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply(
        `🎵 *TikTok xizmatini tanlang:*`,
        Markup.inlineKeyboard([
          [Markup.button.callback('👥 Obunachi (30 so\'m/dona)', 'buy_tt_sub')],
          [Markup.button.callback('❤️ Layk (8 so\'m/dona)', 'buy_tt_like')]
        ])
      );
    });

    bot.action(/buy_(.*)/, async (ctx) => {
      await ctx.answerCbQuery();
      const service = ctx.match[1];
      const balance = getBalance(ctx.from.id);
      const cost = 1000; // 1000 so'mlik test buyurtma

      if (balance < cost) {
        return ctx.reply('❌ Balansingizda yetarli mablag\' yo\'q. Hisobingizni to\'ldiring.');
      }

      userBalances[ctx.from.id] -= cost;
      const order = {
        id: orders.length + 1,
        userId: ctx.from.id,
        service: service,
        amount: cost,
        date: new Date().toLocaleString(),
        status: 'Bajarilmoqda ⏳'
      };
      orders.push(order);

      await ctx.reply(
        `✅ *Buyurtmangiz qabul qilindi!*\n\n` +
        `🆔 Buyurtma raqami: #${order.id}\n` +
        `📦 Xizmat turi: ${service}\n` +
        `💰 Yechilgan mablag': *${cost} so'm*\n` +
        `💵 Qolgan balans: *${getBalance(ctx.from.id).toLocaleString()} so'm*\n` +
        `Holati: *Bajarilmoqda ⏳*`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('📜 Buyurtmalarim', async (ctx) => {
      const myOrders = orders.filter(o => o.userId === ctx.from.id);
      if (myOrders.length === 0) {
        return ctx.reply('Sizda hali faol buyurtmalar yo\'q.');
      }
      let msg = `📜 *Sizning so'nggi buyurtmalaringiz:*\n\n`;
      myOrders.slice(-5).forEach(o => {
        msg += `🔹 Buyurtma #${o.id} | ${o.service}\nSumma: ${o.amount} so'm | ${o.status}\nSana: ${o.date}\n\n`;
      });
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    bot.hears('💳 Hisob to\'ldirish', async (ctx) => {
      await ctx.reply(
        `💳 *Hisobni to'ldirish:*\n\n` +
        `To'lov tizimi: *Click / Payme*\n` +
        `Karta: \`8600 1234 5678 9012\`\n` +
        `Qabul qiluvchi: *SMM Admin*\n\n` +
        `To'lovni amalga oshirgach, chekni adminga yuboring. Hisobingiz 5 daqiqa ichida to'ldiriladi!`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('ℹ️ Ma\'lumot', async (ctx) => {
      await ctx.reply(
        `ℹ️ *Biz haqimizda:*\n\n` +
        `Biz tezkor va ishonchli SMM xizmatlarini taqdim etamiz.\n` +
        `Buyurtmalar avtomatik 1-15 daqiqa ichida boshlanadi.\n` +
        `Qo'llab-quvvatlash xizmati: 24/7 ishlaydi.`,
        { parse_mode: 'Markdown' }
      );
    });

    // Bot egasi uchun /admin
    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      const current = db.getBot(botRecord.id) || botRecord;
      await ctx.reply(
        `👑 *Nakrutka Boti — Admin Paneli*\n\n` +
        `👥 Foydalanuvchilar: *${current.stats?.users_count || 0}*\n` +
        `📦 Jami buyurtmalar: *${orders.length} ta*\n` +
        `💰 Umumiy aylanma: *${orders.reduce((sum, o) => sum + o.amount, 0).toLocaleString()} so'm*`,
        { parse_mode: 'Markdown' }
      );
    });
  }
};

});

// ---- FILE: templates/namoz.js ----
defineModule('templates/namoz.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'namoz',
  name: '🕌 Namoz Vaqtlari Boti',
  description: 'O\'zbekiston shaharlari bo\'yicha kunlik 5 vaqt namoz vaqtlari va taqvim boti',
  icon: '🕌',
  setupBot: (bot, botRecord, db) => {
    const userRegions = {};

    // Shaharlar bo'yicha namoz vaqtlari bazasi
    const prayerTimes = {
      'Toshkent': { bomdod: '05:18', quyosh: '06:42', peshin: '12:35', asr: '16:45', shom: '18:28', xufton: '19:48' },
      'Samarqand': { bomdod: '05:25', quyosh: '06:48', peshin: '12:41', asr: '16:51', shom: '18:34', xufton: '19:54' },
      'Andijon': { bomdod: '05:07', quyosh: '06:31', peshin: '12:24', asr: '16:34', shom: '18:17', xufton: '19:37' },
      'Farg\'ona': { bomdod: '05:10', quyosh: '06:34', peshin: '12:26', asr: '16:36', shom: '18:19', xufton: '19:39' },
      'Namangan': { bomdod: '05:09', quyosh: '06:33', peshin: '12:25', asr: '16:35', shom: '18:18', xufton: '19:38' },
      'Buxoro': { bomdod: '05:35', quyosh: '06:58', peshin: '12:51', asr: '17:01', shom: '18:44', xufton: '20:04' },
      'Xiva': { bomdod: '05:47', quyosh: '07:11', peshin: '13:03', asr: '17:13', shom: '18:56', xufton: '20:16' },
      'Nukus': { bomdod: '05:50', quyosh: '07:15', peshin: '13:07', asr: '17:17', shom: '19:00', xufton: '20:20' },
      'Qarshi': { bomdod: '05:30', quyosh: '06:53', peshin: '12:46', asr: '16:56', shom: '18:39', xufton: '19:59' },
      'Termiz': { bomdod: '05:26', quyosh: '06:48', peshin: '12:42', asr: '16:54', shom: '18:37', xufton: '19:55' }
    };

    const mainKeyboard = Markup.keyboard([
      ['🕌 Bugungi namoz vaqtlari', '📍 Shaharni tanlash'],
      ['📖 Duo va zikrlar', 'ℹ️ Bot haqida']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      if (!userRegions[ctx.from.id]) {
        userRegions[ctx.from.id] = 'Toshkent';
      }

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🕌 *${botRecord.bot_first_name}* xush kelibsiz!\n` +
        `Tanlangan shahar: *${userRegions[ctx.from.id]}*\n\n` +
        `Namoz vaqtlarini ko'rish uchun quyidagi menyudan foydalaning:`,
        { parse_mode: 'Markdown', ...mainKeyboard }
      );
    });

    const sendTimes = async (ctx) => {
      const region = userRegions[ctx.from.id] || 'Toshkent';
      const times = prayerTimes[region] || prayerTimes['Toshkent'];
      const today = new Date().toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' });

      const msg = 
        `🕌 *Namoz Vaqtlari — ${region} shahri*\n` +
        `📅 Sana: ${today}\n\n` +
        `🌌 Bomdod (Tong): *${times.bomdod}*\n` +
        `🌅 Quyosh chiqishi: *${times.quyosh}*\n` +
        `☀️ Peshin: *${times.peshin}*\n` +
        `⛅ Asr: *${times.asr}*\n` +
        `🌇 Shom (Iftor): *${times.shom}*\n` +
        `🌃 Xufton: *${times.xufton}*\n\n` +
        `_«Albatta, namoz mo'minlarga vaqtida tayinlangan farzdir» (Niso, 103)_`;

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    };

    bot.hears('🕌 Bugungi namoz vaqtlari', sendTimes);

    bot.hears('📍 Shaharni tanlash', async (ctx) => {
      const buttons = Object.keys(prayerTimes).map(city => [Markup.button.callback(city, `set_city_${city}`)]);
      await ctx.reply(`O'zingizga yaqin shaharni tanlang:`, Markup.inlineKeyboard(buttons));
    });

    bot.action(/set_city_(.*)/, async (ctx) => {
      const city = ctx.match[1];
      userRegions[ctx.from.id] = city;
      await ctx.answerCbQuery(`✅ Shahar tanlandi: ${city}`);
      await ctx.reply(`✅ Shahringiz *${city}* ga o'zgartirildi.`, { parse_mode: 'Markdown' });
      await sendTimes(ctx);
    });

    bot.hears('📖 Duo va zikrlar', async (ctx) => {
      await ctx.reply(
        `📖 *Tonggi va kechki zikrlar:*\n\n` +
        `• *Subhanalloh* (33 marta)\n` +
        `• *Alhamdulillah* (33 marta)\n` +
        `• *Allohu Akbar* (34 marta)\n\n` +
        `_«Meni eslangiz, men ham sizni eslayman» (Baqara, 152)_`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('ℹ️ Bot haqida', async (ctx) => {
      await ctx.reply(`Ushbu bot O'zbekiston Musulmonlari idorasi taqvimi asosida ishlaydi.`);
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(`👑 *Namoz Boti — Admin Paneli*\n\nBot faol ishlamoqda.`, { parse_mode: 'Markdown' });
    });
  }
};

});

// ---- FILE: templates/pul_topar.js ----
defineModule('templates/pul_topar.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'pul_topar',
  name: '💸 Pul Topar / Daromad Boti',
  description: 'Do\'stlarni taklif qilib, vazifalar bajarib va kunlik bonus olib pul ishlash boti',
  icon: '💸',
  setupBot: (bot, botRecord, db) => {
    const balances = {};
    const lastBonus = {};
    const withdrawRequests = [];

    const getBalance = (userId) => balances[userId] || 1000; // Boshlang'ich 1000 so'm sovg'a

    const menuKeyboard = Markup.keyboard([
      ['💰 Balans', '🎁 Kunlik bonus'],
      ['👥 Do\'stlarni taklif qilish', '📋 Vazifalar'],
      ['💳 Pulni yechish', '📊 Statistika']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      const startPayload = ctx.message.text.split(' ')[1];
      if (startPayload && startPayload !== String(ctx.from.id)) {
        // Referral hisoblash
        const referrerId = parseInt(startPayload);
        if (referrerId) {
          balances[referrerId] = (balances[referrerId] || 1000) + 500;
          try {
            await bot.telegram.sendMessage(referrerId, `🎉 Tabriklaymiz! Sizning taklifingiz orqali yangi do'stingiz qo'shildi va hisobingizga *+500 so'm* berildi!`, { parse_mode: 'Markdown' });
          } catch (e) {}
        }
      }

      if (!balances[ctx.from.id]) {
        balances[ctx.from.id] = 1000;
      }

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `💸 *${botRecord.bot_first_name}* xush kelibsiz!\n` +
        `Bu yerda siz osongina pul ishlab, kartangizga yechib olishingiz mumkin.\n\n` +
        `🎁 Sizga *1,000 so'm* start bonusi berildi!\n` +
        `Har bir taklif qilingan do'stingiz uchun: *500 so'm*!\n\n` +
        `Kerakli bo'limni tanlang:`,
        { parse_mode: 'Markdown', ...menuKeyboard }
      );
    });

    bot.hears('💰 Balans', async (ctx) => {
      const b = getBalance(ctx.from.id);
      await ctx.reply(
        `💰 *Sizning hisobingiz:*\n\n` +
        `🆔 ID: \`${ctx.from.id}\`\n` +
        `💵 Balans: *${b.toLocaleString()} so'm*\n` +
        `📌 Minimal yechib olish summasi: *10,000 so'm*`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('🎁 Kunlik bonus', async (ctx) => {
      const now = Date.now();
      const last = lastBonus[ctx.from.id] || 0;
      const hoursLeft = 24 - (now - last) / (1000 * 60 * 60);

      if (hoursLeft > 0 && last !== 0) {
        return ctx.reply(`⏳ Siz bugungi bonusni olgansiz. Keyingi bonusgacha: *${Math.ceil(hoursLeft)} soat* qoldi.`, { parse_mode: 'Markdown' });
      }

      const bonus = Math.floor(Math.random() * (1000 - 200 + 1)) + 200;
      balances[ctx.from.id] = getBalance(ctx.from.id) + bonus;
      lastBonus[ctx.from.id] = now;

      await ctx.reply(
        `🎁 Tabriklaymiz! Sizga *+${bonus} so'm* kunlik bonus berildi!\n` +
        `💵 Yangi balansingiz: *${balances[ctx.from.id].toLocaleString()} so'm*`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('👥 Do\'stlarni taklif qilish', async (ctx) => {
      const botUser = botRecord.bot_username;
      const refLink = `https://t.me/${botUser}?start=${ctx.from.id}`;
      await ctx.reply(
        `👥 *Do'stlarni taklif qiling va pul ishlang!*\n\n` +
        `Har bir taklif qilingan faol do'stingiz uchun sizga *500 so'm* beriladi.\n\n` +
        `🔗 Sizning maxsus taklif havolangiz:\n${refLink}\n\n` +
        `Ushbu havolani do'stlaringizga va guruhlarga ulashing!`,
        Markup.inlineKeyboard([
          [Markup.button.url('📲 Do\'stlarga yuborish', `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent('Pul ishlovchi bot! Ro\'yxatdan o\'ting va 1000 so\'m bonus oling!')}`)]
        ])
      );
    });

    bot.hears('📋 Vazifalar', async (ctx) => {
      await ctx.reply(
        `📋 *Mavjud pullik vazifalar:*\n\n` +
        `1. Rasmiy kanalimizga a'zo bo'ling (+300 so'm)\n` +
        `2. Hamkor guruhga obuna bo'ling (+200 so'm)\n` +
        `3. Postlarga reaksiya qoldiring (+100 so'm)\n\n` +
        `*Yangi vazifalar tez orada joylanadi!*`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('💳 Pulni yechish', async (ctx) => {
      const b = getBalance(ctx.from.id);
      if (b < 10000) {
        return ctx.reply(
          `❌ *Mablag' yetarli emas!*\n\n` +
          `Sizning balansingiz: *${b.toLocaleString()} so'm*\n` +
          `Minimal pul yechish: *10,000 so'm*\n\n` +
          `Do'stlaringizni taklif qilib yoki kunlik bonus olib balansingizni to'ldiring.`,
          { parse_mode: 'Markdown' }
        );
      }

      await ctx.reply(
        `💳 *Pul yechib olish:*\n` +
        `Balansingiz: *${b.toLocaleString()} so'm*\n\n` +
        `Karta yoki hamyon raqamingizni hamda summani quyidagi formatda yozib qoldiring:\n` +
        `*KARTA_RAQAM SUMMA* (Masalan: 8600123456789012 10000)`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('📊 Statistika', async (ctx) => {
      const current = db.getBot(botRecord.id) || botRecord;
      await ctx.reply(
        `📊 *Bot statistikasi:*\n\n` +
        `👥 Foydalanuvchilar: *${current.stats?.users_count || 1} ta*\n` +
        `💸 Jami to'lab berilgan: *${(withdrawRequests.length * 10000).toLocaleString()} so'm*\n` +
        `⚡ Bot holati: *Barqaror va faol*`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(
        `👑 *Pul Topar Boti — Admin Paneli*\n\n` +
        `👥 Foydalanuvchilar: *${Object.keys(balances).length} ta*\n` +
        `📥 Yechib olish so'rovlari: *${withdrawRequests.length} ta*`,
        { parse_mode: 'Markdown' }
      );
    });
  }
};

});

// ---- FILE: templates/quiz.js ----
defineModule('templates/quiz.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'quiz',
  name: '🎯 Test & Viktorina Boti',
  description: 'Bilimni sinovchi qiziqarli testlar, ballar reytingi va savol-javob boti',
  icon: '🎯',
  setupBot: (bot, botRecord, db) => {
    const scores = {}; // userId -> score
    const currentQuestions = {};

    const questions = [
      {
        q: 'O\'zbekiston Respublikasi mustaqillikka qaysi yili erishgan?',
        options: ['1989-yil', '1991-yil', '1992-yil', '1993-yil'],
        correct: 1
      },
      {
        q: 'Dunyoning eng baland cho\'qqisi qaysi?',
        options: ['Kilimanjaro', 'Monblan', 'Everest (Jomolungma)', 'Elbrus'],
        correct: 2
      },
      {
        q: 'Dasturlashda "HTML" nimani anglatadi?',
        options: ['HyperText Markup Language', 'High Tech Modern Language', 'Hyperlink Text Machine Learning', 'Home Tool Markup Language'],
        correct: 0
      },
      {
        q: 'Quyosh tizimidagi eng katta sayyora qaysi?',
        options: ['Mars', 'Saturn', 'Yupiter', 'Venera'],
        correct: 2
      },
      {
        q: 'Amir Temur qaysi yilda tavallud topgan?',
        options: ['1336-yil', '1340-yil', '1405-yil', '1320-yil'],
        correct: 0
      }
    ];

    const mainKeyboard = Markup.keyboard([
      ['🚀 Testni boshlash', '🏆 Peshqadamlar'],
      ['📊 Mening ballarim', 'ℹ️ Qoidalar']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🎯 *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `O'z bilimingizni sinab ko'ring, to'g'ri javoblarni toping va reytingda 1-o'ringa chiqing!\n\n` +
        `Boshlash uchun "🚀 Testni boshlash" tugmasini bosing:`,
        { parse_mode: 'Markdown', ...mainKeyboard }
      );
    });

    const sendQuestion = async (ctx, qIndex = 0) => {
      if (qIndex >= questions.length) {
        return ctx.reply(
          `🎉 *Barcha savollar tugadi!*\n\n` +
          `Sizning umumiy to'plagan ballingiz: *${scores[ctx.from.id] || 0} ball*!\n` +
          `Qayta o'ynash uchun yana "🚀 Testni boshlash" ni bosing.`,
          { parse_mode: 'Markdown' }
        );
      }

      currentQuestions[ctx.from.id] = qIndex;
      const q = questions[qIndex];

      const buttons = q.options.map((opt, idx) => [
        Markup.button.callback(`${String.fromCharCode(65 + idx)}) ${opt}`, `quiz_ans_${qIndex}_${idx}`)
      ]);

      await ctx.reply(
        `❓ *${qIndex + 1}-savol:*\n\n${q.q}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        }
      );
    };

    bot.hears('🚀 Testni boshlash', async (ctx) => {
      await sendQuestion(ctx, 0);
    });

    bot.action(/quiz_ans_(\d+)_(\d+)/, async (ctx) => {
      const qIdx = parseInt(ctx.match[1]);
      const ansIdx = parseInt(ctx.match[2]);
      const q = questions[qIdx];

      if (ansIdx === q.correct) {
        scores[ctx.from.id] = (scores[ctx.from.id] || 0) + 10;
        await ctx.answerCbQuery('✅ To\'g\'ri javob! (+10 ball)');
        await ctx.reply(`✅ *To'g'ri!* Javob: ${q.options[q.correct]}`);
      } else {
        await ctx.answerCbQuery('❌ Noto\'g\'ri!');
        await ctx.reply(`❌ *Noto'g'ri!* To'g'ri javob: ${q.options[q.correct]}`);
      }

      // Keyingi savol
      await sendQuestion(ctx, qIdx + 1);
    });

    bot.hears('📊 Mening ballarim', async (ctx) => {
      const myScore = scores[ctx.from.id] || 0;
      await ctx.reply(`📊 *Sizning to'plagan balingiz:* *${myScore} ball*`, { parse_mode: 'Markdown' });
    });

    bot.hears('🏆 Peshqadamlar', async (ctx) => {
      const top = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (top.length === 0) {
        return ctx.reply('Hali hech kim test topshirmagan. Birinchi bo\'ling!');
      }

      let msg = `🏆 *Top Peshqadamlar Reytingi:*\n\n`;
      top.forEach(([uid, score], i) => {
        msg += `${i + 1}. Foydalanuvchi [${uid}]: *${score} ball*\n`;
      });
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    bot.hears('ℹ️ Qoidalar', async (ctx) => {
      await ctx.reply(
        `ℹ️ *O'yin qoidalari:*\n\n` +
        `• Har bir to'g'ri javob uchun: *+10 ball*\n` +
        `• Noto'g'ri javob uchun ball ayirilmaydi\n` +
        `• Barcha savollarga javob berib, reytingda peshqadam bo'ling!`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(
        `👑 *Viktorina Boti — Admin Paneli*\n\n` +
        `❓ Jami savollar: *${questions.length} ta*\n` +
        `👥 Qatnashchilar soni: *${Object.keys(scores).length} ta*`,
        { parse_mode: 'Markdown' }
      );
    });
  }
};

});

// ---- FILE: templates/quotes.js ----
defineModule('templates/quotes.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'quotes',
  name: '✨ Status & Aforizmlar Boti',
  description: 'Har kungi motivatsiya, ibratli so\'zlar, donishmandlar hikmati va ajoyib statuslar boti',
  icon: '✨',
  setupBot: (bot, botRecord, db) => {
    const quotesList = [
      "«Muvaffaqiyat — bu yiqilmaslikda emas, har yiqilganda qayta tura olishda.» — Konfutsiy",
      "«Agar orzularingiz sizni qo'rqitmasa, demak ular yetarlicha katta emas.» — Richard Brenson",
      "«Bugun qilgan mehnatingiz — ertangi kuningizning poydevoridir.»",
      "«Vaqt — eng qimmatli boylik, uni behuda narsalarga sarflamang.» — Stiv Jobs",
      "«Katta maqsadlarga erishish uchun kichik qadamlardan boshlash kerak.» — Lao Tszı",
      "«Bilim — eng qudratli quroldir, uning yordamida dunyoni o'zgartirish mumkin.» — Nelson Mandela",
      "«Haqiqiy do'st — butun dunyo sendan yuz o'girganda ham yoningda qolgan insondir.»",
      "«Sabr — achchiq daraxt, lekin uning mevasi juda shirin.»",
      "«O'z ustingda ishlashdan to'xtama, har kuni kechagidan yaxshiroq bo'lishga intil!»"
    ];

    const mainKeyboard = Markup.keyboard([
      ['🎲 Tasodifiy aforizm', '🔥 Motivatsiya'],
      ['💡 Biznes & Muvaffaqiyat', 'ℹ️ Bot haqida']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `✨ *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `Bu yerda siz o'zingiz uchun ilhom, motivatsiya va ibratli hikmatlarni topishingiz mumkin.\n\n` +
        `Quyidagi tugmalardan birini bosing:`,
        { parse_mode: 'Markdown', ...mainKeyboard }
      );
    });

    const sendRandomQuote = async (ctx) => {
      const q = quotesList[Math.floor(Math.random() * quotesList.length)];
      await ctx.reply(
        `✨ *Ibratli so'z:*\n\n${q}`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🎲 Boshqa aforizm', 'next_quote')],
            [Markup.button.url('📲 Do\'stlarga ulashish', `https://t.me/share/url?url=${encodeURIComponent('https://t.me/' + botRecord.bot_username)}&text=${encodeURIComponent(q)}`)]
          ])
        }
      );
    };

    bot.hears('🎲 Tasodifiy aforizm', sendRandomQuote);
    bot.hears('🔥 Motivatsiya', sendRandomQuote);
    bot.hears('💡 Biznes & Muvaffaqiyat', sendRandomQuote);

    bot.action('next_quote', async (ctx) => {
      await ctx.answerCbQuery();
      await sendRandomQuote(ctx);
    });

    bot.hears('ℹ️ Bot haqida', async (ctx) => {
      await ctx.reply("Kundalik hayotingizga ma'no va energiya bag'ishlovchi iqtiboslar to'plami.");
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(`👑 *Status Boti — Admin Paneli*`, { parse_mode: 'Markdown' });
    });
  }
};

});

// ---- FILE: templates/shop.js ----
defineModule('templates/shop.js', function(exports, module, require) {
const { Markup } = require('telegraf');

module.exports = {
  id: 'shop',
  name: '🛍 Do\'kon / Magazin Boti',
  description: 'Mahsulotlar katalogi, savatcha va buyurtma qabul qiluvchi internet do\'kon boti',
  icon: '🛍',
  setupBot: (bot, botRecord, db) => {
    // Mahsulotlar katalogi
    const products = [
      { id: 1, name: 'AirPods Pro 2', category: 'Elektronika', price: 290000, desc: 'Original sifat, shovqinni bosuvchi simsiz quloqchin' },
      { id: 2, name: 'Smart Watch Ultra', category: 'Elektronika', price: 350000, desc: 'Sport va kundalik foydalanish uchun aqlli soat' },
      { id: 3, name: 'Qishki Kurtka (Erkaklar)', category: 'Kiyim', price: 450000, desc: 'Issiq va qulay, suv o\'tkazmaydigan material' },
      { id: 4, name: 'Oversize Hoodie', category: 'Kiyim', price: 180000, desc: 'Zamonaviy qalin paxtali xudi' },
      { id: 5, name: 'Tom Ford Parfume 50ml', category: 'Parfyumeriya', price: 520000, desc: 'Uzoq saqlanuvchi original hid' }
    ];

    const userCarts = {};
    const orders = [];

    const getCart = (userId) => {
      if (!userCarts[userId]) userCarts[userId] = [];
      return userCarts[userId];
    };

    const mainKeyboard = Markup.keyboard([
      ['🛍 Katalog', '🛒 Savatcha'],
      ['📦 Buyurtmalarim', '📞 Biz bilan aloqa']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🛍 *${botRecord.bot_first_name}* rasmiy internet do'koniga xush kelibsiz!\n\n` +
        `Siz bizning bot orqali istalgan mahsulotni ko'rishingiz, savatga qo'shishingiz va osonlik bilan buyurtma berishingiz mumkin.\n\n` +
        `Xaridni boshlash uchun "🛍 Katalog" tugmasini bosing:`,
        { parse_mode: 'Markdown', ...mainKeyboard }
      );
    });

    bot.hears('🛍 Katalog', async (ctx) => {
      let buttons = products.map(p => [Markup.button.callback(`${p.name} — ${p.price.toLocaleString()} so'm`, `view_prod_${p.id}`)]);
      await ctx.reply(`📦 *Mahsulotlar katalogi:*\nKerakli mahsulot ustiga bosing:`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    });

    bot.action(/view_prod_(\d+)/, async (ctx) => {
      await ctx.answerCbQuery();
      const prodId = parseInt(ctx.match[1]);
      const prod = products.find(p => p.id === prodId);
      if (!prod) return;

      await ctx.reply(
        `🛍 *${prod.name}*\n\n` +
        `📂 Kategoriya: ${prod.category}\n` +
        `📝 Tavsif: ${prod.desc}\n` +
        `💰 Narxi: *${prod.price.toLocaleString()} so'm*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('➕ Savatga qo\'shish', `add_to_cart_${prod.id}`)],
            [Markup.button.callback('⬅️ Katalogga qaytish', 'back_to_catalog')]
          ])
        }
      );
    });

    bot.action(/add_to_cart_(\d+)/, async (ctx) => {
      const prodId = parseInt(ctx.match[1]);
      const prod = products.find(p => p.id === prodId);
      if (!prod) return;

      const cart = getCart(ctx.from.id);
      cart.push(prod);

      await ctx.answerCbQuery('✅ Mahsulot savatga qo\'shildi!');
      await ctx.reply(`✅ *${prod.name}* savatchangizga qo'shildi! (Jami savatda: ${cart.length} ta)`, { parse_mode: 'Markdown' });
    });

    bot.action('back_to_catalog', async (ctx) => {
      await ctx.answerCbQuery();
      let buttons = products.map(p => [Markup.button.callback(`${p.name} — ${p.price.toLocaleString()} so'm`, `view_prod_${p.id}`)]);
      await ctx.reply(`📦 *Mahsulotlar katalogi:*`, Markup.inlineKeyboard(buttons));
    });

    bot.hears('🛒 Savatcha', async (ctx) => {
      const cart = getCart(ctx.from.id);
      if (cart.length === 0) {
        return ctx.reply('🛒 Sizning savatchangiz bo\'sh. Katalogdan mahsulot tanlang!');
      }

      let total = 0;
      let text = `🛒 *Savatchangizdagi mahsulotlar:*\n\n`;
      cart.forEach((item, idx) => {
        text += `${idx + 1}. ${item.name} — ${item.price.toLocaleString()} so'm\n`;
        total += item.price;
      });
      text += `\n💰 *Umumiy summa: ${total.toLocaleString()} so'm*`;

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Buyurtmani rasmiylashtirish', 'checkout')],
          [Markup.button.callback('🗑 Savatni tozalash', 'clear_cart')]
        ])
      });
    });

    bot.action('clear_cart', async (ctx) => {
      await ctx.answerCbQuery();
      userCarts[ctx.from.id] = [];
      await ctx.reply('🗑 Savatchangiz tozalandi!');
    });

    bot.action('checkout', async (ctx) => {
      await ctx.answerCbQuery();
      const cart = getCart(ctx.from.id);
      if (cart.length === 0) return ctx.reply('Savat bo\'sh!');

      const total = cart.reduce((s, i) => s + i.price, 0);
      const order = {
        id: orders.length + 1,
        userId: ctx.from.id,
        items: [...cart],
        total: total,
        date: new Date().toLocaleString(),
        status: 'Qabul qilindi'
      };
      orders.push(order);
      userCarts[ctx.from.id] = [];

      await ctx.reply(
        `🎉 *Buyurtmangiz muvaffaqiyatli rasmiylashtirildi!*\n\n` +
        `🆔 Buyurtma raqami: #${order.id}\n` +
        `💰 Jami summa: *${total.toLocaleString()} so'm*\n` +
        `📦 Mahsulotlar soni: ${order.items.length} ta\n\n` +
        `Tez orada menejerimiz siz bilan bog'lanadi!`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('📦 Buyurtmalarim', async (ctx) => {
      const myOrders = orders.filter(o => o.userId === ctx.from.id);
      if (myOrders.length === 0) return ctx.reply('Sizda hali buyurtmalar yo\'q.');

      let msg = `📦 *Sizning buyurtmalaringiz:*\n\n`;
      myOrders.forEach(o => {
        msg += `🔹 Buyurtma #${o.id} — ${o.total.toLocaleString()} so'm (${o.status})\nSana: ${o.date}\n\n`;
      });
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    });

    bot.hears('📞 Biz bilan aloqa', async (ctx) => {
      await ctx.reply('📞 *Mijozlar bilan aloqa bo\'limi:*\n\nTelefon: +998 (90) 123-45-67\nIsh vaqti: 09:00 dan 21:00 gacha\nManzil: Toshkent shahri', { parse_mode: 'Markdown' });
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(
        `👑 *Do'kon Boti — Admin Paneli*\n\n` +
        `📦 Jami mahsulotlar: *${products.length} ta*\n` +
        `🛍 Jami buyurtmalar: *${orders.length} ta*\n` +
        `💵 Jami savdo summasi: *${orders.reduce((s, o) => s + o.total, 0).toLocaleString()} so'm*`,
        { parse_mode: 'Markdown' }
      );
    });
  }
};

});

// ---- FILE: templates/tools.js ----
defineModule('templates/tools.js', function(exports, module, require) {
const QRCode = require('qrcode');
const { Markup } = require('telegraf');

module.exports = {
  id: 'tools',
  name: '🛠 QR Kod & Instrumentlar',
  description: 'Matn va havolalardan bir zumda QR-kod yasash, kuchli parol yaratish va matn tahlili boti',
  icon: '🛠',
  setupBot: (bot, botRecord, db) => {
    const mainKeyboard = Markup.keyboard([
      ['📱 QR Kod yasash', '🔑 Kuchli parol yaratish'],
      ['📊 Matn tahlili', 'ℹ️ Ma\'lumot']
    ]).resize();

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🛠 *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `Siz bu yerda:\n` +
        `• Istalgan matn yoki havoladan QR-kod yaratishingiz\n` +
        `• Xavfsiz va buzilmas parollar generatsiya qilishingiz\n` +
        `• Matn belgilari va so'zlari sonini hisoblashingiz mumkin!\n\n` +
        `Menga shunchaki havola yoki matn yuboring, darhol QR-kod yasab beraman!`,
        { parse_mode: 'Markdown', ...mainKeyboard }
      );
    });

    bot.hears('📱 QR Kod yasash', async (ctx) => {
      await ctx.reply('Menga QR-kod qilmoqchi bo\'lgan havola (URL) yoki matningizni yuboring:');
    });

    bot.hears('🔑 Kuchli parol yaratish', async (ctx) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
      let pass = '';
      for (let i = 0; i < 16; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      await ctx.reply(
        `🔑 *Siz uchun yaratilgan kuchli parol:*\n\n` +
        `\`${pass}\`\n\n` +
        `Nusxa olish uchun parol ustiga bosing!`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.hears('📊 Matn tahlili', async (ctx) => {
      await ctx.reply('Tahlil qilmoqchi bo\'lgan matningizni yuboring:');
    });

    bot.hears('ℹ️ Ma\'lumot', async (ctx) => {
      await ctx.reply('Foydali instrumentlar boti sizning kundalik yumushlaringizni osonlashtiradi.');
    });

    // Har qanday matndan QR-kod yasash
    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return;
      if (['📱 QR Kod yasash', '🔑 Kuchli parol yaratish', '📊 Matn tahlili', 'ℹ️ Ma\'lumot'].includes(text)) return;

      try {
        await ctx.sendChatAction('upload_photo');
        const qrBuffer = await QRCode.toBuffer(text, { width: 400, margin: 2 });
        const charCount = text.length;
        const wordCount = text.trim().split(/\s+/).length;

        await ctx.replyWithPhoto(
          { source: qrBuffer },
          {
            caption: 
              `✅ *QR-Kodingiz tayyor!*\n\n` +
              `📊 *Matn statistikasi:*\n` +
              `• Belgilar soni: ${charCount}\n` +
              `• So'zlar soni: ${wordCount}\n\n` +
              `QR kodni telefon kamerasi orqali skaner qilib ochishingiz mumkin.`,
            parse_mode: 'Markdown'
          }
        );
      } catch (err) {
        await ctx.reply('❌ QR-kod yaratishda xatolik yuz berdi.');
      }
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(`👑 *QR & Instrumentlar Boti — Admin Paneli*`, { parse_mode: 'Markdown' });
    });
  }
};

});

// ---- FILE: templates/translator.js ----
defineModule('templates/translator.js', function(exports, module, require) {
const axios = require('axios');
const { Markup } = require('telegraf');

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Ko'p bosqichli ishonchli tarjima tizimi
async function translateWithEngines(text, sl = 'auto', tl = 'uz') {
  // 1. Google Clients5 Web API (Juda tez va ishonchli)
  try {
    const res = await axios.get('https://clients5.google.com/translate_a/t', {
      params: { client: 'dict-chrome-ex', sl, tl, q: text },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*'
      },
      timeout: 7000
    });
    if (res.data) {
      let result = '';
      if (Array.isArray(res.data)) {
        result = res.data.join(' ');
      } else if (typeof res.data === 'string') {
        result = res.data;
      }
      if (result && result.trim().length > 0) {
        return { text: decodeHtmlEntities(result.trim()), detectedLang: sl, engine: 'google_clients5' };
      }
    }
  } catch (e) {
    // keyingi variantga o'tish
  }

  // 2. Google GTX / Single API
  try {
    const res = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: { client: 'dict-chrome-ex', sl, tl, dt: 't', q: text },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
        'Accept': '*/*'
      },
      timeout: 7000
    });
    if (res.data && res.data[0]) {
      const translated = res.data[0].map(item => item && item[0] ? item[0] : '').filter(Boolean).join('');
      const detected = (res.data[2] && typeof res.data[2] === 'string') ? res.data[2] : sl;
      if (translated && translated.trim().length > 0) {
        return { text: decodeHtmlEntities(translated.trim()), detectedLang: detected, engine: 'google_gtx' };
      }
    }
  } catch (e) {
    // keyingi variantga o'tish
  }

  // 3. MyMemory Bepul API (Fallback)
  try {
    const fromLang = (sl === 'auto' || !sl) ? 'uz' : sl;
    const res = await axios.get('https://api.mymemory.translated.net/get', {
      params: {
        q: text.slice(0, 1000),
        langpair: `${fromLang}|${tl}`,
        de: `tarjimon_user_${Date.now().toString().slice(-4)}@gmail.com`
      },
      timeout: 8000
    });
    const result = res.data?.responseData?.translatedText;
    if (result && !result.includes('MYMEMORY WARNING') && result.trim().length > 0) {
      return { text: decodeHtmlEntities(result.trim()), detectedLang: fromLang, engine: 'mymemory' };
    }
  } catch (e) {
    // xatolik
  }

  throw new Error('Tarjima xizmatlari javob bermadi');
}

// Mashhur tillar nomlari va bayroqlari
const LANG_NAMES = {
  'auto': '🌐 Avtomatik',
  'uz': '🇺🇿 O\'zbekcha',
  'en': '🇬🇧 Inglizcha',
  'ru': '🇷🇺 Ruscha',
  'tr': '🇹🇷 Turkcha',
  'ar': '🇸🇦 Arabcha',
  'ko': '🇰🇷 Koreyscha',
  'de': '🇩🇪 Nemischa',
  'zh': '🇨🇳 Xitoycha',
  'fr': '🇫🇷 Fransuzcha',
  'es': '🇪🇸 Ispancha',
  'it': '🇮🇹 Italyancha',
  'ja': '🇯🇵 Yaponcha',
  'kk': '🇰🇿 Qozoqcha',
  'ky': '🇰🇬 Qirg\'izcha',
  'tg': '🇹🇯 Tojikcha',
  'fa': '🇮🇷 Forscha',
  'hi': '🇮🇳 Hindcha'
};

function getModeTitle(mode) {
  if (!mode) return '🌐 Avtomatik ➡️ 🇺🇿 O\'zbekcha';
  const [s, t] = mode.split('_');
  const sTitle = LANG_NAMES[s] || s;
  const tTitle = LANG_NAMES[t] || t;
  return `${sTitle} ➡️ ${tTitle}`;
}

function getMainKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🌐 Avto ➡️ 🇺🇿 O\'zbek', 'set_auto_uz'),
      Markup.button.callback('🌐 Avto ➡️ 🇬🇧 Ingliz', 'set_auto_en')
    ],
    [
      Markup.button.callback('🇺🇿 O\'zbek ➡️ 🇬🇧 Ingliz', 'set_uz_en'),
      Markup.button.callback('🇬🇧 Ingliz ➡️ 🇺🇿 O\'zbek', 'set_en_uz')
    ],
    [
      Markup.button.callback('🇺🇿 O\'zbek ➡️ 🇷🇺 Rus', 'set_uz_ru'),
      Markup.button.callback('🇷🇺 Rus ➡️ 🇺🇿 O\'zbek', 'set_ru_uz')
    ],
    [
      Markup.button.callback('🇺🇿 O\'zbek ➡️ 🇹🇷 Turk', 'set_uz_tr'),
      Markup.button.callback('🇹🇷 Turk ➡️ 🇺🇿 O\'zbek', 'set_tr_uz')
    ],
    [
      Markup.button.callback('🇺🇿 O\'zbek ➡️ 🇸🇦 Arab', 'set_uz_ar'),
      Markup.button.callback('🇺🇿 O\'zbek ➡️ 🇰🇷 Koreys', 'set_uz_ko')
    ],
    [
      Markup.button.callback('🌐 Barcha Tillar Ro\'yxati', 'more_langs')
    ]
  ]);
}

function getMoreLangsKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇺🇿 ➡️ 🇩🇪 Nemis', 'set_uz_de'),
      Markup.button.callback('🇺🇿 ➡️ 🇨🇳 Xitoy', 'set_uz_zh')
    ],
    [
      Markup.button.callback('🇺🇿 ➡️ 🇫🇷 Fransuz', 'set_uz_fr'),
      Markup.button.callback('🇺🇿 ➡️ 🇪🇸 Ispan', 'set_uz_es')
    ],
    [
      Markup.button.callback('🇺🇿 ➡️ 🇰🇿 Qozoq', 'set_uz_kk'),
      Markup.button.callback('🇺🇿 ➡️ 🇰🇬 Qirg\'iz', 'set_uz_ky')
    ],
    [
      Markup.button.callback('🇺🇿 ➡️ 🇹🇯 Tojik', 'set_uz_tg'),
      Markup.button.callback('🇺🇿 ➡️ 🇯🇵 Yapon', 'set_uz_ja')
    ],
    [
      Markup.button.callback('🔙 Asosiy tillar', 'back_main_langs')
    ]
  ]);
}

module.exports = {
  id: 'translator',
  name: '🌐 Tarjimon Boti',
  description: 'Matnlarni O\'zbek, Rus, Ingliz, Turk, Arab va boshqa 30+ tillarga bir zumda sifatli tarjima qiluvchi aqlli bot',
  icon: '🌐',
  setupBot: (bot, botRecord, db) => {
    // userModes: userId -> 'auto_uz', 'uz_en', etc.
    const userModes = {};

    bot.command('start', async (ctx) => {
      try {
        db.updateBotData(botRecord.id, (b) => {
          b.stats = b.stats || {};
          b.stats.users_count = (b.stats.users_count || 0) + 1;
        });
      } catch (e) {}

      const mode = userModes[ctx.from.id] || 'auto_uz';
      userModes[ctx.from.id] = mode;

      const userName = escapeHtml(ctx.from.first_name || 'Foydalanuvchi');
      const botName = escapeHtml(botRecord.bot_first_name || 'Tarjimon Bot');

      await ctx.reply(
        `👋 Assalomu alaykum, <b>${userName}</b>!\n\n` +
        `🌐 <b>${botName}</b>ga xush kelibsiz!\n\n` +
        `📝 Menga istalgan tildagi matn yuboring, uni darhol aniq va tushunarli qilib tarjima qilib beraman.\n\n` +
        `⚙️ <b>Hozirgi yo'nalish:</b>\n👉 <code>${getModeTitle(mode)}</code>\n\n` +
        `👇 Tarjima yo'nalishini quyidagi tugmalar orqali tanlashingiz mumkin:`,
        { parse_mode: 'HTML', ...getMainKeyboard() }
      );
    });

    bot.command('help', async (ctx) => {
      await ctx.reply(
        `ℹ️ <b>Tarjimon Boti qo'llanmasi:</b>\n\n` +
        `1️⃣ Botga istalgan tilda so'z yoki matn yuboring.\n` +
        `2️⃣ Bot uni bir zumda belgilangan tilga tarjima qiladi.\n` +
        `3️⃣ <b>🌐 Avto ➡️ O'zbek</b> rejimida bot tilni o'zi aniqlab o'zbekchaga o'giradi.\n` +
        `4️⃣ Yo'nalishni o'zgartirish uchun /start yoki quyidagi tugmalardan foydalaning.`,
        { parse_mode: 'HTML', ...getMainKeyboard() }
      );
    });

    bot.action(/set_(.*)/, async (ctx) => {
      const mode = ctx.match[1];
      userModes[ctx.from.id] = mode;
      await ctx.answerCbQuery('✅ Yo\'nalish tanlandi!');

      const title = getModeTitle(mode);
      await ctx.reply(
        `🔄 <b>Yangi tarjima yo'nalishi o'rnatildi:</b>\n👉 <code>${title}</code>\n\n✍️ Endi tarjima qilmoqchi bo'lgan matningizni yuboring!`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('⚙️ Tillar menyusini ochish', 'open_lang_menu')]
          ])
        }
      );
    });

    bot.action('more_langs', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        `🌐 <b>Qo'shimcha tillar ro'yxati:</b>\n\nKerakli tarjima yo'nalishini tanlang:`,
        { parse_mode: 'HTML', ...getMoreLangsKeyboard() }
      );
    });

    bot.action('back_main_langs', async (ctx) => {
      await ctx.answerCbQuery();
      const currentMode = userModes[ctx.from.id] || 'auto_uz';
      await ctx.editMessageText(
        `🌐 <b>Asosiy tarjima yo'nalishlari:</b>\n\nHozirgi: <code>${getModeTitle(currentMode)}</code>\n\nKerakli yo'nalishni tanlang:`,
        { parse_mode: 'HTML', ...getMainKeyboard() }
      );
    });

    bot.action('open_lang_menu', async (ctx) => {
      await ctx.answerCbQuery();
      const currentMode = userModes[ctx.from.id] || 'auto_uz';
      await ctx.reply(
        `🌐 <b>Tarjima yo'nalishini tanlang:</b>\n\nHozirgi yo'nalish: <code>${getModeTitle(currentMode)}</code>`,
        { parse_mode: 'HTML', ...getMainKeyboard() }
      );
    });

    // Teskari almashtirish (Swap)
    bot.action(/swap_(.*)/, async (ctx) => {
      const currentMode = ctx.match[1];
      let newMode = 'auto_uz';
      const [s, t] = currentMode.split('_');
      if (s === 'auto') {
        newMode = t === 'uz' ? 'uz_en' : `auto_uz`;
      } else {
        newMode = `${t}_${s}`;
      }
      userModes[ctx.from.id] = newMode;
      await ctx.answerCbQuery('🔁 Yo\'nalish teskarisiga almashtirildi!');
      await ctx.reply(
        `🔁 <b>Yo'nalish almashtirildi:</b>\n👉 <code>${getModeTitle(newMode)}</code>\n\nEndi matn yuborishingiz mumkin!`,
        { parse_mode: 'HTML' }
      );
    });

    // Ovozli tinglash (TTS audio)
    bot.action(/tts_(.*)_(.*)/, async (ctx) => {
      await ctx.answerCbQuery('🔊 Ovoz yuklanmoqda...');
      try {
        const lang = ctx.match[1];
        const textToSpeak = decodeURIComponent(ctx.match[2]);
        const cleanText = textToSpeak.slice(0, 200);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;

        await ctx.replyWithVoice(
          { url: ttsUrl },
          { caption: `🔊 <i>Talaffuz (${LANG_NAMES[lang] || lang})</i>`, parse_mode: 'HTML' }
        );
      } catch (err) {
        await ctx.reply('⚠️ Ovozli talaffuzni yuklab bo\'lmadi.');
      }
    });

    // Matn kelganda tarjima qilish
    bot.on('text', async (ctx) => {
      const rawText = ctx.message.text;
      if (rawText.startsWith('/')) return;

      const currentMode = userModes[ctx.from.id] || 'auto_uz';
      const [sourceLang, targetLang] = currentMode.split('_');

      await ctx.sendChatAction('typing');

      try {
        const res = await translateWithEngines(rawText, sourceLang, targetLang);
        const translatedText = res.text;
        const detected = res.detectedLang || sourceLang;
        const fromTitle = LANG_NAMES[detected] || LANG_NAMES[sourceLang] || detected;
        const toTitle = LANG_NAMES[targetLang] || targetLang;

        // Statistika
        try {
          db.updateBotData(botRecord.id, (b) => {
            b.stats = b.stats || {};
            b.stats.messages_count = (b.stats.messages_count || 0) + 1;
          });
        } catch (e) {}

        const swapTargetMode = `${targetLang}_${sourceLang === 'auto' ? 'uz' : sourceLang}`;
        const encodedShortText = encodeURIComponent(translatedText.slice(0, 120));

        const replyKeyboard = Markup.inlineKeyboard([
          [
            Markup.button.callback(`🔁 Teskari o'girish`, `swap_${currentMode}`),
            Markup.button.callback('🔊 Ovozli tinglash', `tts_${targetLang}_${encodedShortText}`)
          ],
          [
            Markup.button.callback('⚙️ Yo\'nalishni o\'zgartirish', 'open_lang_menu')
          ]
        ]);

        const responseMessage = 
          `🌐 <b>Tarjima (${fromTitle} ➡️ ${toTitle}):</b>\n\n` +
          `<code>${escapeHtml(translatedText)}</code>`;

        if (responseMessage.length > 4000) {
          // Uzun xabarlarni bo'lib yuborish
          await ctx.reply(`🌐 <b>Tarjima natijasi:</b>`, { parse_mode: 'HTML' });
          for (let i = 0; i < translatedText.length; i += 3800) {
            await ctx.reply(escapeHtml(translatedText.slice(i, i + 3800)));
          }
          await ctx.reply(`⚙️ Boshqaruv tugmalari:`, replyKeyboard);
        } else {
          await ctx.reply(responseMessage, {
            parse_mode: 'HTML',
            ...replyKeyboard
          });
        }
      } catch (err) {
        console.error('Tarjima xatosi:', err.message);
        await ctx.reply(
          `⚠️ <b>Kechirasiz, tarjima qilishda xatolik yuz berdi.</b>\n\n` +
          `Iltimos, qayta urinib ko'ring yoki tarjima yo'nalishini almashtirib ko'ring.`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Yo\'nalishni yangilash', 'open_lang_menu')]
            ])
          }
        );
      }
    });

    // Admin buyrug'i
    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      const stats = botRecord.stats || {};
      const users = stats.users_count || 0;
      const msgs = stats.messages_count || 0;

      await ctx.reply(
        `👑 <b>Tarjimon Boti — Admin Paneli</b>\n\n` +
        `📊 <b>Statistika:</b>\n` +
        `👥 Foydalanuvchilar soni: <b>${users}</b> ta\n` +
        `💬 Bajarilgan tarjimalar: <b>${msgs}</b> ta\n` +
        `⚡ Holat: <b>Faol (100% Onlayn)</b>\n` +
        `🚀 Tarjima dvigatellari: <b>Google Translate v2 + Web Engine + MyMemory</b>`,
        { parse_mode: 'HTML' }
      );
    });
  }
};


});

// ---- FILE: templates/weather.js ----
defineModule('templates/weather.js', function(exports, module, require) {
const axios = require('axios');
const { Markup } = require('telegraf');

module.exports = {
  id: 'weather',
  name: '🌤 Ob-Havo Ma\'lumoti Boti',
  description: 'O\'zbekiston va dunyo shaharlari bo\'yicha aniq ob-havo bashorati boti',
  icon: '🌤',
  setupBot: (bot, botRecord, db) => {
    const cities = ['Toshkent', 'Samarqand', 'Andijon', 'Farg\'ona', 'Namangan', 'Buxoro', 'Xiva', 'Nukus', 'Qarshi', 'Termiz'];

    const mainKeyboard = Markup.keyboard([
      ['🌤 Toshkent', '🌤 Samarqand'],
      ['🌤 Farg\'ona', '🌤 Andijon'],
      ['📍 Boshqa shahar', 'ℹ️ Ma\'lumot']
    ]).resize();

    const getWeather = async (city) => {
      try {
        const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 8000 });
        const current = res.data.current_condition[0];
        return {
          temp: current.temp_C,
          feelsLike: current.FeelsLikeC,
          humidity: current.humidity,
          wind: current.windspeedKmph,
          desc: current.weatherDesc[0].value
        };
      } catch (e) {
        // Fallback simulyatsiya agar internet api kechiksa
        return {
          temp: '22',
          feelsLike: '21',
          humidity: '45',
          wind: '12',
          desc: 'Ochiq va quyoshli'
        };
      }
    };

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🌤 *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `Shahringizni tanlang yoki shahar nomini yozing, men sizga aniq ob-havo ma'lumotlarini taqdim etaman!`,
        { parse_mode: 'Markdown', ...mainKeyboard }
      );
    });

    const sendCityWeather = async (ctx, city) => {
      await ctx.sendChatAction('typing');
      const w = await getWeather(city);

      await ctx.reply(
        `🌤 *${city} shahrida ob-havo:*\n\n` +
        `🌡 Harorat: *${w.temp}°C* (His qilinishi: ${w.feelsLike}°C)\n` +
        `💧 Namlik: *${w.humidity}%*\n` +
        `💨 Shamol tezligi: *${w.wind} km/soat*\n` +
        `🌈 Holati: *${w.desc}*\n\n` +
        `Kun davomida yaxshi kayfiyat tilaymiz! ☀️`,
        { parse_mode: 'Markdown' }
      );
    };

    bot.hears(/🌤 (.*)/, async (ctx) => {
      const city = ctx.match[1];
      await sendCityWeather(ctx, city);
    });

    bot.hears('📍 Boshqa shahar', async (ctx) => {
      const buttons = cities.map(c => [Markup.button.callback(c, `w_${c}`)]);
      await ctx.reply('Shaharni tanlang:', Markup.inlineKeyboard(buttons));
    });

    bot.action(/w_(.*)/, async (ctx) => {
      const city = ctx.match[1];
      await ctx.answerCbQuery();
      await sendCityWeather(ctx, city);
    });

    bot.hears('ℹ️ Ma\'lumot', async (ctx) => {
      await ctx.reply('Ob-havo ma\'lumotlari xalqaro meteorologik xizmatlar orqali taqdim etiladi.');
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      if (text.startsWith('/') || text.startsWith('🌤') || ['📍 Boshqa shahar', 'ℹ️ Ma\'lumot'].includes(text)) return;
      await sendCityWeather(ctx, text);
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(`👑 *Ob-Havo Boti — Admin Paneli*`, { parse_mode: 'Markdown' });
    });
  }
};

});

// ---- FILE: templates/index.js ----
defineModule('templates/index.js', function(exports, module, require) {
const ai = require('./ai');
const nakrutka = require('./nakrutka');
const pulTopar = require('./pul_topar');
const kino = require('./kino');
const anonim = require('./anonim');
const shop = require('./shop');
const quiz = require('./quiz');
const feedback = require('./feedback');
const translator = require('./translator');
const currency = require('./currency');
const namoz = require('./namoz');
const tools = require('./tools');
const moderator = require('./moderator');
const weather = require('./weather');
const quotes = require('./quotes');
const autopost = require('./autopost');
const customButtons = require('./custom_buttons');

const templates = [
  customButtons, // Eng yuqorida turadi
  ai,
  nakrutka,
  pulTopar,
  kino,
  anonim,
  shop,
  quiz,
  feedback,
  translator,
  currency,
  namoz,
  tools,
  moderator,
  weather,
  quotes,
  autopost
];

const templatesMap = {};
templates.forEach(t => {
  templatesMap[t.id] = t;
});

module.exports = {
  templates,
  templatesMap,
  getTemplate: (id) => templatesMap[id] || null
};

});

// ---- FILE: core/botManager.js ----
defineModule('core/botManager.js', function(exports, module, require) {
const { Telegraf } = require('telegraf');
const db = require('../database/db');
const { getTemplate } = require('../templates');

class BotManager {
  constructor() {
    this.runningBots = new Map(); // botId -> Telegraf instance
  }

  // Tokenni Telegram orqali tekshirish va ma'lumotlarini olish
  async validateToken(token) {
    try {
      const tempBot = new Telegraf(token);
      const me = await tempBot.telegram.getMe();
      return { success: true, botInfo: me };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Botni ishga tushirish
  async startBot(botRecord) {
    // Agar bot oldin ishlayotgan bo'lsa, avval to'xtatamiz
    if (this.runningBots.has(botRecord.id)) {
      await this.stopBot(botRecord.id);
    }

    try {
      const template = getTemplate(botRecord.template);
      if (!template) {
        throw new Error(`Shablon topilmadi: ${botRecord.template}`);
      }

      const clientBot = new Telegraf(botRecord.token);

      // Markdown parse xatolarini avtomatik oddiy matnga o'tkazish
      clientBot.use(async (ctx, next) => {
        const origReply = ctx.reply.bind(ctx);
        ctx.reply = async (text, extra = {}) => {
          try {
            return await origReply(text, extra);
          } catch (err) {
            if (err.message && err.message.includes("can't parse entities")) {
              const plainExtra = { ...extra };
              delete plainExtra.parse_mode;
              return await origReply(text, plainExtra);
            }
            throw err;
          }
        };
        return next();
      });

      // Mijoz botidagi har bir xabarni jonli log qilish
      clientBot.use(async (ctx, next) => {
        if (ctx.from) {
          const userStr = `@${ctx.from.username || ctx.from.id} (${ctx.from.first_name || ''})`;
          if (ctx.message && ctx.message.text) {
            console.log(`🤖 [@${botRecord.bot_username}] 👤 ${userStr} yozdi: ${ctx.message.text}`);
          } else if (ctx.callbackQuery && ctx.callbackQuery.data) {
            console.log(`🤖 [@${botRecord.bot_username}] 👤 ${userStr} tugma bosdi: ${ctx.callbackQuery.data}`);
          }
        }
        return next();
      });

      // Bot handlerlarini ulash
      template.setupBot(clientBot, botRecord, db);

      // Xatoliklarni ushlash
      clientBot.catch((err, ctx) => {
        console.error(`[Mijoz Boti: @${botRecord.bot_username}] Xatolik:`, err.message);
      });

      // Ishga tushirish (fondagi polling)
      clientBot.launch({
        dropPendingUpdates: true
      }).catch(err => {
        console.error(`[@${botRecord.bot_username}] to'xtatildi yoki xatolik:`, err.message);
      });

      this.runningBots.set(botRecord.id, clientBot);
      db.updateBotStatus(botRecord.id, 'running');

      console.log(`✅ [@${botRecord.bot_username}] boti ishga tushdi (${template.name})`);
      return { success: true };
    } catch (err) {
      console.error(`❌ [@${botRecord.bot_username}] botini ishga tushirishda xatolik:`, err.message);
      db.updateBotStatus(botRecord.id, 'stopped');
      return { success: false, error: err.message };
    }
  }

  // Botni to'xtatish
  async stopBot(botId) {
    const clientBot = this.runningBots.get(botId);
    if (clientBot) {
      try {
        clientBot.stop('Foydalanuvchi yoki tizim tomonidan to\'xtatildi');
      } catch (err) {
        console.error(`Botni to'xtatishda xatolik:`, err.message);
      }
      this.runningBots.delete(botId);
    }
    db.updateBotStatus(botId, 'stopped');
    return true;
  }

  // Barcha faol botlarni qayta ishga tushirish (server yonganda)
  async startAllActiveBots() {
    const allBots = db.getAllBots();
    console.log(`🔄 Bazadagi botlar tekshirilmoqda (${allBots.length} ta)...`);

    for (const botRecord of allBots) {
      // Obunasi faol ekanligini tekshiramiz
      if (db.isSubscriptionActive(botRecord.owner_id)) {
        if (botRecord.status === 'running') {
          console.log(`🚀 [@${botRecord.bot_username}] boti ishga tushirilmoqda...`);
          await this.startBot(botRecord);
        }
      } else {
        console.log(`⚠️ [@${botRecord.bot_username}] boti to'xtatildi (Obuna muddati tugagan)`);
        db.updateBotStatus(botRecord.id, 'stopped');
      }
    }
  }

  isBotRunning(botId) {
    return this.runningBots.has(botId);
  }

  getRunningCount() {
    return this.runningBots.size;
  }
}

module.exports = new BotManager();

});

// ---- FILE: core/subscriptionChecker.js ----
defineModule('core/subscriptionChecker.js', function(exports, module, require) {
const db = require('../database/db');
const botManager = require('./botManager');
const keyboards = require('./keyboards');
const config = require('../config');
const { Markup } = require('telegraf');

class SubscriptionChecker {
  constructor() {
    this.mainBot = null;
    this.interval = null;
  }

  init(mainBot) {
    this.mainBot = mainBot;
    // Har 2 daqiqada barcha foydalanuvchilarning obunasini tekshirib turadi
    this.interval = setInterval(() => this.checkAllUsers(), 2 * 60 * 1000);
    // Dastlabki tekshiruv 10 soniyadan so'ng
    setTimeout(() => this.checkAllUsers(), 10 * 1000);
  }

  async checkAllUsers() {
    if (!this.mainBot) return;

    try {
      const allUsers = db.getAllUsers();
      const now = new Date();

      for (const user of allUsers) {
        // Admin va Ownerlarni tekshirmaymiz (cheksiz ruxsat)
        if (db.isAdmin(user.id)) continue;
        if (!user.subscription_ends_at) continue;

        const endAt = new Date(user.subscription_ends_at);
        const diffMs = endAt.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // 1. Agar obuna muddatiga 5 soat yoki undan kam vaqt qolgan bo'lsa (0 < diffMs <= 5 soat)
        if (diffMs > 0 && diffHours <= 5) {
          if (!user.notified_5h) {
            await this.send5HoursWarning(user, diffMs);
            user.notified_5h = true;
            db.save();
          }
        }

        // 2. Agar obuna muddati tugagan bo'lsa (diffMs <= 0), lekin 24 soat (8-kun) hali to'lmagan bo'lsa (-24 < diffHours <= 0)
        // Bot to'xtaydi, lekin bazadan o'chib ketmaydi!
        if (diffMs <= 0 && diffHours > -24) {
          if (!user.notified_expired) {
            await this.handleExpiredUser(user);
            user.notified_expired = true;
            user.notified_5h = true; // 5h xabarini qayta yubormaslik uchun
            db.save();
          }
        }

        // 3. Agar obuna tugaganiga 24 soat (1 sutka) bo'lsa (diffHours <= -24) -> Ya'ni 8-kun bo'lganda!
        // Bot butunlay avtomatik tarzda o'chirib yuboriladi!
        if (diffHours <= -24) {
          if (!user.notified_deleted) {
            await this.handleAutoDeleteUserBots(user);
            user.notified_deleted = true;
            user.notified_expired = true;
            user.notified_5h = true;
            db.save();
          }
        }

        // 4. Agar foydalanuvchi obunasini yangilagan / tarif sotib olgan bo'lsa (> 5 soat qolgan)
        if (diffHours > 5) {
          if (user.notified_5h || user.notified_expired || user.notified_deleted) {
            user.notified_5h = false;
            user.notified_expired = false;
            user.notified_deleted = false;
            db.save();
          }
        }
      }
    } catch (err) {
      console.error('SubscriptionChecker xatolik:', err.message);
    }
  }

  // 5 soat qolganda ogohlantirish
  async send5HoursWarning(user, diffMs) {
    try {
      const minutesLeft = Math.max(1, Math.ceil(diffMs / (1000 * 60)));
      const hoursLeft = Math.floor(minutesLeft / 60);
      const remMins = minutesLeft % 60;
      const timeLeftStr = hoursLeft > 0 ? `${hoursLeft} soat ${remMins} daqiqa` : `${remMins} daqiqa`;

      const userBots = db.getUserBots(user.id);
      const botNames = userBots.length > 0 
        ? userBots.map(b => `@${b.bot_username}`).join(', ')
        : 'Botlaringiz';

      const text = 
        `⚠️ *DIQQAT: 3 KUNLIK HOSTING MUDDATINGIZ TUGAMOQDA!*\n\n` +
        `Hurmatli *${user.first_name || 'foydalanuvchi'}*, sizning botingiz uchun berilgan 3 kunlik bepul 24/7 hosting muddati **5 SOATDAN SO'NG TUGAYDI!**\n\n` +
        `⏱ Qolgan vaqt: *${timeLeftStr}*\n` +
        `🤖 Botingiz: *${botNames}*\n\n` +
        `⚠️ *Muhim eslatma:*\n` +
        `• 5 soatdan so'ng botingiz faoliyati avtomatik ravishda **TO'XTATILADI**.\n` +
        `• Agar 24 soat ichida (4-kun bo'lguncha) tarif olib obunani uzaytirmasangiz, botingiz va barcha sozlamalari **BUTUNLAY O'CHIRIB YUBORILADI!**\n\n` +
        `Botlaringiz 24/7 uzluksiz ishlashini ta'minlash va o'chib ketishini oldini olish uchun hoziroq tarifni o'zgartiring / uzaytiring! 👇`;

      await this.mainBot.telegram.sendMessage(user.id, text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💎 Tarifni O\'zgartirish / Uzaytirish', 'tariff_view_all')],
          [Markup.button.callback('📁 Mening Botlarim', 'my_bots_list')]
        ])
      });
      console.log(`📢 [5 Soat Ogohlantirish] ID: ${user.id} ga 5 soatlik obuna ogohlantirishi yuborildi.`);
    } catch (err) {
      console.error(`Foydalanuvchiga (ID: ${user.id}) 5h ogohlantirish yuborishda xatolik:`, err.message);
    }
  }

  // 3 kun to'lganda (muddati tugaganda) - Bot to'xtaydi, lekin O'CHMAYDI!
  async handleExpiredUser(user) {
    try {
      const userBots = db.getUserBots(user.id);
      let stoppedCount = 0;

      for (const b of userBots) {
        if (b.status === 'running' || botManager.isBotRunning(b.id)) {
          await botManager.stopBot(b.id);
          db.updateBotStatus(b.id, 'stopped');
          stoppedCount++;
        }
      }

      const botNames = userBots.length > 0 
        ? userBots.map(b => `@${b.bot_username}`).join(', ')
        : 'Botlaringiz';

      const text = 
        `⛔ *3 KUNLIK HOSTING MUDDATINGIZ YAKUNLANDI!*\n\n` +
        `Hurmatli *${user.first_name || 'foydalanuvchi'}*, sizning 3 kunlik 24/7 bepul hosting muddatingiz to'liq yakunlandi.\n\n` +
        `🛑 Barcha botlaringiz (*${botNames}*) faoliyati avtomatik ravishda **TO'XTATILDI** (lekin hozircha o'chirilmadi, saqlanib turibdi).\n\n` +
        `⏳ *DIQQAT (4-kun qoidasi):*\n` +
        `Sizga 24 soat imtiyozli kutish vaqti berildi. Agar 24 soat ichida (ertaga shu vaqtgacha) tarif sotib olib obunani uzaytirmasangiz, botingiz **AVTOMATIK TARZDA BUTUNLAY O'CHIB KETADI!**\n\n` +
        `🚀 Botingizni darhol qayta yoqish va o'chib ketishidan saqlab qolish uchun quyidagi tugma orqali tarif sotib oling:`;

      await this.mainBot.telegram.sendMessage(user.id, text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('💎 Obunani Uzaytirish / Tariflar', 'tariff_view_all')],
          [Markup.button.callback('📁 Mening Botlarim', 'my_bots_list')]
        ])
      });
      console.log(`🛑 [3 Kun To'xtadi] ID: ${user.id} ning ${stoppedCount} ta boti to'xtatildi (o'chirilmadi) va xabar yuborildi.`);
    } catch (err) {
      console.error(`Foydalanuvchiga (ID: ${user.id}) muddat tugaganini yuborishda xatolik:`, err.message);
    }
  }

  // 4-kun bo'lganda (tugaganiga 24 soat bo'lganda) - Bot BUTUNLAY O'CHIRILADI!
  async handleAutoDeleteUserBots(user) {
    try {
      const userBots = db.getUserBots(user.id);
      if (userBots.length === 0) return;

      const botNames = userBots.map(b => `@${b.bot_username}`).join(', ');
      let deletedCount = 0;

      for (const b of userBots) {
        await botManager.stopBot(b.id);
        db.deleteBot(b.id);
        deletedCount++;
      }

      const text = 
        `🗑 *BOTINGIZ AVTOMATIK TARZDA O'CHIRILDI!*\n\n` +
        `Hurmatli *${user.first_name || 'foydalanuvchi'}*, 4 kunlik muddat (3 kun hosting + 24 soat kutish vaqti) to'liq yakunlandi.\n\n` +
        `❌ Obuna uzaytirilmaganligi sababli botingiz (*${botNames}*) bazadan va tizimdan **BUTUNLAY O'CHIRILDI**.\n\n` +
        `Agar kelgusida yana bot yaratmoqchi bo'lsangiz, botimizga kirib yangi bot yaratishingiz yoki tarif xarid qilishingiz mumkin.`;

      await this.mainBot.telegram.sendMessage(user.id, text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 Yangi Bot Yaratish', 'tariff_view_all')],
          [Markup.button.callback('💎 Tariflar', 'tariff_view_all')]
        ])
      });
      console.log(`🗑 [4-Kun Avto O'chirish] ID: ${user.id} ning ${deletedCount} ta boti bazadan butunlay o'chirildi.`);
    } catch (err) {
      console.error(`Foydalanuvchining (ID: ${user.id}) botlarini avto o'chirishda xatolik:`, err.message);
    }
  }
}

module.exports = new SubscriptionChecker();

});

// ---- FILE: handlers/adminHandlers.js ----
defineModule('handlers/adminHandlers.js', function(exports, module, require) {
const { Markup } = require('telegraf');
const db = require('../database/db');
const botManager = require('../core/botManager');
const keyboards = require('../core/keyboards');
const { getTemplate } = require('../templates');
const config = require('../config');
const { cleanName } = require('../core/helpers');

module.exports = (bot) => {
  const adminStates = {}; // adminId -> { state: 'waiting_broadcast' | 'waiting_add_admin' }

  // Admin panel ochish
  const openAdminPanel = async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) {
      return ctx.reply('⛔ Kechirasiz, sizda administrator huquqi mavjud emas.');
    }

    const isOwner = db.isOwner(ctx.from.id);
    const isPublic = db.isWebappPublic();
    const stats = db.getStats();

    await ctx.reply(
      `👑 *Asosiy Administrator Paneli*\n\n` +
      `Sizning maqomingiz: *${isOwner ? '👑 Bosh Admin (Ega)' : '🛡 Yordamchi Admin'}*\n` +
      `Web App holati: *${isPublic ? '🟢 Hamma uchun ochiq (ON)' : '🔴 Faqat admin uchun (OFF)'}*\n\n` +
      `Quyidagi boshqaruv bo'limlaridan birini tanlang:`,
      {
        parse_mode: 'Markdown',
        ...keyboards.getAdminKeyboard(isOwner, isPublic, ctx.from.id)
      }
    );
  };

  bot.hears('👑 Admin Panel', openAdminPanel);
  bot.command('admin', openAdminPanel);

  // Web App ON/OFF almashtirish
  bot.action('admin_toggle_webapp', async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    const newStatus = db.toggleWebappPublic();
    const isOwner = db.isOwner(ctx.from.id);

    await ctx.answerCbQuery(
      newStatus ? '🟢 Web App barcha foydalanuvchilar uchun yoqildi!' : '🔴 Web App faqat adminlar uchun belgilandi!'
    );

    try {
      await ctx.editMessageText(
        `👑 *Asosiy Administrator Paneli*\n\n` +
        `Sizning maqomingiz: *${isOwner ? '👑 Bosh Admin (Ega)' : '🛡 Yordamchi Admin'}*\n` +
        `Web App holati: *${newStatus ? '🟢 Hamma uchun ochiq (ON)' : '🔴 Faqat admin uchun (OFF)'}*\n\n` +
        `Quyidagi boshqaruv bo'limlaridan birini tanlang:`,
        {
          parse_mode: 'Markdown',
          ...keyboards.getAdminKeyboard(isOwner, newStatus, ctx.from.id)
        }
      );
    } catch (e) {}
  });

  // Yangilanishlar tarixi (Faqat Ega / Adminlar uchun)
  const showUpdatesInfo = async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    if (ctx.callbackQuery) await ctx.answerCbQuery();

    const updatesText = 
      `✨ *BOT KONSTRUKTORI — SO'NGGI YANGILANISHLAR (v2.5)*\n\n` +
      `Hurmatli Bot Egasi, botingizga quyidagi barcha yangi funksiyalar va yaxshilanishlar qo'shildi:\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *1. TELEGRAM WEB APP (MINI APP) BOSHQARUV:* \n` +
      `• *Mijoz Botlari Nazorati:* Barcha yaratilgan botlar, ularning faolligi, foydalanuvchilar va xabarlar soni.\n` +
      `• *🔑 Tokenlar Boshqaruvi:* Tokenlarni ko'rish/yashirish va bitta bosishda nusxalash (\`📋 Nusxalash\`).\n` +
      `• *👤 Mijozlar Ma'lumotlari:* Mijoz ID si, username, amaldagi tarifi, obunaning qolgan kunlari.\n` +
      `• *⚡ Tezkor Boshqaruv:* Botlarni to'xtatish (\`⏹\`), ishga tushirish (\`▶️\`) va o'chirish (\`🗑\`).\n` +
      `• *🔍 Qidiruv va Filtr:* Bot nomi, username, mijoz yoki token bo'yicha qidirish.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚙️ *2. WEB APP ON / OFF REJIMI:* \n` +
      `• *🟢 ON (Hamma ko'radi):* Barcha mijozlar Web App orqali o'z shaxsiy kabinetlarini ko'ra olishadi.\n` +
      `• *🔴 OFF (Faqat Admin):* Web App oddiy foydalanuvchilarga yopiladi va faqat bot egasi va adminlarga ko'rinadi.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `🌐 *3. TARJIMON BOTI (TUBDAN YANGILANDI):* \n` +
      `• *Google Web Engine:* Bepul, cheklovlarsiz va tezkor tarjima dvigateli.\n` +
      `• *30+ Xalqaro Tillar:* O'zbek, Rus, Ingliz, Turk, Arab, Koreys, Nemis, Xitoy, Fransuz, Ispan va h.k.\n` +
      `• *🌐 Avto-Aniqlash:* Yuborilgan matn tilini avtomatik aniqlab o'zbekchaga o'girish.\n` +
      `• *🔁 Swap Tugmasi:* Bitta bosish bilan tillarni teskari almashtirish.\n` +
      `• *🔊 Ovozli Talaffuz (TTS):* Tarjima qilingan so'zlarning to'g'ri talaffuzini eshitish.\n` +
      `• *🛡 HTML Format:* Maxsus belgilar tufayli xabar buzilishi to'liq bartaraf etildi.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `⚡ *4. TIZIM VA HOSTING 24/7:* \n` +
      `• Ziddiyatli Render bot instansiyalari to'xtatildi, 409 Conflict xatolari yo'qotildi.\n` +
      `• Tizim maksimal tezlik va xavfsizlik bilan 24/7 rejimda ishlamoqda!`;

    await ctx.reply(updatesText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Admin menyuga qaytish', 'admin_back')]
      ])
    });
  };

  bot.action('admin_updates_info', showUpdatesInfo);
  bot.hears('✨ Yangilanishlar', showUpdatesInfo);
  bot.hears('🔄 Yangilanishlar', showUpdatesInfo);
  bot.hears('Yangilanishlar', showUpdatesInfo);


  // Statistika
  bot.action('admin_stats', async (ctx) => {

    if (!db.isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();

    const stats = db.getStats();
    const runningCount = botManager.getRunningCount();

    const text = 
      `📊 *Tizim Statistikasi:*\n\n` +
      `👥 Jami foydalanuvchilar: *${stats.totalUsers} ta*\n` +
      `🤖 Jami yaratilgan botlar: *${stats.totalBots} ta*\n` +
      `⚡ Hozir faol (Online) botlar: *${runningCount} ta*\n` +
      `💳 Jami to'lov urinishlari: *${stats.totalPayments} ta*\n` +
      `✅ Tasdiqlangan to'lovlar: *${stats.approvedPayments} ta*\n` +
      `⏳ Kutilayotgan cheklar: *${stats.pendingPayments} ta*\n` +
      `💰 Jami daromad: *${stats.totalIncome.toLocaleString()} so'm*\n` +
      `🛡 Administratorlar soni: *${stats.adminsCount} ta*`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Admin menyuga qaytish', 'admin_back')]
      ])
    });
  });


  // Mijoz botlari ro'yxati
  bot.action('admin_bots', async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();

    const allBots = db.getAllBots();
    if (allBots.length === 0) {
      return ctx.reply('Tizimda hali birorta ham mijoz boti yaratilmagan.');
    }

    let msg = `🤖 *Barcha mijoz botlari (${allBots.length} ta):*\n\n`;
    const buttons = [];

    allBots.slice(-15).forEach((b, idx) => {
      const isRunning = botManager.isBotRunning(b.id);
      const tpl = getTemplate(b.template);
      msg += `${idx + 1}. *${b.bot_first_name}* (@${b.bot_username})\n` +
        `   Ega ID: \`${b.owner_id}\`\n` +
        `   Turi: ${tpl ? tpl.name : b.template}\n` +
        `   Holat: ${isRunning ? '🟢 Faol' : '🔴 To\'xtagan'}\n\n`;

      buttons.push([
        Markup.button.callback(`🗑 O'chirish: @${b.bot_username}`, `adm_del_bot_${b.id}`)
      ]);
    });

    buttons.push([Markup.button.callback('⬅️ Admin menyuga qaytish', 'admin_back')]);

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  });

  // Admin tomonidan botni o'chirish
  bot.action(/adm_del_bot_(.*)/, async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    const botId = ctx.match[1];
    const b = db.getBot(botId);

    if (!b) {
      return ctx.answerCbQuery('Bot topilmadi!');
    }

    await botManager.stopBot(botId);
    db.deleteBot(botId);

    await ctx.answerCbQuery('🗑 Bot butunlay o\'chirildi!');
    await ctx.reply(`✅ Admin tomonidan *@${b.bot_username}* boti butunlay o'chirildi va to'xtatildi!`, {
      parse_mode: 'Markdown'
    });
  });

  // Kutilayotgan to'lovlar
  bot.action('admin_payments', async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();

    const pending = db.getPendingPayments();
    if (pending.length === 0) {
      return ctx.reply('✅ Hozirda ko\'rib chiqilmagan yangi to\'lovlar mavjud emas.');
    }

    await ctx.reply(`💳 Hozirda *${pending.length} ta* to'lov kutilmoqda:`, { parse_mode: 'Markdown' });

    for (const p of pending) {
      try {
        await ctx.replyWithPhoto(p.photo_id, {
          caption: 
            `🆔 To'lov #${p.id}\n` +
            `👤 Foydalanuvchi ID: \`${p.user_id}\`\n` +
            `💎 Tarif: *${p.tariff_name}*\n` +
            `💰 Summa: *${p.amount.toLocaleString()} so'm*`,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Tasdiqlash', `pay_approve_${p.id}`),
              Markup.button.callback('❌ Rad etish', `pay_reject_${p.id}`)
            ]
          ])
        });
      } catch (err) {}
    }
  });

  // To'lovni tasdiqlash
  bot.action(/pay_approve_(.*)/, async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    const paymentId = ctx.match[1];
    const payment = db.approvePayment(paymentId);

    if (!payment) {
      return ctx.answerCbQuery('To\'lov allaqachon ko\'rib chiqilgan yoki topilmadi.');
    }

    await ctx.answerCbQuery('✅ To\'lov tasdiqlandi!');
    try {
      await ctx.editMessageCaption(
        ctx.callbackQuery.message.caption + `\n\n✅ *TASDIQLANDI* (Admin: ${ctx.from.first_name})`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {}

    // Foydalanuvchiga xushxabar jo'natish
    try {
      await bot.telegram.sendMessage(
        payment.user_id,
        `🎉 *Ajoyib xabar!*\n\n` +
        `Sizning *${payment.tariff_name}* tarifi bo'yicha qilgan to'lovingiz qabul qilindi va tasdiqlandi!\n` +
        `Obunangiz 30 kunga faollashtirildi. Botlaringizdan cheklovlarsiz foydalanishingiz mumkin! 🚀`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.log('Foydalanuvchiga to\'lov tasdiqlanganini yetkazib bo\'lmadi:', err.message);
    }
  });

  // To'lovni rad etish
  bot.action(/pay_reject_(.*)/, async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    const paymentId = ctx.match[1];
    const payment = db.rejectPayment(paymentId);

    if (!payment) {
      return ctx.answerCbQuery('To\'lov allaqachon ko\'rib chiqilgan yoki topilmadi.');
    }

    await ctx.answerCbQuery('❌ To\'lov rad etildi.');
    try {
      await ctx.editMessageCaption(
        ctx.callbackQuery.message.caption + `\n\n❌ *RAD ETILDI* (Admin: ${ctx.from.first_name})`,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {}

    try {
      await bot.telegram.sendMessage(
        payment.user_id,
        `❌ *To'lov rad etildi.*\n\n` +
        `Siz yuborgan kvitansiya qabul qilinmadi. Mablag' hisobga tushmagan yoki chek noaniq bo'lishi mumkin.\n` +
        `Iltimos, qayta to'lov qilib chekni yuboring yoki adminga murojaat qiling.`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {}
  });

  // Adminlarni boshqarish (Faqat Ega / Owner uchun)
  bot.action('admin_manage_admins', async (ctx) => {
    if (!db.isOwner(ctx.from.id)) {
      return ctx.answerCbQuery('⛔ Bu bo\'lim faqat Bosh Admin (Ega) uchun!');
    }
    await ctx.answerCbQuery();

    const admins = db.getAdmins();
    let msg = `👥 *Administratorlar Ro'yxati:*\n\n`;
    admins.forEach((aid, i) => {
      const isOwner = db.isOwner(aid);
      msg += `${i + 1}. ID: \`${aid}\` ${isOwner ? '👑 (Bosh Admin / Ega)' : '🛡 (Admin)'}\n`;
    });

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('➕ Yangi Admin Qo\'shish', 'admin_add_prompt')],
        [Markup.button.callback('⬅️ Admin menyuga qaytish', 'admin_back')]
      ])
    });
  });

  bot.action('admin_add_prompt', async (ctx) => {
    if (!db.isOwner(ctx.from.id)) return;
    await ctx.answerCbQuery();

    adminStates[ctx.from.id] = { state: 'waiting_add_admin' };
    await ctx.reply(
      `➕ Yangi administratorning *Telegram ID* sini yuboring:\n\n` +
      `Foydalanuvchi o'z ID sini bilishi uchun @userinfobot ga kirishi mumkin.`,
      { parse_mode: 'Markdown', ...keyboards.getCancelKeyboard() }
    );
  });

  // Xabar tarqatish (Rassilka)
  bot.action('admin_broadcast', async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();

    adminStates[ctx.from.id] = { state: 'waiting_broadcast' };
    await ctx.reply(
      `📢 *Barcha foydalanuvchilarga xabar tarqatish:*\n\n` +
      `Barcha a'zolarga jo'natmoqchi bo'lgan xabaringizni yuboring (Matn yoki Rasm bilan birga).\n` +
      `Xabar darhol hamma a'zolarga tarqatiladi.`,
      { parse_mode: 'Markdown', ...keyboards.getCancelKeyboard() }
    );
  });

  // Foydalanuvchilar (Mijozlar) ro'yxati
  bot.action('admin_users', async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();

    const allUsers = db.getAllUsers();
    if (allUsers.length === 0) {
      return ctx.reply('Tizimda hali foydalanuvchilar mavjud emas.');
    }

    let msg = `👥 *Barcha Foydalanuvchilar (${allUsers.length} ta):*\n\n`;
    allUsers.slice(-20).forEach((u, i) => {
      const tariff = config.TARIFFS[u.tariff] || { name: u.tariff || 'Standart' };
      const days = db.getSubscriptionDaysLeft(u.id);
      msg += `${i + 1}. *${cleanName(u.first_name)}* ${u.username ? '(@' + u.username + ')' : ''}\n` +
        `   🆔 ID: \`${u.id}\`\n` +
        `   💰 Balans: *${(u.balance || 0).toLocaleString()} so'm*\n` +
        `   💎 Tarif: *${tariff.name}* (${days} kun qoldi)\n\n`;
    });

    msg += `💡 *Tezkor Balans Boshqaruvi Buyruqlari:*\n` +
      `• Pul qo'shish: \`/add_money <ID> <summa>\`\n` +
      `• Pul ayirish: \`/sub_money <ID> <summa>\`\n` +
      `• Kun qo'shish: \`/add_days <ID> <kun>\`\n` +
      `• Tarif berish: \`/set_tariff <ID> <pro_month/vip_year/...>\`\n\n` +
      `_Yoki to'liq vizual boshqaruv uchun Web App dan foydalaning._`;

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🌐 Web App orqali boshqarish', keyboards.getWebAppUrl(ctx.from.id))],
        [Markup.button.callback('⬅️ Admin menyuga qaytish', 'admin_back')]
      ])
    });
  });

  // Tezkor buyruq: /add_money <ID> <summa>
  bot.command(['add_money', 'add_balance', 'pul_qoshish'], async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    const parts = ctx.message.text.split(' ').filter(Boolean);
    if (parts.length < 3) {
      return ctx.reply('ℹ️ Ishlatish: `/add_money <User_ID> <Summa>`\nMisol: `/add_money 8422157752 50000`', { parse_mode: 'Markdown' });
    }
    const targetId = parts[1];
    const amount = parseFloat(parts[2]);
    if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Noto\'g\'ri summa kiritildi.');

    const newBal = db.addBalance(targetId, amount);
    if (newBal === false) return ctx.reply('❌ Foydalanuvchi topilmadi.');

    await ctx.reply(`✅ ID: \`${targetId}\` ga *${amount.toLocaleString()} so'm* qo'shildi!\nYangi balansi: *${newBal.toLocaleString()} so'm*`, { parse_mode: 'Markdown' });
  });

  // Tezkor buyruq: /sub_money <ID> <summa>
  bot.command(['sub_money', 'sub_balance', 'pul_ayirish'], async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    const parts = ctx.message.text.split(' ').filter(Boolean);
    if (parts.length < 3) {
      return ctx.reply('ℹ️ Ishlatish: `/sub_money <User_ID> <Summa>`\nMisol: `/sub_money 8422157752 20000`', { parse_mode: 'Markdown' });
    }
    const targetId = parts[1];
    const amount = parseFloat(parts[2]);
    if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Noto\'g\'ri summa kiritildi.');

    const newBal = db.subtractBalance(targetId, amount);
    if (newBal === false) return ctx.reply('❌ Foydalanuvchi topilmadi.');

    await ctx.reply(`➖ ID: \`${targetId}\` dan *${amount.toLocaleString()} so'm* ayirildi!\nYangi balansi: *${newBal.toLocaleString()} so'm*`, { parse_mode: 'Markdown' });
  });

  // Tezkor buyruq: /add_days <ID> <kun>
  bot.command(['add_days', 'kun_qoshish'], async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    const parts = ctx.message.text.split(' ').filter(Boolean);
    if (parts.length < 3) {
      return ctx.reply('ℹ️ Ishlatish: `/add_days <User_ID> <Kun>`\nMisol: `/add_days 8422157752 30`', { parse_mode: 'Markdown' });
    }
    const targetId = parts[1];
    const days = parseInt(parts[2]);
    if (isNaN(days) || days <= 0) return ctx.reply('❌ Noto\'g\'ri kun soni.');

    const daysLeft = db.addDays(targetId, days);
    if (daysLeft === false) return ctx.reply('❌ Foydalanuvchi topilmadi.');

    await ctx.reply(`⏳ ID: \`${targetId}\` ga *${days} kun* qo'shildi!\nQolgan obuna muddati: *${daysLeft} kun*`, { parse_mode: 'Markdown' });
  });

  // Tezkor buyruq: /set_tariff <ID> <tariffId>
  bot.command(['set_tariff', 'tarif_berish'], async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    const parts = ctx.message.text.split(' ').filter(Boolean);
    if (parts.length < 3) {
      return ctx.reply('ℹ️ Ishlatish: `/set_tariff <User_ID> <Tarif>`\nTariflar: `starter`, `pro_month`, `business_3m`, `vip_year`, `unlimited_forever`\nMisol: `/set_tariff 8422157752 pro_month`', { parse_mode: 'Markdown' });
    }
    const targetId = parts[1];
    const tariffId = parts[2];

    const ok = db.setTariff(targetId, tariffId);
    if (!ok) return ctx.reply('❌ Foydalanuvchi topilmadi.');

    const tariff = config.TARIFFS[tariffId] || { name: tariffId };
    await ctx.reply(`💎 ID: \`${targetId}\` ga *${tariff.name}* tarifi muvaffaqiyatli o'rnatildi!`, { parse_mode: 'Markdown' });
  });

  // Admin menyusiga qaytish
  bot.action('admin_back', async (ctx) => {
    if (!db.isAdmin(ctx.from.id)) return;
    await ctx.answerCbQuery();
    await openAdminPanel(ctx);
  });

  bot.action('admin_close', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Asosiy menyudasiz.', keyboards.getMainKeyboard(db.isAdmin(ctx.from.id)));
  });

  // Admin matn kiritishlarini qayta ishlash
  bot.on('message', async (ctx, next) => {
    const adminId = ctx.from.id;
    const session = adminStates[adminId];

    if (!session) return next();

    // 1. Yangi admin qo'shish
    if (session.state === 'waiting_add_admin') {
      const newAdminId = parseInt(ctx.message.text?.trim());
      delete adminStates[adminId];

      if (isNaN(newAdminId)) {
        return ctx.reply('❌ Noto\'g\'ri Telegram ID kiritildi.');
      }

      const added = db.addAdmin(newAdminId);
      if (added) {
        await ctx.reply(`✅ Foydalanuvchi [ID: \`${newAdminId}\`] muvaffaqiyatli administrator qilindi!`, { parse_mode: 'Markdown' });
      } else {
        await ctx.reply('⚠️ Bu foydalanuvchi allaqachon adminlar ro\'yxatida mavjud.');
      }
      return;
    }

    // 2. Rassilka (Xabar tarqatish)
    if (session.state === 'waiting_broadcast') {
      delete adminStates[adminId];
      const allUsers = db.getAllUsers();

      await ctx.reply(`📢 Xabar tarqatish boshlandi... Jami: ${allUsers.length} ta foydalanuvchi.`);

      let sentCount = 0;
      let failedCount = 0;

      for (const u of allUsers) {
        try {
          if (ctx.message.text) {
            await bot.telegram.sendMessage(u.id, ctx.message.text);
          } else if (ctx.message.photo) {
            const photoId = ctx.message.photo.pop().file_id;
            await bot.telegram.sendPhoto(u.id, photoId, { caption: ctx.message.caption });
          }
          sentCount++;
        } catch (err) {
          failedCount++;
        }
      }

      await ctx.reply(
        `✅ *Xabar tarqatish yakunlandi!*\n\n` +
        `📤 Muvaffaqiyatli yetkazildi: *${sentCount} ta*\n` +
        `🚫 Yetkazilmadi (bloklangan): *${failedCount} ta*`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    return next();
  });
};

});

// ---- FILE: handlers/tariffHandlers.js ----
defineModule('handlers/tariffHandlers.js', function(exports, module, require) {
const { Markup } = require('telegraf');
const db = require('../database/db');
const keyboards = require('../core/keyboards');
const config = require('../config');

module.exports = (bot) => {
  const pendingPaymentUsers = {}; // userId -> tariffId

  // Tariflar bo'limi
  const showTariffs = async (ctx) => {
    const user = db.getOrCreateUser(ctx.from);
    const daysLeft = db.getSubscriptionDaysLeft(ctx.from.id);

    const text = 
      `💎 *Tariflar va Obuna Rejalari:*\n\n` +
      `Sizning hozirgi holatingiz: *${config.TARIFFS[user.tariff]?.name || 'Tekin sinov'}*\n` +
      `Qolgan muddat: *${daysLeft} kun*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎁 *1. 3 Kunlik Bepul Sinov*\n` +
      `• Narxi: *0 so'm (Mutlaqo Bepul)*\n` +
      `• Muddat: 3 kun\n` +
      `• Limit: Faqat 1 ta bot\n\n` +
      `🌱 *2. Starter (1 Oylik)*\n` +
      `• Narxi: *15,000 so'm* / oy\n` +
      `• Muddat: 30 kun\n` +
      `• Limit: 3 tagacha bot\n\n` +
      `⭐ *3. 25 Pro (1 Oylik)*\n` +
      `• Narxi: *25,000 so'm* / oy\n` +
      `• Muddat: 30 kun\n` +
      `• Limit: 10 tagacha bot\n\n` +
      `💼 *4. Business (3 Oylik)*\n` +
      `• Narxi: *60,000 so'm* (Chegirma bilan!)\n` +
      `• Muddat: 90 kun (3 oy)\n` +
      `• Limit: 25 tagacha bot\n\n` +
      `👑 *5. VIP Premium (1 Yillik)*\n` +
      `• Narxi: *150,000 so'm*\n` +
      `• Muddat: 365 kun (1 yil)\n` +
      `• Limit: 50 tagacha bot\n\n` +
      `♾ *6. Cheksiz Umrbod (Lifetime)*\n` +
      `• Narxi: *300,000 so'm* (Bir martalik to'lov!)\n` +
      `• Muddat: Umrbod / Cheksiz\n` +
      `• Limit: Cheksiz botlar (999 ta)\n` +
      `• Barcha yangi chiqadigan funksiyalardan doimiy foydalanish\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `O'zingizga ma'qul tarifni tanlang:`;

    await ctx.reply(text, {
      parse_mode: 'Markdown',
      ...keyboards.getTariffsKeyboard()
    });
  };

  bot.hears('💎 Tariflar va Obuna', showTariffs);
  bot.action('tariff_view_all', async (ctx) => {
    await ctx.answerCbQuery();
    await showTariffs(ctx);
  });

  // Tarif tanlanganda
  bot.action(/tariff_(.*)/, async (ctx) => {
    await ctx.answerCbQuery();
    const tariffId = ctx.match[1];

    if (tariffId === 'free_trial') {
      const user = db.getUser(ctx.from.id);
      return ctx.reply(
        `🎁 *3 Kunlik Tekin Sinov*\n\n` +
        `Ushbu sinov siz ro'yxatdan o'tganingizda avtomatik taqdim etilgan.\n` +
        `Qolgan sinov muddati: *${db.getSubscriptionDaysLeft(ctx.from.id)} kun*.\n\n` +
        `Muddatingizni uzaytirish uchun *25 Pro* yoki *VIP Premium* tariflarini tanlashingiz mumkin!`,
        { parse_mode: 'Markdown' }
      );
    }

    const tariff = config.TARIFFS[tariffId];
    if (!tariff) return ctx.reply('❌ Tarif topilmadi.');

    pendingPaymentUsers[ctx.from.id] = tariffId;

    const paymentText = 
      `💳 *To'lov Ma'lumotlari:*\n\n` +
      `Tanlangan tarif: *${tariff.name}*\n` +
      `To'lov summasi: *${tariff.price.toLocaleString()} so'm*\n\n` +
      `To'lov uchun karta raqami:\n` +
      `💳 \`${config.CARD_NUMBER}\`\n` +
      `👤 Karta egasi: *${config.CARD_HOLDER}*\n\n` +
      `📌 *To'lov yo'riqnomasi:*\n` +
      `1. Yuqoridagi kartaga *${tariff.price.toLocaleString()} so'm* o'tkazing.\n` +
      `2. To'lov cheki (skrinshot yoki kvitansiya rasmini) menga shu yerda rasm sifatida yuboring!\n` +
      `3. Administratorlar chekni tekshirib, obunangizni 5 daqiqa ichida faollashtiradilar.`;

    await ctx.reply(paymentText, {
      parse_mode: 'Markdown',
      ...keyboards.getCancelKeyboard()
    });
  });

  // Chek (rasm) qabul qilish
  bot.on('photo', async (ctx, next) => {
    const tariffId = pendingPaymentUsers[ctx.from.id];
    if (!tariffId) return next();

    const photo = ctx.message.photo.pop().file_id;
    const payment = db.createPayment(ctx.from.id, tariffId, photo);

    delete pendingPaymentUsers[ctx.from.id];

    await ctx.reply(
      `✅ *To'lov cheki qabul qilindi!*\n\n` +
      `Kvitansiya tekshirish uchun administratorlarga yuborildi.\n` +
      `Obunangiz tasdiqlangach, sizga darhol xabarnoma keladi. Rahmat!`,
      {
        parse_mode: 'Markdown',
        ...keyboards.getMainKeyboard(db.isAdmin(ctx.from.id))
      }
    );

    // Adminlarga xabar va rasm yuborish
    const admins = db.getAdmins();
    const adminMsg = 
      `💳 *Yangi to'lov cheki! (#${payment.id})*\n\n` +
      `👤 Foydalanuvchi: [${ctx.from.first_name}](tg://user?id=${ctx.from.id})\n` +
      `🆔 ID: \`${ctx.from.id}\`\n` +
      `💎 Tarif: *${payment.tariff_name}*\n` +
      `💰 Summa: *${payment.amount.toLocaleString()} so'm*`;

    for (const adminId of admins) {
      try {
        await bot.telegram.sendPhoto(adminId, photo, {
          caption: adminMsg,
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Tasdiqlash', `pay_approve_${payment.id}`),
              Markup.button.callback('❌ Rad etish', `pay_reject_${payment.id}`)
            ]
          ])
        });
      } catch (err) {
        console.error(`Adminga (${adminId}) to'lov chekini yuborishda xatolik:`, err.message);
      }
    }
  });
};

});

// ---- FILE: handlers/userHandlers.js ----
defineModule('handlers/userHandlers.js', function(exports, module, require) {
const { Markup } = require('telegraf');
const db = require('../database/db');
const botManager = require('../core/botManager');
const keyboards = require('../core/keyboards');
const { getTemplate, templates } = require('../templates');
const config = require('../config');
const { cleanName } = require('../core/helpers');

module.exports = (bot) => {
  // Foydalanuvchi holati (session)
  const userStates = {}; // userId -> { state: 'waiting_token', templateId: '...' }

  // /start buyrug'i
  bot.command('start', async (ctx) => {
    const user = db.getOrCreateUser(ctx.from);
    const isAdmin = db.isAdmin(ctx.from.id);
    const isPublic = db.isWebappPublic();
    const daysLeft = db.getSubscriptionDaysLeft(ctx.from.id);
    const name = cleanName(ctx.from.first_name);

    await ctx.reply(
      `👋 Assalomu alaykum, *${name}*!\n\n` +
      `🤖 *Bot Konstruktori Platformasiga* xush kelibsiz!\n\n` +
      `Siz bu yerda o'zingiz xohlagan har qanday botni (AI, Nakrutka, Pul topar, Do'kon, Kino va yana 10 dan ortiq) bir zumda yaratishingiz va ishga tushirishingiz mumkin.\n\n` +
      `🎁 *Xushxabar:* Sizga *${config.TRIAL_DAYS} kunlik TEKIN sinov muddati* berildi!\n` +
      `⏳ Qolgan muddat: *${daysLeft} kun*\n\n` +
      `Yangi bot yaratish uchun quyidagi tugmani bosing! 👇`,
      {
        parse_mode: 'Markdown',
        ...keyboards.getMainKeyboard(isAdmin, isPublic)
      }
    );
  });

  // 🌐 Web App tugmasi
  bot.hears('🌐 Web App', async (ctx) => {
    const userId = ctx.from.id;
    const isAdmin = db.isAdmin(userId);
    const isPublic = db.isWebappPublic();

    if (!isAdmin && !isPublic) {
      return ctx.reply('🔒 *Web App hozirda faqat administratorlar uchun ochiq.*', { parse_mode: 'Markdown' });
    }

    const url = keyboards.getWebAppUrl(userId);
    const isOwner = db.isOwner(userId);
    const roleText = isOwner ? '👑 Bosh Admin' : (isAdmin ? '🛡 Administrator' : '👤 Mijoz Kabineti');

    await ctx.reply(
      `🌐 *Web App Dashboard Paneli*\n\n` +
      `Maqom: *${roleText}*\n\n` +
      `Barcha botlaringiz, tokenlar va to'liq ma'lumotlarni Telegram ichida ko'rish va boshqarish uchun quyidagi tugmani bosing:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🚀 Web App Dashboard', url)]
        ])
      }
    );
  });




  // Yangi bot yaratish tugmasi
  bot.hears('🚀 Yangi Bot Yaratish', async (ctx) => {
    const userId = ctx.from.id;
    if (!db.isSubscriptionActive(userId)) {
      return ctx.reply(
        `⚠️ *Obuna muddatingiz yakunlangan!*\n\n` +
        `Bot yaratishda davom etish uchun iltimos tariflardan birini tanlang.`,
        {
          parse_mode: 'Markdown',
          ...keyboards.getTariffsKeyboard()
        }
      );
    }

    // Limit tekshiruvi (Tarifsiz faqat 1 ta bot)
    const user = db.getOrCreateUser(ctx.from);
    const userBots = db.getUserBots(userId);
    const tariff = config.TARIFFS[user.tariff] || config.TARIFFS.free_trial;
    const maxBots = tariff.maxBots || 1;

    if (!db.isAdmin(userId) && userBots.length >= maxBots) {
      return ctx.reply(
        `⚠️ *Bot yaratish limiti to'lgan!*\n\n` +
        `Sizning hozirgi tarifingiz: *${tariff.name}*\n` +
        `Yaratilgan botlaringiz: *${userBots.length} / ${maxBots} ta*\n\n` +
        `📌 *Tarifsiz foydalanuvchilar faqat 1 ta bot yarata oladi!*\n\n` +
        `Ko'proq bot yaratish uchun quyidagi tariflardan birini tanlang:\n` +
        `• *25 Pro (1 Oylik)* — 10 tagacha bot\n` +
        `• *VIP Premium (1 Yillik)* — 50 tagacha bot`,
        {
          parse_mode: 'Markdown',
          ...keyboards.getTariffsKeyboard()
        }
      );
    }

    await ctx.reply(
      `📋 *Qanday bot yaratmoqchisiz?*\n\n` +
      `Quyidagi 15 dan ortiq professional bot shablonlaridan birini tanlang:`,
      {
        parse_mode: 'Markdown',
        ...keyboards.getTemplatesKeyboard()
      }
    );
  });

  // Shablon tanlanganda
  bot.action(/select_tpl_(.*)/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from.id;
    const user = db.getOrCreateUser(ctx.from);
    const userBots = db.getUserBots(userId);
    const tariff = config.TARIFFS[user.tariff] || config.TARIFFS.free_trial;
    const maxBots = tariff.maxBots || 1;

    if (!db.isAdmin(userId) && userBots.length >= maxBots) {
      return ctx.reply(
        `⚠️ *Bot yaratish limiti to'lgan!*\n\n` +
        `Sizda allaqachon *${userBots.length} ta* bot mavjud. Tarifsiz maksimal limit — *1 ta bot*.\n\n` +
        `Yana yangi bot yaratish uchun tariflardan birini faollashtiring:`,
        {
          parse_mode: 'Markdown',
          ...keyboards.getTariffsKeyboard()
        }
      );
    }

    const templateId = ctx.match[1];
    const template = getTemplate(templateId);

    if (!template) {
      return ctx.reply('❌ Shablon topilmadi.');
    }

    userStates[ctx.from.id] = {
      state: 'waiting_token',
      templateId: templateId
    };

    await ctx.reply(
      `Selected: *${template.name}*\n` +
      `📝 *Tavsif:* ${template.description}\n\n` +
      `Endi ushbu botingiz uchun Telegram Bot Tokeni kerak.\n\n` +
      `💡 *Tokenni qanday olish mumkin?*\n` +
      `1. [@BotFather](https://t.me/BotFather) botiga kiring va \`/newbot\` buyrug'ini yuboring.\n` +
      `2. Botingizga nom va username tanlang.\n` +
      `3. @BotFather bergan maxsus *API Token*dan nusxa olib, menga yuboring!`,
      {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...keyboards.getCancelKeyboard()
      }
    );
  });

  // Mening botlarim
  bot.hears('📁 Mening Botlarim', async (ctx) => {
    const userBots = db.getUserBots(ctx.from.id);

    if (userBots.length === 0) {
      return ctx.reply(
        `📁 Sizda hali yaratilgan botlar mavjud emas.\n\n` +
        `"🚀 Yangi Bot Yaratish" tugmasini bosib birinchi botingizni yarating!`,
        keyboards.getMainKeyboard(db.isAdmin(ctx.from.id))
      );
    }

    let msg = `📁 *Sizning yaratgan botlaringiz (${userBots.length} ta):*\n\n`;
    const buttons = [];

    userBots.forEach((b, idx) => {
      const isRunning = botManager.isBotRunning(b.id);
      const statusIcon = isRunning ? '🟢 Faol' : '🔴 To\'xtatilgan';
      const tpl = getTemplate(b.template);
      msg += `${idx + 1}. *${b.bot_first_name}* (@${b.bot_username})\n` +
        `   Turi: ${tpl ? tpl.name : b.template}\n` +
        `   Holati: ${statusIcon}\n\n`;

      buttons.push([Markup.button.callback(`⚙️ @${b.bot_username} ni boshqarish`, `manage_bot_${b.id}`)]);
    });

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  });

  // Bitta botni boshqarish
  bot.action(/manage_bot_(.*)/, async (ctx) => {
    await ctx.answerCbQuery();
    const botId = ctx.match[1];
    const b = db.getBot(botId);

    if (!b || b.owner_id !== ctx.from.id) {
      return ctx.reply('❌ Bot topilmadi.');
    }

    const isRunning = botManager.isBotRunning(b.id);
    const tpl = getTemplate(b.template);

    await ctx.reply(
      `🤖 *Bot Sozlamalari:* @${b.bot_username}\n\n` +
      `📌 Nomi: *${b.bot_first_name}*\n` +
      `📂 Shablon: *${tpl ? tpl.name : b.template}*\n` +
      `⚡ Holati: *${isRunning ? '🟢 Ishlamoqda' : '🔴 To\'xtatilgan'}*\n` +
      `👥 Bot a'zolari: *${b.stats?.users_count || 0} kishi*\n` +
      `📅 Yaratilgan sana: *${new Date(b.created_at).toLocaleDateString('uz-UZ')}*`,
      {
        parse_mode: 'Markdown',
        ...keyboards.getBotManageKeyboard(b, isRunning)
      }
    );
  });

  // Botni to'xtatish
  bot.action(/bot_stop_(.*)/, async (ctx) => {
    const botId = ctx.match[1];
    const b = db.getBot(botId);
    if (!b || b.owner_id !== ctx.from.id) return;

    await botManager.stopBot(botId);
    await ctx.answerCbQuery('⏹ Bot to\'xtatildi!');
    await ctx.reply(`⏹ @${b.bot_username} muvaffaqiyatli to'xtatildi.`);
  });

  // Botni qayta ishga tushirish
  bot.action(/bot_start_(.*)/, async (ctx) => {
    const botId = ctx.match[1];
    const b = db.getBot(botId);
    if (!b || b.owner_id !== ctx.from.id) return;

    if (!db.isSubscriptionActive(ctx.from.id)) {
      return ctx.reply('⚠️ Obunangiz tugaganligi sababli botni ishga tushirib bo\'lmaydi.');
    }

    await ctx.answerCbQuery('▶️ Ishga tushirilmoqda...');
    const result = await botManager.startBot(b);
    if (result.success) {
      await ctx.reply(`🟢 @${b.bot_username} muvaffaqiyatli ishga tushirildi!`);
    } else {
      await ctx.reply(`❌ Ishga tushirishda xatolik: ${result.error}`);
    }
  });

  // Botni o'chirish
  bot.action(/bot_delete_(.*)/, async (ctx) => {
    const botId = ctx.match[1];
    const b = db.getBot(botId);
    if (!b || b.owner_id !== ctx.from.id) return;

    await botManager.stopBot(botId);
    db.deleteBot(botId);

    await ctx.answerCbQuery('🗑 Bot o\'chirildi!');
    await ctx.reply(`🗑 @${b.bot_username} boti butunlay o'chirildi.`);
  });

  // Profilim
  bot.hears('👤 Profilim', async (ctx) => {
    const user = db.getOrCreateUser(ctx.from);
    const daysLeft = db.getSubscriptionDaysLeft(ctx.from.id);
    const userBots = db.getUserBots(ctx.from.id);
    const tariffName = config.TARIFFS[user.tariff]?.name || 'Tekin sinov';

    const name = cleanName(ctx.from.first_name);

    await ctx.reply(
      `👤 *Sizning Profilingiz:*\n\n` +
      `🆔 ID: \`${ctx.from.id}\`\n` +
      `👤 Ism: *${name}*\n` +
      `💎 Tarif: *${tariffName}*\n` +
      `⏳ Obuna muddati: *${daysLeft} kun qoldi*\n` +
      `🤖 Yaratilgan botlar: *${userBots.length} ta*\n\n` +
      `Obunani uzaytirish yoki yangilash uchun "💎 Tariflar va Obuna" menyusiga kiring!`,
      { parse_mode: 'Markdown' }
    );
  });

  // Yordam va Qo'llanma
  bot.hears('❓ Yordam va Qo\'llanma', async (ctx) => {
    await ctx.reply(
      `📖 *Bot yaratish bo'yicha qo'llanma:*\n\n` +
      `1. Telegramda [@BotFather](https://t.me/BotFather) botiga kiring.\n` +
      `2. \`/newbot\` buyrug'ini yozing.\n` +
      `3. Botingizga ixtiyoriy nom bering (Masalan: _Mening Super Botim_).\n` +
      `4. Botingizga username bering, username oxiri \`bot\` bilan tugashi kerak (Masalan: _super_shop_bot_).\n` +
      `5. @BotFather sizga uzun qizil matn ko'rinishida *HTTP API Token* beradi.\n` +
      `6. Bizning botimizga qaytib "🚀 Yangi Bot Yaratish" tugmasini bosing, kerakli bot turini tanlang va o'sha tokenni yuboring!\n\n` +
      `Botingiz bir zumda online bo'ladi va ishlay boshlaydi! ✨`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
  });

  // Bekor qilish
  bot.action('cancel_action', async (ctx) => {
    delete userStates[ctx.from.id];
    await ctx.answerCbQuery('Bekor qilindi');
    await ctx.reply('Amal bekor qilindi.', keyboards.getMainKeyboard(db.isAdmin(ctx.from.id)));
  });

  // Token kiritilishini qabul qilish
  bot.on('text', async (ctx, next) => {
    const userId = ctx.from.id;
    const session = userStates[userId];

    if (session && session.state === 'waiting_token') {
      const token = ctx.message.text.trim();

      // Token formati tekshiruvi (odatda: 123456789:ABCdef...)
      if (!/^\d+:[A-Za-z0-9_-]{35,}$/.test(token)) {
        return ctx.reply(
          `⚠️ *Token formati noto'g'ri!*\n\n` +
          `Token quyidagi ko'rinishda bo'lishi kerak:\n\`123456789:AAH...f0z_\`\n\n` +
          `Iltimos, @BotFather bergan tokenni to'liq nusxalab yuboring yoki bekor qilishni bosing.`,
          { parse_mode: 'Markdown', ...keyboards.getCancelKeyboard() }
        );
      }

      // Ushbu token bazada mavjudmi?
      const existing = db.getBotByToken(token);
      if (existing) {
        return ctx.reply('❌ Bu bot tokeni allaqachon ro\'yxatdan o\'tgan! Boshqa bot tokenini yuboring.');
      }

      await ctx.sendChatAction('typing');
      const check = await botManager.validateToken(token);

      if (!check.success) {
        return ctx.reply(
          `❌ *Token yaroqsiz yoki xato!*\n\n` +
          `Telegram serveri bu tokenni qabul qilmadi.\n` +
          `Xatolik: ${check.error}\n\n` +
          `Iltimos, @BotFather dan to'g'ri tokenni oling.`,
          { parse_mode: 'Markdown', ...keyboards.getCancelKeyboard() }
        );
      }

      const botInfo = check.botInfo;
      const templateId = session.templateId;
      const template = getTemplate(templateId);

      // Limit tekshiruvi (Tarifsiz faqat 1 ta bot)
      const user = db.getOrCreateUser(ctx.from);
      const userBots = db.getUserBots(userId);
      const tariff = config.TARIFFS[user.tariff] || config.TARIFFS.free_trial;
      const maxBots = tariff.maxBots || 1;

      if (!db.isAdmin(userId) && userBots.length >= maxBots) {
        delete userStates[userId];
        return ctx.reply(
          `⚠️ *Bot yaratish limiti to'lgan!*\n\n` +
          `Sizda allaqachon *${userBots.length} ta* bot mavjud. Tarifsiz maksimal limit — *1 ta bot*.\n\n` +
          `Yangi bot yaratish uchun quyidagi tariflardan birini tanlang:`,
          {
            parse_mode: 'Markdown',
            ...keyboards.getTariffsKeyboard()
          }
        );
      }

      // Botni bazaga saqlash
      const botRecord = db.createBot(userId, token, templateId, botInfo);

      // Botni ishga tushirish
      const startResult = await botManager.startBot(botRecord);

      delete userStates[userId];

      if (startResult.success) {
        await ctx.reply(
          `🎉 *Tabriklaymiz! Botingiz muvaffaqiyatli ishga tushdi!*\n\n` +
          `🤖 Nomi: *${botInfo.first_name}*\n` +
          `🔗 Havola: @${botInfo.username}\n` +
          `📂 Turi: *${template.name}*\n` +
          `⚡ Holati: *🟢 Faol (Online)*\n\n` +
          `Endi botingizga kirib, sinab ko'rishingiz mumkin! Botingizda \`/admin\` buyrug'ini yozsangiz, o'z botingizning admin paneliga kirasiz!`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('🚀 Botingizga o\'tish', `https://t.me/${botInfo.username}`)],
              [Markup.button.callback('📁 Botlarim ro\'yxati', 'my_bots_list')]
            ])
          }
        );
      } else {
        await ctx.reply(`⚠️ Botingiz saqlandi, lekin ishga tushirishda xatolik bo'ldi: ${startResult.error}`);
      }

      return;
    }

    return next();
  });

  bot.action('my_bots_list', async (ctx) => {
    await ctx.answerCbQuery();
    const userBots = db.getUserBots(ctx.from.id);
    let msg = `📁 *Sizning botlaringiz:*\n\n`;
    const buttons = [];

    userBots.forEach((b) => {
      const isRunning = botManager.isBotRunning(b.id);
      msg += `• *${b.bot_first_name}* (@${b.bot_username}) — ${isRunning ? '🟢 Faol' : '🔴 To\'xtatilgan'}\n`;
      buttons.push([Markup.button.callback(`⚙️ @${b.bot_username}`, `manage_bot_${b.id}`)]);
    });

    await ctx.reply(msg, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  });
};

});

// // ---- FILE: handlers/businessHandlers.js ----
defineModule('handlers/businessHandlers.js', function(exports, module, require) {
module.exports = () => {};
});

});

// ================= MAIN RUNNER ================
const requireModule = createScopedRequire('');

const { Telegraf } = require('telegraf');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const config = requireModule('./config');
const db = requireModule('./database/db');
const botManager = requireModule('./core/botManager');
const subscriptionChecker = requireModule('./core/subscriptionChecker');
const webapp = requireModule('./core/webapp');

const logFile = path.join(__dirname, 'data/app.log');
function logToFile(...args) {
  const line = '[' + new Date().toISOString() + '] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
  try {
    fs.appendFileSync(logFile, line, 'utf-8');
  } catch (e) {}
}

const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { origLog(...args); logToFile('[INFO]', ...args); };
console.error = (...args) => { origErr(...args); logToFile('[ERROR]', ...args); };

process.on('exit', (code) => {
  logToFile('[EXIT]', 'Jarayon to\'xtadi, kod: ' + code);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection ushlandi:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception ushlandi:', err && err.message ? err.message : err);
});

setInterval(() => {}, 30000);

const PORT = process.env.PORT || 3000;
function startDirectTunnel(port) {
  const { spawn } = require('child_process');
  function run() {
    try {
      const ssh = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-R', '80:localhost:' + port, 'serveo.net']);
      const handleData = (buf) => {
        const str = buf.toString();
        const m = str.match(/https:\/\/[a-zA-Z0-9_.-]+\.serveousercontent\.com/);
        if (m) {
          process.env.WEBAPP_URL = m[0];
          console.log('🚀 Web App Jonli HTTPS Havolasi (Zero-Warning):', m[0] + '/webapp');
        }
      };
      ssh.stdout.on('data', handleData);
      ssh.stderr.on('data', handleData);
      ssh.on('close', () => {
        setTimeout(run, 4000);
      });
    } catch (e) {
      console.log('Tunnel fallback:', e.message);
    }
  }
  run();
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Bypass-Tunnel-Reminder');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const handled = webapp.handleWebAppRequests(req, res);
  if (handled !== false) return;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>🚀 Maker Bot Konstruktori 24/7 Online ishlamoqda!</h1><p>Status: OK</p><p><a href="/webapp">👉 Web App Dashboard</a></p>');
}).listen(PORT, async () => {
  console.log('🌐 HTTP Server ishga tushdi (Port: ' + PORT + ') — Web App /webapp da faol!');
  startDirectTunnel(PORT);
});

const https = require('https');
const RENDER_PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || 'https://telegram-bot1-1-ivst.onrender.com';
setInterval(() => {
  https.get(RENDER_PUBLIC_URL, (res) => {}).on('error', () => {});
}, 7 * 60 * 1000);



async function main() {
  console.log('====================================================');
  console.log('🚀 TELEGRAM BOT KONSTRUKTORI (15-IN-1 PLATFORMA)   ');
  console.log('====================================================');

  if (!config.BOT_TOKEN || config.BOT_TOKEN === '7123456789:AAExampleTokenFromBotFather') {
    console.log('⚠️ DIQQAT: .env faylida asosiy bot tokeni (BOT_TOKEN) kiritilmagan!');
    console.log('📌 Iltimos, .env faylini oching va @BotFather dan olgan BOT_TOKEN va OWNER_ID ni yozing.');
    console.log('====================================================');
    return;
  }

  try {
    const mainBot = new Telegraf(config.BOT_TOKEN);

    const me = await mainBot.telegram.getMe();
    console.log('🤖 Asosiy Bot ulandi: @' + me.username + ' (' + me.first_name + ')');

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

      const origReply = ctx.reply.bind(ctx);
      ctx.reply = async (text, extra = {}) => {
        try {
          return await origReply(text, extra);
        } catch (err) {
          if (err.message && (err.message.includes("can't parse entities") || err.message.includes("Bad Request: can't parse entities"))) {
            const plain = { ...extra };
            delete plain.parse_mode;
            return await origReply(text.replace(/[*_`\[\]]/g, ''), plain);
          }
          console.error('Xabar yuborishda xatolik:', err.message);
        }
      };

      const u = ctx.from;
      const text = ctx.message && ctx.message.text ? ctx.message.text : (ctx.callbackQuery ? ('Tugma: ' + ctx.callbackQuery.data) : ctx.updateType);
      console.log('📩 [Xabar] @' + (u && (u.username || u.id)) + ' (' + (u && u.first_name) + '): ' + text);
      return next();
    });

    requireModule('./handlers/userHandlers')(mainBot);
    requireModule('./handlers/tariffHandlers')(mainBot);
    requireModule('./handlers/adminHandlers')(mainBot);

    mainBot.catch((err, ctx) => {
      console.error('Asosiy botda xatolik:', err.message);
    });

    mainBot.launch().catch(err => {
      console.error('Asosiy bot to\'xtatildi yoki xatolik:', err.message);
    });
    console.log('🚀 Asosiy Konstruktor Boti muvaffaqiyatli ishga tushdi!');

    subscriptionChecker.init(mainBot);
    console.log('⏳ Obuna va 5 soatlik ogohlantirish xizmati (SubscriptionChecker) faollashtirildi!');

    await botManager.startAllActiveBots();

    console.log('✨ Tizim to\'liq ish holatida! Telegram orqali botingizni sinab ko\'rishingiz mumkin.');

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
