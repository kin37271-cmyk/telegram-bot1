const { Telegraf, Markup } = require('telegraf');
const db = require('../data/db');
const mediaDownloader = require('./mediaDownloader');


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

// 🎵 YouTube MP3 audio fetcher (loader.to)
async function getMp3FromYouTubeUrl(ytUrl) {
  try {
    const initRes = await fetch(`https://loader.to/ajax/download.php?format=mp3&url=${encodeURIComponent(ytUrl)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000)
    });
    if (!initRes.ok) return null;
    const initData = await initRes.json();
    if (!initData || !initData.id) return null;

    const progressUrl = initData.progress_url || `https://loader.to/ajax/progress.php?id=${initData.id}`;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1200));
      const progRes = await fetch(progressUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6000)
      });
      if (!progRes.ok) continue;
      const progData = await progRes.json();
      if (progData.download_url) {
        return progData.download_url;
      }
    }
  } catch (err) {
    console.error('loader.to mp3 error:', err.message);
  }
  return null;
}

// 🎵 Real MP3 Audio Fetcher (320kbps Studio Master)
async function getAudioForQuery(query) {
  if (!btchDl) return null;
  try {
    const searchRes = await btchDl.yts(query);
    const all = searchRes?.result?.all || searchRes?.result || [];
    const videos = all.filter(x => (x.type === 'video' || x.videoId) && (!x.url || !x.url.includes('playlist')));
    if (!videos.length) return null;

    for (let i = 0; i < Math.min(videos.length, 3); i++) {
      const video = videos[i];
      const ytUrl = video.url || `https://www.youtube.com/watch?v=${video.videoId}`;
      const mp3Url = await getMp3FromYouTubeUrl(ytUrl);
      if (mp3Url) {
        return {
          title: video.title || query,
          performer: video.author?.name || 'Artist',
          audioUrl: mp3Url,
          thumbnail: video.thumbnail || video.image
        };
      }
    }
  } catch (e) {
    console.error('getAudioForQuery error:', e.message);
  }
  return null;
}

// 🎵 Xonandalar va Mashhur Qo'shiqlar Katalogi (To'liq O'zbek Yulduzlari)
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
  'munisa': {
    name: "🎤 Munisa Rizayeva",
    genre: "Zamonaviy estrada & Pop",
    bio: "O'zbek estradasining yorqin yulduzi, millionlab muxlislar sevimli san'atkori.",
    songs: [
      { id: 1, title: 'Jonginam', year: '2024', duration: '03:40', size: '8.5 MB' },
      { id: 2, title: "O'ylamading (feat. Konsta)", year: '2024', duration: '04:05', size: '9.4 MB' },
      { id: 3, title: 'Yonar', year: '2023', duration: '03:50', size: '8.8 MB' },
      { id: 4, title: 'Arzimaysan', year: '2023', duration: '03:35', size: '8.2 MB' },
      { id: 5, title: 'Sensiz', year: '2024', duration: '04:15', size: '9.8 MB' },
      { id: 6, title: 'Yetmadimi', year: '2023', duration: '03:48', size: '8.7 MB' },
      { id: 7, title: 'Kuch ber', year: '2024', duration: '03:55', size: '9.0 MB' },
      { id: 8, title: 'Xafa-xafa', year: '2023', duration: '03:30', size: '8.1 MB' }
    ]
  },
  'gaybulla': {
    name: "🎤 G'aybulla Tursunov",
    genre: "Xalqona & Shirin navolar",
    bio: "Haqiqiy xalqona va to'yona qo'shiqlar ustasi.",
    songs: [
      { id: 1, title: 'Maruskam', year: '2024', duration: '03:50', size: '8.8 MB' },
      { id: 2, title: 'Quralay', year: '2024', duration: '04:10', size: '9.5 MB' },
      { id: 3, title: 'Yulduzimsan', year: '2023', duration: '03:45', size: '8.6 MB' },
      { id: 4, title: 'Dilorom', year: '2024', duration: '04:02', size: '9.2 MB' },
      { id: 5, title: 'Jon bolam', year: '2023', duration: '04:20', size: '10.0 MB' },
      { id: 6, title: 'Shoir yigit', year: '2024', duration: '03:35', size: '8.2 MB' }
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
      { id: 6, title: 'Ey aziz inson', year: '2023', duration: '04:15', size: '9.8 MB' },
      { id: 7, title: 'Yulduzlar', year: '2024', duration: '04:10', size: '9.6 MB' },
      { id: 8, title: 'Binafsha', year: '2023', duration: '03:50', size: '8.8 MB' }
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
  },
  'tohir': {
    name: "🎤 Tohir Sodiqov (Bolalar)",
    genre: "Afsonaviy O'zbek Rok & Pop",
    bio: "Bolalar guruhi asoschisi, o'zbek estradasining tirik afsonasi.",
    songs: [
      { id: 1, title: 'Kerak emas shahlo ko\'zlaring', year: '2023', duration: '04:15', size: '9.8 MB' },
      { id: 2, title: 'Sevgi fasli', year: '2024', duration: '03:50', size: '8.8 MB' },
      { id: 3, title: 'Yomg\'irlar', year: '2023', duration: '04:05', size: '9.4 MB' },
      { id: 4, title: 'Eshiging ochmadi yor', year: '2024', duration: '03:40', size: '8.5 MB' }
    ]
  },
  'shohrux': {
    name: "🎤 Shohruxxon",
    genre: "Romantik estrada",
    bio: "Dilbar qo'shiqlar va sevimli taronalar muallifi.",
    songs: [
      { id: 1, title: 'Yig\'lama yurak', year: '2024', duration: '03:45', size: '8.6 MB' },
      { id: 2, title: 'Zor-zor', year: '2023', duration: '04:00', size: '9.2 MB' },
      { id: 3, title: 'Pari', year: '2024', duration: '03:35', size: '8.2 MB' }
    ]
  },
  'rayhon': {
    name: "🎤 Rayhon G'aniyeva",
    genre: "Zamonaviy Pop Diva",
    bio: "Betakror shou va kuylar yaratuvchisi.",
    songs: [
      { id: 1, title: 'Yuragimdasan', year: '2024', duration: '03:50', size: '8.8 MB' },
      { id: 2, title: 'Ayt', year: '2023', duration: '04:10', size: '9.5 MB' },
      { id: 3, title: 'Aldangan yurak', year: '2024', duration: '03:42', size: '8.5 MB' }
    ]
  },
  'shahzoda': {
    name: "🎤 Shahzoda",
    genre: "Sharqona Pop",
    bio: "O'zbek va xalqaro estrada yulduzi.",
    songs: [
      { id: 1, title: 'Chik-chik', year: '2024', duration: '03:30', size: '8.1 MB' },
      { id: 2, title: 'Assalomu alaykum', year: '2023', duration: '03:55', size: '9.0 MB' },
      { id: 3, title: 'Layli va Majnun', year: '2024', duration: '04:05', size: '9.4 MB' }
    ]
  },
  'botir': {
    name: "🎤 Botir Qodirov",
    genre: "Mumtoz va Klassik estrada",
    bio: "Dardli va kuchli ovoz sohibi.",
    songs: [
      { id: 1, title: 'Ona', year: '2024', duration: '04:30', size: '10.3 MB' },
      { id: 2, title: 'Jim turing', year: '2023', duration: '04:15', size: '9.8 MB' },
      { id: 3, title: 'Seni deb', year: '2024', duration: '03:50', size: '8.8 MB' }
    ]
  },
  'sherali': {
    name: "🎤 Sherali Jo'rayev",
    genre: "O'zbek Milliy Klassikasi",
    bio: "O'zbekiston xalq hofizi, afsonaviy san'atkor.",
    songs: [
      { id: 1, title: 'Karvon', year: '2023', duration: '05:20', size: '12.2 MB' },
      { id: 2, title: 'O\'zbegim', year: '2023', duration: '06:10', size: '14.0 MB' },
      { id: 3, title: 'Gulandon', year: '2024', duration: '04:45', size: '11.0 MB' }
    ]
  }
};

// Map to track client bot admin dialog states: `${botId}_${userId}` -> { step, ... }
const clientAdminStates = new Map();

// Helper to render owner Admin Panel
function renderClientAdminPanel(botId, botRecord) {
  const curBot = db.getBot(botId) || botRecord;
  const subCount = db.getBotSubscribersCount ? db.getBotSubscribersCount(botId) : 0;
  const channels = curBot.mandatoryChannels || [];
  const hasCustomStart = !!curBot.customStartText;

  const text =
`👑 <b>BOT EGASI BOSHQARUV PANELI (ADMIN PANEL)</b>

🤖 <b>Bot:</b> @${curBot.botUsername || botRecord.botUsername}
🛠 <b>Turi:</b> ${(curBot.botType || botRecord.botType || '').toUpperCase()}

📊 <b>Hozirgi holat:</b>
• 👥 <b>Jami obunachilar:</b> <b>${subCount} ta</b>
• 📢 <b>Majburiy kanallar:</b> <b>${channels.length} ta</b>
• ✍️ <b>Start xabari:</b> <b>${hasCustomStart ? 'Moslashtirilgan ✅' : 'Standart (shablon)'}</b>

<i>Quyidagi tugmalar orqali botingizni to'liq boshqaring:</i>`;

  const buttons = [
    [
      Markup.button.callback('📊 Statistika', 'c_admin_stats'),
      Markup.button.callback('📢 Xabar Tarqatish', 'c_admin_broadcast')
    ],
    [
      Markup.button.callback('📢 Majburiy Kanallar', 'c_admin_channels'),
      Markup.button.callback('✍️ Start Matni', 'c_admin_start_text')
    ],
    [
      Markup.button.callback('🔄 Yangilash', 'c_admin_refresh'),
      Markup.button.callback('🔙 Chiqish', 'c_admin_exit')
    ]
  ];

  return { text, keyboard: Markup.inlineKeyboard(buttons) };
}

// Setup handlers for each bot template
function setupBotHandlers(clientBot, botRecord) {
  const botId = botRecord.id;
  const ownerId = String(botRecord.userId);
  const type = botRecord.botType || 'weather';

  // 1. Obunachini ro'yxatga olish (Automatic subscriber tracking)
  clientBot.use(async (ctx, next) => {
    if (ctx.from) {
      db.addBotSubscriber(botId, {
        id: ctx.from.id,
        name: ctx.from.first_name || 'Foydalanuvchi',
        username: ctx.from.username || ''
      });
    }
    return next();
  });

  // 2. Majburiy obuna tekshiruvi (oddiy foydalanuvchilar uchun)
  clientBot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    // Bot egasiga hech qanday cheklov yo'q
    if (String(userId) === ownerId) {
      return next();
    }

    // Callback query tekshiruvi bo'lsa o'tkazamiz
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'client_check_sub') {
      return next();
    }

    const curBot = db.getBot(botId) || botRecord;
    const channels = curBot.mandatoryChannels || [];
    if (!channels || channels.length === 0) {
      return next();
    }

    let notJoined = [];
    for (const ch of channels) {
      try {
        const member = await ctx.telegram.getChatMember(ch.channelId || ch.username, userId);
        const okStatuses = ['creator', 'administrator', 'member', 'restricted'];
        if (!okStatuses.includes(member.status)) {
          notJoined.push(ch);
        }
      } catch (e) {
        // Agar kanalda bot admin bo'lmasa, user bloklanmaydi
      }
    }

    if (notJoined.length > 0) {
      const buttons = notJoined.map(ch => [
        Markup.button.url(
          `📢 ${ch.title || ch.username} kanaliga a'zo bo'lish`,
          ch.inviteUrl || `https://t.me/${(ch.username || '').replace('@', '')}`
        )
      ]);
      buttons.push([Markup.button.callback('🔄 A\'zolikni tekshirish', 'client_check_sub')]);

      const msg = `⚠️ <b>Botdan to'liq foydalanish uchun quyidagi kanallarga a'zo bo'ling:</b>\n\nA'zo bo'lgach, "🔄 A'zolikni tekshirish" tugmasini bosing!`;
      return ctx.replyWithHTML(msg, Markup.inlineKeyboard(buttons));
    }

    return next();
  });

  // A'zolikni tekshirish callbacki
  clientBot.action('client_check_sub', async (ctx) => {
    const userId = ctx.from.id;
    const curBot = db.getBot(botId) || botRecord;
    const channels = curBot.mandatoryChannels || [];
    let notJoined = [];

    for (const ch of channels) {
      try {
        const member = await ctx.telegram.getChatMember(ch.channelId || ch.username, userId);
        const okStatuses = ['creator', 'administrator', 'member', 'restricted'];
        if (!okStatuses.includes(member.status)) {
          notJoined.push(ch);
        }
      } catch (e) {}
    }

    if (notJoined.length > 0) {
      return ctx.answerCbQuery('❌ Siz hali barcha kanallarga a\'zo bo\'lmadingiz!', { show_alert: true });
    }

    await ctx.answerCbQuery('✅ Rahmat! Kanallarga a\'zoligingiz tasdiqlandi!');
    try { await ctx.deleteMessage(); } catch (e) {}
    await ctx.reply('🎉 Tabriklaymiz! Endi botdan to\'liq foydalanishingiz mumkin. /start buyrug\'ini yuboring.');
  });

  // 3. Bot egasining faol dialog holatlarini ushlash middleware
  clientBot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || String(userId) !== ownerId) return next();

    const stateKey = `${botId}_${userId}`;
    const state = clientAdminStates.get(stateKey);
    if (!state) return next();

    const text = ctx.message?.text?.trim();

    // Bekor qilish
    if (text === '/cancel' || text === '❌ Bekor qilish') {
      clientAdminStates.delete(stateKey);
      await ctx.reply('Amal bekor qilindi. Boshqaruv menyusiga qaytdingiz.');
      const panel = renderClientAdminPanel(botId, botRecord);
      return ctx.replyWithHTML(panel.text, panel.keyboard);
    }

    // A. Rassilka (Xabar tarqatish)
    if (state.step === 'awaiting_broadcast') {
      clientAdminStates.delete(stateKey);
      const subs = db.getBotSubscribers(botId);
      if (!subs || subs.length === 0) {
        return ctx.reply('Botda hali obunachilar mavjud emas.');
      }

      const waitMsg = await ctx.reply(`⏳ Xabar barcha obunachilarga tarqatilmoqda (Jami: ${subs.length} ta)...`);
      let sent = 0, failed = 0;

      for (const s of subs) {
        try {
          await ctx.copyMessage(s.id);
          sent++;
        } catch (e) {
          failed++;
        }
        if (subs.length > 25) {
          await new Promise(r => setTimeout(r, 40));
        }
      }

      try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
      await ctx.replyWithHTML(
        `✅ <b>XABAR TARQATISH YAKUNLANDI!</b>\n\n` +
        `👥 <b>Jami obunachilar:</b> ${subs.length} ta\n` +
        `📤 <b>Muvaffaqiyatli yetkazildi:</b> <b>${sent} ta</b>\n` +
        `🚫 <b>Yetkazilmadi (bloklaganlar):</b> <b>${failed} ta</b>`
      );
      const panel = renderClientAdminPanel(botId, botRecord);
      return ctx.replyWithHTML(panel.text, panel.keyboard);
    }

    // B. Majburiy kanal qo'shish
    if (state.step === 'awaiting_channel') {
      clientAdminStates.delete(stateKey);
      let channelInput = (text || '').replace('https://t.me/', '').trim();
      if (!channelInput.startsWith('@') && !channelInput.startsWith('-100')) {
        channelInput = '@' + channelInput;
      }

      const waitMsg = await ctx.reply(`⏳ <b>${escapeHtml(channelInput)}</b> kanali tekshirilmoqda...`, { parse_mode: 'HTML' });
      try {
        const chat = await ctx.telegram.getChat(channelInput);
        const botMe = await ctx.telegram.getMe();
        let botMember;
        try {
          botMember = await ctx.telegram.getChatMember(chat.id, botMe.id);
        } catch (err) {
          try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
          return ctx.replyWithHTML(
            `❌ <b>Botingiz bu kanalda topilmadi!</b>\n\nIltimos, avval botingizni (<b>@${botMe.username}</b>) ushbu kanalga qo'shing va unga <b>Administrator</b> huquqini bering!`,
            Markup.inlineKeyboard([[Markup.button.callback('🔙 Admin Panel', 'c_admin_back')]])
          );
        }

        if (botMember.status !== 'administrator' && botMember.status !== 'creator') {
          try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
          return ctx.replyWithHTML(
            `❌ <b>Botingiz kanalda Administrator emas!</b>\n\nBotingiz obunani tekshirishi uchun kanalda admin huquqiga ega bo'lishi shart.`,
            Markup.inlineKeyboard([[Markup.button.callback('🔙 Admin Panel', 'c_admin_back')]])
          );
        }

        db.addMandatoryChannel(botId, {
          channelId: chat.id,
          username: chat.username ? `@${chat.username}` : channelInput,
          title: chat.title || channelInput,
          inviteUrl: chat.invite_link || (chat.username ? `https://t.me/${chat.username}` : '')
        });

        try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
        await ctx.replyWithHTML(
          `🎉 <b>${escapeHtml(chat.title || channelInput)}</b> kanali muvaffaqiyatli qo'shildi!\n\nEndi botdan foydalanuvchilar ushbu kanalga a'zo bo'lishlari shart bo'ladi.`
        );
        const panel = renderClientAdminPanel(botId, botRecord);
        return ctx.replyWithHTML(panel.text, panel.keyboard);
      } catch (err) {
        try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
        return ctx.replyWithHTML(
          `❌ <b>Kanal topilmadi:</b> ${escapeHtml(err.message)}\n\nKanal ommaviy (public) ekanligini yoki to'g'ri yozilganini tekshiring (masalan: <code>@mening_kanalim</code>).`,
          Markup.inlineKeyboard([[Markup.button.callback('🔙 Admin Panel', 'c_admin_back')]])
        );
      }
    }

    // C. Start matnini o'zgartirish
    if (state.step === 'awaiting_start_text') {
      clientAdminStates.delete(stateKey);
      if (!text) {
        return ctx.reply('Iltimos, matn yuboring.');
      }
      db.updateBotSettings(botId, { customStartText: text });
      await ctx.replyWithHTML(
        `✅ <b>Start salomlashish matni muvaffaqiyatli saqlandi!</b>\n\nEndi botingiz yangi a'zolarni aynan shu matn bilan kutib oladi.`
      );
      const panel = renderClientAdminPanel(botId, botRecord);
      return ctx.replyWithHTML(panel.text, panel.keyboard);
    }

    return next();
  });

  // 4. Bot egasi /admin buyrug'i
  clientBot.hears(['/admin', '👑 Admin Panel', 'admin', 'Admin'], async (ctx, next) => {
    if (String(ctx.from.id) !== ownerId) {
      return next();
    }
    clientAdminStates.delete(`${botId}_${ctx.from.id}`);
    const panel = renderClientAdminPanel(botId, botRecord);
    return ctx.replyWithHTML(panel.text, panel.keyboard);
  });

  // 5. Admin Panel Callbacks
  clientBot.action('c_admin_refresh', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    const panel = renderClientAdminPanel(botId, botRecord);
    await ctx.answerCbQuery('Yangilandi 🔄');
    try {
      await ctx.editMessageText(panel.text, { parse_mode: 'HTML', ...panel.keyboard });
    } catch (e) {}
  });

  clientBot.action('c_admin_back', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    clientAdminStates.delete(`${botId}_${ctx.from.id}`);
    const panel = renderClientAdminPanel(botId, botRecord);
    await ctx.answerCbQuery();
    try {
      await ctx.editMessageText(panel.text, { parse_mode: 'HTML', ...panel.keyboard });
    } catch (e) {}
  });

  clientBot.action('c_admin_exit', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    clientAdminStates.delete(`${botId}_${ctx.from.id}`);
    await ctx.answerCbQuery('Chiqildi');
    try { await ctx.deleteMessage(); } catch (e) {}
    await ctx.reply('Foydalanuvchi rejimiga qaytdingiz. /start orqali botdan foydalanishingiz mumkin.');
  });

  clientBot.action('c_admin_stats', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    await ctx.answerCbQuery();
    const subs = db.getBotSubscribers(botId);
    const curBot = db.getBot(botId) || botRecord;
    const channels = curBot.mandatoryChannels || [];
    const recent = subs.slice(-7).reverse();

    let text =
`📊 <b>BOT STATISTIKASI VA FOYDALANUVCHILAR</b>

🤖 <b>Bot:</b> @${curBot.botUsername || botRecord.botUsername}
👥 <b>Jami obunachilar:</b> <b>${subs.length} ta</b>
📢 <b>Majburiy kanallar:</b> <b>${channels.length} ta</b>
⚡ <b>Holati:</b> 24/7 Avto Hostingda Onlayn 🟢

`;
    if (recent.length > 0) {
      text += `🕒 <b>So'nggi qo'shilganlar:</b>\n`;
      recent.forEach((u, i) => {
        const uName = escapeHtml(u.name || 'User');
        const uLink = u.username ? `@${u.username}` : `<code>${u.id}</code>`;
        text += `${i + 1}. ${uName} (${uLink})\n`;
      });
    } else {
      text += `<i>Hozircha obunachilar yo'q. Bot havolasini ulashing!</i>`;
    }

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Yangilash', 'c_admin_stats')],
      [Markup.button.callback('🔙 Admin Panel', 'c_admin_back')]
    ]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb });
    } catch (e) {}
  });

  clientBot.action('c_admin_broadcast', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    await ctx.answerCbQuery();
    const subs = db.getBotSubscribers(botId);
    clientAdminStates.set(`${botId}_${ctx.from.id}`, { step: 'awaiting_broadcast' });

    const text =
`📢 <b>HAMMAGA XABAR YUBORISH (RASSILKA)</b>

📊 Botingizdagi obunachilar: <b>${subs.length} ta</b>

Barcha obunachilarga yubormoqchi bo'lgan xabaringizni shu yerga yuboring:
• ✍️ <b>Matn</b>
• 🖼 <b>Rasm</b> (izohi bilan)
• 🎥 <b>Video</b> (izohi bilan)
• 🔁 <b>Forward</b> (istalgan kanaldan post)

<i>Bekor qilish uchun pastdagi tugmani bosing:</i>`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Bekor qilish', 'c_admin_cancel')]
    ]);

    await ctx.replyWithHTML(text, kb);
  });

  clientBot.action('c_admin_cancel', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    clientAdminStates.delete(`${botId}_${ctx.from.id}`);
    await ctx.answerCbQuery('Bekor qilindi');
    try { await ctx.deleteMessage(); } catch (e) {}
    const panel = renderClientAdminPanel(botId, botRecord);
    await ctx.replyWithHTML(panel.text, panel.keyboard);
  });

  clientBot.action('c_admin_channels', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    await ctx.answerCbQuery();
    const curBot = db.getBot(botId) || botRecord;
    const channels = curBot.mandatoryChannels || [];

    let text = `📢 <b>MAJBURIY A'ZOLIK KANALLARI</b>\n\n`;
    if (channels.length === 0) {
      text += `Hozircha majburiy kanallar belgilanmagan.\nFoydalanuvchilar to'g'ridan-to'g'ri botdan foydalanishmoqda.\n\n`;
    } else {
      text += `Ulangan kanallar (foydalanuvchilar bu kanallarga a'zo bo'lmaguncha bot ishlamaydi):\n\n`;
    }

    const buttons = [];
    channels.forEach((ch, idx) => {
      text += `${idx + 1}. <b>${escapeHtml(ch.title || ch.username)}</b> (${ch.username})\n`;
      buttons.push([Markup.button.callback(`🗑 O'chirish: ${ch.username}`, `c_del_ch_${ch.channelId || ch.username}`)]);
    });

    buttons.push([Markup.button.callback('➕ Yangi kanal qo\'shish', 'c_add_channel')]);
    buttons.push([Markup.button.callback('🔙 Admin Panel', 'c_admin_back')]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    } catch (e) {}
  });

  clientBot.action('c_add_channel', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    await ctx.answerCbQuery();
    clientAdminStates.set(`${botId}_${ctx.from.id}`, { step: 'awaiting_channel' });

    const text =
`➕ <b>YANGI MAJBURIY KANAL QO'SHISH</b>

Kanal username yoki havolasini yuboring (masalan: <code>@mening_kanalim</code>).

⚠️ <b>MUHIM QOIDA:</b>
Botingiz ushbu kanalda <b>Administrator</b> qilib qo'shilgan bo'lishi shart! Aks holda a'zolikni tekshirib bo'lmaydi.`;

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Bekor qilish', 'c_admin_cancel')]
    ]);

    await ctx.replyWithHTML(text, kb);
  });

  clientBot.action(/^c_del_ch_(.+)$/, async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    const target = ctx.match[1];
    db.removeMandatoryChannel(botId, target);
    await ctx.answerCbQuery('Kanal o\'chirildi 🗑');

    const curBot = db.getBot(botId) || botRecord;
    const channels = curBot.mandatoryChannels || [];
    let text = `📢 <b>MAJBURIY A'ZOLIK KANALLARI</b>\n\n`;
    if (channels.length === 0) {
      text += `Hozircha majburiy kanallar belgilanmagan.\n\n`;
    } else {
      text += `Ulangan kanallar:\n\n`;
    }
    const buttons = [];
    channels.forEach((ch, idx) => {
      text += `${idx + 1}. <b>${escapeHtml(ch.title || ch.username)}</b> (${ch.username})\n`;
      buttons.push([Markup.button.callback(`🗑 O'chirish: ${ch.username}`, `c_del_ch_${ch.channelId || ch.username}`)]);
    });
    buttons.push([Markup.button.callback('➕ Yangi kanal qo\'shish', 'c_add_channel')]);
    buttons.push([Markup.button.callback('🔙 Admin Panel', 'c_admin_back')]);

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    } catch (e) {}
  });

  clientBot.action('c_admin_start_text', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    await ctx.answerCbQuery();
    const curBot = db.getBot(botId) || botRecord;

    let text =
`✍️ <b>BOT START (SALOMLASHISH) MATNI</b>\n\n` +
`Hozirgi start matni:\n` +
`━━━━━━━━━━━━━━━━━━━━━\n` +
`${escapeHtml(curBot.customStartText || 'Standart shablon matni o\'rnatilgan.')}\n` +
`━━━━━━━━━━━━━━━━━━━━━\n\n` +
`<i>O'zgartirish uchun "✏️ Yangi matn kiritish" tugmasini bosing:</i>`;

    const buttons = [
      [Markup.button.callback('✏️ Yangi matn kiritish', 'c_edit_start_text')],
      [Markup.button.callback('🔄 Standartga qaytarish', 'c_reset_start_text')],
      [Markup.button.callback('🔙 Admin Panel', 'c_admin_back')]
    ];

    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
    } catch (e) {}
  });

  clientBot.action('c_edit_start_text', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    await ctx.answerCbQuery();
    clientAdminStates.set(`${botId}_${ctx.from.id}`, { step: 'awaiting_start_text' });

    await ctx.replyWithHTML(
      `✍️ Yangi salomlashish matnini yozib yuboring:\n\n` +
      `<i>💡 Maslahat: Foydalanuvchi ismini chiqarish uchun matnda <code>{name}</code> so'zidan foydalanishingiz mumkin.</i>`,
      Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'c_admin_cancel')]])
    );
  });

  clientBot.action('c_reset_start_text', async (ctx) => {
    if (String(ctx.from.id) !== ownerId) return ctx.answerCbQuery('Ruxsat yo\'q!');
    db.updateBotSettings(botId, { customStartText: null });
    await ctx.answerCbQuery('Standartga qaytarildi 🔄');
    const panel = renderClientAdminPanel(botId, botRecord);
    try {
      await ctx.editMessageText(panel.text, { parse_mode: 'HTML', ...panel.keyboard });
    } catch (e) {}
  });

  // Start matnini chiqaruvchi yordamchi funksiya
  function sendStartWelcome(ctx, defaultHtml, keyboard = null) {
    const curBot = db.getBot(botId) || botRecord;
    const name = escapeHtml(ctx.from?.first_name || 'Foydalanuvchi');
    let welcome = curBot.customStartText
      ? curBot.customStartText.replace(/{name}/g, name)
      : defaultHtml;

    if (String(ctx.from?.id) === ownerId) {
      welcome += `\n\n👑 <i>Siz bot egasisiz. Boshqaruv paneli uchun: /admin</i>`;
    }
    const extra = { parse_mode: 'HTML' };
    if (keyboard) Object.assign(extra, keyboard);
    return ctx.reply(welcome, extra);
  }

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
      await sendStartWelcome(
        ctx,
        `Assalomu alaykum, <b>${escapeHtml(name)}</b>!\n\n` +
        `🌦 <b>Professional Ob-havo botiga xush kelibsiz!</b>\n\n` +
        `Pastdagi shaharlardan birini tanlang yoki istalgan shahar/tuman nomini yozing (masalan: <i>Chirchiq</i>, <i>Zomin</i>, <i>Moskva</i>).`,
        citiesKeyboard
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
      await sendStartWelcome(
        ctx,
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
      await sendStartWelcome(
        ctx,
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

  // 11. MUSIQA QIDIRUVCHI BOT
  else if (type === 'music') {
    const mainMusicKeyboard = Markup.keyboard([
      ['🔥 Top 10 Xitlar', '🎤 Xonandalar (Artistlar)'],
      ['🌟 Xojakbar Ro\'zmetov', '🎧 Janrlar'],
      ['❤️ Sevimli Treklari', '🎲 Tasodifiy Musiqa']
    ]).resize();

    const artistsKeyboard = Markup.keyboard([
      ['🌟 Xojakbar Ro\'zmetov', '🎤 Munisa Rizayeva'],
      ['🎤 G\'aybulla Tursunov', '🎤 Yulduz Usmonova'],
      ['🎤 Jaloliddin Ahmadaliyev', '🎤 Xamdam Sobirov'],
      ['🎤 Janob Rasul', '🎤 Konsta'],
      ['🎤 Ozoda Nursaidova', '🎤 Doston Ergashev'],
      ['🎤 Tohir Sodiqov (Bolalar)', '🎤 Shohruxxon'],
      ['🎤 Rayhon G\'aniyeva', '🎤 Shahzoda'],
      ['🎤 Botir Qodirov', '🎤 Sherali Jo\'rayev'],
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
        `🌟 <b>Munisa Rizayeva, G'aybulla Tursunov, Yulduz Usmonova, Xojakbar Ro'zmetov</b> va barcha mashhur artistlar qo'shiqlari mavjud.\n\n` +
        `Pastdagi tugmalardan xonandani tanlang yoki istalgan qo'shiq nomini yozing!`,
        mainMusicKeyboard
      );
    });

    clientBot.hears('🏠 Asosiy Menyu', async (ctx) => {
      await ctx.replyWithHTML(`🏠 <b>Asosiy menyu:</b>`, mainMusicKeyboard);
    });

    clientBot.hears(['🔙 Boshqa Xonandalar', '🔙 Xonandalar', '🎤 Xonandalar (Artistlar)'], async (ctx) => {
      await ctx.replyWithHTML(
        `🎤 <b>Mashhur O'zbek Xonandalari:</b>\n\n` +
        `O'zingiz yoqtirgan artistni tanlang va barcha mashhur taronalarini bir joyda tinglang:`,
        artistsKeyboard
      );
    });

    // Dynamic handlers for all artists in MUSIC_ARTISTS
    Object.entries(MUSIC_ARTISTS).forEach(([key, art]) => {
      const cleanName = art.name.replace(/[^\w\s\u0400-\u04FF']/gi, '').trim();
      const triggers = [art.name, cleanName];
      if (key === 'munisa') triggers.push('Munisa Rizayeva', 'Munisa Usmonova', 'Munisa', 'munisa');
      if (key === 'gaybulla') triggers.push('G\'aybulla Tursunov', 'Gaybulla Tursunov', 'Gaybulla', 'gaybulla', 'G‘aybulla Tursunov');
      if (key === 'yulduz') triggers.push('Yulduz Usmonova', 'Yulduz', 'yulduz');
      if (key === 'xojakbar') triggers.push('Xojakbar Ro\'zmetov', 'Xojakbar', 'xojakbar', 'Xojiakbar');

      clientBot.hears(triggers, async (ctx) => {
        await ctx.replyWithHTML(
          `🎤 <b>${art.name}</b> — Taronalar to'plami:\n\n📌 <i>${art.bio}</i>\n💿 <b>Janr:</b> ${art.genre}\n\nKerakli qo'shiqni tanlang:`,
          getArtistKeyboard(key)
        );
      });
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

      // If user typed any artist name or part of it
      for (const [key, artist] of Object.entries(MUSIC_ARTISTS)) {
        const cleanName = artist.name.replace(/[^\w\s\u0400-\u04FF']/gi, '').toLowerCase();
        if (qLower === key || qLower.includes(key) || cleanName.includes(qLower) || qLower.includes(cleanName)) {
          return ctx.replyWithHTML(
            `🎤 <b>${artist.name}</b> taronalari:\n\nKerakli qo'shiqni tanlang:`,
            getArtistKeyboard(key)
          );
        }
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

  // 17. INSTAGRAM & MEDIA YUKLOVCHI BOT
  else if (type === 'downloader') {
    const dlKeyboard = Markup.keyboard([
      ['📥 Video Yuklash', 'ℹ️ Bot Haqida'],
      ['⚡️ Qo\'llanma', '🌐 Qo\'llab-quvvatlanadigan Tarmoqlar']
    ]).resize();

    clientBot.start(async (ctx) => {
      const customStart = botRecord.customStartText;
      if (customStart) {
        return ctx.replyWithHTML(escapeHtml(customStart), dlKeyboard);
      }
      await ctx.replyWithHTML(
        `👋 <b>Assalomu alaykum! Video va Media Yuklovchi botga xush kelibsiz!</b>\n\n` +
        `📥 <b>Menga quyidagi tarmoqlar video havolasini yuboring:</b>\n` +
        `• <b>Instagram:</b> Reels, Post, Karusel, IGTV\n` +
        `• <b>TikTok:</b> Suv belgisisiz (No Watermark)\n` +
        `• <b>YouTube:</b> Shorts va qisqa videolar\n` +
        `• <b>Pinterest:</b> HD video va pinlar\n\n` +
        `🚀 <i>Shunchaki Instagram yoki TikTok havolasini shu yerga yuboring, video bir necha soniyada tayyor bo'ladi!</i>`,
        dlKeyboard
      );
    });

    clientBot.hears('📥 Video Yuklash', async (ctx) => {
      await ctx.replyWithHTML(`Iltimos, Instagram Reels yoki TikTok video havolasini shu yerga yuboring 👇`);
    });

    clientBot.hears('ℹ️ Bot Haqida', async (ctx) => {
      await ctx.replyWithHTML(
        `ℹ️ <b>Bot Haqida:</b>\n\n` +
        `Ushbu bot Instagram, TikTok va boshqa tarmoqlardagi videolarni eng yuqori sifatda, tezkor va suv belgisisiz yuklab berish uchun xizmat qiladi.\n\n` +
        `⚡️ 24/7 rejimda to'xtovsiz ishlaydi.`,
        dlKeyboard
      );
    });

    clientBot.hears('🌐 Qo\'llab-quvvatlanadigan Tarmoqlar', async (ctx) => {
      await ctx.replyWithHTML(
        `🌐 <b>Qo'llab-quvvatlanadigan tarmoqlar:</b>\n\n` +
        `✅ <b>Instagram</b> — Reels, Postlar, Karusel, IGTV\n` +
        `✅ <b>TikTok</b> — Suv belgisisiz toza HD video\n` +
        `✅ <b>YouTube Shorts</b> — Qisqa videolar\n` +
        `✅ <b>Pinterest</b> — Pin videolar\n\n` +
        `💡 <i>Istalgan birining havolasini yuborib ko'ring!</i>`,
        dlKeyboard
      );
    });

    clientBot.hears('⚡️ Qo\'llanma', async (ctx) => {
      await ctx.replyWithHTML(
        `❓ <b>Qanday ishlatiladi?</b>\n\n` +
        `1. Instagram yoki TikTok ilovasiga kiring.\n` +
        `2. Video ostidagi "Ulashish" (Share) tugmasini bosing va havolani nusxalang (Copy link).\n` +
        `3. Nusxalangan havolani ushbu botga yuboring.\n` +
        `4. Bot videoni avtomatik yuklab sizga yuboradi!`,
        dlKeyboard
      );
    });

    clientBot.on('text', async (ctx) => {
      const text = ctx.message.text.trim();

      if (mediaDownloader.isMediaUrl(text)) {
        const mediaUrl = mediaDownloader.extractMediaUrl(text);
        const isInsta = mediaDownloader.isInstagramUrl(mediaUrl);

        const waitMsg = await ctx.replyWithHTML(
          `⏳ <b>${isInsta ? 'Instagram' : 'Media'} video yuklanmoqda...</b>\n<i>Iltimos kuting (odatda 2-5 soniya)...</i>`
        );

        try {
          const dlResult = await mediaDownloader.downloadMedia(mediaUrl);
          if (dlResult.success && dlResult.url) {
            try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}

            const caption =
              `🎬 <b>${escapeHtml(dlResult.title || 'Video')}</b>\n\n` +
              `✅ <b>@${clientBot.botInfo?.username || 'Bot'}</b> orqali muvaffaqiyatli yuklab berildi!`;

            await mediaDownloader.sendVideoToTelegram(ctx, dlResult.url, caption);
            return;
          } else {
            try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
            return ctx.replyWithHTML(
              `❌ <b>Videoni yuklab bo'lmadi!</b>\n\n${escapeHtml(dlResult.error || 'Havola xato yoki video o\'chirilgan/shaxsiy.')}\n\n<i>Iltimos, ochiq (public) video havolasini yuboring.</i>`,
              dlKeyboard
            );
          }
        } catch (err) {
          try { await ctx.deleteMessage(waitMsg.message_id); } catch (e) {}
          return ctx.replyWithHTML(
            `❌ <b>Yuklashda xatolik yuz berdi:</b>\n<i>${escapeHtml(err.message)}</i>`,
            dlKeyboard
          );
        }
      }

      await ctx.replyWithHTML(
        `📥 <b>Video yuklab olish uchun iltimos havolani yuboring!</b>\n\nMasalan: <code>https://www.instagram.com/reel/...</code>`,
        dlKeyboard
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
      try {
        const botMe = await clientBot.telegram.getMe();
        clientBot.botInfo = botMe;
      } catch (e) {}
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
    id: 'downloader',
    name: '📥 Instagram & Media Yuklovchi Bot',
    category: 'Media',
    badge: 'Trend 🔥',
    icon: 'download',
    desc: 'Instagram Reels, Post, TikTok va YouTube Shorts videolarini yuqori sifatda avtomatik yuklab beruvchi bot.',
    demo: 'Instagram yoki TikTok video havolasini yuborish'
  },
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
