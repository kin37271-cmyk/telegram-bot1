const TEMPLATES = [
  {
    id: 'portfolio',
    name: '💻 Shaxsiy Portfolio',
    category: 'Shaxsiy',
    badge: 'Trend 🔥',
    color: 'from-blue-600 to-indigo-600',
    accentColor: '#3b82f6',
    desc: 'Dasturchilar, dizaynerlar va frilanserlar uchun zamonaviy shaxsiy portfolio sayt.',
    defaultServices: ['Web Dasturlash', 'Telegram Botlar', 'UI/UX Dizayn', 'Texnik Yordam']
  },
  {
    id: 'restaurant',
    name: '🍽 Restoran & Kafe',
    category: 'Ovqatlanish',
    badge: 'Mashhur ⭐',
    color: 'from-amber-600 to-red-600',
    accentColor: '#d97706',
    desc: 'Taomnoma (menyu), maxsus takliflar, stol bron qilish va manzil ko\'rsatish.',
    defaultServices: ['Milliy Taomlar', 'Yevropa Oshxonasi', 'Stol Bron Qilish', 'Banketlar']
  },
  {
    id: 'shop',
    name: '🛍 Kiyim & Mahsulotlar Do\'koni',
    category: 'Savdo',
    badge: 'Xarid 🏷',
    color: 'from-pink-600 to-rose-600',
    accentColor: '#e11d48',
    desc: 'Mahsulotlar katalogi, narxlar, aksiyalar va to\'g\'ridan-to\'g\'ri buyurtma olish.',
    defaultServices: ['Yangi Kolleksiya', 'Premium Sifat', 'Yetkazib Berish', 'Kafolat']
  },
  {
    id: 'fastfood',
    name: '🍔 Fast Food & Burger',
    category: 'Ovqatlanish',
    badge: 'Tezkor ⚡',
    color: 'from-yellow-500 to-orange-600',
    accentColor: '#f59e0b',
    desc: 'Burger, lavash, pitsa va ichimliklar uchun tezkor buyurtma qabul qiluvchi sayt.',
    defaultServices: ['Sersuv Burgerlar', 'Issiq Lavashlar', 'Pitsa Turlari', 'Tezkor Yetkazish']
  },
  {
    id: 'barbershop',
    name: '💈 Barbershop & Salon',
    category: 'Xizmatlar',
    badge: 'Stil ✂️',
    color: 'from-zinc-700 to-neutral-900',
    accentColor: '#52525b',
    desc: 'Erkaklar sartaroshxonasi yoki go\'zallik saloni uchun navbatga yozilish tizimi.',
    defaultServices: ['Soch Turmaklash', 'Soqol Olish & Dizayn', 'Yuz Parvarishi', 'VIP Xizmat']
  },
  {
    id: 'education',
    name: '📚 O\'quv Markazi & Kurslar',
    category: 'Ta\'lim',
    badge: 'Bilim 🎓',
    color: 'from-emerald-600 to-teal-700',
    accentColor: '#059669',
    desc: 'Kurslar ro\'yxati, o\'qituvchilar, dars jadvali va o\'quvchilarni ro\'yxatga olish.',
    defaultServices: ['IT & Dasturlash', 'Ingliz Tili (IELTS)', 'Matematika', 'Mental Arifmetika']
  },
  {
    id: 'autoservice',
    name: '🚗 Avtoservis & Detailing',
    category: 'Avto',
    badge: 'Tezkor 🛠',
    color: 'from-slate-700 to-blue-800',
    accentColor: '#334155',
    desc: 'Avtomoyka, moy almashtirish, detailing, diagnostika va ehtiyot qismlar.',
    defaultServices: ['Avtomobil Diagnostikasi', 'Moy Almashtirish', 'Polirovka & Detailing', 'Xodovoy Ta\'mirlash']
  },
  {
    id: 'clinic',
    name: '🦷 Stomatologiya & Klinika',
    category: 'Tibbiyot',
    badge: 'Salomatlik 🩺',
    color: 'from-cyan-600 to-blue-600',
    accentColor: '#0891b2',
    desc: 'Tibbiy markaz, stomatologiya xizmatlari va shifokor ko\'rigiga yozilish.',
    defaultServices: ['Tish Davolash', 'Implantatsiya', 'Tishlarni Oqartirish', 'Professional Maslahat']
  },
  {
    id: 'agency',
    name: '🚀 IT Agentlik & Marketing',
    category: 'Biznes',
    badge: 'Biznes 💼',
    color: 'from-purple-600 to-indigo-700',
    accentColor: '#7c3aed',
    desc: 'Target reklama, SMM, sayt va bot yasash agentliklari uchun nufuzli taqdimot.',
    defaultServices: ['SMM Xizmatlari', 'Targeting Reklama', 'Veb-saytlar Yaratish', 'Brending & Logotip']
  },
  {
    id: 'construction',
    name: '🏗 Qurilish & Interyer',
    category: 'Qurilish',
    badge: 'Sifat 🔨',
    color: 'from-stone-600 to-amber-800',
    accentColor: '#78716c',
    desc: 'Uylarni ta\'mirlash, interyer dizayn, arxitektura va qurilish xizmatlari.',
    defaultServices: ['Evroremont', 'Interyer Dizayn', 'Uy Qurilishi', 'Smeta Hisoblash']
  },
  {
    id: 'photostudio',
    name: '📸 Foto Studio & Fotosessiya',
    category: 'Ijod',
    badge: 'Kreativ 📷',
    color: 'from-fuchsia-600 to-pink-600',
    accentColor: '#c026d3',
    desc: 'Fotosuratkashlar, to\'y va marosimlar fotosessiyasi uchun portfolio galereyasi.',
    defaultServices: ['To\'y Fotosessiyasi', 'Love Story', 'Studio Rasmga Olish', 'Videomontaj']
  },
  {
    id: 'fitness',
    name: '💪 Fitnes & Sport Zal',
    category: 'Sport',
    badge: 'Kuch 🏋️‍♂️',
    color: 'from-red-600 to-rose-700',
    accentColor: '#e11d48',
    desc: 'Trenajor zali, murabbiylar, oylik abonementlar va sog\'lom ovqatlanish rejasi.',
    defaultServices: ['Shaxsiy Murabbiy', 'Kardio & Fitnes', 'Krossfit Zali', 'Ozish / Vazn Yig\'ish']
  },
  {
    id: 'delivery',
    name: '📦 Kuryerlik & Yetkazib Berish',
    category: 'Xizmatlar',
    badge: 'Tezkor 🚚',
    color: 'from-orange-500 to-amber-600',
    accentColor: '#ea580c',
    desc: 'Shahar bo\'ylab yoki viloyatlararo tezkor yuk va posilka yetkazish xizmati.',
    defaultServices: ['Ekspress Yetkazish', 'Hujjatlar Kuryeri', 'Katta Yuklar', 'Online Kuzatuv']
  },
  {
    id: 'realestate',
    name: '🏢 Ko\'chmas Mulk (Rieltor)',
    category: 'Mulk',
    badge: 'Nufuzli 🏡',
    color: 'from-blue-700 to-sky-800',
    accentColor: '#1d4ed8',
    desc: 'Kvartiralar, yangi binolar, hovlilar va tijorat obyektlarini sotish/ijaraga berish.',
    defaultServices: ['Kvartira Sotish', 'Ijara Xizmatlari', 'Yangi Uylar (Novostroyka)', 'Hujjatlashtirish']
  },
  {
    id: 'events',
    name: '🎉 To\'y & Tadbirlar Agentligi',
    category: 'Marosim',
    badge: 'Bayram 🎊',
    color: 'from-pink-500 to-purple-600',
    accentColor: '#db2777',
    desc: 'To\'ylar, tug\'ilgan kunlar, korporativ bayramlar va sahna bezaklari.',
    defaultServices: ['To\'y Tashkil Qilish', 'Sahna Bezatish (Dekor)', 'Boshlovchi & Dj', 'Show Dasturlar']
  },
  {
    id: 'legal',
    name: '⚖️ Yuridik Xizmatlar & Advokat',
    category: 'Huquq',
    badge: 'Rasmiy 📜',
    color: 'from-gray-800 to-zinc-900',
    accentColor: '#27272a',
    desc: 'Advokatlik, huquqiy maslahat, shartnomalar tuzish va sud himoyasi.',
    defaultServices: ['Fuqarolik Ishlari', 'Biznes Huquqi', 'Shartnomalar Auditi', 'Sudda Himoya']
  },
  {
    id: 'travel',
    name: '✈️ Sayohat & Turizm Agentligi',
    category: 'Turizm',
    badge: 'Sayohat 🌴',
    color: 'from-teal-500 to-cyan-600',
    accentColor: '#0d9488',
    desc: 'Umra ziyorati, Dubay, Turkiya, Misr va boshqa mamlakatlarga unutilmas turlar.',
    defaultServices: ['Umra & Haj Turlari', 'Dubay & Antaliya', 'Viza Xizmatlari', 'Aviachiptalar']
  },
  {
    id: 'gaming',
    name: '🎮 PUBG & O\'yinlar Do\'koni',
    category: 'Gaming',
    badge: 'Geymer 🎯',
    color: 'from-violet-600 to-fuchsia-700',
    accentColor: '#8b5cf6',
    desc: 'PUBG Mobile UC, akkauntlar savdosi, turnirlar va geymerlik xizmatlari.',
    defaultServices: ['Tezkor UC To\'ldirish', 'Akkaunt Sotuv / Kafolat', 'Telegram Turnirlar', 'Royale Pass']
  },
  {
    id: 'saas',
    name: '📱 Mobil Ilova & SaaS Landing',
    category: 'Texnologiya',
    badge: 'Texno 🚀',
    color: 'from-sky-500 to-blue-600',
    accentColor: '#0284c7',
    desc: 'Mobil ilovalar, startaplar va dasturiy ta\'minot uchun zamonaviy landing sahifa.',
    defaultServices: ['iOS & Android Qo\'llab-quvvatlash', 'Cloud Sinxronizatsiya', 'Yuqori Xavfsizlik', '24/7 Support']
  },
  {
    id: 'blog',
    name: '✍️ Shaxsiy Blog & Yangiliklar',
    category: 'Media',
    badge: 'Media 📰',
    color: 'from-stone-700 to-gray-800',
    accentColor: '#44403c',
    desc: 'Foydali maqolalar, yangiliklar va mualliflik fikrlarini ulashuvchi qulay blog.',
    defaultServices: ['Eksklyuziv Maqolalar', 'Haftalik Sharh', 'Ekspert Fikrlari', 'Foydali Qo\'llanmalar']
  }
];

module.exports = TEMPLATES;
