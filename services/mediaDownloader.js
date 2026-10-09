/**
 * 📥 Universal Media & Instagram Video Downloader Service
 * MakerBot Platform - High-Performance Multi-Provider Engine
 */

const axios = require('axios');
let ruhend;
let scrapr;
let rahad;

try { ruhend = require('ruhend-scraper'); } catch (e) { console.warn('ruhend-scraper not loaded:', e.message); }
try { scrapr = require('@coflyn/scrapr'); } catch (e) { console.warn('@coflyn/scrapr not loaded:', e.message); }
try { rahad = require('rahad-all-downloader-v2'); } catch (e) { console.warn('rahad-all-downloader-v2 not loaded:', e.message); }

// Instagram URL regex
const IG_REGEX = /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|reels|tv|share)\/([A-Za-z0-9_\-\.]+)/i;
// All supported media URL regex
const ANY_MEDIA_REGEX = /https?:\/\/(?:www\.)?(?:instagram\.com|instagr\.am|tiktok\.com|youtube\.com\/shorts|youtu\.be|pin\.it|pinterest\.com)\/[^\s]+/i;

/**
 * Matndan birinchi media linkni ajratib oladi
 */
function extractMediaUrl(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(ANY_MEDIA_REGEX);
  return match ? match[0] : null;
}

/**
 * Matn Instagram havolasimi tekshirish
 */
function isInstagramUrl(text) {
  if (!text || typeof text !== 'string') return false;
  return IG_REGEX.test(text);
}

/**
 * Matn har qanday qo'llab-quvvatlanadigan media havolasimi tekshirish
 */
function isMediaUrl(text) {
  if (!text || typeof text !== 'string') return false;
  return ANY_MEDIA_REGEX.test(text);
}

/**
 * Instagram ulashish (share) havolalarini asl post havolasiga aylantirish
 */
async function resolveShareUrl(url) {
  try {
    if (url.includes('/share/')) {
      const res = await axios.get(url, {
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      });
      if (res.request?.res?.responseUrl) {
        return res.request.res.responseUrl.split('?')[0];
      }
    }
  } catch (e) {}
  return url.split('?')[0];
}

/**
 * Instagram videosini ko'p bosqichli kaskad orqali yuklab olish
 */
async function downloadInstagram(rawUrl) {
  const url = await resolveShareUrl(rawUrl);
  console.log(`[MediaDownloader] Instagram yuklanmoqda: ${url}`);

  // 1-bosqich: Ruhend igdl (Eng tez va barqaror)
  if (ruhend && typeof ruhend.igdl === 'function') {
    try {
      const res = await ruhend.igdl(url);
      if (Array.isArray(res) && res.length > 0) {
        const video = res.find(u => typeof u === 'string' && (u.includes('.mp4') || u.includes('cdninstagram'))) || res[0];
        if (video && typeof video === 'string' && video.startsWith('http')) {
          console.log('[MediaDownloader] Ruhend orqali muvaffaqiyatli olindi');
          return {
            success: true,
            url: video,
            provider: 'ruhend',
            title: 'Instagram Video',
            type: 'video'
          };
        }
      }
    } catch (e) {
      console.warn('[MediaDownloader] Ruhend xatolik:', e.message);
    }
  }

  // 2-bosqich: Scrapr InDown
  if (scrapr?.instagram?.indown) {
    try {
      const res = await scrapr.instagram.indown(url);
      if (res?.status && res.result?.downloads?.length > 0) {
        const dl = res.result.downloads.find(d => d.type === 'video') || res.result.downloads[0];
        if (dl && dl.url) {
          console.log('[MediaDownloader] Scrapr InDown orqali muvaffaqiyatli olindi');
          return {
            success: true,
            url: dl.url,
            thumbnail: dl.thumbnail || res.result.thumbnail,
            title: res.result.title || 'Instagram Video',
            provider: 'scrapr-indown',
            type: dl.type || 'video'
          };
        }
      }
    } catch (e) {
      console.warn('[MediaDownloader] Scrapr InDown xatolik:', e.message);
    }
  }

  // 3-bosqich: Scrapr SnapSave
  if (scrapr?.instagram?.snapsave) {
    try {
      const res = await scrapr.instagram.snapsave(url);
      if (res?.status && res.result?.downloads?.length > 0) {
        const dl = res.result.downloads.find(d => d.type === 'video') || res.result.downloads[0];
        if (dl && dl.url) {
          console.log('[MediaDownloader] Scrapr SnapSave orqali muvaffaqiyatli olindi');
          return {
            success: true,
            url: dl.url,
            thumbnail: dl.thumbnail || res.result.thumbnail,
            title: res.result.title || 'Instagram Video',
            provider: 'scrapr-snapsave',
            type: dl.type || 'video'
          };
        }
      }
    } catch (e) {
      console.warn('[MediaDownloader] Scrapr SnapSave xatolik:', e.message);
    }
  }

  // 4-bosqich: Scrapr Direct Embed
  if (scrapr?.instagram?.direct) {
    try {
      const res = await scrapr.instagram.direct(url);
      if (res?.status && res.result?.downloads?.length > 0) {
        const dl = res.result.downloads.find(d => d.type === 'video') || res.result.downloads[0];
        if (dl && dl.url) {
          console.log('[MediaDownloader] Scrapr Direct orqali muvaffaqiyatli olindi');
          return {
            success: true,
            url: dl.url,
            thumbnail: res.result.thumbnail,
            title: res.result.title || 'Instagram Video',
            provider: 'scrapr-direct',
            type: dl.type || 'video'
          };
        }
      }
    } catch (e) {
      console.warn('[MediaDownloader] Scrapr Direct xatolik:', e.message);
    }
  }

  // 5-bosqich: Rahad Insta
  if (rahad?.alldl?.insta) {
    try {
      const res = await rahad.alldl.insta(url);
      if (res?.success && res.data?.download?.url) {
        console.log('[MediaDownloader] Rahad orqali muvaffaqiyatli olindi');
        return {
          success: true,
          url: res.data.download.url,
          thumbnail: res.data.download.thumbnail,
          title: res.data.caption || 'Instagram Video',
          provider: 'rahad',
          type: res.data.download.type || 'video'
        };
      }
    } catch (e) {
      console.warn('[MediaDownloader] Rahad xatolik:', e.message);
    }
  }

  return {
    success: false,
    error: 'Video yuklab bo\'lmadi. Havola to\'g\'riligini yoki video ochiqligini (private emasligini) tekshiring.'
  };
}

/**
 * Universal yuklab olish (Instagram, TikTok, va h.k.)
 */
async function downloadMedia(url) {
  if (!url) return { success: false, error: 'Havola ko\'rsatilmadi' };
  
  if (isInstagramUrl(url)) {
    return await downloadInstagram(url);
  }

  // TikTok
  if (/tiktok\.com/i.test(url)) {
    if (rahad?.alldl?.tiktok) {
      try {
        const res = await rahad.alldl.tiktok(url);
        const dlUrl = res?.data?.download?.no_watermark || res?.data?.download?.watermark;
        if (dlUrl) {
          return {
            success: true,
            url: dlUrl,
            title: res.data.title || 'TikTok Video',
            provider: 'rahad-tiktok',
            type: 'video'
          };
        }
      } catch (e) {}
    }
  }

  // Universal fallback (Rahad alldl)
  if (rahad?.alldl) {
    try {
      const res = await rahad.alldl(url);
      const dlUrl = res?.data?.videoUrl;
      if (dlUrl) {
        return {
          success: true,
          url: dlUrl,
          title: res.data.title || 'Media Video',
          provider: 'rahad-universal',
          type: 'video'
        };
      }
    } catch (e) {}
  }

  return { success: false, error: 'Ushbu platforma hozircha qo\'llab-quvvatlanmaydi.' };
}

/**
 * Videoni Telegram foydalanuvchisiga yuborish (Direct URL + Stream buffer fallback)
 */
async function sendVideoToTelegram(ctx, videoUrl, caption = '', extra = {}) {
  // 1-urinish: Direct URL orqali yuborish (juda tezkor, 0 sekund)
  try {
    return await ctx.replyWithVideo({ url: videoUrl }, {
      caption: caption,
      parse_mode: 'HTML',
      supports_streaming: true,
      ...extra
    });
  } catch (err) {
    console.warn('[MediaDownloader] Direct replyWithVideo failed, streaming buffer...', err.message);
    
    // 2-urinish: Video faylini stream orqali olib Telegramga yuborish
    try {
      const response = await axios({
        url: videoUrl,
        method: 'GET',
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.instagram.com/'
        },
        timeout: 60000
      });

      return await ctx.replyWithVideo({ source: response.data }, {
        caption: caption,
        parse_mode: 'HTML',
        supports_streaming: true,
        ...extra
      });
    } catch (streamErr) {
      console.error('[MediaDownloader] Stream replyWithVideo failed:', streamErr.message);
      throw streamErr;
    }
  }
}

module.exports = {
  isInstagramUrl,
  isMediaUrl,
  extractMediaUrl,
  downloadInstagram,
  downloadMedia,
  sendVideoToTelegram
};
