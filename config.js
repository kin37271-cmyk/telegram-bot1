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
