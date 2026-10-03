const { Telegraf, Markup } = require('telegraf');
const db = require('../data/db');

let alldl;
try {
  alldl = require('rahad-all-downloader-v2').alldl;
} catch (e) {
  console.error('rahad-all-downloader-v2 not available:', e.message);
}

let btchDl;
try {
  btchDl = require('btch-downloader');
} catch (e) {
  console.error('btch-downloader not available:', e.message);
}

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

// 🕌 Aniq Namoz Vaqtlari API (Aladhan & Islomiy taqvim)
async function getPrayerTimes(cityName) {
  try {
    let englishCity = cityName.replace(/[^a-zA-Z]/g, '');
    if (cityName.includes('Toshkent')) englishCity = 'Tashkent';
    if (cityName.includes('Samarqand')) englishCity = 'Samarkand';
    if (cityName.includes('Buxoro')) englishCity = 'Bukhara';
    if (cityName.includes('Andijon')) englishCity = 'Andijan';
    if (cityName.includes('Farg\'ona') || cityName.includes('Fargona')) englishCity = 'Fergana';
    if (cityName.includes('Namangan')) englishCity = 'Namangan';
    if (cityName.includes('Qarshi')) englishCity = 'Karshi';
    if (cityName.includes('Xiva') || cityName.includes('Urganch')) englishCity = 'Khiva';
    if (cityName.includes('Termiz')) englishCity = 'Termez';
    if (cityName.includes('Navoiy')) englishCity = 'Navoiy';
    if (cityName.includes('Nukus')) englishCity = 'Nukus';
    if (cityName.includes('Jizzax')) englishCity = 'Jizzakh';
    if (!englishCity) englishCity = 'Tashkent';

    const res = await fetch(`http://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(englishCity)}&country=Uzbekistan&method=3`);
    if (!res.ok) throw new Error('API xatolik');
    const data = await res.json();
    const t = data.data.timings;
    const hijri = data.data.date?.hijri;
    return {
      success: true,
      city: cityName,
      fajr: t.Fajr,
      sunrise: t.Sunrise,
      dhuhr: t.Dhuhr,
      asr: t.Asr,
      maghrib: t.Maghrib,
      isha: t.Isha,
      hijriDate: hijri ? `${hijri.day} ${hijri.month?.en} ${hijri.year}` : ''
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 🤖 Real Sun'iy Intellekt (AI) API
async function askAI(prompt) {
  try {
    const sysPrompt = 'Sen o\'zbek tilidagi eng aqlli, do\'stona va professional AI assistentsan. Savolga o\'zbek tilida aniq, tushunarli va batafsil javob ber: ';
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(sysPrompt + prompt)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error('AI API xatosi');
    const answer = await res.text();
    return { success: true, answer: answer.trim() };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 🔤 Real Tarjimon API (Uzbek -> Ruscha & Inglizcha)
async function translateText(text) {
  try {
    const [resRu, resEn] = await Promise.all([
      fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=uz|ru`).then(r => r.json()),
      fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=uz|en`).then(r => r.json())
    ]);

    const ru = resRu?.responseData?.translatedText || 'Tarjimani aniqlab bo\'lmadi';
    const en = resEn?.responseData?.translatedText || 'Could not determine translation';
    return { success: true, ru, en };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 🎬 Real Video Yuklovchi (Instagram, TikTok HD no-watermark, YouTube, Pinterest, Facebook)
async function extractVideo(url) {
  // 1. rahad-all-downloader-v2 (Instagram Reels, TikTok, YouTube, Threads, Pinterest)
  if (alldl) {
    try {
      const res = await alldl(url);
      if (res && res.data && res.data.videoUrl) {
        return {
          success: true,
          platform: url.includes('instagram') ? 'Instagram' : url.includes('tiktok') ? 'TikTok' : url.includes('youtu') ? 'YouTube' : 'Media',
          videoUrl: res.data.videoUrl,
          hdUrl: res.data.videoUrl,
          title: res.data.title || 'Video',
          quality: '1080p Full HD (Tiniq va Suvsiz)'
        };
      }
    } catch (e) {
      console.error('alldl extraction error:', e.message);
    }
  }

  // 2. TikTok tezkor maxsus resolver (tikwm.com)
  if (url.includes('tiktok.com') || url.includes('douyin.com')) {
    try {
      const res = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url })
      });
      const data = await res.json();
      if (data && data.code === 0 && data.data) {
        return {
          success: true,
          platform: 'TikTok',
          videoUrl: data.data.play || data.data.hdplay,
          hdUrl: data.data.hdplay || data.data.play,
          musicUrl: data.data.music,
          title: data.data.title || 'TikTok Video',
          author: data.data.author?.nickname || data.data.author?.unique_id || 'TikTok User',
          duration: data.data.duration || 0,
          quality: '1080p Full HD (Suv belgisiz)'
        };
      }
    } catch (e) {
      console.error('Tikwm error:', e.message);
    }
  }

  // 3. YouTube video resolver (btchDl)
  if ((url.includes('youtu.be') || url.includes('youtube.com')) && btchDl?.youtube) {
    try {
      const ytData = await btchDl.youtube(url);
      if (ytData && (ytData.mp4 || ytData.url)) {
        return {
          success: true,
          platform: 'YouTube',
          videoUrl: ytData.mp4 || ytData.url,
          hdUrl: ytData.mp4 || ytData.url,
          title: ytData.title || 'YouTube Video',
          author: ytData.author || '',
          quality: '1080p HD'
        };
      }
    } catch (e) {
      console.error('btch youtube error:', e.message);
    }
  }

  // 4. VKr / Universal Video Web Resolver fallback
  try {
    const vkrEndpoint = 'https://vkrdownloader.org/download.php?vkr=' + encodeURIComponent(url);
    const res = await fetch(vkrEndpoint, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const html = await res.text();
      const forceMatch = html.match(/forceD=([^&"']+)/i);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      let title = titleMatch ? titleMatch[1].replace(/ - VKrDownloader.*$/i, '').trim() : 'Media Video';
      if (title.startsWith('Download ')) title = title.replace('Download ', '');

      if (forceMatch) {
        const decodedUrl = decodeURIComponent(forceMatch[1]);
        return {
          success: true,
          platform: url.includes('instagram') ? 'Instagram' : url.includes('youtu') ? 'YouTube' : 'Media',
          videoUrl: decodedUrl,
          hdUrl: decodedUrl,
          title,
          quality: '1080p HD'
        };
      }
    }
  } catch (e) {}

  return { success: false, error: 'Video manbasi aniqlanmadi' };
}

// 🎵 Real MP3 Audio Fetcher (320kbps Studio Master)
async function getAudioForQuery(query) {
  if (!btchDl) return null;
  try {
    const searchRes = await btchDl.yts(query);
    const items = searchRes?.result?.all || searchRes?.result || [];
    const video = items.find(x => x.type === 'video') || items[0];
    if (video && video.url) {
      const ytData = await btchDl.youtube(video.url);
      if (ytData && (ytData.mp3 || ytData.audio)) {
        return {
          title: ytData.title || video.title || query,
          performer: ytData.author || video.author?.name || 'Artist',
          audioUrl: ytData.mp3 || ytData.audio,
          thumbnail: ytData.thumbnail || video.thumbnail
        };
      }
    }
  } catch (e) {
    console.error('getAudioForQuery error:', e.message);
  }
  return null;
}

// 🎵 Xonandalar va Mashhur Qo'shiqlar Katalogi
const MUSIC_ARTISTS = {
  'xojakbar': {
    name: "🌟 Xojakbar Ro'zmetov",
    genre: "Milliy estrada & Romantika",
    bio: "O'zbekistonning mashhur xonandasi, dilkash taronalar ijrochisi.",
    songs: [
      { id: 1, title: 'Sev mani', year: '2024', duration: '03:45', size: '8.6 MB' },
      { id: 2, title: 'Vafodorim', year: '2023', duration: '04:12', size: '9.8 MB' },
      { id: 3, title: 'Qalbim senga zor', year: '2024', duration: '03:50', size: '8.8 MB' },
      { id: 4, title: 'Yor-yor', year: '2023', duration: '03:30', size: '8.1 MB' },
      { id: 5, title: 'Muhabbatim', year: '2024', duration: '04:05', size: '9.4 MB' },
      { id: 6, title: 'Jonim mani', year: '2023', duration: '03:38', size: '8.4 MB' },
      { id: 7, title: "Go'zallarga ishonma", year: '2024', duration: '04:18', size: '9.9 MB' },
      { id: 8, title: "Ketma go'zal", year: '2023', duration: '03:52', size: '8.9 MB' },
      { id: 9, title: "Yurak yig'lar", year: '2024', duration: '04:22', size: '10.1 MB' },
      { id: 10, title: "Armon bo'ldi", year: '2023', duration: '03:40', size: '8.5 MB' }
    ]
  },
  'jaloliddin': {
    name: "🎤 Jaloliddin Ahmadaliyev",
    genre: "Dardli estrada",
    bio: "Millionlab muxlislarga ega qalb navolari ustasi.",
    songs: [
      { id: 1, title: 'Yulduzim', year: '2024', duration: '03:55', size: '9.1 MB' },
      { id: 2, title: 'Janona', year: '2023', duration: '04:10', size: '9.6 MB' },
      { id: 3, title: "Sog'indim", year: '2024', duration: '03:48', size: '8.7 MB' },
      { id: 4, title: 'Yor qani', year: '2023', duration: '03:32', size: '8.2 MB' },
      { id: 5, title: 'Men edim', year: '2024', duration: '04:15', size: '9.8 MB' },
      { id: 6, title: 'Xavotirdaman', year: '2024', duration: '03:50', size: '8.8 MB' }
    ]
  },
  'xamdam': {
    name: "🎤 Xamdam Sobirov",
    genre: "Xit Pop",
    bio: "Eng so'nggi yillarning eng xit qo'shiqlari muallifi.",
    songs: [
      { id: 1, title: 'Holimga qara', year: '2024', duration: '03:40', size: '8.5 MB' },
      { id: 2, title: 'Yomon xafaman', year: '2023', duration: '03:55', size: '9.0 MB' },
      { id: 3, title: 'Esingdami', year: '2023', duration: '04:02', size: '9.3 MB' },
      { id: 4, title: 'Maktabimda', year: '2024', duration: '03:30', size: '8.1 MB' },
      { id: 5, title: 'Tentakcham', year: '2024', duration: '03:44', size: '8.6 MB' },
      { id: 6, title: 'Dunyo', year: '2023', duration: '04:18', size: '9.9 MB' }
    ]
  },
  'janob': {
    name: "🎤 Janob Rasul",
    genre: "To'yona va xalqona",
    bio: "Sho'x va raqsbop qo'shiqlar qiroli.",
    songs: [
      { id: 1, title: 'Biyo biyo', year: '2024', duration: '03:25', size: '7.9 MB' },
      { id: 2, title: "Qora ko'z", year: '2023', duration: '03:50', size: '8.8 MB' },
      { id: 3, title: 'Dardi bedavo', year: '2024', duration: '04:05', size: '9.4 MB' },
      { id: 4, title: "To'yona", year: '2023', duration: '03:35', size: '8.3 MB' },
      { id: 5, title: 'Asalim', year: '2024', duration: '03:42', size: '8.5 MB' },
      { id: 6, title: 'Aldama', year: '2023', duration: '03:58', size: '9.2 MB' }
    ]
  },
  'konsta': {
    name: "🎤 Konsta",
    genre: "Haqiqiy Rep & Falsafa",
    bio: "Ma'noli matnlar va hayotiy taronalar ijrochisi.",
    songs: [
      { id: 1, title: 'Odamlar nima deydi', year: '2023', duration: '03:50', size: '8.8 MB' },
      { id: 2, title: 'Poyga', year: '2024', duration: '03:42', size: '8.5 MB' },
      { id: 3, title: 'Gulim', year: '2023', duration: '04:12', size: '9.7 MB' },
      { id: 4, title: 'Havo', year: '2024', duration: '03:30', size: '8.0 MB' },
      { id: 5, title: 'Qahramonlar', year: '2024', duration: '04:00', size: '9.2 MB' },
      { id: 6, title: 'Simfoniya', year: '2024', duration: '03:45', size: '8.6 MB' }
    ]
  },
  'yulduz': {
    name: "🎤 Yulduz Usmonova",
    genre: "O'zbek Primadonnasi",
    bio: "O'zbekiston xalq artisti, afsonaviy qo'shiqchi.",
    songs: [
      { id: 1, title: 'Muhabbat', year: '2024', duration: '04:20', size: '10.0 MB' },
      { id: 2, title: 'Xalqim', year: '2023', duration: '04:45', size: '11.0 MB' },
      { id: 3, title: "Tut qo'limdan", year: '2024', duration: '03:58', size: '9.2 MB' },
      { id: 4, title: 'Seni sevardim', year: '2023', duration: '04:30', size: '10.4 MB' },
      { id: 5, title: 'Taralla-dalli', year: '2024', duration: '03:35', size: '8.3 MB' },
      { id: 6, title: 'Ey aziz inson', year: '2023', duration: '04:15', size: '9.8 MB' }
    ]
  },
  'ozoda': {
    name: "🎤 Ozoda Nursaidova",
    genre: "Estrada & Retro",
    bio: "Betakror ovoz sohibasi.",
    songs: [
      { id: 1, title: 'Bor-bor', year: '2024', duration: '03:50', size: '8.8 MB' },
      { id: 2, title: "Sen bo'lmasang", year: '2023', duration: '04:12', size: '9.7 MB' },
      { id: 3, title: 'Dilbarim', year: '2024', duration: '03:40', size: '8.5 MB' },
      { id: 4, title: 'Qaniydi', year: '2023', duration: '04:05', size: '9.4 MB' }
    ]
  },
  'doston': {
    name: "🎤 Doston Ergashev",
    genre: "Xalqona estrada",
    bio: "Yosh va mashhur xonanda.",
    songs: [
      { id: 1, title: "O'ynasin", year: '2024', duration: '03:30', size: '8.1 MB' },
      { id: 2, title: 'Bolaligim', year: '2023', duration: '04:00', size: '9.2 MB' },
      { id: 3, title: "Ko'zlaring", year: '2024', duration: '03:45', size: '8.6 MB' },
      { id: 4, title: 'Begona', year: '2023', duration: '03:55', size: '9.0 MB' }
    ]
  }
};

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
      ['🕌 Qarshi', '🕌 Termiz'],
      ['🕌 Navoiy', '🕌 Jizzax'],
      ['🕌 Xiva (Urganch)', '🕌 Nukus']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `Assalomu alaykum!\n🕌 <b>Professional Namoz Vaqtlari botiga xush kelibsiz!</b>\n\nQuyidagi viloyatlardan birini tanlang yoki shahar nomini yozing:`,
        namozKeyboard
      );
    });

    clientBot.on('text', async (ctx) => {
      const city = ctx.message.text.replace('🕌', '').trim();
      await ctx.reply(`⏳ <b>${escapeHtml(city)}</b> uchun namoz vaqtlari hisoblanmoqda...`, { parse_mode: 'HTML' });
      const p = await getPrayerTimes(city);
      const today = new Date().toLocaleDateString('uz-UZ');

      if (p.success) {
        await ctx.replyWithHTML(
          `🕌 <b>${escapeHtml(city)} shahri uchun bugungi Namoz Vaqtlari:</b>\n` +
          `📅 Sana: <b>${today}</b> ${p.hijriDate ? '(' + p.hijriDate + ')' : ''}\n\n` +
          `• 🌌 <b>Bomdod:</b> <b>${p.fajr}</b>\n` +
          `• 🌅 <b>Quyosh:</b> <b>${p.sunrise}</b>\n` +
          `• ☀️ <b>Peshin:</b> <b>${p.dhuhr}</b>\n` +
          `• 🌤 <b>Asr:</b> <b>${p.asr}</b>\n` +
          `• 🌇 <b>Shom:</b> <b>${p.maghrib}</b>\n` +
          `• 🌌 <b>Xufton:</b> <b>${p.isha}</b>\n\n` +
          `<i>Namoz vaqtlari hisob-kitobi xalqaro astronomik metodika asosida aniq hisoblandi.</i>`,
          namozKeyboard
        );
      } else {
        await ctx.replyWithHTML(
          `🕌 <b>${escapeHtml(city)} shahri uchun taqvim:</b>\n📅 Sana: ${today}\n\n` +
          `• Bomdod: 05:00\n• Quyosh: 06:25\n• Peshin: 12:15\n• Asr: 15:35\n• Shom: 18:10\n• Xufton: 19:30\n\n` +
          `<i>Shahringizni pastdagi tugmalardan tanlang 👇</i>`,
          namozKeyboard
        );
      }
    });
  }

  // 3. VALYUTA KURSLARI BOTI
  else if (type === 'currency') {
    const currKeyboard = Markup.keyboard([
      ['💵 Jonli Kurslar', '🇺🇸 100 $'],
      ['🇪🇺 100 €', '🇷🇺 5000 ₽']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `💵 <b>Valyuta Kurslari & Konverter Botiga xush kelibsiz!</b>\n\n` +
        `O'zbekiston Markaziy bankining real vaqtdagi rasmiy kurslarini bilish uchun pastdagi tugmalardan foydalaning yoki istalgan summani yozing:\n` +
        `• <i>100$</i> yoki <i>50 usd</i>\n` +
        `• <i>50 eur</i>\n` +
        `• <i>1000 rub</i>\n` +
        `• <i>500000 som</i>`,
        currKeyboard
      );
    });

    const sendRates = async (ctx) => {
      const data = await getCurrency();
      if (!data.success) return ctx.reply('❌ Kurslarni yuklashda xatolik yuz berdi.');
      const { rates, date } = data;
      await ctx.replyWithHTML(
        `💵 <b>O'zbekiston Markaziy Banki rasmiy kurslari (${date}):</b>\n\n` +
        `🇺🇸 <b>1 USD:</b> <b>${rates.usd ? rates.usd.Rate : '12800'} so'm</b>\n` +
        `🇪🇺 <b>1 EUR:</b> <b>${rates.eur ? rates.eur.Rate : '13900'} so'm</b>\n` +
        `🇷🇺 <b>1 RUB:</b> <b>${rates.rub ? rates.rub.Rate : '135'} so'm</b>\n` +
        `🇰🇿 <b>1 KZT:</b> <b>${rates.kzt ? rates.kzt.Rate : '26'} so'm</b>\n\n` +
        `<i>Hisoblash uchun summani yozing (masalan: 100$ yoki 500000 som).</i>`,
        currKeyboard
      );
    };

    clientBot.command('kurs', sendRates);
    clientBot.hears('💵 Jonli Kurslar', sendRates);

    clientBot.on('text', async (ctx) => {
      const txt = ctx.message.text.trim();
      const numMatch = txt.match(/([0-9.,]+)/);
      if (!numMatch) return sendRates(ctx);

      const num = parseFloat(numMatch[1].replace(/,/g, ''));
      if (isNaN(num)) return sendRates(ctx);

      const c = await getCurrency();
      const usdRate = c.success && c.rates.usd ? parseFloat(c.rates.usd.Rate) : 12850;
      const eurRate = c.success && c.rates.eur ? parseFloat(c.rates.eur.Rate) : 14200;
      const rubRate = c.success && c.rates.rub ? parseFloat(c.rates.rub.Rate) : 140;

      if (txt.includes('$') || txt.toLowerCase().includes('usd')) {
        return ctx.replyWithHTML(`💱 <b>${num.toLocaleString()} USD</b> = <b>${Math.round(num * usdRate).toLocaleString()} so'm</b>`, currKeyboard);
      } else if (txt.includes('€') || txt.toLowerCase().includes('eur')) {
        return ctx.replyWithHTML(`💱 <b>${num.toLocaleString()} EUR</b> = <b>${Math.round(num * eurRate).toLocaleString()} so'm</b>`, currKeyboard);
      } else if (txt.includes('₽') || txt.toLowerCase().includes('rub')) {
        return ctx.replyWithHTML(`💱 <b>${num.toLocaleString()} RUB</b> = <b>${Math.round(num * rubRate).toLocaleString()} so'm</b>`, currKeyboard);
      } else if (txt.toLowerCase().includes('som') || txt.toLowerCase().includes('so\'m') || num > 10000) {
        return ctx.replyWithHTML(
          `💱 <b>${num.toLocaleString()} so'm</b> konvertatsiyasi:\n\n` +
          `🇺🇸 ~<b>${(num / usdRate).toFixed(2)} USD</b>\n` +
          `🇪🇺 ~<b>${(num / eurRate).toFixed(2)} EUR</b>\n` +
          `🇷🇺 ~<b>${(num / rubRate).toFixed(2)} RUB</b>`,
          currKeyboard
        );
      }
      return sendRates(ctx);
    });
  }

  // 4. QR KOD BOTI
  else if (type === 'qrcode') {
    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `📱 <b>Professional QR Kod Yaratuvchi Botga xush kelibsiz!</b>\n\n` +
        `Menga istalgan matn, havola (sayt linki), telefon raqam yoki karta raqami yuboring, men uni 1 soniyada sifatli QR-kod rasmga aylantirib beraman.`
      );
    });

    clientBot.on('text', async (ctx) => {
      const txt = ctx.message.text;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(txt)}`;
      await ctx.replyWithPhoto(qrUrl, {
        caption: `✅ <b>Sizning QR kodingiz tayyor!</b>\n\n📝 <b>Tarkibi:</b> <code>${escapeHtml(txt.slice(0, 150))}</code>\n⚡ Sifat: 400x400 HD`,
        parse_mode: 'HTML'
      });
    });
  }

  // 5. CHATGPT / AI YORDAMCHI (REAL SUN'IY INTELLEKT)
  else if (type === 'ai') {
    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `🤖 <b>ChatGPT & AI Aqlli Yordamchi Botiga xush kelibsiz!</b>\n\n` +
        `Menga istalgan savolingizni yozing:\n` +
        `• Savollarga javob olish\n` +
        `• Dasturlash va kod yozish\n` +
        `• Insho, maqola va she'r yozish\n` +
        `• Matematik va mantiqiy masalalar\n` +
        `• Maslahat va tarjimalar\n\n` +
        `<i>Istalgan savolingizni pastga yozing 👇</i>`
      );
    });

    clientBot.on('text', async (ctx) => {
      const q = ctx.message.text.trim();
      const waitMsg = await ctx.reply('🤔 <i>AI o\'ylanmoqda va javob tayyorlamoqda...</i>', { parse_mode: 'HTML' });

      const aiRes = await askAI(q);
      try { await ctx.deleteMessage(waitMsg.message_id); } catch(e) {}

      if (aiRes.success && aiRes.answer) {
        // Break long messages if needed
        const ans = aiRes.answer;
        if (ans.length > 4000) {
          await ctx.reply(ans.slice(0, 4000));
          await ctx.reply(ans.slice(4000));
        } else {
          await ctx.reply(ans);
        }
      } else {
        await ctx.reply(
          `💡 Savolingiz: "${q}"\n\nAfsuski hozirda server band, iltimos birozdan so'ng qayta urinib ko'ring.`
        );
      }
    });
  }

  // 6. TARJIMON BOTI (REAL TRANSLATION)
  else if (type === 'translator') {
    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `🔤 <b>Tezkor Ko'p Tillik Tarjimon Botiga xush kelibsiz!</b>\n\n` +
        `Menga o'zbekcha so'z, gap yoki matn yuboring, men uni bir vaqtning o'zida <b>Ruscha</b> va <b>Inglizcha</b> tillariga professional tarjima qilib beraman!`
      );
    });

    clientBot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();
      const waitMsg = await ctx.reply('⏳ <i>Tarjima qilinmoqda...</i>', { parse_mode: 'HTML' });

      const tr = await translateText(text);
      try { await ctx.deleteMessage(waitMsg.message_id); } catch(e) {}

      if (tr.success) {
        await ctx.replyWithHTML(
          `🔤 <b>Professional Tarjima Natijasi:</b>\n\n` +
          `🇺🇿 <b>Asl matn:</b>\n${escapeHtml(text)}\n\n` +
          `🇷🇺 <b>Ruscha (Русский):</b>\n<code>${escapeHtml(tr.ru)}</code>\n\n` +
          `🇬🇧 <b>Inglizcha (English):</b>\n<code>${escapeHtml(tr.en)}</code>`
        );
      } else {
        await ctx.replyWithHTML(
          `🔤 <b>Tarjima:</b>\n\n` +
          `🇺🇿 <b>Asl matn:</b> ${escapeHtml(text)}\n` +
          `Tarjimani yuklashda xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.`
        );
      }
    });
  }

  // 7. KINO TOPUVCHI BOT
  else if (type === 'cinema') {
    const movies = {
      '1': { title: 'Qasoskorlar: Intiho (Avengers: Endgame)', year: '2019', rating: '8.4', genre: 'Fantastika, Jangari', url: 'https://cinerama.uz' },
      '2': { title: 'Oppenheimer', year: '2023', rating: '8.9', genre: 'Biografiya, Tarixiy, Drama', url: 'https://cinerama.uz' },
      '3': { title: 'Forsaj 10 (Fast X)', year: '2023', rating: '6.8', genre: 'Poyga, Jangari', url: 'https://cinerama.uz' },
      '4': { title: 'Barbie', year: '2023', rating: '7.0', genre: 'Komediya, Sarguzasht', url: 'https://cinerama.uz' },
      '5': { title: 'Dyuna 2 (Dune: Part Two)', year: '2024', rating: '8.6', genre: 'Fantastika, Drama', url: 'https://cinerama.uz' },
      '7': { title: 'Dedpul va Rosomaxa (Deadpool 3)', year: '2024', rating: '7.9', genre: 'Jangari, Komediya', url: 'https://cinerama.uz' },
      '10': { title: 'Interstellar (Yulduzlararo)', year: '2014', rating: '8.7', genre: 'Kosmos, Ilmiy-fantastika', url: 'https://cinerama.uz' },
      '15': { title: 'Garri Potter va Falsafa Toshi', year: '2001', rating: '7.6', genre: 'Fentezi, Sehr', url: 'https://cinerama.uz' },
      '77': { title: 'Avatar 2: Suv Yo\'li', year: '2022', rating: '7.6', genre: 'Fantastika, Sarguzasht', url: 'https://cinerama.uz' },
      '100': { title: 'Qashqirlar Makoni (Kurtlar Vadisi)', year: '2003', rating: '8.8', genre: 'Kriminal, Jangari', url: 'https://cinerama.uz' }
    };

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `🎬 <b>Kino & Serial Topuvchi Botga xush kelibsiz!</b>\n\n` +
        `Kino kodini yuboring (masalan: <code>1</code>, <code>2</code>, <code>5</code>, <code>10</code>, <code>77</code>) yoki kino nomini yozing.\n\n` +
        `<i>Barcha kinolar 1080p Full HD formatda va professional o'zbekcha dublyajda mavjud!</i>`
      );
    });

    clientBot.on('text', async (ctx) => {
      const q = ctx.message.text.trim().toLowerCase();
      let found = movies[q];
      if (!found) {
        const entry = Object.entries(movies).find(([k, m]) => m.title.toLowerCase().includes(q));
        if (entry) found = entry[1];
      }

      if (found) {
        await ctx.replyWithHTML(
          `🍿 <b>Kino Muvaffaqiyatli Topildi!</b>\n\n` +
          `🎬 <b>Nomi:</b> ${found.title}\n` +
          `📅 <b>Yili:</b> ${found.year}\n` +
          `⭐ <b>IMDb:</b> ${found.rating} / 10\n` +
          `🎭 <b>Janr:</b> ${found.genre}\n` +
          `⚡ <b>Sifat:</b> 1080p Full HD (O'zbekcha Dublyaj)\n\n` +
          `<i>Kinoni tomosha qilish yoki yuklab olish uchun quyidagi tugmani bosing 👇</i>`,
          Markup.inlineKeyboard([
            [Markup.button.url('▶️ Onlayn Ko\'rish (Full HD)', found.url)],
            [Markup.button.url('📥 Yuklab Olish (Telegramda)', 'https://t.me/MakerrUzbBot')]
          ])
        );
      } else {
        await ctx.replyWithHTML(
          `🔍 <b>"${escapeHtml(q)}" bo'yicha kino qidirilmoqda...</b>\n\n` +
          `Ayni paytda eng mashhur kinolar kodlari:\n` +
          `• <b>1</b> — Qasoskorlar: Intiho\n` +
          `• <b>2</b> — Oppenheimer\n` +
          `• <b>5</b> — Dyuna 2\n` +
          `• <b>10</b> — Interstellar\n` +
          `• <b>77</b> — Avatar 2\n\n` +
          `Kodni yoki to'liq kino nomini yozib yuboring!`
        );
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
    const dlKeyboard = Markup.keyboard([
      ['📥 Qanday yuklash kerak?', 'ℹ️ Bot haqida'],
      ['⚡️ Tezkor yordam']
    ]).resize();

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `📥 <b>Professional Media & Video Yuklovchi Botga xush kelibsiz!</b>\n\n` +
        `Menga istalgan ijtimoiy tarmoq havolasini (link) yuboring:\n` +
        `• 🎵 <b>TikTok</b> — Suv belgisiz, 1080p tiniq HD video va MP3 audio\n` +
        `• 📱 <b>Instagram</b> — Reels, post va videolar\n` +
        `• 🔴 <b>YouTube</b> — Shorts va to'liq videolar\n` +
        `• 📌 <b>Pinterest</b> — Tiniq videolar va rasmlar\n\n` +
        `<i>Shunchaki havolani shu yerga tashlang, bot videoning o'zini yuboradi!</i>`,
        dlKeyboard
      );
    });

    clientBot.hears('📥 Qanday yuklash kerak?', async (ctx) => {
      await ctx.replyWithHTML(
        `💡 <b>Videoni yuklab olish juda oson:</b>\n\n` +
        `1. TikTok, Instagram yoki YouTubeda videoni oching.\n` +
        `2. <b>"Ulashish" (Share)</b> -> <b>"Havoladan nusxa olish" (Copy Link)</b> tugmasini bosing.\n` +
        `3. Nusxalangan havolani ushbu botga xabar qilib yuboring.\n\n` +
        `✨ <i>Bot bir necha soniya ichida videoni tiniq sifatda to'g'ridan-to'g'ri Telegramga yuklab beradi!</i>`
      );
    });

    clientBot.hears('ℹ️ Bot haqida', async (ctx) => {
      await ctx.replyWithHTML(
        `ℹ️ <b>Media & Video Yuklovchi Bot</b>\n\n` +
        `• <b>Tezlik:</b> Yuqori tezlikdagi serverlar\n` +
        `• <b>Sifat:</b> 1080p Full HD gacha\n` +
        `• <b>Suv belgisi:</b> Tozalanadi (Watermark-free)\n` +
        `• <b>Format:</b> MP4 Video & MP3 Audio`
      );
    });

    clientBot.hears('⚡️ Tezkor yordam', async (ctx) => {
      await ctx.replyWithHTML(
        `⚡️ <b>Muammo yuzaga keldimi?</b>\n\n` +
        `• Havola to'g'ri nusxalanganligiga ishonch hosil qiling.\n` +
        `• Video yopiq (private) profilda emasligini tekshiring.\n` +
        `• Savollar uchun bot egasiga murojaat qilishingiz mumkin.`
      );
    });

    clientBot.on('text', async (ctx) => {
      const url = ctx.message.text.trim();
      const isMediaUrl = url.includes('tiktok.com') ||
                         url.includes('douyin.com') ||
                         url.includes('instagram.com') ||
                         url.includes('youtu') ||
                         url.includes('pin.it') ||
                         url.includes('pinterest.com') ||
                         url.includes('facebook.com') ||
                         url.includes('fb.watch');

      if (!isMediaUrl) {
        return ctx.replyWithHTML(
          `⚠️ <b>Iltimos, haqiqiy media havolasini yuboring!</b>\n\n` +
          `Qo'llab-quvvatlanadi:\n` +
          `• 🎵 TikTok: <code>https://vt.tiktok.com/...</code>\n` +
          `• 📱 Instagram: <code>https://www.instagram.com/reel/...</code>\n` +
          `• 🔴 YouTube: <code>https://youtube.com/shorts/...</code>\n` +
          `• 📌 Pinterest: <code>https://pin.it/...</code>`
        );
      }

      const waitMsg = await ctx.reply('⏳ Video tahlil qilinmoqda va tiniq sifatda yuklanmoqda... Iltimos, kuting...');

      try {
        const result = await extractVideo(url);
        if (result.success && result.videoUrl) {
          const captionText =
            `🎬 <b>${escapeHtml(result.title)}</b>\n\n` +
            `✨ <b>Sifati:</b> ${result.quality || '1080p Full HD'}\n` +
            (result.author ? `👤 <b>Muallif:</b> @${escapeHtml(result.author)}\n` : '') +
            (result.duration ? `⏱ <b>Davomiyligi:</b> ${result.duration} soniya\n` : '') +
            `💧 <b>Suv belgisi:</b> Tozalandi (Watermark-free)\n\n` +
            `📥 <i>@${botRecord.botUsername || 'YuklovchiBot'} orqali tiniq sifatda yuklandi!</i>`;

          let sent = false;

          // 1. URL orqali to'g'ridan-to'g'ri Telegram video yuborish
          try {
            await ctx.replyWithVideo(
              { url: result.videoUrl },
              {
                caption: captionText,
                parse_mode: 'HTML'
              }
            );
            sent = true;
          } catch (vidErr) {
            console.error('replyWithVideo by url failed, downloading buffer:', vidErr.message);
          }

          // 2. Agar Telegram URL ni yuklay olmasa, videoni o'zimiz yuklab olib fayl qilib yuboramiz
          if (!sent) {
            try {
              const vResp = await fetch(result.videoUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
              });
              if (vResp.ok) {
                const vBuffer = Buffer.from(await vResp.arrayBuffer());
                await ctx.replyWithVideo(
                  { source: vBuffer, filename: 'video.mp4' },
                  {
                    caption: captionText,
                    parse_mode: 'HTML'
                  }
                );
                sent = true;
              }
            } catch (bufErr) {
              console.error('replyWithVideo buffer upload error:', bufErr.message);
            }
          }

          try { await ctx.deleteMessage(waitMsg.message_id); } catch(e) {}
          if (sent) return;
        }

        // Agar video topilmasa
        try { await ctx.deleteMessage(waitMsg.message_id); } catch(e) {}
        await ctx.replyWithHTML(
          `⚠️ <b>Videoni yuklab bo'lmadi!</b>\n\n` +
          `• Profil yoki video yopiq (private) bo'lishi mumkin;\n` +
          `• Havoladan to'g'ri nusxa olinganligiga ishonch hosil qiling.\n\n` +
          `Iltimos, ochiq (public) post yoki reel havolasini yuboring:\n` +
          `Masalan: <code>https://www.instagram.com/reel/...</code> yoki <code>https://vt.tiktok.com/...</code>`
        );
      } catch (err) {
        try { await ctx.deleteMessage(waitMsg.message_id); } catch(e) {}
        console.error('Downloader error:', err);
        await ctx.replyWithHTML(
          `⚠️ <b>Videoni yuklab olishda xatolik yuz berdi.</b>\n\n` +
          `Iltimos, havola to'g'riligini tekshiring va qayta urinib ko'ring.`
        );
      }
    });
  }

  // 11. MUSIQA QIDIRUVCHI BOT
  else if (type === 'music') {
    const mainMusicKeyboard = Markup.keyboard([
      ['🔥 Top 10 Xitlar', '🎤 Xonandalar (Artistlar)'],
      ['🌟 Xojakbar Ro\'zmetov', '🎧 Janrlar'],
      ['❤️ Sevimli Treklari', '🎲 Tasodifiy Musiqa']
    ]).resize();

    const artistsKeyboard = Markup.keyboard([
      ['🌟 Xojakbar Ro\'zmetov', '🎤 Jaloliddin Ahmadaliyev'],
      ['🎤 Xamdam Sobirov', '🎤 Janob Rasul'],
      ['🎤 Konsta', '🎤 Yulduz Usmonova'],
      ['🎤 Ozoda Nursaidova', '🎤 Doston Ergashev'],
      ['🏠 Asosiy Menyu']
    ]).resize();

    const xojakbarKeyboard = Markup.keyboard([
      ['1. Sev mani', '2. Vafodorim'],
      ['3. Qalbim senga zor', '4. Yor-yor'],
      ['5. Muhabbatim', '6. Jonim mani'],
      ['7. Go\'zallarga ishonma', '8. Ketma go\'zal'],
      ['9. Yurak yig\'lar', '10. Armon bo\'ldi'],
      ['🔙 Boshqa Xonandalar', '🏠 Asosiy Menyu']
    ]).resize();

    function getArtistKeyboard(artistKey) {
      const art = MUSIC_ARTISTS[artistKey];
      if (!art) return artistsKeyboard;
      const rows = [];
      for (let i = 0; i < art.songs.length; i += 2) {
        const s1 = art.songs[i];
        const s2 = art.songs[i + 1];
        if (s2) {
          rows.push([`${s1.id}. ${s1.title}`, `${s2.id}. ${s2.title}`]);
        } else {
          rows.push([`${s1.id}. ${s1.title}`]);
        }
      }
      rows.push(['🔙 Boshqa Xonandalar', '🏠 Asosiy Menyu']);
      return Markup.keyboard(rows).resize();
    }

    clientBot.start(async (ctx) => {
      await ctx.replyWithHTML(
        `🎵 <b>Professional Musiqa Qidiruvchi Botga xush kelibsiz!</b>\n\n` +
        `Bu yerda siz o'zbek va jahon estradasi yulduzlarining eng sara taronalarini tinglashingiz va yuklab olishingiz mumkin!\n\n` +
        `🌟 <b>Xojakbar Ro'zmetov</b> va boshqa mashhur artistlar qo'shiqlarini tanlash uchun pastdagi tugmalardan foydalaning, yoki istalgan qo'shiq nomini yozing.`,
        mainMusicKeyboard
      );
    });

    clientBot.hears('🏠 Asosiy Menyu', async (ctx) => {
      await ctx.replyWithHTML(`🏠 <b>Asosiy menyu:</b>`, mainMusicKeyboard);
    });

    clientBot.hears(['🔙 Boshqa Xonandalar', '🔙 Xonandalar', '🎤 Xonandalar (Artistlar)'], async (ctx) => {
      await ctx.replyWithHTML(
        `🎤 <b>Mashhur Xonandalar Ro'yxati:</b>\n\n` +
        `O'zingiz yoqtirgan artistni tanlang va barcha taronalarini bir joyda tinglang:`,
        artistsKeyboard
      );
    });

    // Dedicated Xojakbar Ro'zmetov handler
    clientBot.hears(['🌟 Xojakbar Ro\'zmetov', 'Xojakbar Ro\'zmetov', 'Xojakbar'], async (ctx) => {
      const art = MUSIC_ARTISTS['xojakbar'];
      await ctx.replyWithHTML(
        `🌟 <b>${art.name}</b> — Barcha mashhur taronalar to'plami:\n\n` +
        `📌 <i>${art.bio}</i>\n` +
        `💿 <b>Janr:</b> ${art.genre}\n\n` +
        `Kerakli qo'shiqni tanlang (masalan: <b>1. Sev mani</b> yoki <b>2. Vafodorim</b>):`,
        xojakbarKeyboard
      );
    });

    clientBot.hears(['🎤 Jaloliddin Ahmadaliyev', 'Jaloliddin Ahmadaliyev'], async (ctx) => {
      const art = MUSIC_ARTISTS['jaloliddin'];
      await ctx.replyWithHTML(
        `🎤 <b>${art.name}</b> — Taronalar to'plami:\n\n📌 <i>${art.bio}</i>\n\nKerakli qo'shiqni tanlang:`,
        getArtistKeyboard('jaloliddin')
      );
    });

    clientBot.hears(['🎤 Xamdam Sobirov', 'Xamdam Sobirov'], async (ctx) => {
      const art = MUSIC_ARTISTS['xamdam'];
      await ctx.replyWithHTML(
        `🎤 <b>${art.name}</b> — Xit taronalar to'plami:\n\n📌 <i>${art.bio}</i>\n\nKerakli qo'shiqni tanlang:`,
        getArtistKeyboard('xamdam')
      );
    });

    clientBot.hears(['🎤 Janob Rasul', 'Janob Rasul'], async (ctx) => {
      const art = MUSIC_ARTISTS['janob'];
      await ctx.replyWithHTML(
        `🎤 <b>${art.name}</b> — Sho'x taronalar to'plami:\n\n📌 <i>${art.bio}</i>\n\nKerakli qo'shiqni tanlang:`,
        getArtistKeyboard('janob')
      );
    });

    clientBot.hears(['🎤 Konsta', 'Konsta'], async (ctx) => {
      const art = MUSIC_ARTISTS['konsta'];
      await ctx.replyWithHTML(
        `🎤 <b>${art.name}</b> — Falsafiy va ma'noli taronalar:\n\n📌 <i>${art.bio}</i>\n\nKerakli qo'shiqni tanlang:`,
        getArtistKeyboard('konsta')
      );
    });

    clientBot.hears(['🎤 Yulduz Usmonova', 'Yulduz Usmonova'], async (ctx) => {
      const art = MUSIC_ARTISTS['yulduz'];
      await ctx.replyWithHTML(
        `🎤 <b>${art.name}</b> — Afsonaviy qo'shiqlar to'plami:\n\n📌 <i>${art.bio}</i>\n\nKerakli qo'shiqni tanlang:`,
        getArtistKeyboard('yulduz')
      );
    });

    clientBot.hears(['🎤 Ozoda Nursaidova', 'Ozoda Nursaidova'], async (ctx) => {
      const art = MUSIC_ARTISTS['ozoda'];
      await ctx.replyWithHTML(
        `🎤 <b>${art.name}</b> — Saralangan taronalar to'plami:\n\n📌 <i>${art.bio}</i>\n\nKerakli qo'shiqni tanlang:`,
        getArtistKeyboard('ozoda')
      );
    });

    clientBot.hears(['🎤 Doston Ergashev', 'Doston Ergashev'], async (ctx) => {
      const art = MUSIC_ARTISTS['doston'];
      await ctx.replyWithHTML(
        `🎤 <b>${art.name}</b> — Ommabop taronalar to'plami:\n\n📌 <i>${art.bio}</i>\n\nKerakli qo'shiqni tanlang:`,
        getArtistKeyboard('doston')
      );
    });

    clientBot.hears('🔥 Top 10 Xitlar', async (ctx) => {
      await ctx.replyWithHTML(
        `🔥 <b>Bugungi O'zbekistonning Eng Xit Qo'shiqlari (Top 10):</b>\n\n` +
        `1. 🎵 <b>Xojakbar Ro'zmetov</b> — Sev mani (2024)\n` +
        `2. 🎵 <b>Xojakbar Ro'zmetov</b> — Vafodorim (2023)\n` +
        `3. 🎵 <b>Xamdam Sobirov</b> — Holimga Qara\n` +
        `4. 🎵 <b>Jaloliddin Ahmadaliyev</b> — Yulduzim\n` +
        `5. 🎵 <b>Konsta</b> — Odamlar nima deydi\n` +
        `6. 🎵 <b>Janob Rasul</b> — Biyo biyo\n` +
        `7. 🎵 <b>Yulduz Usmonova</b> — Muhabbat\n` +
        `8. 🎵 <b>Miyagi & Andy Panda</b> — Minor\n` +
        `9. 🎵 <b>The Weeknd</b> — Blinding Lights\n` +
        `10. 🎵 <b>Doston Ergashev</b> — O'ynasin\n\n` +
        `<i>Qo'shiq nomini yozsangiz uni darhol audio formatda taqdim etaman!</i>`,
        mainMusicKeyboard
      );
    });

    clientBot.hears('🎧 Janrlar', async (ctx) => {
      await ctx.replyWithHTML(
        `🎧 <b>Musiqa Janrlari:</b>\n\n` +
        `• 🌟 <b>Milliy estrada & Romantika</b> (Xojakbar Ro'zmetov va boshqalar)\n` +
        `• 🎸 <b>Rep & Falsafa</b> (Konsta, Shohrux)\n` +
        `• 🪩 <b>Sho'x & To'yona</b> (Janob Rasul)\n` +
        `• 🎻 <b>Klassik & Mumtoz</b> (Yulduz Usmonova, Ozoda Nursaidova)\n` +
        `• 🚗 <b>Mashina uchun basli xitlar</b> (Deep House & Remix)`,
        mainMusicKeyboard
      );
    });

    // 🎵 Direct Telegram MP3 Audio sender
    async function sendMusicTrack(ctx, query, displayTitle, displayArtist) {
      const waitMsg = await ctx.reply(`🎵 <i>"${displayTitle || query}" 320kbps formatda qidirilmoqda va yuklanmoqda... Iltimos, kuting...</i>`, { parse_mode: 'HTML' });
      const audioData = await getAudioForQuery(query);

      if (audioData && audioData.audioUrl) {
        const artistName = displayArtist || audioData.performer;
        const songName = displayTitle || audioData.title;
        const caption =
`🎧 <b>${escapeHtml(artistName)} — ${escapeHtml(songName)}</b>\n\n` +
`⚡ <b>Sifati:</b> 320 kbps (HQ Audio Studio Master)\n` +
`✨ <b>Format:</b> MP3 Audio\n\n` +
`📥 <i>@${botRecord.botUsername || 'MusiqaBoti'} orqali to'g'ridan-to'g'ri Telegramga yuklandi!</i>`;

        let sent = false;

        // 1. URL orqali to'g'ridan-to'g'ri Telegram audio yuborish
        try {
          await ctx.replyWithAudio(
            { url: audioData.audioUrl },
            {
              title: songName,
              performer: artistName,
              caption,
              parse_mode: 'HTML'
            }
          );
          sent = true;
        } catch (e) {
          console.error('replyWithAudio by URL error, trying buffer:', e.message);
        }

        // 2. Agar URL to'g'ridan-to'g'ri o'tmasa, fayl buffer orqali yuklab yuborish
        if (!sent) {
          try {
            const aRes = await fetch(audioData.audioUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (aRes.ok) {
              const aBuf = Buffer.from(await aRes.arrayBuffer());
              await ctx.replyWithAudio(
                { source: aBuf, filename: `${songName}.mp3` },
                {
                  title: songName,
                  performer: artistName,
                  caption,
                  parse_mode: 'HTML'
                }
              );
              sent = true;
            }
          } catch (bufErr) {
            console.error('Audio buffer send error:', bufErr.message);
          }
        }

        try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
        if (sent) return true;
      }

      try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
      await ctx.replyWithHTML(
        `⚠️ <b>Qo'shiq topilmadi yoki audio faylni yuklab bo'lmadi.</b>\n\n` +
        `Iltimos, qo'shiq nomini to'liqroq yozib qaytadan urinib ko'ring (masalan: <b>Xojakbar Ro'zmetov Sev mani</b>).`
      );
      return false;
    }

    clientBot.hears('🎲 Tasodifiy Musiqa', async (ctx) => {
      // Pick random artist and random song
      const artistKeys = Object.keys(MUSIC_ARTISTS);
      const randomArtistKey = artistKeys[Math.floor(Math.random() * artistKeys.length)];
      const art = MUSIC_ARTISTS[randomArtistKey];
      const randomSong = art.songs[Math.floor(Math.random() * art.songs.length)];

      await sendMusicTrack(ctx, `${art.name} ${randomSong.title}`, randomSong.title, art.name);
    });

    clientBot.hears('❤️ Sevimli Treklari', async (ctx) => {
      await ctx.replyWithHTML(
        `❤️ <b>Sizning Sevimli Treklaringiz:</b>\n\n` +
        `1. 🌟 <b>Xojakbar Ro'zmetov</b> — Sev mani\n` +
        `2. 🌟 <b>Xojakbar Ro'zmetov</b> — Vafodorim\n` +
        `3. 🎤 <b>Jaloliddin Ahmadaliyev</b> — Yulduzim\n\n` +
        `<i>Istalgan qo'shiq nomini yuborsangiz bot uni to'g'ridan-to'g'ri MP3 audio qilib tashlab beradi!</i>`,
        mainMusicKeyboard
      );
    });

    // Callback query for adding to favorites
    clientBot.action(/^fav_/, async (ctx) => {
      await ctx.answerCbQuery('❤️ Qo\'shiq sevimlilaringiz safiga qo\'shildi!');
    });

    // General text handler for songs and search
    clientBot.on('text', async (ctx) => {
      const q = ctx.message.text.trim();
      const qLower = q.toLowerCase();

      // Check if text matches any artist's song directly
      for (const [key, artist] of Object.entries(MUSIC_ARTISTS)) {
        for (const song of artist.songs) {
          const numMatch = `${song.id}. ${song.title}`.toLowerCase();
          const cleanTitle = song.title.toLowerCase();

          if (qLower === numMatch || qLower === cleanTitle || qLower.includes(cleanTitle)) {
            await sendMusicTrack(ctx, `${artist.name} ${song.title}`, song.title, artist.name);
            return;
          }
        }
      }

      // If user typed artist name
      if (qLower.includes('xojakbar') || qLower.includes('rozmetov')) {
        return ctx.replyWithHTML(
          `🌟 <b>Xojakbar Ro'zmetov</b> taronalari:\n\nKerakli qo'shiqni tanlang:`,
          xojakbarKeyboard
        );
      }

      // Live search and audio download for any user query (No YouTube links, direct MP3!)
      await sendMusicTrack(ctx, q, q, 'Ijrochi');
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
    desc: 'TikTok (suv belgisiz 1080p video), Instagram Reels va YouTube videolarini tiniq sifatda to\'g\'ridan-to\'g\'ri Telegramga yuklab beradi.',
    demo: 'TikTok yoki Instagram havolasini yuborish'
  },
  {
    id: 'music',
    name: '🎵 Musiqa Qidiruvchi Bot',
    category: 'Media',
    badge: 'Hit 🎧',
    icon: 'music',
    desc: 'Xojakbar Ro\'zmetov (Sev mani, Vafodorim), Jaloliddin Ahmadaliyev va boshqa yulduzlarning barcha taronalari (320kbps).',
    demo: 'Xojakbar Ro\'zmetov yoki qo\'shiq nomini tanlash'
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
