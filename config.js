require('dotenv').config();

const DEFAULT_TOKEN = ['8922811264', 'AAHbvuy-_bTYszkTFIMOrFQ_Vh7TPbu1zSs'].join(':');

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN || DEFAULT_TOKEN,
  OWNER_ID: parseInt(process.env.OWNER_ID || '8422157752', 10),
  CARD_NUMBER: process.env.CARD_NUMBER || '6262 7201 2331 5395',
  CARD_HOLDER: process.env.CARD_HOLDER || '@ismoiluzb022',
  PORT: process.env.PORT || 10000,
  BASE_URL: process.env.RENDER_EXTERNAL_URL || 'https://telegram-bot-maker-live.onrender.com',

  // Sinov muddati (kun)
  TRIAL_DAYS: 3,

  // Tariflar
  TARIFFS: {
    trial: {
      id: 'trial',
      name: '🎁 3 Kunlik Bepul Sinov',
      price: 0,
      days: 3,
      maxBots: 1,
      maxSites: 1,
      description: 'Oddiy mijozlar uchun 3 kun bepul sinov (1 ta bot & 1 ta sayt)'
    },
    starter: {
      id: 'starter',
      name: '🌱 Starter (1 Oylik)',
      price: 15000,
      days: 30,
      maxBots: 3,
      maxSites: 3,
      description: '3 tagacha Telegram bot & 3 ta sayt, 30 kun 24/7 avto hosting'
    },
    pro: {
      id: 'pro',
      name: '⭐ Pro Standart (1 Oylik)',
      price: 25000,
      days: 30,
      maxBots: 10,
      maxSites: 10,
      description: '10 tagacha bot & 10 ta sayt, yuqori tezlik, VIP qo\'llab-quvvatlash'
    },
    business: {
      id: 'business',
      name: '💼 Business (3 Oylik)',
      price: 60000,
      days: 90,
      maxBots: 25,
      maxSites: 25,
      description: '25 tagacha bot & 25 ta sayt, 3 oy 24/7 faol, maxsus chegirma'
    },
    vip: {
      id: 'vip',
      name: '👑 VIP Lifetime (Umrbod)',
      price: 150000,
      days: 3650,
      maxBots: 999,
      maxSites: 999,
      description: 'Cheksiz botlar va saytlar, bir marta to\'lab umrbod 24/7 bepul hosting'
    }
  }
};
