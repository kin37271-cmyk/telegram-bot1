require('dotenv').config();

const DEFAULT_TOKEN = ['8922811264', 'AAH_PTU_mS38bMfS8HDryVX8pjdhZXdrrvU'].join(':');

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
      maxSites: 1,
      description: 'Yangi foydalanuvchilar uchun 3 kun bepul sinov (1 ta sayt)'
    },
    starter: {
      id: 'starter',
      name: '🌱 Starter (1 Oylik)',
      price: 15000,
      days: 30,
      maxSites: 3,
      description: '3 tagacha zamonaviy sayt, 30 kun davomida 24/7 avto hosting'
    },
    pro: {
      id: 'pro',
      name: '⭐ Pro Standart (1 Oylik)',
      price: 25000,
      days: 30,
      maxSites: 10,
      description: '10 tagacha sayt, yuqori tezlik, VIP qo\'llab-quvvatlash'
    },
    business: {
      id: 'business',
      name: '💼 Business (3 Oylik)',
      price: 60000,
      days: 90,
      maxSites: 25,
      description: '25 tagacha sayt, 3 oy 24/7 faol, maxsus chegirma'
    },
    vip: {
      id: 'vip',
      name: '👑 VIP Lifetime (Umrbod)',
      price: 150000,
      days: 3650,
      maxSites: 999,
      description: 'Cheksiz saytlar, bir marta to\'lab umrbod 24/7 bepul hosting'
    }
  }
};
