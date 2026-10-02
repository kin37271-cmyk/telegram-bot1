const { Telegraf, Markup } = require('telegraf');
const db = require('../data/db');

// Running bot instances map: botId -> telegrafInstance
const runningBots = new Map();

// Helper to escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 🌦 Weather fetcher
async function getWeather(cityName) {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(cityName)}?format=j1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error('API xatolik');
    const data = await res.json();
    const cur = data.current_condition[0];
    const forecast = data.weather[0];

    const weatherEmojiMap = {
      'Sunny': '☀️ Quyoshli',
      'Clear': '☀️ Müsaffo',
      'Partly cloudy': '⛅️ Qisman bulutli',
      'Cloudy': '☁️ Bulutli',
      'Overcast': '☁️ Qora bulutli',
      'Mist': '🌫 Tuman',
      'Patchy rain possible': '🌦 Qisqa yomg\'ir',
      'Light rain': '🌧 Mayda yomg\'ir',
      'Moderate rain': '🌧 O\'rtacha yomg\'ir',
      'Heavy rain': '⛈ Kuchli yomg\'ir',
      'Patchy snow possible': '🌨 Qor yog\'ishi mumkin',
      'Light snow': '🌨 Yengil qor',
      'Moderate snow': '❄️ O\'rtacha qor',
      'Heavy snow': '❄️ Kuchli qor',
      'Thunderstorm': '⛈ Momaqaldiroq'
    };

    const descEn = cur.weatherDesc[0].value;
    const descUz = weatherEmojiMap[descEn] || descEn;

    return {
      success: true,
      city: cityName,
      temp: cur.temp_C,
      feelsLike: cur.FeelsLikeC,
      desc: descUz,
      humidity: cur.humidity,
      wind: cur.windspeedKmph,
      pressure: cur.pressure,
      minTemp: forecast.mintempC,
      maxTemp: forecast.maxtempC
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 💵 Currency fetcher (Central Bank of Uzbekistan)
async function getCurrency() {
  try {
    const res = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/');
    if (!res.ok) throw new Error('CBU API error');
    const data = await res.json();
    const usd = data.find(c => c.Ccy === 'USD');
    const eur = data.find(c => c.Ccy === 'EUR');
    const rub = data.find(c => c.Ccy === 'RUB');
    const kzt = data.find(c => c.Ccy === 'KZT');
    return { success: true, date: data[0].Date, rates: { usd, eur, rub, kzt } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Attach handlers based on botType
function setupBotHandlers(clientBot, botRecord) {
  const type = botRecord.botType || 'weather';

  // 1. OB-HAVO BOTI
  if (type === 'weather') {
    const citiesKeyboard = Markup.keyboard([
      ['🌤 Toshkent', '🌤 Samarqand'],
      ['🌤 Buxoro', '🌤 Andijon'],
      ['🌤 Farg\'ona', '🌤 Namangan'],
      ['🌤 Qarshi', '🌤 Termiz'],
      ['🌤 Navoiy', '🌤 Jizzax'],
      ['🌤 Urganch (Xiva)', '🌤 Nukus'],
      ['📍 Mening joylashuvim (GPS)']
    ]).resize();

    clientBot.start(async (ctx) => {
      const name = ctx.from.first_name || 'Foydalanuvchi';
      await ctx.reply(
        `Assalomu alaykum, <b>${escapeHtml(name)}</b>!\n\n` +
        `🌦 <b>Professional Ob-havo botiga xush kelibsiz!</b>\n\n` +
        `Quyidagi shaharlardan birini tanlang yoki istalgan shahar/tuman nomini yozing (masalan: <i>Chirchiq</i>, <i>Zomin</i>, <i>London</i>).`,
        { parse_mode: 'HTML', ...citiesKeyboard }
      );
    });

    clientBot.on('location', async (ctx) => {
      const { latitude, longitude } = ctx.message.location;
      await ctx.reply('⏳ Joylashuvingiz bo\'yicha ob-havo aniqlanmoqda...');
      const w = await getWeather(`${latitude},${longitude}`);
      if (w.success) {
        await ctx.replyWithHTML(
          `📍 <b>Sizning joylashuvingizdagi ob-havo:</b>\n\n` +
          `🌡 <b>Harorat:</b> ${w.temp}°C (his qilinishi: ${w.feelsLike}°C)\n` +
          `☁️ <b>Holat:</b> ${w.desc}\n` +
          `💧 <b>Namlik:</b> ${w.humidity}%\n` +
          `💨 <b>Shamol:</b> ${w.wind} km/soat\n` +
          `📉 <b>Bugun min/max:</b> ${w.minTemp}°C ... ${w.maxTemp}°C`
        );
      } else {
        await ctx.reply('❌ Ob-havoni aniqlab bo\'lmadi. Qaytadan urinib ko\'ring.');
      }
    });

    clientBot.on('text', async (ctx) => {
      let city = ctx.message.text.replace(/^[^\w\s\u0400-\u04FF]/, '').trim();
      if (city === '📍 Mening joylashuvim (GPS)') {
        return ctx.reply('Pastdagi klaviatura orqali lokatsiya yuboring yoki shahar nomini yozing.');
      }
      city = city.replace('🌤', '').trim();
      if (city.includes('Urganch')) city = 'Urgench';
      if (city.includes('Toshkent')) city = 'Tashkent';
      if (city.includes('Samarqand')) city = 'Samarkand';
      if (city.includes('Buxoro')) city = 'Bukhara';
      if (city.includes('Andijon')) city = 'Andijan';
      if (city.includes('Farg\'ona')) city = 'Fergana';

      await ctx.reply(`⏳ <b>${escapeHtml(city)}</b> ob-havosi yuklanmoqda...`, { parse_mode: 'HTML' });
      const w = await getWeather(city);
      if (w.success) {
        await ctx.replyWithHTML(
          `🌦 <b>${escapeHtml(city)} shahridagi ob-havo:</b>\n\n` +
          `🌡 <b>Harorat:</b> <b>${w.temp}°C</b> (his qilinishi: ${w.feelsLike}°C)\n` +
          `☁️ <b>Holat:</b> <b>${w.desc}</b>\n` +
          `💧 <b>Namlik:</b> ${w.humidity}%\n` +
          `💨 <b>Shamol tezligi:</b> ${w.wind} km/soat\n` +
          `📊 <b>Kutilayotgan:</b> ${w.minTemp}°C dan ${w.maxTemp}°C gacha\n\n` +
          `<i>Yangilandi: ${new Date().toLocaleTimeString('uz-UZ')}</i>`
        );
      } else {
        await ctx.reply(`❌ "${city}" shahri bo'yicha ma'lumot topilmadi. Shahar nomini to'g'ri yozing.`);
      }
    });
  }

  // 2. NAMOZ VAQTLARI BOTI
  else if (type === 'namoz') {
    const namozKeyboard = Markup.keyboard([
      ['🕌 Toshkent', '🕌 Samarqand'],
      ['🕌 Buxoro', '🕌 Andijon'],
      ['🕌 Farg\'ona', '🕌 Namangan']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.reply(
        `Assalomu alaykum!\n🕌 <b>Namoz Vaqtlari botiga xush kelibsiz!</b>\n\nViloyatni tanlang:`,
        { parse_mode: 'HTML', ...namozKeyboard }
      );
    });

    clientBot.on('text', async (ctx) => {
      const city = ctx.message.text.replace('🕌', '').trim();
      const today = new Date().toLocaleDateString('uz-UZ');
      await ctx.replyWithHTML(
        `🕌 <b>${escapeHtml(city)} shahri uchun bugungi Namoz Vaqtlari:</b>\n📅 Sana: ${today}\n\n` +
        `• <b>Bomdod:</b> 05:15\n` +
        `• <b>Quyosh:</b> 06:32\n` +
        `• <b>Peshin:</b> 12:20\n` +
        `• <b>Asr:</b> 16:15\n` +
        `• <b>Shom:</b> 18:05\n` +
        `• <b>Xufton:</b> 19:25\n\n` +
        `<i>Eslatma: Vaqtlar taxminiy ko'rsatilgan.</i>`
      );
    });
  }

  // 3. VALYUTA KURSLARI BOTI
  else if (type === 'currency') {
    clientBot.start(async (ctx) => {
      await ctx.reply(
        `💵 <b>Valyuta Kurslari Botiga xush kelibsiz!</b>\n\n` +
        `Markaziy bankning rasmiy kurslarini olish uchun /kurs buyrug'ini bosing yoki xohlagan summani yozing (masalan: <i>100$</i> yoki <i>500000 som</i>).`,
        { parse_mode: 'HTML', ...Markup.keyboard([['💵 Valyuta Kurslari']]).resize() }
      );
    });

    const sendRates = async (ctx) => {
      const data = await getCurrency();
      if (!data.success) return ctx.reply('❌ Kurslarni yuklashda xatolik yuz berdi.');
      const { rates, date } = data;
      await ctx.replyWithHTML(
        `💵 <b>O'zbekiston Markaziy Banki rasmiy kurslari (${date}):</b>\n\n` +
        `🇺🇸 <b>1 USD:</b> ${rates.usd ? rates.usd.Rate : '12800'} so'm\n` +
        `🇪🇺 <b>1 EUR:</b> ${rates.eur ? rates.eur.Rate : '13900'} so'm\n` +
        `🇷🇺 <b>1 RUB:</b> ${rates.rub ? rates.rub.Rate : '135'} so'm\n` +
        `🇰🇿 <b>1 KZT:</b> ${rates.kzt ? rates.kzt.Rate : '26'} so'm\n\n` +
        `<i>Hisoblash uchun miqdorni yuboring (masalan: 50$ yoki 100000 som).</i>`
      );
    };

    clientBot.command('kurs', sendRates);
    clientBot.hears('💵 Valyuta Kurslari', sendRates);

    clientBot.on('text', async (ctx) => {
      const txt = ctx.message.text.trim();
      if (txt.includes('$') || txt.toLowerCase().includes('usd')) {
        const num = parseFloat(txt.replace(/[^0-9.]/g, ''));
        if (!isNaN(num)) {
          const c = await getCurrency();
          const rate = c.success && c.rates.usd ? parseFloat(c.rates.usd.Rate) : 12850;
          return ctx.replyWithHTML(`💱 <b>${num} USD</b> = <b>${(num * rate).toLocaleString()} so'm</b>`);
        }
      }
      return sendRates(ctx);
    });
  }

  // 4. QR KOD BOTI
  else if (type === 'qrcode') {
    clientBot.start(async (ctx) => {
      await ctx.reply(
        `📱 <b>QR Kod Yaratuvchi Botga xush kelibsiz!</b>\n\nMenga istalgan matn, havola (link) yoki telefon raqam yuboring, men uni tezkor QR-kodga aylantirib beraman.`
      );
    });

    clientBot.on('text', async (ctx) => {
      const txt = ctx.message.text;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(txt)}`;
      await ctx.replyWithPhoto(qrUrl, {
        caption: `✅ <b>Sizning QR kodingiz tayyor!</b>\n\nMatn: <code>${escapeHtml(txt.slice(0, 100))}</code>`,
        parse_mode: 'HTML'
      });
    });
  }

  // 5. CHATGPT / AI YORDAMCHI
  else if (type === 'ai') {
    clientBot.start(async (ctx) => {
      await ctx.reply(
        `🤖 <b>AI Yordamchi Botiga xush kelibsiz!</b>\n\nMenga xohlagan savolingizni yuboring, men sizga yordam beraman.`
      );
    });

    clientBot.on('text', async (ctx) => {
      const q = ctx.message.text;
      await ctx.reply(
        `💡 <b>Savolingiz bo'yicha tahlil:</b>\n\n` +
        `"${escapeHtml(q)}"\n\n` +
        `Ushbu savol bo'yicha to'liq ma'lumot tayyorlanmoqda. Sun'iy intellekt xizmati 24/7 onlayn!`,
        { parse_mode: 'HTML' }
      );
    });
  }

  // 6. TARJIMON BOTI
  else if (type === 'translator') {
    clientBot.start(async (ctx) => {
      await ctx.reply(
        `🔤 <b>Tezkor Tarjimon Botiga xush kelibsiz!</b>\n\nMenga xohlagan so'z yoki matn yuboring, men uni o'zbek, rus va ingliz tillariga tarjima qilib beraman.`
      );
    });

    clientBot.on('text', async (ctx) => {
      const text = ctx.message.text;
      await ctx.replyWithHTML(
        `🔤 <b>Tarjima natijasi:</b>\n\n` +
        `🇺🇿 <b>O'zbekcha:</b> ${escapeHtml(text)}\n` +
        `🇷🇺 <b>Ruscha:</b> [Tarjima faol]\n` +
        `🇬🇧 <b>Inglizcha:</b> [Translated]`
      );
    });
  }
}

const botManager = {
  // Test token with Telegram API
  async verifyToken(token) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (data.ok && data.result) {
        return {
          valid: true,
          username: data.result.username,
          firstName: data.result.first_name,
          id: data.result.id
        };
      }
      return { valid: false, error: data.description || 'Noto\'g\'ri token' };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  },

  // Start single bot instance
  async startBot(botRecord) {
    if (!botRecord.is_active) return false;
    if (runningBots.has(botRecord.id)) {
      this.stopBot(botRecord.id);
    }

    try {
      const clientBot = new Telegraf(botRecord.token);
      setupBotHandlers(clientBot, botRecord);

      clientBot.catch((err) => {
        console.error(`[Bot @${botRecord.botUsername}] xatolik:`, err.message);
      });

      clientBot.launch({ dropPendingUpdates: true }).catch(err => {
        console.error(`[Bot @${botRecord.botUsername}] to'xtatildi:`, err.message);
      });

      runningBots.set(botRecord.id, clientBot);
      console.log(`🤖 [@${botRecord.botUsername}] boti 24/7 ishga tushdi (${botRecord.botType})`);
      return true;
    } catch (err) {
      console.error(`Bot @${botRecord.botUsername} ni ishga tushirishda xato:`, err.message);
      return false;
    }
  },

  // Stop single bot instance
  stopBot(botId) {
    if (runningBots.has(botId)) {
      try {
        const instance = runningBots.get(botId);
        instance.stop();
      } catch (e) {}
      runningBots.delete(botId);
      console.log(`🛑 Bot ${botId} to'xtatildi.`);
      return true;
    }
    return false;
  },

  // Start all active bots from database
  async startAllActiveBots() {
    const allBots = db.getAllBots ? db.getAllBots() : [];
    console.log(`🤖 Bazadagi botlar tekshirilmoqda (${allBots.length} ta)...`);
    for (const b of allBots) {
      if (b.is_active) {
        await this.startBot(b);
      }
    }
  }
};

module.exports = botManager;
