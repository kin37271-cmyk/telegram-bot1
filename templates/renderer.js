const TEMPLATES = require('./templatesData');

function renderSiteHtml(site) {
  const template = TEMPLATES.find(t => t.id === site.templateId) || TEMPLATES[0];

  // If site is deactivated by admin or user
  if (!site.is_active) {
    return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(site.title)} — Faol Emas</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>body { font-family: 'Plus Jakarta Sans', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full text-center bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
    <div class="w-20 h-20 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner border border-amber-500/20">
      ⚠️
    </div>
    <h1 class="text-2xl font-bold mb-2">${escapeHtml(site.title)}</h1>
    <p class="text-slate-400 text-sm mb-6">Ushbu sayt vaqtincha to'xtatilgan yoki administrator tomonidan faolsizlantirilgan.</p>
    <div class="bg-slate-800/60 rounded-xl p-4 mb-6 border border-slate-700/50 text-xs text-slate-400">
      Agar bu sizning saytingiz bo'lsa, @MakerrUzbBot boti orqali obunangizni yoki sayt holatini tekshiring.
    </div>
    <a href="https://t.me/MakerrUzbBot" class="inline-flex items-center justify-center w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition shadow-lg shadow-blue-600/30">
      🤖 Maker Botga O'tish
    </a>
  </div>
</body>
</html>`;
  }

  const services = (site.services && site.services.length > 0) ? site.services : template.defaultServices;
  const phoneClean = site.phone ? site.phone.replace(/[^0-9+]/g, '') : '';
  const tgClean = site.telegram ? site.telegram.replace('@', '').trim() : '';

  return `<!DOCTYPE html>
<html lang="uz" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(site.title)} — Rasmiy Sayt</title>
  <meta name="description" content="${escapeHtml(site.description || '')}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .heading-font { font-family: 'Space Grotesk', sans-serif; }
    .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .glow-effect { box-shadow: 0 0 60px -15px ${template.accentColor}40; }
  </style>
</head>
<body class="bg-[#090D16] text-slate-100 min-h-screen selection:bg-blue-500 selection:text-white">

  <!-- Header / Navbar -->
  <header class="fixed top-0 left-0 right-0 z-50 bg-[#090D16]/80 backdrop-blur-md border-b border-slate-800/80">
    <div class="max-w-6xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr ${template.color} flex items-center justify-center text-white font-bold text-lg shadow-lg">
          ${escapeHtml(site.title.charAt(0).toUpperCase())}
        </div>
        <div>
          <span class="font-bold text-lg sm:text-xl tracking-tight text-white block leading-tight">${escapeHtml(site.title)}</span>
          <span class="text-[11px] text-slate-400 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span> 24/7 Rasmiy
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        ${site.phone ? `
          <a href="tel:${phoneClean}" class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition border border-slate-700">
            <i data-lucide="phone" class="w-4 h-4 text-emerald-400"></i>
            <span>${escapeHtml(site.phone)}</span>
          </a>
        ` : ''}
        ${tgClean ? `
          <a href="https://t.me/${tgClean}" target="_blank" class="inline-flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-600/30">
            <i data-lucide="send" class="w-4 h-4"></i>
            <span>Bog'lanish</span>
          </a>
        ` : `
          <a href="#contact" class="inline-flex items-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg shadow-blue-600/30">
            <span>Aloqa</span>
          </a>
        `}
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="pt-32 pb-16 sm:pt-40 sm:pb-24 relative overflow-hidden">
    <div class="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-tr ${template.color} opacity-20 blur-3xl pointer-events-none"></div>
    <div class="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-indigo-600 opacity-15 blur-3xl pointer-events-none"></div>

    <div class="max-w-5xl mx-auto px-4 text-center relative z-10">
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs sm:text-sm font-medium mb-6">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        <span>${escapeHtml(template.name)}</span>
        <span class="text-xs px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 font-semibold">${template.badge}</span>
      </div>

      <h1 class="heading-font text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight max-w-4xl mx-auto">
        ${escapeHtml(site.title)}
      </h1>

      <p class="text-slate-300 text-base sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-light">
        ${escapeHtml(site.description || template.desc)}
      </p>

      <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
        ${tgClean ? `
          <a href="https://t.me/${tgClean}" target="_blank" class="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition shadow-xl shadow-blue-600/30 text-base">
            <i data-lucide="send" class="w-5 h-5"></i>
            <span>Telegramda Bog'lanish</span>
          </a>
        ` : ''}
        ${site.phone ? `
          <a href="tel:${phoneClean}" class="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold transition text-base">
            <i data-lucide="phone-call" class="w-5 h-5 text-emerald-400"></i>
            <span>Qo'ng'iroq Qilish</span>
          </a>
        ` : ''}
      </div>

      <!-- Quick Metrics -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-6 max-w-3xl mx-auto mt-14">
        <div class="glass-card rounded-2xl p-4 sm:p-5 text-center">
          <div class="text-2xl sm:text-3xl font-extrabold text-white heading-font">100%</div>
          <div class="text-xs sm:text-sm text-slate-400 mt-1">Sifat Kafolati</div>
        </div>
        <div class="glass-card rounded-2xl p-4 sm:p-5 text-center">
          <div class="text-2xl sm:text-3xl font-extrabold text-emerald-400 heading-font">24/7</div>
          <div class="text-xs sm:text-sm text-slate-400 mt-1">Tezkor Aloqa</div>
        </div>
        <div class="glass-card rounded-2xl p-4 sm:p-5 text-center col-span-2 sm:col-span-1">
          <div class="text-2xl sm:text-3xl font-extrabold text-blue-400 heading-font">A'lo</div>
          <div class="text-xs sm:text-sm text-slate-400 mt-1">Mijozlar Bahosi</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Services / Offers Section -->
  <section class="py-16 bg-slate-900/50 border-y border-slate-800/80">
    <div class="max-w-5xl mx-auto px-4">
      <div class="text-center max-w-xl mx-auto mb-12">
        <h2 class="heading-font text-2xl sm:text-3xl font-bold text-white mb-3">Bizning Xizmatlar & Afzalliklar</h2>
        <p class="text-slate-400 text-sm sm:text-base">Siz uchun eng qulay va professional darajadagi xizmatlar taqdim etiladi.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
        ${services.map((item, idx) => `
          <div class="glass-card rounded-2xl p-6 transition hover:border-slate-600 hover:-translate-y-1 duration-300">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-tr ${template.color} flex items-center justify-center text-white shrink-0 shadow-md">
                <i data-lucide="check-circle-2" class="w-6 h-6"></i>
              </div>
              <div>
                <h3 class="text-lg font-bold text-white mb-1.5">${escapeHtml(item)}</h3>
                <p class="text-slate-400 text-sm leading-relaxed">
                  Eng yuqori standartlarda bajariladi. Buyurtma berish uchun aloqaga chiqing.
                </p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      ${site.priceRange ? `
        <div class="mt-8 text-center">
          <div class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm font-medium">
            <i data-lucide="tag" class="w-4 h-4"></i>
            <span>Narxlar toifasi: <strong>${escapeHtml(site.priceRange)}</strong></span>
          </div>
        </div>
      ` : ''}
    </div>
  </section>

  <!-- Contact & Location Section -->
  <section id="contact" class="py-16 sm:py-24 relative">
    <div class="max-w-4xl mx-auto px-4">
      <div class="glass-card rounded-3xl p-6 sm:p-10 border border-slate-800 glow-effect text-center relative overflow-hidden">
        <h2 class="heading-font text-2xl sm:text-4xl font-bold text-white mb-4">Hoziroq Bog'laning!</h2>
        <p class="text-slate-300 text-sm sm:text-base max-w-xl mx-auto mb-8">
          Savollaringiz bormi yoki buyurtma bermoqchimisiz? Biz bilan to'g'ridan-to'g'ri bog'lanishingiz mumkin.
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-8 text-left">
          ${site.phone ? `
            <a href="tel:${phoneClean}" class="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center gap-3 hover:bg-slate-800 transition">
              <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <i data-lucide="phone" class="w-5 h-5"></i>
              </div>
              <div>
                <div class="text-xs text-slate-400">Telefon</div>
                <div class="text-sm font-bold text-white">${escapeHtml(site.phone)}</div>
              </div>
            </a>
          ` : ''}

          ${tgClean ? `
            <a href="https://t.me/${tgClean}" target="_blank" class="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center gap-3 hover:bg-slate-800 transition">
              <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <i data-lucide="send" class="w-5 h-5"></i>
              </div>
              <div>
                <div class="text-xs text-slate-400">Telegram</div>
                <div class="text-sm font-bold text-white">@${escapeHtml(tgClean)}</div>
              </div>
            </a>
          ` : ''}

          ${site.instagram ? `
            <a href="https://instagram.com/${site.instagram.replace('@','')}" target="_blank" class="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center gap-3 hover:bg-slate-800 transition sm:col-span-2">
              <div class="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center shrink-0">
                <i data-lucide="instagram" class="w-5 h-5"></i>
              </div>
              <div>
                <div class="text-xs text-slate-400">Instagram</div>
                <div class="text-sm font-bold text-white">${escapeHtml(site.instagram)}</div>
              </div>
            </a>
          ` : ''}
        </div>

        ${site.address ? `
          <div class="inline-flex items-center gap-2 text-slate-400 text-xs sm:text-sm bg-slate-800/40 px-4 py-2 rounded-xl border border-slate-700/50">
            <i data-lucide="map-pin" class="w-4 h-4 text-rose-400"></i>
            <span>Manzil: ${escapeHtml(site.address)}</span>
          </div>
        ` : ''}
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="py-8 border-t border-slate-800/80 text-center text-xs text-slate-500">
    <div class="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>© ${new Date().getFullYear()} ${escapeHtml(site.title)}. Barcha huquqlar himoyalangan.</div>
      <div class="flex items-center gap-2 text-slate-400">
        <span>Yaratuvchi:</span>
        <a href="https://t.me/MakerrUzbBot" class="text-blue-400 hover:underline font-medium inline-flex items-center gap-1">
          🤖 @MakerrUzbBot (24/7 Hosting)
        </a>
      </div>
    </div>
  </footer>

  <script>
    lucide.createIcons();
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { renderSiteHtml };
