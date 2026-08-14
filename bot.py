# ============================================================
# QR CODE BOT PRO
# 1-QISM: SOZLAMALAR + DATABASE + MENYULAR
# ============================================================

import os
import sqlite3
import qrcode
import telebot
from telebot import types

# ============================================================
# SOZLAMALAR
# ============================================================

BOT_TOKEN = "8633658106:AAFjNIzpm1jS30eNCxtzr8uaeM_xRVKsBzI"

# O'Z TELEGRAM IDINGIZNI YOZING
ADMIN_ID = 7600986332

# 1 ta QR narxi
QR_PRICE = 300

# Hisob to'ldirish minimumi
MIN_PAYMENT = 2000

# Karta
CARD_NUMBER = "6262 7201 2331 5395"

# Database
DB_NAME = "qr_bot.db"

# Bot
bot = telebot.TeleBot(
    BOT_TOKEN,
    parse_mode="HTML"
)


# ============================================================
# DATABASE
# ============================================================

def get_db():
    return sqlite3.connect(DB_NAME)


def create_database():

    conn = get_db()
    cursor = conn.cursor()

    # USERS
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT DEFAULT '',
            first_name TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            balance INTEGER DEFAULT 0,
            total_deposited INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            total_bonus INTEGER DEFAULT 0,
            blocked INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # PAYMENTS
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            amount INTEGER,
            photo_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


create_database()


# ============================================================
# FOYDALANUVCHINI DATABASEGA QO'SHISH
# ============================================================

def add_user(user):

    conn = get_db()
    cursor = conn.cursor()

    username = user.username or ""
    first_name = user.first_name or ""

    cursor.execute("""
        INSERT OR IGNORE INTO users
        (user_id, username, first_name)
        VALUES (?, ?, ?)
    """, (
        user.id,
        username,
        first_name
    ))

    cursor.execute("""
        UPDATE users
        SET username = ?,
            first_name = ?
        WHERE user_id = ?
    """, (
        username,
        first_name,
        user.id
    ))

    conn.commit()
    conn.close()


# ============================================================
# FOYDALANUVCHI MA'LUMOTI
# ============================================================

def get_user(user_id):

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            user_id,
            username,
            first_name,
            phone,
            balance,
            total_deposited,
            total_spent,
            total_bonus,
            blocked
        FROM users
        WHERE user_id = ?
    """, (user_id,))

    user = cursor.fetchone()

    conn.close()

    return user


# ============================================================
# BALANS
# ============================================================

def get_balance(user_id):

    user = get_user(user_id)

    if user:
        return user[4]

    return 0


# ============================================================
# BLOKLANGANMI?
# ============================================================

def is_blocked(user_id):

    user = get_user(user_id)

    if user:
        return user[8] == 1

    return False


# ============================================================
# BALANSNI O'ZGARTIRISH
# ============================================================

def change_balance(user_id, amount, reason="deposit"):

    conn = get_db()
    cursor = conn.cursor()

    # PUL QO'SHISH
    if amount > 0:

        if reason == "bonus":

            cursor.execute("""
                UPDATE users
                SET
                    balance = balance + ?,
                    total_bonus = total_bonus + ?
                WHERE user_id = ?
            """, (
                amount,
                amount,
                user_id
            ))

        else:

            cursor.execute("""
                UPDATE users
                SET
                    balance = balance + ?,
                    total_deposited = total_deposited + ?
                WHERE user_id = ?
            """, (
                amount,
                amount,
                user_id
            ))

    # PUL AYIRISH
    elif amount < 0:

        cursor.execute("""
            UPDATE users
            SET
                balance = balance + ?,
                total_spent = total_spent + ?
            WHERE user_id = ?
        """, (
            amount,
            abs(amount),
            user_id
        ))

    conn.commit()
    conn.close()


# ============================================================
# TELEFON SAQLASH
# ============================================================

def save_phone(user_id, phone):

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE users
        SET phone = ?
        WHERE user_id = ?
    """, (
        phone,
        user_id
    ))

    conn.commit()
    conn.close()


# ============================================================
# ODDIY FOYDALANUVCHI MENYUSI
# ============================================================

def user_menu():

    keyboard = types.ReplyKeyboardMarkup(
        resize_keyboard=True,
        row_width=2
    )

    keyboard.add(
        types.KeyboardButton("🧾 QR Code yaratish"),
        types.KeyboardButton("💰 Hisobim")
    )

    keyboard.add(
        types.KeyboardButton("➕ Hisobni to‘ldirish"),
        types.KeyboardButton("📞 Telefon raqamim")
    )

    keyboard.add(
        types.KeyboardButton("ℹ️ Yordam")
    )

    return keyboard


# ============================================================
# ADMIN MENYUSI
# ============================================================

def admin_menu():

    keyboard = types.ReplyKeyboardMarkup(
        resize_keyboard=True,
        row_width=2
    )

    keyboard.add(
        types.KeyboardButton("👥 Foydalanuvchilar"),
        types.KeyboardButton("📊 Statistika")
    )

    keyboard.add(
        types.KeyboardButton("💰 Hisobiga pul kiritish"),
        types.KeyboardButton("➖ Hisobidan pul ayirish")
    )

    keyboard.add(
        types.KeyboardButton("🎁 Bonus berish"),
        types.KeyboardButton("💳 To‘lovlar")
    )

    keyboard.add(
        types.KeyboardButton("🔎 Foydalanuvchi"),
        types.KeyboardButton("📞 Telefon raqamini ko‘rish")
    )

    keyboard.add(
        types.KeyboardButton("🚫 Bloklash"),
        types.KeyboardButton("✅ Blokdan chiqarish")
    )

    keyboard.add(
        types.KeyboardButton("⬅️ Oddiy menyu")
    )

    return keyboard


# ============================================================
# QR MENYU
# ============================================================

def qr_menu():

    keyboard = types.InlineKeyboardMarkup(
        row_width=2
    )

    keyboard.add(
        types.InlineKeyboardButton(
            "🔗 Link",
            callback_data="qr_link"
        ),
        types.InlineKeyboardButton(
            "📝 Matn",
            callback_data="qr_text"
        )
    )

    keyboard.add(
        types.InlineKeyboardButton(
            "📞 Telefon",
            callback_data="qr_phone"
        ),
        types.InlineKeyboardButton(
            "👤 Kontakt",
            callback_data="qr_contact"
        )
    )

    keyboard.add(
        types.InlineKeyboardButton(
            "📍 Lokatsiya",
            callback_data="qr_location"
        ),
        types.InlineKeyboardButton(
            "📶 Wi-Fi",
            callback_data="qr_wifi"
        )
    )

    keyboard.add(
        types.InlineKeyboardButton(
            "💳 To‘lov",
            callback_data="qr_payment"
        ),
        types.InlineKeyboardButton(
            "✈️ Telegram",
            callback_data="qr_telegram"
        )
    )

    keyboard.add(
        types.InlineKeyboardButton(
            "📧 Email",
            callback_data="qr_email"
        )
    )

    return keyboard


# ============================================================
# START
# ============================================================

@bot.message_handler(commands=["start"])
def start(message):

    add_user(message.from_user)

    if is_blocked(message.from_user.id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz botdan foydalanishingiz bloklangan."
        )

        return

    balance = get_balance(
        message.from_user.id
    )

    text = f"""
<b>🤖 QR CODE PRO</b>

Assalomu alaykum,
<b>{message.from_user.first_name}</b>! 👋

🧾 QR Code narxi:
<b>{QR_PRICE:,} so‘m</b>

💰 Sizning balansingiz:
<b>{balance:,} so‘m</b>

Quyidagi menyudan foydalaning 👇
"""

    if message.from_user.id == ADMIN_ID:

        bot.send_message(
            message.chat.id,
            text,
            reply_markup=admin_menu()
        )

    else:

        bot.send_message(
            message.chat.id,
            text,
            reply_markup=user_menu()
        )


# ============================================================
# HISOBIM
# ============================================================

@bot.message_handler(
    func=lambda message:
    message.text == "💰 Hisobim"
)
def my_balance(message):

    add_user(message.from_user)

    user = get_user(
        message.from_user.id
    )

    bot.send_message(
        message.chat.id,
        f"""
💰 <b>MENING HISOBIM</b>

💵 Joriy balans:
<b>{user[4]:,} so‘m</b>

📥 Jami kiritilgan:
<b>{user[5]:,} so‘m</b>

📤 Jami sarflangan:
<b>{user[6]:,} so‘m</b>

🎁 Jami bonus:
<b>{user[7]:,} so‘m</b>

🧾 QR narxi:
<b>{QR_PRICE:,} so‘m</b>
""",
        reply_markup=user_menu()
    )


# ============================================================
# TELEFON RAQAMI
# ============================================================

@bot.message_handler(
    func=lambda message:
    message.text == "📞 Telefon raqamim"
)
def phone_request(message):

    keyboard = types.ReplyKeyboardMarkup(
        resize_keyboard=True,
        one_time_keyboard=True
    )

    keyboard.add(
        types.KeyboardButton(
            "📱 Raqamni yuborish",
            request_contact=True
        )
    )

    keyboard.add(
        types.KeyboardButton("⬅️ Orqaga")
    )

    bot.send_message(
        message.chat.id,
        "📞 Telefon raqamingizni yuboring:",
        reply_markup=keyboard
    )


# ============================================================
# TELEFONNI QABUL QILISH
# ============================================================

@bot.message_handler(
    content_types=["contact"]
)
def receive_phone(message):

    if not message.contact:
        return

    if (
        message.contact.user_id
        and
        message.contact.user_id != message.from_user.id
    ):
        bot.send_message(
            message.chat.id,
            "❌ Iltimos, o‘zingizning raqamingizni yuboring."
        )
        return

    save_phone(
        message.from_user.id,
        message.contact.phone_number
    )

    bot.send_message(
        message.chat.id,
        f"""
✅ <b>Telefon raqamingiz saqlandi!</b>

📞 Raqam:
<b>{message.contact.phone_number}</b>
""",
        reply_markup=user_menu()
    )


# ============================================================
# QR CODE BOSHLASH
# ============================================================

@bot.message_handler(
    func=lambda message:
    message.text == "🧾 QR Code yaratish"
)
def qr_start(message):

    add_user(message.from_user)

    if is_blocked(message.from_user.id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    balance = get_balance(
        message.from_user.id
    )

    if balance < QR_PRICE:

        bot.send_message(
            message.chat.id,
            f"""
❌ <b>Balansingiz yetarli emas!</b>

💰 Balans:
<b>{balance:,} so‘m</b>

🧾 QR narxi:
<b>{QR_PRICE:,} so‘m</b>

➕ Avval hisobingizni to‘ldiring.
""",
            reply_markup=user_menu()
        )

        return

    bot.send_message(
        message.chat.id,
        f"""
🧾 <b>QR CODE YARATISH</b>

💸 1 ta QR:
<b>{QR_PRICE:,} so‘m</b>

Kerakli QR turini tanlang 👇
""",
        reply_markup=qr_menu()
    )


# ============================================================
# ORQAGA
# ============================================================

@bot.message_handler(
    func=lambda message:
    message.text == "⬅️ Orqaga"
)
def back_button(message):

    bot.send_message(
        message.chat.id,
        "🏠 Asosiy menyu",
        reply_markup=user_menu()
    )


# ============================================================
# YORDAM
# ============================================================

@bot.message_handler(
    func=lambda message:
    message.text == "ℹ️ Yordam"
)
def help_command(message):

    bot.send_message(
        message.chat.id,
        f"""
ℹ️ <b>QR CODE BOT YORDAM</b>

🧾 QR Code yaratish
💰 Hisobim
➕ Hisobni to‘ldirish
📞 Telefon raqamini saqlash

<b>QR narxi:</b>
{QR_PRICE:,} so‘m

<b>Hisob to‘ldirish minimumi:</b>
{MIN_PAYMENT:,} so‘m
"""
    )


# ============================================================
# ADMIN TEKSHIRUVI
# ============================================================

def admin_only(message):

    return message.from_user.id == ADMIN_ID


# ============================================================
# ADMIN / ODDIY MENYU
# ============================================================

@bot.message_handler(
    func=lambda message:
    message.text == "⬅️ Oddiy menyu"
)
def normal_menu(message):

    if not admin_only(message):
        return

    bot.send_message(
        message.chat.id,
        "👤 Oddiy foydalanuvchi menyusi:",
        reply_markup=user_menu()
    )

 # ============================================================
# 2-QISM
# ZAMONAVIY QR CODE GENERATOR
# ============================================================


# ============================================================
# QR TURINI TANLASH
# ============================================================

@bot.callback_query_handler(
    func=lambda call: call.data.startswith("qr_")
)
def qr_type_selected(call):

    user_id = call.from_user.id

    # Foydalanuvchini tekshirish
    add_user(call.from_user)

    if is_blocked(user_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Siz bloklangansiz!",
            show_alert=True
        )

        return

    # Balansni tekshirish
    balance = get_balance(user_id)

    if balance < QR_PRICE:

        bot.answer_callback_query(
            call.id,
            "❌ Balansingiz yetarli emas!",
            show_alert=True
        )

        bot.send_message(
            call.message.chat.id,
            f"""
❌ <b>QR yaratib bo‘lmaydi!</b>

💰 Balansingiz:
<b>{balance:,} so‘m</b>

🧾 QR narxi:
<b>{QR_PRICE:,} so‘m</b>

➕ Avval hisobingizni to‘ldiring.
"""
        )

        return

    qr_type = call.data.replace(
        "qr_",
        ""
    )

    # ========================================================
    # KO‘RSATMALAR
    # ========================================================

    instructions = {

        "link": """
🔗 <b>LINK QR CODE</b>

Sayt yoki linkni yuboring.

Masalan:

https://google.com

yoki:

https://instagram.com
""",

        "text": """
📝 <b>MATN QR CODE</b>

QR ichiga yoziladigan matnni yuboring.

Masalan:

Assalomu alaykum!
Bu mening QR kodim.
""",

        "phone": """
📞 <b>TELEFON QR CODE</b>

Telefon raqamini yuboring.

Masalan:

+998901234567
""",

        "contact": """
👤 <b>KONTAKT QR CODE</b>

Quyidagi formatda yuboring:

Ism | Telefon

Masalan:

Ismoil | +998901234567
""",

        "location": """
📍 <b>LOKATSIYA QR CODE</b>

Quyidagi formatda yuboring:

Latitude, Longitude

Masalan:

41.3111, 69.2797
""",

        "wifi": """
📶 <b>WI-FI QR CODE</b>

Quyidagi formatda yuboring:

SSID | PAROL | WPA

Masalan:

MyWifi | 12345678 | WPA

Agar parol bo‘lmasa:

MyWifi | | nopass
""",

        "payment": """
💳 <b>TO‘LOV QR CODE</b>

QR ichida ko‘rinadigan to‘lov ma’lumotini yuboring.

Masalan:

Karta: 8600123456789012
Summa: 20000 so‘m
""",

        "telegram": """
✈️ <b>TELEGRAM QR CODE</b>

Username yoki Telegram linkni yuboring.

Masalan:

@username

yoki:

https://t.me/username
""",

        "email": """
📧 <b>EMAIL QR CODE</b>

Email manzilini yuboring.

Masalan:

example@gmail.com
"""
    }

    text = instructions.get(
        qr_type,
        "📝 Ma’lumotni yuboring."
    )

    bot.answer_callback_query(
        call.id
    )

    msg = bot.send_message(
        call.message.chat.id,
        text
    )

    # Keyingi xabarni kutish
    bot.register_next_step_handler(
        msg,
        create_qr_code,
        qr_type
    )


# ============================================================
# QR YARATISH
# ============================================================

def create_qr_code(message, qr_type):

    user_id = message.from_user.id

    add_user(message.from_user)

    # ========================================================
    # BLOK TEKSHIRISH
    # ========================================================

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz botdan foydalanishingiz bloklangan."
        )

        return

    # ========================================================
    # BALANS TEKSHIRISH
    # ========================================================

    balance = get_balance(user_id)

    if balance < QR_PRICE:

        bot.send_message(
            message.chat.id,
            f"""
❌ <b>Balans yetarli emas!</b>

💰 Balans:
<b>{balance:,} so‘m</b>

🧾 QR narxi:
<b>{QR_PRICE:,} so‘m</b>
"""
        )

        return

    # ========================================================
    # MATNNI OLISH
    # ========================================================

    if not message.text:

        bot.send_message(
            message.chat.id,
            "❌ Ma’lumot topilmadi. Qaytadan urinib ko‘ring."
        )

        return

    value = message.text.strip()

    if not value:

        bot.send_message(
            message.chat.id,
            "❌ Bo‘sh ma’lumot yuborib bo‘lmaydi."
        )

        return

    # ========================================================
    # QR DATA
    # ========================================================

    try:

        # ----------------------------------------------------
        # LINK
        # ----------------------------------------------------

        if qr_type == "link":

            if not value.startswith(
                ("http://", "https://")
            ):

                value = "https://" + value

            qr_data = value


        # ----------------------------------------------------
        # MATN
        # ----------------------------------------------------

        elif qr_type == "text":

            qr_data = value


        # ----------------------------------------------------
        # TELEFON
        # ----------------------------------------------------

        elif qr_type == "phone":

            phone = value.replace(
                " ",
                ""
            )

            qr_data = "tel:" + phone


        # ----------------------------------------------------
        # TELEGRAM
        # ----------------------------------------------------

        elif qr_type == "telegram":

            if value.startswith(
                "https://t.me/"
            ):

                qr_data = value

            elif value.startswith(
                "http://t.me/"
            ):

                qr_data = value

            else:

                username = value.replace(
                    "@",
                    ""
                ).strip()

                qr_data = (
                    "https://t.me/"
                    + username
                )


        # ----------------------------------------------------
        # EMAIL
        # ----------------------------------------------------

        elif qr_type == "email":

            qr_data = (
                "mailto:"
                + value
            )


        # ----------------------------------------------------
        # LOKATSIYA
        # ----------------------------------------------------

        elif qr_type == "location":

            parts = value.split(",")

            if len(parts) != 2:

                bot.send_message(
                    message.chat.id,
                    """
❌ Format noto‘g‘ri.

To‘g‘ri format:

41.3111, 69.2797
"""
                )

                return

            latitude = parts[0].strip()
            longitude = parts[1].strip()

            qr_data = (
                f"geo:{latitude},{longitude}"
            )


        # ----------------------------------------------------
        # WI-FI
        # ----------------------------------------------------

        elif qr_type == "wifi":

            parts = [
                x.strip()
                for x in value.split("|")
            ]

            if len(parts) != 3:

                bot.send_message(
                    message.chat.id,
                    """
❌ Format noto‘g‘ri.

To‘g‘ri:

SSID | PAROL | WPA

Masalan:

MyWifi | 12345678 | WPA
"""
                )

                return

            ssid = parts[0]
            password = parts[1]
            security = parts[2].upper()

            # WiFi special belgilarini escape qilish
            ssid = (
                ssid
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace(":", "\\:")
            )

            password = (
                password
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace(":", "\\:")
            )

            if security == "NOPASS":

                qr_data = (
                    f"WIFI:T:nopass;"
                    f"S:{ssid};"
                    f"P:;;"
                )

            else:

                if security not in [
                    "WPA",
                    "WEP"
                ]:

                    security = "WPA"

                qr_data = (
                    f"WIFI:T:{security};"
                    f"S:{ssid};"
                    f"P:{password};;"
                )


        # ----------------------------------------------------
        # KONTAKT
        # ----------------------------------------------------

        elif qr_type == "contact":

            parts = value.split("|")

            if len(parts) != 2:

                bot.send_message(
                    message.chat.id,
                    """
❌ Format noto‘g‘ri.

To‘g‘ri:

Ism | Telefon

Masalan:

Ismoil | +998901234567
"""
                )

                return

            name = parts[0].strip()
            phone = parts[1].strip()

            qr_data = f"""BEGIN:VCARD
VERSION:3.0
FN:{name}
TEL:{phone}
END:VCARD"""


        # ----------------------------------------------------
        # TO‘LOV
        # ----------------------------------------------------

        elif qr_type == "payment":

            qr_data = value


        # ----------------------------------------------------
        # BOSHQA
        # ----------------------------------------------------

        else:

            qr_data = value


        # ====================================================
        # QR CODE YARATISH
        # ====================================================

        qr = qrcode.QRCode(

            version=None,

            error_correction=(
                qrcode.constants
                .ERROR_CORRECT_H
            ),

            box_size=12,

            border=4
        )

        qr.add_data(
            qr_data
        )

        qr.make(
            fit=True
        )

        image = qr.make_image(
            fill_color="black",
            back_color="white"
        )


        # ====================================================
        # FAYL NOMI
        # ====================================================

        filename = (
            f"qr_{user_id}_"
            f"{message.message_id}.png"
        )


        # ====================================================
        # RASMNI SAQLASH
        # ====================================================

        image.save(
            filename
        )


        # ====================================================
        # MUVAFFAQIYATLI YARATILDI
        # ====================================================

        # Faqat QR muvaffaqiyatli yaratilgandan
        # keyin 300 so‘m yechiladi.

        change_balance(
            user_id,
            -QR_PRICE,
            reason="spent"
        )


        # Yangi balans
        new_balance = get_balance(
            user_id
        )


        # ====================================================
        # QR NI YUBORISH
        # ====================================================

        with open(
            filename,
            "rb"
        ) as photo:

            bot.send_photo(

                message.chat.id,

                photo,

                caption=f"""
✅ <b>QR CODE TAYYOR!</b>

🧾 QR turi:
<b>{qr_type.upper()}</b>

💸 Narxi:
<b>{QR_PRICE:,} so‘m</b>

💰 Qolgan balans:
<b>{new_balance:,} so‘m</b>

📱 Telefon kamerasi bilan skaner qilib tekshirishingiz mumkin.
"""
            )


        # ====================================================
        # FAYLNI O‘CHIRISH
        # ====================================================

        try:

            os.remove(
                filename
            )

        except:

            pass


    except Exception as error:

        # ====================================================
        # XATOLIK
        # ====================================================

        try:

            if os.path.exists(
                filename
            ):

                os.remove(
                    filename
                )

        except:

            pass


        bot.send_message(
            message.chat.id,
            f"""
❌ <b>QR yaratishda xatolik!</b>

Xatolik:
<code>{error}</code>

Qaytadan urinib ko‘ring.
"""
        )
# ============================================================
# BOTNI ISHGA TUSHIRISH
# ============================================================

if __name__ == "__main__":

    print("===================================")
    print("       QR CODE PRO ISHLAMOQDA")
    print("===================================")

    bot.infinity_polling(
        skip_pending=True,
        timeout=60,
        long_polling_timeout=60
    )
