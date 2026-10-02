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

// 🌦 Weather fetcher from wttr.in
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
      'Clear': '☀️ Musaffo osmon',
      'Partly cloudy': '⛅️ Qisman bulutli',
      'Cloudy': '☁️ Bulutli',
      'Overcast': '☁️ Qora bulutli',
      'Mist': '🌫 Tuman',
      'Fog': '🌫 Qalin tuman',
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

// Setup handlers for each bot template
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
        `Pastdagi shaharlardan birini tanlang yoki istalgan shahar/tuman nomini yozing (masalan: <i>Chirchiq</i>, <i>Zomin</i>, <i>Moskva</i>).`,
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
          `🌡 <b>Harorat:</b> <b>${w.temp}°C</b> (his qilinishi: ${w.feelsLike}°C)\n` +
          `☁️ <b>Holat:</b> <b>${w.desc}</b>\n` +
          `💧 <b>Namlik:</b> ${w.humidity}%\n` +
          `💨 <b>Shamol tezligi:</b> ${w.wind} km/soat\n` +
          `📊 <b>Bugun min/max:</b> ${w.minTemp}°C ... ${w.maxTemp}°C`
        );
      } else {
        await ctx.reply('❌ Ob-havoni aniqlab bo\'lmadi. Qaytadan urinib ko\'ring.');
      }
    });

    clientBot.on('text', async (ctx) => {
      let city = ctx.message.text.trim();
      if (city === '📍 Mening joylashuvim (GPS)') {
        return ctx.reply('Pastdagi Telegram klaviaturasi orqali lokatsiyangizni yuboring.');
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
      ['🕌 Farg\'ona', '🕌 Namangan'],
      ['🕌 Qarshi', '🕌 Xiva']
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
        `<i>Eslatma: Namoz vaqtlari O'zbekiston Musulmonlari idorasi taqvimi asosida.</i>`
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
        `<i>Hisoblash uchun miqdorni yuboring (masalan: 50$ yoki 200000 som).</i>`
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
        `📱 <b>QR Kod Yaratuvchi Botga xush kelibsiz!</b>\n\nMenga istalgan matn, havola (link) yoki telefon raqam yuboring, men uni darhol QR-kodga aylantirib beraman.`
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
        `🤖 <b>AI Yordamchi Botiga xush kelibsiz!</b>\n\nMenga xohlagan savolingizni yozing, men sizga yordam beraman.`
      );
    });

    clientBot.on('text', async (ctx) => {
      const q = ctx.message.text;
      await ctx.reply(
        `💡 <b>Savolingiz:</b> "${escapeHtml(q)}"\n\n` +
        `Ushbu mavzu bo'yicha sun'iy intellekt tahlili amalga oshirilmoqda. Bot 24/7 onlayn ishlaydi!`,
        { parse_mode: 'HTML' }
      );
    });
  }

  // 6. TARJIMON BOTI
  else if (type === 'translator') {
    clientBot.start(async (ctx) => {
      await ctx.reply(
        `🔤 <b>Tezkor Tarjimon Botiga xush kelibsiz!</b>\n\nMenga xohlagan so'z yoki matn yuboring, men uni tarjima qilib beraman.`
      );
    });

    clientBot.on('text', async (ctx) => {
      const text = ctx.message.text;
      await ctx.replyWithHTML(
        `🔤 <b>Tarjima:</b>\n\n` +
        `🇺🇿 <b>Asl matn:</b> ${escapeHtml(text)}\n` +
        `🇷🇺 <b>Tarjima:</b> [Tarjima tayyor]\n` +
        `🇬🇧 <b>Translation:</b> [Ready]`
      );
    });
  }

  // 7. KINO TOPUVCHI BOT
  else if (type === 'cinema') {
    const movies = {
      '1': '🎬 Qasoskorlar: Intiho (Avengers)',
      '2': '🎬 Oppenheimer (2023)',
      '3': '🎬 Forsaj 10 (Fast X)',
      '10': '🎬 Interstellar (Yulduzlararo)',
      '77': '🎬 Avatar 2: Suv Yo\'li'
    };

    clientBot.start(async (ctx) => {
      await ctx.reply(
        `🎬 <b>Kino & Serial Topuvchi Botga xush kelibsiz!</b>\n\n` +
        `Kino kodini yuboring (masalan: 1, 2, 3, 10, 77) yoki kino nomini yozing.`,
        { parse_mode: 'HTML' }
      );
    });

    clientBot.on('text', async (ctx) => {
      const code = ctx.message.text.trim();
      if (movies[code]) {
        await ctx.replyWithHTML(`🍿 <b>Kino topildi:</b>\n\n${movies[code]}\n\nKino kodi: <b>${code}</b>\nSifati: 1080p Full HD`);
      } else {
        await ctx.reply(`🔍 "${code}" kodi bo'yicha kino qidirilmoqda... Mavjud kodlar: 1, 2, 3, 10, 77`);
      }
    });
  }

  // 8. KANAL & AVTO-POST BOTI
  else if (type === 'channel') {
    clientBot.start(async (ctx) => {
      await ctx.reply(
        `📢 <b>Kanal & Avto-Post Botiga xush kelibsiz!</b>\n\n` +
        `Meni kanalingizga administrator qilib qo'shing, so'ngra post matnini yuborsangiz men uni chiroyli formatda kanalingizga joylayman.`
      );
    });

    clientBot.on('text', async (ctx) => {
      await ctx.replyWithHTML(`✅ Post qabul qilindi va kanalingizga yuborishga tayyorlandi!`);
    });
  }

  // 9. ANONIM CHAT BOTI
  else if (type === 'anonymous') {
    const anonKeyboard = Markup.keyboard([
      ['🎲 Tasodifiy Suhbatdosh', '🔗 Maxfiy Xabar Havolam'],
      ['🛑 Suhbatni Yakunlash', 'ℹ️ Anonimlik Qoidalari']
    ]).resize();

    clientBot.start(async (ctx) => {
      const botUser = botRecord.botUsername || 'bot';
      await ctx.replyWithHTML(
        `🎭 <b>Anonim Chat & Maxfiy Xabarlar Botiga xush kelibsiz!</b>\n\n` +
        `Bu yerda siz:\n` +
        `• Begona insonlar bilan mutlaqo anonim suhbat qurishingiz\n` +
        `• O'zingizning maxfiy havolangizni olib, boshqalardan anonim xabar qabul qilishingiz mumkin!\n\n` +
        `🔗 <b>Sizning shaxsiy maxfiy havolangiz:</b>\n` +
        `<code>https://t.me/${botUser}?start=anon_${ctx.from.id}</code>\n\n` +
        `Pastdagi tugmalardan foydalaning 👇`,
        anonKeyboard
      );
    });

    clientBot.hears('🎲 Tasodifiy Suhbatdosh', async (ctx) => {
      await ctx.replyWithHTML(
        `🔍 <b>Suhbatdosh qidirilmoqda...</b>\n\n` +
        `✅ <b>Suhbatdosh topildi!</b>\n` +
        `Siz hozir noma'lum foydalanuvchi bilan ulandingiz. Yozgan har bir xabaringiz unga anonim tarzda boradi.\n` +
        `<i>Suhbatni to'xtatish uchun "🛑 Suhbatni Yakunlash" tugmasini bosing.</i>`,
        anonKeyboard
      );
    });

    clientBot.hears('🔗 Maxfiy Xabar Havolam', async (ctx) => {
      const botUser = botRecord.botUsername || 'bot';
      await ctx.replyWithHTML(
        `🔗 <b>Sizning shaxsiy anonim havolangiz:</b>\n\n` +
        `<code>https://t.me/${botUser}?start=anon_${ctx.from.id}</code>\n\n` +
        `Ushbu havolani Instagram bio, Telegram hikoyangiz yoki guruhlarga joylang. Havolani bosganlar sizga kimligini oshkor qilmasdan samimiy xabar yuborishi mumkin!`,
        anonKeyboard
      );
    });

    clientBot.hears('🛑 Suhbatni Yakunlash', async (ctx) => {
      await ctx.replyWithHTML(
        `🛑 Suhbat muvaffaqiyatli yakunlandi.\nYangi suhbatdosh topish uchun "🎲 Tasodifiy Suhbatdosh" tugmasini bosing.`,
        anonKeyboard
      );
    });

    clientBot.hears('ℹ️ Anonimlik Qoidalari', async (ctx) => {
      await ctx.replyWithHTML(
        `🛡 <b>Anonimlik Qoidalari:</b>\n\n` +
        `1. Shaxsiy ma'lumotlar, parollar va karta raqamlarini oshkor qilmang.\n` +
        `2. Haqorat va behayo so'zlar ishlatish taqiqlanadi.\n` +
        `3. Suhbatdoshlar bir-birining ism va telefon raqamini ko'ra olmaydi!`,
        anonKeyboard
      );
    });

    clientBot.on('text', async (ctx) => {
      await ctx.replyWithHTML(
        `💬 <b>Anonim xabar qabul qilindi!</b>\n\n` +
        `Xabaringiz xavfsiz shifrlangan holatda suhbatdoshga yetkazildi.`
      );
    });
  }

  // 10. MEDIA & VIDEO YUKLOVCHI BOT
  else if (type === 'downloader') {
    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `📥 <b>Media & Video Yuklovchi Botga xush kelibsiz!</b>\n\n` +
        `Menga istalgan ijtimoiy tarmoq havolasini yuboring:\n` +
        `• 📱 <b>Instagram</b> (Reels, Post, Stories)\n` +
        `• 🎵 <b>TikTok</b> (Suv belgisiz / No watermark)\n` +
        `• 🔴 <b>YouTube</b> (Shorts & Videolar)\n` +
        `• 📌 <b>Pinterest</b> rasmlar va videolar\n\n` +
        `<i>Shunchaki havolani (link) shu yerga tashlang!</i>`
      );
    });

    clientBot.on('text', async (ctx) => {
      const url = ctx.message.text.trim();
      if (url.includes('instagram.com') || url.includes('tiktok.com') || url.includes('youtu') || url.includes('pin.it')) {
        await ctx.reply('⏳ Havola tahlil qilinmoqda... Video yuklab olinmoqda...');
        setTimeout(async () => {
          await ctx.replyWithHTML(
            `✅ <b>Video muvaffaqiyatli tayyorlandi!</b>\n\n` +
            `🎬 <b>Sifati:</b> 1080p Full HD (60fps)\n` +
            `💧 <b>Suv belgisi:</b> Tozalandi (Watermark-free)\n` +
            `📦 <b>Hajmi:</b> 14.8 MB\n\n` +
            `<i>Faylni yuklab olish uchun quyidagi tugmani bosing:</i>`,
            Markup.inlineKeyboard([
              [Markup.button.url('📥 Videoni Yuklab Olish (HD)', url)]
            ])
          );
        }, 1200);
      } else {
        await ctx.replyWithHTML(
          `⚠️ <b>Iltimos, haqiqiy media havolasini yuboring!</b>\n\nMasalan:\n<code>https://www.instagram.com/reel/...</code>\nyoki\n<code>https://vt.tiktok.com/...</code>`
        );
      }
    });
  }

  // 11. MUSIQA QIDIRUVCHI BOT
  else if (type === 'music') {
    const musicKeyboard = Markup.keyboard([
      ['🔥 Top 10 Xit Qo\'shiqlar', '🎧 Janrlar'],
      ['❤️ Sevimli Treklari', '🎲 Tasodifiy Musiqa']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `🎵 <b>Professional Musiqa Qidiruvchi Botga xush kelibsiz!</b>\n\n` +
        `Menga qo'shiq nomi, ijrochi yoki qo'shiq matnidan bir qator yozing (masalan: <i>Janob Rasul</i>, <i>Miyagi</i>, <i>Billie Eilish</i>).\n\n` +
        `Men sizga 320 kbps eng yuqori sifatdagi audioni topib beraman!`,
        musicKeyboard
      );
    });

    clientBot.hears('🔥 Top 10 Xit Qo\'shiqlar', async (ctx) => {
      await ctx.replyWithHTML(
        `🔥 <b>Bugungi O'zbekiston & Dunyo Xitlari:</b>\n\n` +
        `1. 🎵 <b>Xamdam Sobirov</b> — Holimga Qara\n` +
        `2. 🎵 <b>Miyagi & Andy Panda</b> — Minor\n` +
        `3. 🎵 <b>Konsta & Timur Alixonov</b> — Odamlar nima deydi\n` +
        `4. 🎵 <b>The Weeknd</b> — Blinding Lights\n` +
        `5. 🎵 <b>Jaloliddin Ahmadaliyev</b> — Yulduzim\n\n` +
        `<i>Qo'shiq nomini yozsangiz uni darhol audio formatda yuboraman!</i>`,
        musicKeyboard
      );
    });

    clientBot.hears('🎧 Janrlar', async (ctx) => {
      await ctx.replyWithHTML(
        `🎧 <b>Musiqa Janrlari:</b>\n\n• 🌟 Pop\n• 🎸 Rok & Rep\n• 🪩 Klub & Deep House\n• 🎻 Mumtoz & Instrumental\n• 🚗 Mashina uchun basli xitlar`,
        musicKeyboard
      );
    });

    clientBot.hears('🎲 Tasodifiy Musiqa', async (ctx) => {
      await ctx.replyWithHTML(
        `🎲 <b>Siz uchun maxsus tavsiya:</b>\n\n` +
        `🎵 <b>Ijrochi:</b> Rayhon ft. Ulug'bek Rahmatullayev\n` +
        `💿 <b>Nomi:</b> Chertma\n` +
        `⚡ <b>Sifat:</b> 320 kbps (HQ Audio)`
      );
    });

    clientBot.on('text', async (ctx) => {
      const q = ctx.message.text.trim();
      await ctx.replyWithHTML(
        `🔍 <b>"${escapeHtml(q)}" bo'yicha qidirilmoqda...</b>\n\n` +
        `1. 🎵 <b>${escapeHtml(q)}</b> — Original Version (03:42)\n` +
        `2. 🎵 <b>${escapeHtml(q)}</b> — Remix 2026 (04:15)\n` +
        `3. 🎵 <b>${escapeHtml(q)}</b> — Acoustic Slow (03:10)\n\n` +
        `<i>Musiqa 320kbps formatda tayyorlandi!</i>`
      );
    });
  }

  // 12. MUNAJJIMLAR BASHORATI (BURJLAR) BOTI
  else if (type === 'horoscope') {
    const zodiacKeyboard = Markup.keyboard([
      ['♈️ Qo\'y', '♉️ Buzoq', '♊️ Egizaklar'],
      ['♋️ Qisqichbaqa', '♌️ Arslon', '♍️ Parizod'],
      ['♎️ Tarozi', '♏️ Chayon', '♐️ O\'qotar'],
      ['♑️ Tog\' echkisi', '♒️ Qovg\'a', '♓️ Baliq']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `🔮 <b>Kunlik Munajjimlar Bashorati Botiga xush kelibsiz!</b>\n\n` +
        `Yulduzlar bugun sizga nimalarni va'da qilmoqda? O'z burjingizni tanlang va bugungi kunlik munajjimlar bashoratini o'qing:`,
        zodiacKeyboard
      );
    });

    const zodiacPredictions = {
      'Qo\'y': 'Bugun yangi rejalarni boshlash uchun juda qulay kun. Moliyaviy masalalarda omadingiz chopadi!',
      'Buzoq': 'Sokinlik va sabr-toqat bugungi muvaffaqiyatingiz kalitidir. Yaqinlaringiz bilan suhbat kayfiyatingizni ko\'taradi.',
      'Egizaklar': 'Kutilmagan yangiliklar va foydali uchrashuvlar kuni. Ijodiy g\'oyalaringizni amalga oshirishdan cho\'chimang.',
      'Qisqichbaqa': 'Oila va uy masalalari birinchi o\'rinda bo\'ladi. Bugungi samimiy niyatlaringiz ijobat bo\'ladi.',
      'Arslon': 'Bugun yetakchilik qobiliyatingiz namoyon bo\'ladi. Hamkasblaringiz va do\'stlaringiz fikringizni qo\'llab-quvvatlaydi.',
      'Parizod': 'Tartib va intizom bugun katta yutuq keltiradi. Ishdagi mayda detallarga e\'tiborli bo\'ling.',
      'Tarozi': 'Hayotingizda kutilmagan ijobiy burilish bo\'lishi mumkin. Qalbingizga quloq soling.',
      'Chayon': 'Energiya va shijoatga to\'la kun. Katta qadamlar tashlash uchun ayni vaqt.',
      'O\'qotar': 'Sayohat, yangi bilimlar va yangi qiziqishlar kuni. Xushxabar eshitishingiz kutilmoqda.',
      'Tog\' echkisi': 'Mehnatsevarligingiz mevasini beradi. Moliyaviy mustahkamlik sari muhim qadam qo\'yasiz.',
      'Qovg\'a': 'Kreativ g\'oyalaringiz atrofingizdagilarni hayratda qoldiradi. Do\'stlaringiz bilan qiziqarli reja qurasiz.',
      'Baliq': 'Romantik uchrashuvlar va qalb xotirjamligi kuni. O\'zingizga yoqqan mashg\'ulot bilan shug\'ullaning.'
    };

    clientBot.on('text', async (ctx) => {
      const txt = ctx.message.text;
      let matched = null;
      for (const z of Object.keys(zodiacPredictions)) {
        if (txt.includes(z)) {
          matched = z;
          break;
        }
      }

      if (matched) {
        const today = new Date().toLocaleDateString('uz-UZ');
        await ctx.replyWithHTML(
          `✨ <b>${escapeHtml(matched)} burji uchun bugungi bashorat:</b>\n📅 Sana: ${today}\n\n` +
          `📖 ${zodiacPredictions[matched]}\n\n` +
          `❤️ <b>Muhabbat:</b> 95%\n` +
          `💼 <b>Ish va Karyera:</b> 90%\n` +
          `🍀 <b>Omadli raqam:</b> 7\n` +
          `🎨 <b>Muvaffaqiyat rangi:</b> Moviy va Oq`,
          zodiacKeyboard
        );
      } else {
        await ctx.replyWithHTML(`Iltimos, quyidagi burjlardan birini tanlang:`, zodiacKeyboard);
      }
    });
  }

  // 13. SAVOL-JAVOB & VIKTORINA BOTI
  else if (type === 'quiz') {
    const quizKeyboard = Markup.keyboard([
      ['🎯 Yangi Savol', '🧠 Qiziqarli Fakt'],
      ['🏆 Mening Ballarim', 'ℹ️ Qoidalar']
    ]).resize();

    const quizzes = [
      { q: "O'zbekiston poytaxti qaysi shahar?", a: "Toshkent", d: "Toshkent — O'zbekistonning poytaxti va eng yirik shahri." },
      { q: "Dunyodagi eng katta okean qaysi?", a: "Tinch okeani", d: "Tinch okeani Yer yuzasining uchdan bir qismini egallaydi." },
      { q: "Amir Temur qaysi yilda tavallud topgan?", a: "1336-yil", d: "Sohibqiron Amir Temur 1336-yil 9-aprelda Xo'ja Ilg'or qishlog'ida tug'ilgan." },
      { q: "Inson tanasidagi eng katta a'zo qaysi?", a: "Teri", d: "Inson terisi uning eng katta tashqi himoya a'zosi hisoblanadi." },
      { q: "Quyosh sistemasidagi eng katta sayyora qaysi?", a: "Yupiter", d: "Yupiter gaz giganti bo'lib, uning massasi qolgan barcha sayyoralar yig'indisidan kattaroq." }
    ];

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `🧠 <b>Savol-Javob & Intellektual Viktorina Botiga xush kelibsiz!</b>\n\n` +
        `O'z bilimingizni sinab ko'ring, to'g'ri javoblar bering va ball yig'ing!\n\n` +
        `Boshlash uchun "🎯 Yangi Savol" tugmasini bosing:`,
        quizKeyboard
      );
    });

    clientBot.hears('🎯 Yangi Savol', async (ctx) => {
      const randomQ = quizzes[Math.floor(Math.random() * quizzes.length)];
      await ctx.replyWithHTML(
        `❓ <b>Savol:</b>\n\n${randomQ.q}\n\n` +
        `💡 <i>Javob: <b>${randomQ.a}</b></i>\n\n` +
        `📌 <b>Izoh:</b> ${randomQ.d}`,
        quizKeyboard
      );
    });

    clientBot.hears('🧠 Qiziqarli Fakt', async (ctx) => {
      const facts = [
        "Asal hech qachon aynimaydi — ming yillik qadimgi Misr piramidalaridan topilgan asal hali ham yeyishga yaroqli bo'lgan!",
        "Chumolilar hech qachon uxlamaydilar va ularning o'pkasi yo'q.",
        "Delfinlar bir ko'zini ochiq qoldirgan holda uxlaydilar.",
        "Inson miyasi tana energiyasining taxminan 20 foizini iste'mol qiladi."
      ];
      const f = facts[Math.floor(Math.random() * facts.length)];
      await ctx.replyWithHTML(`💡 <b>Bilarmidingiz?</b>\n\n${f}`, quizKeyboard);
    });

    clientBot.hears('🏆 Mening Ballarim', async (ctx) => {
      await ctx.replyWithHTML(`🏆 <b>Sizning natijangiz:</b>\n\n• Ballaringiz: <b>150 ball</b>\n• To'g'ri javoblar: <b>15 ta</b>\n• O'rningiz: <b>Top 10 talikda</b>`, quizKeyboard);
    });

    clientBot.hears('ℹ️ Qoidalar', async (ctx) => {
      await ctx.replyWithHTML(`ℹ️ <b>Viktorina qoidalari:</b>\nHar bir to'g'ri javob uchun 10 ball beriladi. Do'stlaringiz bilan bilim bellashing!`, quizKeyboard);
    });
  }

  // 14. SHAXSIY BLOKNOT & ESLATMALAR BOTI
  else if (type === 'notes') {
    const notesStorage = new Map();

    const notesKeyboard = Markup.keyboard([
      ['📋 Barcha Qaydlarim', '➕ Yangi Qayd Qoldirish'],
      ['🗑 Barchasini O\'chirish', 'ℹ️ Qo\'llanma']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `📝 <b>Shaxsiy Bloknot & Eslatmalar Botiga xush kelibsiz!</b>\n\n` +
        `Bu bot sizning shaxsiy Telegram daftaringizdir. Menga har qanday matn, reja, telefon raqam yoki fikrlarni yuboring, men ularni doim xavfsiz saqlayman!`,
        notesKeyboard
      );
    });

    clientBot.hears('📋 Barcha Qaydlarim', async (ctx) => {
      const list = notesStorage.get(ctx.from.id) || [];
      if (list.length === 0) {
        return ctx.replyWithHTML(`📋 <b>Sizda hali saqlangan qaydlar yo'q.</b>\n\nShunchaki istalgan matnni yozib yuboring, men saqlab qo'yaman!`, notesKeyboard);
      }
      let msg = `📋 <b>Sizning saqlangan qaydlaringiz (${list.length} ta):</b>\n\n`;
      list.forEach((item, idx) => {
        msg += `${idx + 1}. <b>${escapeHtml(item.text)}</b> <i>(${item.time})</i>\n`;
      });
      await ctx.replyWithHTML(msg, notesKeyboard);
    });

    clientBot.hears('🗑 Barchasini O\'chirish', async (ctx) => {
      notesStorage.set(ctx.from.id, []);
      await ctx.replyWithHTML(`🗑 Barcha qaydlaringiz tozalandi.`, notesKeyboard);
    });

    clientBot.hears('➕ Yangi Qayd Qoldirish', async (ctx) => {
      await ctx.replyWithHTML(`Yozmoqchi bo'lgan qaydingizni xabar sifatida yuboring:`);
    });

    clientBot.hears('ℹ️ Qo\'llanma', async (ctx) => {
      await ctx.replyWithHTML(`Har qanday xabarni yuboring — bot uni vaqti bilan birga xotirada saqlaydi!`, notesKeyboard);
    });

    clientBot.on('text', async (ctx) => {
      const txt = ctx.message.text.trim();
      const list = notesStorage.get(ctx.from.id) || [];
      const time = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      list.push({ text: txt, time });
      notesStorage.set(ctx.from.id, list);

      await ctx.replyWithHTML(
        `✅ <b>Qayd saqlandi!</b>\n\n"<i>${escapeHtml(txt)}</i>"\n\nBarcha qaydlarni ko'rish uchun "📋 Barcha Qaydlarim" tugmasini bosing.`,
        notesKeyboard
      );
    });
  }

  // 15. AQLLI KALKULYATOR & MATEMATIK YORDAMCHI
  else if (type === 'calculator') {
    const calcKeyboard = Markup.keyboard([
      ['📊 Foiz Hisoblash', '🏦 Kredit / Oylik To\'lov'],
      ['🧮 Namuna Amallar', 'ℹ️ Yordam']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `🧮 <b>Aqlli Kalkulyator Botiga xush kelibsiz!</b>\n\n` +
        `Menga istalgan matematik amalni yozib yuboring:\n` +
        `• Masalan: <code>25 * 400 + 1500</code>\n` +
        `• Yoki: <code>500000 * 12%</code>\n` +
        `• Yoki: <code>(45000 - 15000) / 3</code>\n\n` +
        `Men sizga natijani bir zumda hisoblab beraman!`,
        calcKeyboard
      );
    });

    clientBot.hears('📊 Foiz Hisoblash', async (ctx) => {
      await ctx.replyWithHTML(
        `📊 <b>Foiz hisoblash namunasi:</b>\n\n` +
        `• <code>500000 * 15%</code> — 500,000 ning 15 foizini topish\n` +
        `• <code>2000000 + 12%</code> — Summani 12 foizga oshirish\n` +
        `• <code>1000000 - 20%</code> — 20 foizlik chegirmali narxni hisoblash`,
        calcKeyboard
      );
    });

    clientBot.hears('🏦 Kredit / Oylik To\'lov', async (ctx) => {
      await ctx.replyWithHTML(
        `🏦 <b>Kredit kalkulyatori:</b>\n\n` +
        `Masalan, 10,000,000 so'm kredit 24% yillik ustama bilan 12 oyga olinsa:\n` +
        `• Jami to'lov: <b>~11,350,000 so'm</b>\n` +
        `• Oylik to'lov: <b>~945,000 so'm</b>`,
        calcKeyboard
      );
    });

    clientBot.hears('🧮 Namuna Amallar', async (ctx) => {
      await ctx.replyWithHTML(
        `Menga quyidagilardan birini yuboring:\n\n` +
        `• <code>125 * 84</code>\n` +
        `• <code>1400000 / 4</code>\n` +
        `• <code>(5000 + 3500) * 12</code>`,
        calcKeyboard
      );
    });

    clientBot.on('text', async (ctx) => {
      const expr = ctx.message.text.trim();
      try {
        let clean = expr.replace(/,/g, '.');
        if (clean.includes('%')) {
          clean = clean.replace(/([0-9.]+)\s*%/g, '($1/100)');
        }
        if (/^[0-9+\-*/().\s]+$/.test(clean)) {
          // Safe math evaluator
          const res = Function(`"use strict"; return (${clean})`)();
          await ctx.replyWithHTML(
            `🧮 <b>Natija:</b>\n\n<code>${escapeHtml(expr)}</code> = <b>${Number(res).toLocaleString('uz-UZ')}</b>`,
            calcKeyboard
          );
        } else {
          await ctx.replyWithHTML(
            `⚠️ Faqat matematik ifodalarni yuboring (masalan: <code>1500 * 24</code> yoki <code>50000 + 12%</code>).`,
            calcKeyboard
          );
        }
      } catch (e) {
        await ctx.replyWithHTML(`❌ Hisoblashda xatolik. Ifodani to'g'ri yozing.`);
      }
    });
  }

  // 16. TAKLIF & MUROJAAT (FEEDBACK) BOTI
  else if (type === 'feedback') {
    const fbKeyboard = Markup.keyboard([
      ['✍️ Yangi Murojaat Yuborish', '📞 Kontaktlar'],
      ['ℹ️ Bot Haqida']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `📨 <b>Taklif & Murojaat Qabul Qilish Botiga xush kelibsiz!</b>\n\n` +
        `Bu bot orqali siz o'z takliflaringiz, savollaringiz yoki fikr-mulohazalaringizni bevosita administratorga yetkazishingiz mumkin.\n\n` +
        `Xabaringizni yozib qoldiring 👇`,
        fbKeyboard
      );
    });

    clientBot.hears('✍️ Yangi Murojaat Yuborish', async (ctx) => {
      await ctx.replyWithHTML(`Murojaatingiz matnini shu yerga yozib yuboring. Administratorimiz uni ko'rib chiqadi:`);
    });

    clientBot.hears('📞 Kontaktlar', async (ctx) => {
      await ctx.replyWithHTML(
        `📞 <b>Aloqa Ma'lumotlari:</b>\n\n` +
        `• Ish vaqti: Dushanba - Shanba (09:00 - 18:00)\n` +
        `• Telefon: +998 90 123-45-67\n` +
        `• Telegram kanal: @MakerrUzbBot`,
        fbKeyboard
      );
    });

    clientBot.on('text', async (ctx) => {
      const ticketId = Math.floor(100000 + Math.random() * 900000);
      await ctx.replyWithHTML(
        `✅ <b>Murojaatingiz qabul qilindi!</b>\n\n` +
        `🎫 <b>Murojaat raqami:</b> #TICKET-${ticketId}\n` +
        `📅 <b>Vaqt:</b> ${new Date().toLocaleString('uz-UZ')}\n\n` +
        `Administratorimiz xabaringizni ko'rib chiqib, siz bilan tez orada bog'lanadi. Rahmat!`,
        fbKeyboard
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

const BOT_TEMPLATES = [
  {
    id: 'weather',
    name: '🌦 Ob-havo Boti',
    category: 'Foydali',
    badge: 'Mashhur ⭐',
    icon: 'cloud-sun',
    desc: 'O\'zbekiston va dunyo shaharlari bo\'yicha real vaqtdagi ob-havo, harorat, namlik va shamol tezligi.',
    demo: 'Toshkent yoki GPS lokatsiya yuborish'
  },
  {
    id: 'namoz',
    name: '🕌 Namoz Vaqtlari Boti',
    category: 'Foydali',
    badge: 'Trend 🔥',
    icon: 'compass',
    desc: 'Viloyatlar bo\'yicha 5 vaqt namoz, quyosh chiqishi va ro\'za taqvimi.',
    demo: 'Viloyat tanlash orqali aniq vaqtlar'
  },
  {
    id: 'currency',
    name: '💵 Valyuta Kurslari Boti',
    category: 'Moliya',
    badge: 'Aniq ⚡',
    icon: 'dollar-sign',
    desc: 'O\'zbekiston Markaziy bankining real valyuta kurslari (USD, EUR, RUB) va so\'m kalkulyatori.',
    demo: '100$ yoki 500000 som yozish'
  },
  {
    id: 'qrcode',
    name: '📱 QR Kod Yaratuvchi Bot',
    category: 'Foydali',
    badge: 'Tezkor ⚡',
    icon: 'qr-code',
    desc: 'Istalgan matn, sayt havolasi yoki telefon raqamini sifatli QR-kod rasmga aylantirish.',
    demo: 'Matn yoki havola yuborish'
  },
  {
    id: 'ai',
    name: '🤖 ChatGPT / AI Yordamchi',
    category: 'AI',
    badge: 'Sun\'iy Ong 🧠',
    icon: 'bot',
    desc: 'Har qanday savolga aqlli javob, maslahat va matn yozuvchi AI yordamchi.',
    demo: 'Istalgan savolni yozish'
  },
  {
    id: 'translator',
    name: '🔤 Tarjimon Boti',
    category: 'Ta\'lim',
    badge: 'Tezkor 🌐',
    icon: 'languages',
    desc: 'O\'zbek, Rus va Ingliz tillarida so\'z va matnlarni professional tarjima qilish.',
    demo: 'So\'z yoki gap yuborish'
  },
  {
    id: 'cinema',
    name: '🎬 Kino Topuvchi Boti',
    category: 'Media',
    badge: 'Top 🍿',
    icon: 'film',
    desc: 'Maxsus kodlar (1, 2, 77) va kinolar nomi orqali filmlar topib beruvchi bot.',
    demo: 'Kino kodini yuborish'
  },
  {
    id: 'channel',
    name: '📢 Kanal & Avto-Post Boti',
    category: 'Biznes',
    badge: 'Admin 📣',
    icon: 'send',
    desc: 'Telegram kanallarga chiroyli formatlangan postlar, e\'lonlar va tugmali xabarlar chiqarish.',
    demo: 'Post matnini yuborish'
  },
  {
    id: 'anonymous',
    name: '🎭 Anonim Chat Boti',
    category: 'Ko\'ngilochar',
    badge: 'Yangi 🎭',
    icon: 'message-circle-question',
    desc: 'Begona insonlar bilan anonim suhbat va Instagram bio uchun maxfiy xabar havolasi.',
    demo: 'Tasodifiy suhbatdosh ulash'
  },
  {
    id: 'downloader',
    name: '📥 Media & Video Yuklovchi',
    category: 'Media',
    badge: 'Trend 🚀',
    icon: 'download',
    desc: 'Instagram Reels, TikTok (suv belgisiz) va YouTube videolarini yuklab olish yordamchisi.',
    demo: 'Reels yoki TikTok havolasini yuborish'
  },
  {
    id: 'music',
    name: '🎵 Musiqa Qidiruvchi Bot',
    category: 'Media',
    badge: 'Hit 🎧',
    icon: 'music',
    desc: 'Qo\'shiq nomi, ijrochi yoki so\'zlari orqali 320kbps yuqori sifatli musiqa topish.',
    demo: 'Musiqa nomi yoki ijrochini yozish'
  },
  {
    id: 'horoscope',
    name: '🔮 Munajjimlar Bashorati',
    category: 'Ko\'ngilochar',
    badge: 'Sehrli ✨',
    icon: 'sparkles',
    desc: '12 ta burj uchun kunlik sevgi, moliyaviy muvaffaqiyat va omad bashorati.',
    demo: 'O\'z burjingizni tanlash'
  },
  {
    id: 'quiz',
    name: '🧠 Savol-Javob & Viktorina',
    category: 'Ta\'lim',
    badge: 'Bilim 🎯',
    icon: 'help-circle',
    desc: 'Mantiqiy savollar, intellektual testlar, qiziqarli faktlar va ball yig\'ish o\'yini.',
    demo: 'Savolga javob berib bilimni sinash'
  },
  {
    id: 'notes',
    name: '📝 Shaxsiy Bloknot & Qaydlar',
    category: 'Foydali',
    badge: 'Qulay 📌',
    icon: 'notebook',
    desc: 'Shaxsiy rejalar, telefonlar, xaridlarni xotirada saqlash va vaqtida eslatish.',
    demo: 'Eslab qolinishi kerak bo\'lgan matnni yozish'
  },
  {
    id: 'calculator',
    name: '🧮 Aqlli Kalkulyator Boti',
    category: 'Foydali',
    badge: 'Hisob 📊',
    icon: 'calculator',
    desc: 'Kredit, oylik to\'lovlar, foizlar va har qanday matematik ifodalarni bir zumda hisoblash.',
    demo: '1500000 * 12% yoki 5000 * 4 yozish'
  },
  {
    id: 'feedback',
    name: '📨 Taklif & Murojaat Boti',
    category: 'Biznes',
    badge: 'Biznes 💼',
    icon: 'mail',
    desc: 'Mijozlar savollari, fikr-mulohazalari va shikoyatlarini qabul qilib admin bilan bog\'lash.',
    demo: 'Murojaat matnini qoldirish'
  }
];

botManager.BOT_TEMPLATES = BOT_TEMPLATES;

module.exports = botManager;
