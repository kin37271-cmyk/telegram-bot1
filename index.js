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

function resolveLocalPath(currentDir, reqPath) {
  if (!reqPath.startsWith('.')) return reqPath;
  let resolved = path.join(currentDir, reqPath).replace(/\\/g, '/');
  if (resolved.startsWith('/')) resolved = resolved.slice(1);
  if (_modules[resolved]) return resolved;
  if (_modules[resolved + '.js']) return resolved + '.js';
  if (_modules[resolved + '/index.js']) return resolved + '/index.js';
  if (_modules[resolved + '/index']) return resolved + '/index';
  return resolved;
}

function createScopedRequire(currentDir) {
  return function(modulePath) {
    if (modulePath.startsWith('.')) {
      const resolved = resolveLocalPath(currentDir, modulePath);
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
  BOT_TOKEN: process.env.BOT_TOKEN || '8922811264:AAGCWrjrt38U2zRq_f5ZIppgIFHSDg5AjJ8',

  // Asosiy Ega (Owner) Telegram ID si
  OWNER_ID: process.env.OWNER_ID ? parseInt(process.env.OWNER_ID) : 8422157752,

  // To'lov rekvizitlari (Karta raqami va egasi)
  CARD_NUMBER: process.env.CARD_NUMBER || '6262720123315395',
  CARD_HOLDER: process.env.CARD_HOLDER || '@ismoiluzb022',

  // OpenAI API Key (ixtiyoriy, agar bo'lmasa aqlli bepul AI ishlaydi)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',

  // Tariflar
  TRIAL_DAYS: 7, // 7 kunlik tekin sinov
  TARIFFS: {
    free_trial: {
      id: 'free_trial',
      name: '🎁 7 Kunlik Bepul Sinov',
      price: 0,
      days: 7,
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
defineModule('config', _modules['config.js']);

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
        trial_ends_at: trialEnds.toISOString(),
        subscription_ends_at: trialEnds.toISOString(),
        status: 'active'
      };
      this.save();
    } else {
      // Ismi yoki username yangilangan bo'lsa yangilab qo'yamiz
      let updated = false;
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
}

module.exports = new Database();

});
defineModule('database/db', _modules['database/db.js']);

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
defineModule('core/helpers', _modules['core/helpers.js']);

// ---- FILE: core/keyboards.js ----
defineModule('core/keyboards.js', function(exports, module, require) {
const { Markup } = require('telegraf');
const { templates } = require('../templates');
const config = require('../config');

module.exports = {
  // Asosiy foydalanuvchi menyusi
  getMainKeyboard: (isAdmin = false) => {
    const buttons = [
      ['🚀 Yangi Bot Yaratish', '📁 Mening Botlarim'],
      ['💎 Tariflar va Obuna', '👤 Profilim'],
      ['❓ Yordam va Qo\'llanma']
    ];

    if (isAdmin) {
      buttons.push(['👑 Admin Panel']);
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
      [Markup.button.callback('🎁 7 Kunlik Bepul Sinov', 'tariff_free_trial')],
      [Markup.button.callback('🌱 Starter (1 Oylik) — 15,000 so\'m', 'tariff_starter')],
      [Markup.button.callback('⭐ 25 Pro (1 Oylik) — 25,000 so\'m', 'tariff_pro_month')],
      [Markup.button.callback('💼 Business (3 Oylik) — 60,000 so\'m', 'tariff_business_3m')],
      [Markup.button.callback('👑 VIP Premium (1 Yillik) — 150,000 so\'m', 'tariff_vip_year')],
      [Markup.button.callback('♾ Cheksiz Umrbod (Lifetime) — 300,000 so\'m', 'tariff_unlimited_forever')],
      [Markup.button.callback('⬅️ Orqaga', 'cancel_action')]
    ]);
  },

  // Admin panel asosiy menyusi
  getAdminKeyboard: (isOwner = false) => {
    const buttons = [
      [Markup.button.callback('📊 Statistika', 'admin_stats'), Markup.button.callback('🤖 Mijoz Botlari', 'admin_bots')],
      [Markup.button.callback('💳 To\'lov so\'rovlari', 'admin_payments'), Markup.button.callback('📢 Xabar tarqatish (Rassilka)', 'admin_broadcast')]
    ];

    if (isOwner) {
      buttons.push([Markup.button.callback('👥 Adminlarni boshqarish', 'admin_manage_admins')]);
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
defineModule('core/keyboards', _modules['core/keyboards.js']);

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
defineModule('templates/ai', _modules['templates/ai.js']);

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
defineModule('templates/anonim', _modules['templates/anonim.js']);

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
defineModule('templates/autopost', _modules['templates/autopost.js']);

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
defineModule('templates/currency', _modules['templates/currency.js']);

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
defineModule('templates/custom_buttons', _modules['templates/custom_buttons.js']);

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
defineModule('templates/feedback', _modules['templates/feedback.js']);

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
defineModule('templates/kino', _modules['templates/kino.js']);

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
defineModule('templates/moderator', _modules['templates/moderator.js']);

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
defineModule('templates/nakrutka', _modules['templates/nakrutka.js']);

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
defineModule('templates/namoz', _modules['templates/namoz.js']);

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
defineModule('templates/pul_topar', _modules['templates/pul_topar.js']);

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
defineModule('templates/quiz', _modules['templates/quiz.js']);

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
defineModule('templates/quotes', _modules['templates/quotes.js']);

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
defineModule('templates/shop', _modules['templates/shop.js']);

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
defineModule('templates/tools', _modules['templates/tools.js']);

// ---- FILE: templates/translator.js ----
defineModule('templates/translator.js', function(exports, module, require) {
const axios = require('axios');
const { Markup } = require('telegraf');

module.exports = {
  id: 'translator',
  name: '🌐 Tarjimon Boti',
  description: 'Matnlarni O\'zbek, Rus, Ingliz, Turk tillariga bir zumda tarjima qiluvchi aqlli bot',
  icon: '🌐',
  setupBot: (bot, botRecord, db) => {
    const userModes = {}; // userId -> 'uz-en', 'en-uz', 'uz-ru', 'ru-uz'

    const langKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🇺🇿 O\'zbekcha ➡️ 🇬🇧 Inglizcha', 'lang_uz_en'), Markup.button.callback('🇬🇧 Inglizcha ➡️ 🇺🇿 O\'zbekcha', 'lang_en_uz')],
      [Markup.button.callback('🇺🇿 O\'zbekcha ➡️ 🇷🇺 Ruscha', 'lang_uz_ru'), Markup.button.callback('🇷🇺 Ruscha ➡️ 🇺🇿 O\'zbekcha', 'lang_ru_uz')],
      [Markup.button.callback('🇺🇿 O\'zbekcha ➡️ 🇹🇷 Turkcha', 'lang_uz_tr'), Markup.button.callback('🇹🇷 Turkcha ➡️ 🇺🇿 O\'zbekcha', 'lang_tr_uz')]
    ]);

    bot.command('start', async (ctx) => {
      db.updateBotData(botRecord.id, (b) => {
        b.stats.users_count = (b.stats.users_count || 0) + 1;
      });

      userModes[ctx.from.id] = userModes[ctx.from.id] || 'uz_en';

      await ctx.reply(
        `👋 Assalomu alaykum, *${ctx.from.first_name}*!\n\n` +
        `🌐 *${botRecord.bot_first_name}* xush kelibsiz!\n\n` +
        `Matn yuboring, men uni darhol tarjima qilib beraman.\n` +
        `Hozirgi tarjima yo'nalishi: *🇺🇿 O'zbekcha ➡️ 🇬🇧 Inglizcha*\n\n` +
        `Yo'nalishni o'zgartirish uchun quyidagi tugmalardan birini bosing:`,
        { parse_mode: 'Markdown', ...langKeyboard }
      );
    });

    bot.action(/lang_(.*)/, async (ctx) => {
      const mode = ctx.match[1];
      userModes[ctx.from.id] = mode;
      await ctx.answerCbQuery('✅ Tarjima yo\'nalishi o\'zgartirildi!');
      
      const labels = {
        'uz_en': '🇺🇿 O\'zbekcha ➡️ 🇬🇧 Inglizcha',
        'en_uz': '🇬🇧 Inglizcha ➡️ 🇺🇿 O\'zbekcha',
        'uz_ru': '🇺🇿 O\'zbekcha ➡️ 🇷🇺 Ruscha',
        'ru_uz': '🇷🇺 Ruscha ➡️ 🇺🇿 O\'zbekcha',
        'uz_tr': '🇺🇿 O\'zbekcha ➡️ 🇹🇷 Turkcha',
        'tr_uz': '🇹🇷 Turkcha ➡️ 🇺🇿 O\'zbekcha'
      };

      await ctx.reply(`🔄 Yangi yo'nalish: *${labels[mode] || mode}*\nEndi matn yuboring!`, { parse_mode: 'Markdown' });
    });

    bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      if (text.startsWith('/')) return;

      const mode = userModes[ctx.from.id] || 'uz_en';
      const [source, target] = mode.split('_');

      await ctx.sendChatAction('typing');

      try {
        // MyMemory bepul tarjima API si
        const res = await axios.get(`https://api.mymemory.translated.net/get`, {
          params: {
            q: text,
            langpair: `${source}|${target}`
          },
          timeout: 10000
        });

        const translated = res.data?.responseData?.translatedText || 'Tarjima qilib bo\'lmadi';
        await ctx.reply(
          `🌐 *Tarjima:* \n\n${translated}`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Yo\'nalishni o\'zgartirish', 'change_lang_prompt')]
            ])
          }
        );
      } catch (err) {
        await ctx.reply(`⚠️ Tarjimada xatolik yuz berdi. Iltimos qayta urinib ko'ring.`);
      }
    });

    bot.action('change_lang_prompt', async (ctx) => {
      await ctx.answerCbQuery();
      await ctx.reply('Tarjima yo\'nalishini tanlang:', langKeyboard);
    });

    bot.command('admin', async (ctx) => {
      if (ctx.from.id !== botRecord.owner_id && !db.isAdmin(ctx.from.id)) {
        return ctx.reply('⛔ Siz bu botning egasi emassiz.');
      }
      await ctx.reply(`👑 *Tarjimon Boti — Admin Paneli*\n\nBot barqaror ishlamoqda.`, { parse_mode: 'Markdown' });
    });
  }
};

});
defineModule('templates/translator', _modules['templates/translator.js']);

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
defineModule('templates/weather', _modules['templates/weather.js']);

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
defineModule('templates/index', _modules['templates/index.js']);

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
defineModule('core/botManager', _modules['core/botManager.js']);

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
    const stats = db.getStats();

    await ctx.reply(
      `👑 *Asosiy Administrator Paneli*\n\n` +
      `Sizning maqomingiz: *${isOwner ? '👑 Bosh Admin (Ega)' : '🛡 Yordamchi Admin'}*\n\n` +
      `Quyidagi boshqaruv bo'limlaridan birini tanlang:`,
      {
        parse_mode: 'Markdown',
        ...keyboards.getAdminKeyboard(isOwner)
      }
    );
  };

  bot.hears('👑 Admin Panel', openAdminPanel);
  bot.command('admin', openAdminPanel);

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
defineModule('handlers/adminHandlers', _modules['handlers/adminHandlers.js']);

// ---- FILE: handlers/tariffHandlers.js ----
defineModule('handlers/tariffHandlers.js', function(exports, module, require) {
const { Markup } = require('telegraf');
const db = require('../database/db');
const keyboards = require('../core/keyboards');
const config = require('../config');

module.exports = (bot) => {
  const pendingPaymentUsers = {}; // userId -> tariffId

  // Tariflar bo'limi
  bot.hears('💎 Tariflar va Obuna', async (ctx) => {
    const user = db.getOrCreateUser(ctx.from);
    const daysLeft = db.getSubscriptionDaysLeft(ctx.from.id);

    const text = 
      `💎 *Tariflar va Obuna Rejalari:*\n\n` +
      `Sizning hozirgi holatingiz: *${config.TARIFFS[user.tariff]?.name || 'Tekin sinov'}*\n` +
      `Qolgan muddat: *${daysLeft} kun*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎁 *1. 7 Kunlik Bepul Sinov*\n` +
      `• Narxi: *0 so'm (Mutlaqo Bepul)*\n` +
      `• Muddat: 7 kun\n` +
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
  });

  // Tarif tanlanganda
  bot.action(/tariff_(.*)/, async (ctx) => {
    await ctx.answerCbQuery();
    const tariffId = ctx.match[1];

    if (tariffId === 'free_trial') {
      const user = db.getUser(ctx.from.id);
      return ctx.reply(
        `🎁 *7 Kunlik Tekin Sinov*\n\n` +
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
defineModule('handlers/tariffHandlers', _modules['handlers/tariffHandlers.js']);

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
        ...keyboards.getMainKeyboard(isAdmin)
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
defineModule('handlers/userHandlers', _modules['handlers/userHandlers.js']);

// ================= MAIN RUNNER ================
const requireModule = createScopedRequire('');

const { Telegraf } = require('telegraf');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const config = requireModule('./config');
const db = requireModule('./database/db');
const botManager = requireModule('./core/botManager');

const logFile = path.join(__dirname, 'data/app.log');
function logToFile(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') + '\n';
  try {
    fs.appendFileSync(logFile, line, 'utf-8');
  } catch (e) {}
}

const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { origLog(...args); logToFile('[INFO]', ...args); };
console.error = (...args) => { origErr(...args); logToFile('[ERROR]', ...args); };

process.on('exit', (code) => {
  logToFile('[EXIT]', `Jarayon to'xtadi, kod: ${code}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection ushlandi:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception ushlandi:', err?.message || err);
});

// Event loopni hech qachon o'chib qolmasligi uchun doimiy yurak urishi (Keep-alive heartbeat)
setInterval(() => {}, 30000);

// Render.com va bulutli hostinglar uchun HTTP server (Port bind)
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>🚀 Maker Bot Konstruktori 24/7 Online ishlamoqda!</h1><p>Status: OK</p>');
}).listen(PORT, () => {
  console.log(`🌐 HTTP Server ishga tushdi (Port: ${PORT}) — Render.com ga to'liq tayyor!`);
});

// Render.com tekin rejimda hech qachon uxlab qolmasligi uchun avtomatik o'z-o'zini uyg'otish (Keep-Alive Ping)
const https = require('https');
const RENDER_PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || 'https://telegram-bot1-1-ivst.onrender.com';
setInterval(() => {
  https.get(RENDER_PUBLIC_URL, (res) => {
    // Har 7 daqiqada so'rov yuborib, Render 15 daqiqalik uyqu taymerini yangilab turadi
  }).on('error', () => {});
}, 7 * 60 * 1000);

async function main() {
  console.log('====================================================');
  console.log('🚀 TELEGRAM BOT KONSTRUKTORI (15-IN-1 PLATFORMA)   ');
  console.log('====================================================');

  if (!config.BOT_TOKEN || config.BOT_TOKEN === '7123456789:AAExampleTokenFromBotFather') {
    console.log('⚠️ DIQQAT: .env faylida asosiy bot tokeni (BOT_TOKEN) kiritilmagan!');
    console.log('📌 Iltimos, .env faylini oching va @BotFather dan olgan BOT_TOKEN va OWNER_ID ni yozing.');
    console.log('👉 Misol:');
    console.log('   BOT_TOKEN=123456789:AAHxxxxxxxxxxxxxxxxxxxx');
    console.log('   OWNER_ID=123456789');
    console.log('====================================================');
    console.log('Tizim token kiritilishini kutmoqda...');
    return;
  }

  try {
    const mainBot = new Telegraf(config.BOT_TOKEN);

    // Asosiy bot ma'lumotlarini olish
    const me = await mainBot.telegram.getMe();
    console.log(`🤖 Asosiy Bot ulandi: @${me.username} (${me.first_name})`);

    // Xavfsiz callback query va log middleware
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

      // Xavfsiz xabar yuborish (parse_mode Markdown xatosi bo'lsa avtomatik toza matnda yuboradi)
      const origReply = ctx.reply.bind(ctx);
      ctx.reply = async (text, extra = {}) => {
        try {
          return await origReply(text, extra);
        } catch (err) {
          if (err.message && err.message.includes("can't parse entities")) {
            const plain = { ...extra };
            delete plain.parse_mode;
            return await origReply(text.replace(/[*_`\[\]]/g, ''), plain);
          }
          console.error('Xabar yuborishda xatolik:', err.message);
        }
      };

      const u = ctx.from;
      const text = ctx.message?.text || (ctx.callbackQuery ? `Tugma: ${ctx.callbackQuery.data}` : ctx.updateType);
      console.log(`📩 [Xabar] @${u?.username || u?.id} (${u?.first_name}): ${text}`);
      return next();
    });

    // Handlerlarni ulash
    requireModule('./handlers/userHandlers')(mainBot);
    requireModule('./handlers/tariffHandlers')(mainBot);
    requireModule('./handlers/adminHandlers')(mainBot);

    // Xatoliklarni ushlash
    mainBot.catch((err, ctx) => {
      console.error('Asosiy botda xatolik:', err.message);
    });

    // Asosiy botni ishga tushirish (fondagi polling)
    mainBot.launch().catch(err => {
      console.error('Asosiy bot to\'xtatildi yoki xatolik:', err.message);
    });
    console.log('🚀 Asosiy Konstruktor Boti muvaffaqiyatli ishga tushdi!');

    // Bazadagi barcha mijoz botlarini fonda ishga tushirish
    await botManager.startAllActiveBots();

    console.log('✨ Tizim to\'liq ish holatida! Telegram orqali botingizni sinab ko\'rishingiz mumkin.');

    // To'xtatish signallari
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
