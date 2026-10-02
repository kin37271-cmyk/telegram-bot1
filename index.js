require('dotenv').config();
const { startServer } = require('./server');
const { startBot } = require('./bot');
const botManager = require('./services/botManager');

console.log('========================================================');
console.log('🚀 MAKER BOT PLATFORM (20-IN-1 SAYT & TELEGRAM BOT)');
console.log('⚡ 24/7 Avto Hosting, Web App & To\'liq Admin Paneli');
console.log('========================================================');

// 1. HTTP Web Serverni ishga tushirish (Web App + 24/7 Saytlar)
startServer();

// 2. Asosiy Telegram Botni ishga tushirish (@MakerrUzbBot)
startBot();

// 3. Foydalanuvchilarning barcha faol botlarini 24/7 ishga tushirish
setTimeout(() => {
  botManager.startAllActiveBots();
}, 2000);

process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));
