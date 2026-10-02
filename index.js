require('dotenv').config();
const { startServer } = require('./server');
const { startBot } = require('./bot');

console.log('========================================================');
console.log('🚀 MAKER BOT PLATFORM (20-IN-1 SAYT KONSTRUKTORI)');
console.log('⚡ 24/7 Avto Hosting, Web App & To\'liq Admin Paneli');
console.log('========================================================');

// 1. HTTP Web Serverni ishga tushirish (Web App + 24/7 Saytlar)
startServer();

// 2. Telegram Botni ishga tushirish (@MakerrUzbBot)
startBot();

process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));
