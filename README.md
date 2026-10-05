# 🚀 Telegram Bot Konstruktori (15-in-1 Platforma) - Node.js Edition

Ushbu loyiha Telegram foydalanuvchilariga hech qanday dasturlashsiz 1 daqiqa ichida **15 dan ortiq turli xil botlarni** o'z `@BotFather` tokeni orqali ishga tushirish imkonini beruvchi to'laqonli bot platformasidir.

---

## ✨ Imkoniyatlar

### 🤖 16 ta Tayyor Bot Shablonlari:
1. **🤖 AI / ChatGPT Boti** — Savollarga javob, kod yozish, maslahatlar (OpenAI va aqlli AI fallback).
2. **🚀 Nakrutka / SMM Boti** — Telegram, Instagram, TikTok kanallar va guruhlar uchun obunachi, layk, ko'rish buyurtmalari.
3. **💸 Pul Topar / Daromad Boti** — Referal taklif qilish, kunlik bonus, vazifalar bajarish, balans yechib olish.
4. **🎬 Kino & Serial Boti** — Kod orqali filmlarni topish va ko'rish, majburiy kanal a'zoligi.
5. **🎭 Anonim Chat Boti** — Tasodifiy suhbatdosh bilan maxfiy va anonim jonli muloqot.
6. **🛍 Do'kon / Magazin Boti** — Mahsulotlar katalogi, savatcha, buyurtma berish.
7. **🎯 Test & Viktorina Boti** — Qiziqarli savol-javoblar, ballar reytingi, peshqadamlar jadvali.
8. **📩 Qabul / Aloqa (Feedback) Boti** — Mijozlardan murojaatlarni adminga yetkazish va reply orqali javob berish.
9. **🌐 Tarjimon Boti** — Ko'p tilli tezkor tarjima (O'zbekcha, Ruscha, Inglizcha, Turkcha).
10. **💱 Valyuta Kurslari & Konvertor** — O'zbekiston Markaziy Banki rasmiy kurslari va hisoblash kalkulyatori.
11. **🕌 Namoz Vaqtlari Boti** — O'zbekiston shaharlari bo'yicha 5 vaqt namoz vaqtlari va taqvim.
12. **🛠 QR Kod & Instrumentlar** — Matn yoki havoladan QR-kod yasash, kuchli parol yaratish, matn hisoblagich.
13. **🛡 Guruh Nazoratchisi (Moderator)** — Yangi a'zolarni kutib olish, reklama linklari va haqoratlarni avtomatik o'chirish.
14. **🌤 Ob-Havo Ma'lumoti Boti** — Shaharlar bo'yicha harorat, namlik va prognoz.
15. **✨ Status & Aforizmlar Boti** — Har kungi motivatsion iqtiboslar, donishmandlar hikmati.
16. **📢 Avto-Post & Inline Post Boti** — Kanallar uchun tugmali chiroyli postlar tayyorlash.

---

### 🎁 7 Kunlik Tekin Sinov va Tariflar:
- Har bir yangi foydalanuvchiga ro'yxatdan o'tganida **avtomatik 7 kunlik bepul sinov (Trial)** beriladi.
- **25 Pro (1 oylik)**: 25,000 so'm / oy — 10 tagacha bot, doimiy onlayn ishlash, barcha funksiyalar.
- **VIP Premium (1 yillik)**: 150,000 so'm / yil — 50 tagacha bot, ustuvor server.
- Foydalanuvchi to'lov qilgach, chek rasmini botga yuboradi. Admin panelda tasdiqlash tugmasi bosilishi bilan obuna darhol faollashadi.

---

### 💳 Avtomatlashtirilgan To'lov Tizimlari:
- ⭐ **Telegram Stars (Telegram Yulduzlari)**: To'g'ridan-to'g'ri Telegram ichida Stars orqali 1 soniyada xarid qilish va avtomatik tarif yoqilishi.
- 🟢 **Click & 🔵 Payme**: Avtomatik to'lov havolalari va Webhook API integratsiyasi (`/api/payment/click` & `/api/payment/payme`).
- 💎 **CryptoBot**: USDT va TON orqali kriptovalyuta to'lovlari.
- 💳 **Karta orqali o'tkazma**: Chek rasmini botga yuborish va admin tasdiqlashi.

---

### 👑 Mijoz Botlari Uchun Shaxsiy Admin Paneli (`/admin`):
Platformada yaratilgan har bir mijoz botining egasi o'z botiga kirib `/admin` yuborganida quyidagi imkoniyatlarga ega bo'ladi:
- 📊 **Statistika**: Botingizdagi jami a'zolar soni, faollik va oxirgi obunachilar ro'yxati.
- 📢 **Xabar tarqatish (Rassilka)**: Botingizning barcha obunachilariga matn, rasm, video yoki postlarni bir zumda tarqatish.
- 📢 **Majburiy kanallar (OP)**: Kanal qo'shish va tekshirish (foydalanuvchilar kanalingizga a'zo bo'lmaguncha botdan foydalana olishmaydi).
- ✍️ **Start xabarini sozlash**: Botingizning boshlang'ich salomlashish matnini o'zingiz xohlagancha tahrirlash (`{name}` tegi bilan).

---

### 👑 Platforma Bosh Admini (Owner) Paneli (`/admin` asosiy botda):
- **Statistika**: Jami foydalanuvchilar, yaratilgan botlar, 24/7 faol ishlayotgan botlar, to'lovlar va daromad.
- **Mijoz botlari**: Barcha yaratilgan mijoz botlarini ko'rish, to'xtatish yoki o'chirish.
- **Adminlar boshqaruvi**: Bosh admin (Owner) boshqa yordamchi adminlarni ID orqali qo'shishi va o'chirishi mumkin.
- **Xabar tarqatish (Rassilka)**: Barcha platforma foydalanuvchilariga bir zumda xabar yuborish.
- **To'lov cheklari**: Kelgan to'lovlarni tasdiqlash yoki rad etish.

---

## 🚀 Ishga Tushirish Qo'llanmasi

### 1. Sozlash (`.env` fayli):
Loyihadagi `.env` faylini oching va quyidagi ma'lumotlarni kiriting:

```env
# Asosiy Konstruktor Bot tokeni (@BotFather dan olingan)
BOT_TOKEN=123456789:AAHxxxxxxxxxxxxxxxxxxxx

# Bosh Admin (Owner) Telegram ID si (Telegramda @userinfobot orqali ID ni bilsa bo'ladi)
OWNER_ID=123456789

# To'lov kartasi (Mijozlar to'lov qilishi uchun)
CARD_NUMBER=8600 1234 5678 9012
CARD_HOLDER=Falonchi Pistonchiyev

# OpenAI API Key (Ixtiyoriy)
OPENAI_API_KEY=
```

### 2. Botni ishga tushirish:
Terminalda quyidagi buyruqni bering:
```bash
npm start
```
yoki:
```bash
node index.js
```

### 3. Testlarni tekshirish:
```bash
npm test
```
