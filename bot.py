import os
import io
import sqlite3
import hashlib
import logging
from datetime import datetime

import telebot
from telebot import types
import qrcode


# =========================================================
# SOZLAMALAR
# =========================================================

BOT_TOKEN = "8633658106:AAFjNIzpm1jS30eNCxtzr8uaeM_xRVKsBzI"

# O'zingizning Telegram ID'ingizni yozing
ADMIN_IDS = {
    7600986332
}

# Karta raqamingizni shu yerga yozing
CARD_NUMBER = "6262 7201 2331 5395"

# 1 ta QR narxi
QR_PRICE = 150

# Ma'lumotlar bazasi
DB_NAME = "qr_bot.db"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")


# =========================================================
# DATABASE
# =========================================================

def get_db():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            phone TEXT DEFAULT '',
            balance INTEGER DEFAULT 0,
            bonus INTEGER DEFAULT 0,
            is_blocked INTEGER DEFAULT 0,
            referred_by INTEGER DEFAULT NULL,
            created_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            receipt_file_id TEXT,
            receipt_hash TEXT,
            status TEXT DEFAULT 'pending',
            created_at TEXT,
            processed_at TEXT DEFAULT '',
            admin_id INTEGER DEFAULT NULL
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            type TEXT,
            description TEXT,
            created_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS qr_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            qr_type TEXT,
            content TEXT,
            price INTEGER,
            created_at TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            user_id INTEGER PRIMARY KEY
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inviter_id INTEGER,
            invited_id INTEGER,
            bonus INTEGER,
            created_at TEXT
        )
    """)

    # Dastlabki adminlar
    for admin_id in ADMIN_IDS:
        cur.execute(
            "INSERT OR IGNORE INTO admins(user_id) VALUES(?)",
            (admin_id,)
        )

    # Sozlamalar
    default_settings = {
        "qr_price": str(QR_PRICE),
        "referral_bonus": "100",
        "welcome_bonus": "0"
    }

    for key, value in default_settings.items():
        cur.execute(
            "INSERT OR IGNORE INTO settings(key, value) VALUES(?, ?)",
            (key, value)
        )

    conn.commit()
    conn.close()


# =========================================================
# SETTINGS
# =========================================================

def get_setting(key, default=None):
    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT value FROM settings WHERE key=?",
        (key,)
    )

    row = cur.fetchone()
    conn.close()

    if row:
        return row["value"]

    return default


def set_setting(key, value):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO settings(key, value)
        VALUES(?, ?)
        ON CONFLICT(key)
        DO UPDATE SET value=excluded.value
    """, (key, str(value)))

    conn.commit()
    conn.close()


def get_qr_price():
    try:
        return int(get_setting("qr_price", QR_PRICE))
    except:
        return QR_PRICE


# =========================================================
# USER FUNCTIONS
# =========================================================

def register_user(user, referred_by=None):
    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM users WHERE id=?",
        (user.id,)
    )

    exists = cur.fetchone()

    if not exists:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cur.execute("""
            INSERT INTO users(
                id,
                username,
                first_name,
                last_name,
                created_at,
                referred_by
            )
            VALUES(?,?,?,?,?,?)
        """, (
            user.id,
            user.username or "",
            user.first_name or "",
            user.last_name or "",
            now,
            referred_by
        ))

        conn.commit()

    else:
        cur.execute("""
            UPDATE users
            SET username=?,
                first_name=?,
                last_name=?
            WHERE id=?
        """, (
            user.username or "",
            user.first_name or "",
            user.last_name or "",
            user.id
        ))

        conn.commit()

    conn.close()


def get_user(user_id):
    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM users WHERE id=?",
        (user_id,)
    )

    row = cur.fetchone()
    conn.close()

    return row


def is_blocked(user_id):
    user = get_user(user_id)

    if not user:
        return False

    return bool(user["is_blocked"])


def is_admin(user_id):
    if user_id in ADMIN_IDS:
        return True

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT user_id FROM admins WHERE user_id=?",
        (user_id,)
    )

    row = cur.fetchone()
    conn.close()

    return bool(row)


# =========================================================
# BALANCE
# =========================================================

def add_balance(user_id, amount, description=""):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE users
        SET balance = balance + ?
        WHERE id=?
    """, (amount, user_id))

    cur.execute("""
        INSERT INTO transactions(
            user_id,
            amount,
            type,
            description,
            created_at
        )
        VALUES(?,?,?,?,?)
    """, (
        user_id,
        amount,
        "credit",
        description,
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ))

    conn.commit()
    conn.close()


def remove_balance(user_id, amount, description=""):
    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT balance FROM users WHERE id=?",
        (user_id,)
    )

    row = cur.fetchone()

    if not row or row["balance"] < amount:
        conn.close()
        return False

    cur.execute("""
        UPDATE users
        SET balance = balance - ?
        WHERE id=?
    """, (amount, user_id))

    cur.execute("""
        INSERT INTO transactions(
            user_id,
            amount,
            type,
            description,
            created_at
        )
        VALUES(?,?,?,?,?)
    """, (
        user_id,
        -amount,
        "debit",
        description,
        datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ))

    conn.commit()
    conn.close()

    return True


# =========================================================
# KEYBOARDS
# =========================================================

def main_menu():
    kb = types.ReplyKeyboardMarkup(
        resize_keyboard=True
    )

    kb.row(
        "📱 QR yaratish",
        "💰 Hisobim"
    )

    kb.row(
        "💳 Hisob to‘ldirish",
        "🎁 Bonus"
    )

    kb.row(
        "📜 Tarix",
        "🆘 Yordam"
    )

    kb.row(
        "ℹ️ Bot haqida"
    )

    return kb


def qr_menu():
    kb = types.InlineKeyboardMarkup()

    kb.row(
        types.InlineKeyboardButton(
            "🔗 Link",
            callback_data="qr_link"
        ),
        types.InlineKeyboardButton(
            "📝 Matn",
            callback_data="qr_text"
        )
    )

    kb.row(
        types.InlineKeyboardButton(
            "📞 Telefon",
            callback_data="qr_phone"
        ),
        types.InlineKeyboardButton(
            "📍 Lokatsiya",
            callback_data="qr_location"
        )
    )

    kb.row(
        types.InlineKeyboardButton(
            "📶 Wi-Fi",
            callback_data="qr_wifi"
        ),
        types.InlineKeyboardButton(
            "👤 Kontakt",
            callback_data="qr_contact"
        )
    )

    return kb


def admin_menu():
    kb = types.InlineKeyboardMarkup(row_width=2)

    buttons = [
        ("👥 Foydalanuvchilar", "admin_users"),
        ("📊 Statistika", "admin_stats"),
        ("💳 To‘lovlar", "admin_payments"),
        ("🎁 Bonus berish", "admin_bonus"),
        ("➕ Pul berish", "admin_add_money"),
        ("➖ Pul ayirish", "admin_remove_money"),
        ("🚫 Bloklash", "admin_block"),
        ("🔓 Blokdan chiqarish", "admin_unblock"),
        ("📢 Xabar yuborish", "admin_broadcast"),
        ("⚙️ QR narxi", "admin_price"),
        ("👑 Adminlar", "admin_admins"),
        ("📜 QR tarixi", "admin_qr_history"),
    ]

    for text, data in buttons:
        kb.add(
            types.InlineKeyboardButton(
                text,
                callback_data=data
            )
        )

    return kb


# =========================================================
# TEMP DATA
# =========================================================

user_states = {}


# =========================================================
# START
# =========================================================

@bot.message_handler(commands=["start"])
def start(message):
    try:
        user = message.from_user

        referred_by = None

        args = message.text.split(maxsplit=1)

        if len(args) > 1:
            try:
                ref_id = int(args[1])

                if ref_id != user.id:
                    referred_by = ref_id
            except:
                pass

        already = get_user(user.id)

        register_user(
            user,
            referred_by if not already else None
        )

        # Referral bonus
        if not already and referred_by:
            inviter = get_user(referred_by)

            if inviter:
                bonus = int(
                    get_setting(
                        "referral_bonus",
                        "100"
                    )
                )

                add_balance(
                    referred_by,
                    bonus,
                    "Referral bonusi"
                )

                conn = get_db()
                cur = conn.cursor()

                cur.execute("""
                    INSERT INTO referrals(
                        inviter_id,
                        invited_id,
                        bonus,
                        created_at
                    )
                    VALUES(?,?,?,?,?)
                """, (
                    referred_by,
                    user.id,
                    bonus,
                    datetime.now().strftime(
                        "%Y-%m-%d %H:%M:%S"
                    )
                ))

                conn.commit()
                conn.close()

                try:
                    bot.send_message(
                        referred_by,
                        f"🎁 Sizga referral bonusi berildi: "
                        f"<b>{bonus:,} so‘m</b>"
                    )
                except:
                    pass

        if is_blocked(user.id):
            bot.send_message(
                message.chat.id,
                "🚫 Siz botdan foydalanish huquqidan mahrum qilingansiz."
            )
            return

        text = (
            "👋 <b>QR Kod Yaratish Botiga xush kelibsiz!</b>\n\n"
            "⚡ Tez va sifatli QR kod yarating.\n"
            f"💰 1 ta QR kod: <b>{get_qr_price():,} so‘m</b>\n\n"
            "Quyidagi menyudan foydalaning:"
        )

        bot.send_message(
            message.chat.id,
            text,
            reply_markup=main_menu()
        )

    except Exception as e:
        logging.exception(e)


# =========================================================
# CONTACT
# =========================================================

@bot.message_handler(content_types=["contact"])
def receive_contact(message):
    if is_blocked(message.from_user.id):
        return

    phone = message.contact.phone_number

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        UPDATE users
        SET phone=?
        WHERE id=?
    """, (
        phone,
        message.from_user.id
    ))

    conn.commit()
    conn.close()

    bot.send_message(
        message.chat.id,
        "✅ Telefon raqamingiz saqlandi.",
        reply_markup=main_menu()
    )


# =========================================================
# TEXT MENU
# =========================================================

@bot.message_handler(
    func=lambda m: m.text == "💰 Hisobim"
)
def account(message):
    if is_blocked(message.from_user.id):
        return

    user = get_user(message.from_user.id)

    bot.send_message(
        message.chat.id,
        "💰 <b>Hisobingiz</b>\n\n"
        f"💵 Balans: <b>{user['balance']:,} so‘m</b>\n"
        f"🎁 Bonus: <b>{user['bonus']:,} so‘m</b>\n"
        f"📱 QR narxi: <b>{get_qr_price():,} so‘m</b>",
        reply_markup=main_menu()
    )


# =========================================================
# QR CREATE MENU
# =========================================================

@bot.message_handler(
    func=lambda m: m.text == "📱 QR yaratish"
)
def create_qr(message):
    if is_blocked(message.from_user.id):
        return

    user = get_user(message.from_user.id)

    price = get_qr_price()

    if user["balance"] < price:
        bot.send_message(
            message.chat.id,
            "❌ Balansingiz yetarli emas.\n\n"
            f"💰 Kerak: <b>{price:,} so‘m</b>\n"
            f"💵 Balansingiz: <b>{user['balance']:,} so‘m</b>\n\n"
            "Avval hisobingizni to‘ldiring."
        )
        return

    bot.send_message(
        message.chat.id,
        "📱 <b>QR turini tanlang:</b>",
        reply_markup=qr_menu()
    )


# =========================================================
# QR CALLBACK
# =========================================================

@bot.callback_query_handler(
    func=lambda call: call.data.startswith("qr_")
)
def qr_callback(call):
    user_id = call.from_user.id

    if is_blocked(user_id):
        bot.answer_callback_query(
            call.id,
            "🚫 Siz bloklangansiz."
        )
        return

    qr_type = call.data.replace("qr_", "")

    user = get_user(user_id)

    if user["balance"] < get_qr_price():
        bot.answer_callback_query(
            call.id,
            "❌ Balans yetarli emas!"
        )
        return

    user_states[user_id] = {
        "action": "qr",
        "type": qr_type
    }

    questions = {
        "link": "🔗 QR ichiga joylashtiriladigan linkni yuboring:",
        "text": "📝 QR ichiga yoziladigan matnni yuboring:",
        "phone": "📞 Telefon raqamini yuboring:",
        "location": "📍 Lokatsiyani <code>41.3111, 69.2797</code> ko‘rinishida yuboring:",
        "wifi": (
            "📶 Wi-Fi ma'lumotlarini quyidagi ko‘rinishda yuboring:\n\n"
            "<code>SSID|PAROL|WPA</code>"
        ),
        "contact": (
            "👤 Kontakt ma'lumotlarini yuboring:\n\n"
            "<code>Ism|Telefon</code>"
        )
    }

    bot.answer_callback_query(call.id)

    bot.send_message(
        call.message.chat.id,
        questions.get(
            qr_type,
            "Ma'lumotni yuboring:"
        )
    )


# =========================================================
# QR GENERATION
# =========================================================

def generate_qr(data):
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=12,
        border=4
    )

    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image()

    bio = io.BytesIO()
    bio.name = "qr_code.png"

    img.save(
        bio,
        format="PNG"
    )

    bio.seek(0)

    return bio


def build_qr_content(qr_type, text):
    if qr_type == "link":
        return text.strip()

    if qr_type == "text":
        return text

    if qr_type == "phone":
        return "tel:" + text.strip()

    if qr_type == "location":
        parts = text.split(",")

        if len(parts) != 2:
            raise ValueError(
                "Lokatsiya noto‘g‘ri formatda."
            )

        lat = parts[0].strip()
        lon = parts[1].strip()

        return f"geo:{lat},{lon}"

    if qr_type == "wifi":
        parts = text.split("|")

        if len(parts) != 3:
            raise ValueError(
                "Wi-Fi formati noto‘g‘ri."
            )

        ssid = parts[0]
        password = parts[1]
        security = parts[2]

        return (
            f"WIFI:T:{security};"
            f"S:{ssid};"
            f"P:{password};;"
        )

    if qr_type == "contact":
        parts = text.split("|")

        if len(parts) != 2:
            raise ValueError(
                "Kontakt formati noto‘g‘ri."
            )

        name = parts[0]
        phone = parts[1]

        return (
            "BEGIN:VCARD\n"
            "VERSION:3.0\n"
            f"FN:{name}\n"
            f"TEL:{phone}\n"
            "END:VCARD"
        )

    return text


# =========================================================
# MESSAGE HANDLER
# =========================================================

@bot.message_handler(
    content_types=["text"]
)
def text_handler(message):
    user_id = message.from_user.id

    if is_blocked(user_id):
        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )
        return

    register_user(message.from_user)

    text = message.text

    if text == "💳 Hisob to‘ldirish":
        payment_start(message)
        return

    if text == "🎁 Bonus":
        referral_info(message)
        return

    if text == "📜 Tarix":
        history(message)
        return

    if text == "🆘 Yordam":
        help_message(message)
        return

    if text == "ℹ️ Bot haqida":
        about(message)
        return

    if text == "👑 Admin panel":
        if is_admin(user_id):
            bot.send_message(
                message.chat.id,
                "👑 <b>Admin panel</b>",
                reply_markup=admin_menu()
            )
        return

    state = user_states.get(user_id)

    if state:
        if state.get("action") == "qr":
            handle_qr_data(message)
            return

        if state.get("action") == "payment_amount":
            handle_payment_amount(message)
            return

        if state.get("action") == "admin_bonus":
            admin_bonus_process(message)
            return

        if state.get("action") == "admin_add_money":
            admin_add_money_process(message)
            return

        if state.get("action") == "admin_remove_money":
            admin_remove_money_process(message)
            return

        if state.get("action") == "admin_block":
            admin_block_process(message)
            return

        if state.get("action") == "admin_unblock":
            admin_unblock_process(message)
            return

        if state.get("action") == "admin_broadcast":
            admin_broadcast_process(message)
            return

        if state.get("action") == "admin_price":
            admin_price_process(message)
            return


# =========================================================
# QR DATA
# =========================================================

def handle_qr_data(message):
    user_id = message.from_user.id
    state = user_states.get(user_id)

    if not state:
        return

    qr_type = state["type"]

    try:
        content = build_qr_content(
            qr_type,
            message.text
        )

        price = get_qr_price()

        user = get_user(user_id)

        if user["balance"] < price:
            user_states.pop(user_id, None)

            bot.send_message(
                message.chat.id,
                "❌ Balansingiz yetarli emas."
            )
            return

        # Pulni yechish
        success = remove_balance(
            user_id,
            price,
            f"{qr_type} QR yaratildi"
        )

        if not success:
            user_states.pop(user_id, None)

            bot.send_message(
                message.chat.id,
                "❌ Balansdan pul yechib bo‘lmadi."
            )
            return

        # QR
        image = generate_qr(content)

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO qr_codes(
                user_id,
                qr_type,
                content,
                price,
                created_at
            )
            VALUES(?,?,?,?,?)
        """, (
            user_id,
            qr_type,
            content,
            price,
            datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        ))

        conn.commit()
        conn.close()

        user_states.pop(user_id, None)

        bot.send_photo(
            message.chat.id,
            image,
            caption=(
                "✅ <b>QR kod tayyor!</b>\n\n"
                f"💰 Narxi: <b>{price:,} so‘m</b>\n"
                "📱 QR kodni telefon kamerasi orqali "
                "skaner qilishingiz mumkin."
            ),
            reply_markup=main_menu()
        )

    except Exception as e:
        logging.exception(e)

        bot.send_message(
            message.chat.id,
            f"❌ Ma'lumot noto‘g‘ri.\n\n"
            f"<code>{e}</code>"
        )


# =========================================================
# PAYMENT
# =========================================================

def payment_start(message):
    user_states[message.from_user.id] = {
        "action": "payment_amount"
    }

    bot.send_message(
        message.chat.id,
        "💳 <b>Hisob to‘ldirish</b>\n\n"
        f"💳 Karta:\n<code>{CARD_NUMBER}</code>\n\n"
        "1️⃣ Kartaga kerakli summani o'tkazing.\n"
        "2️⃣ Qancha to‘lov qilganingizni yozing.\n"
        "3️⃣ Keyin chekni yuboring.\n\n"
        "💡 Masalan: <code>10000</code>"
    )


def handle_payment_amount(message):
    user_id = message.from_user.id

    try:
        amount = int(
            message.text.replace(
                " ",
                ""
            )
        )

        if amount <= 0:
            raise ValueError

        user_states[user_id] = {
            "action": "payment_receipt",
            "amount": amount
        }

        bot.send_message(
            message.chat.id,
            "🧾 Endi to‘lov chekini <b>rasm</b> "
            "yoki <b>fayl</b> ko‘rinishida yuboring."
        )

    except:
        bot.send_message(
            message.chat.id,
            "❌ Summani faqat raqam bilan yozing.\n"
            "Masalan: <code>10000</code>"
        )


# =========================================================
# RECEIPT PHOTO
# =========================================================

@bot.message_handler(
    content_types=["photo", "document"]
)
def receipt_handler(message):
    user_id = message.from_user.id

    if is_blocked(user_id):
        return

    state = user_states.get(user_id)

    if not state:
        return

    if state.get("action") != "payment_receipt":
        return

    amount = state["amount"]

    file_id = None

    if message.content_type == "photo":
        file_id = message.photo[-1].file_id

    elif message.content_type == "document":
        file_id = message.document.file_id

    if not file_id:
        return

    unique_data = (
        f"{user_id}|{amount}|{file_id}"
    )

    receipt_hash = hashlib.sha256(
        unique_data.encode()
    ).hexdigest()

    conn = get_db()
    cur = conn.cursor()

    # Bir xil receipt hash
    cur.execute(
        "SELECT id FROM payments WHERE receipt_hash=?",
        (receipt_hash,)
    )

    exists = cur.fetchone()

    if exists:
        conn.close()

        bot.send_message(
            message.chat.id,
            "⚠️ Bu chek allaqachon yuborilgan."
        )
        return

    cur.execute("""
        INSERT INTO payments(
            user_id,
            amount,
            receipt_file_id,
            receipt_hash,
            status,
            created_at
        )
        VALUES(?,?,?,?,?,?)
    """, (
        user_id,
        amount,
        file_id,
        receipt_hash,
        "pending",
        datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )
    ))

    payment_id = cur.lastrowid

    conn.commit()
    conn.close()

    user_states.pop(user_id, None)

    bot.send_message(
        message.chat.id,
        "✅ Chekingiz adminga yuborildi.\n\n"
        "⏳ Admin tekshirganidan keyin "
        "balansingiz to‘ldiriladi."
    )

    user = get_user(user_id)

    admin_text = (
        "💳 <b>Yangi to‘lov!</b>\n\n"
        f"🆔 To‘lov: <code>#{payment_id}</code>\n"
        f"👤 Ism: {user['first_name'] or '-'}\n"
        f"🔹 Username: @{user['username'] if user['username'] else '-'}\n"
        f"🆔 User ID: <code>{user_id}</code>\n"
        f"📞 Telefon: <code>{user['phone'] or '-'}</code>\n"
        f"💰 Summa: <b>{amount:,} so‘m</b>\n"
        f"🕐 Sana: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

    keyboard = types.InlineKeyboardMarkup()

    keyboard.row(
        types.InlineKeyboardButton(
            "✅ Tasdiqlash",
            callback_data=f"pay_accept:{payment_id}"
        ),
        types.InlineKeyboardButton(
            "❌ Rad etish",
            callback_data=f"pay_reject:{payment_id}"
        )
    )

    for admin_id in ADMIN_IDS:
        try:
            if message.content_type == "photo":
                bot.send_photo(
                    admin_id,
                    file_id,
                    caption=admin_text,
                    reply_markup=keyboard
                )
            else:
                bot.send_document(
                    admin_id,
                    file_id,
                    caption=admin_text,
                    reply_markup=keyboard
                )
        except Exception as e:
            logging.exception(e)


# =========================================================
# PAYMENT CALLBACK
# =========================================================

@bot.callback_query_handler(
    func=lambda call:
        call.data.startswith("pay_accept:")
        or call.data.startswith("pay_reject:")
)
def payment_callback(call):
    if not is_admin(call.from_user.id):
        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q."
        )
        return

    action, payment_id = call.data.split(":")

    payment_id = int(payment_id)

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM payments WHERE id=?",
        (payment_id,)
    )

    payment = cur.fetchone()

    if not payment:
        conn.close()

        bot.answer_callback_query(
            call.id,
            "To‘lov topilmadi."
        )
        return

    if payment["status"] != "pending":
        conn.close()

        bot.answer_callback_query(
            call.id,
            "Bu to‘lov allaqachon ko‘rib chiqilgan."
        )
        return

    if action == "pay_accept":
        cur.execute("""
            UPDATE payments
            SET status='approved',
                processed_at=?,
                admin_id=?
            WHERE id=?
        """, (
            datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            call.from_user.id,
            payment_id
        ))

        conn.commit()
        conn.close()

        add_balance(
            payment["user_id"],
            payment["amount"],
            f"To‘lov #{payment_id} tasdiqlandi"
        )

        bot.edit_message_caption(
            "✅ <b>TO‘LOV TASDIQLANDI</b>\n\n"
            f"💰 {payment['amount']:,} so‘m\n"
            f"👤 User ID: <code>{payment['user_id']}</code>\n"
            f"👑 Admin: <code>{call.from_user.id}</code>",
            call.message.chat.id,
            call.message.message_id
        )

        try:
            user = get_user(payment["user_id"])

            bot.send_message(
                payment["user_id"],
                "✅ <b>To‘lov tasdiqlandi!</b>\n\n"
                f"💰 Balansingizga "
                f"<b>{payment['amount']:,} so‘m</b> qo‘shildi.\n"
                f"💵 Joriy balans: "
                f"<b>{user['balance']:,} so‘m</b>"
            )
        except:
            pass

    else:
        cur.execute("""
            UPDATE payments
            SET status='rejected',
                processed_at=?,
                admin_id=?
            WHERE id=?
        """, (
            datetime.now().strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            call.from_user.id,
            payment_id
        ))

        conn.commit()
        conn.close()

        bot.edit_message_caption(
            "❌ <b>TO‘LOV RAD ETILDI</b>\n\n"
            f"💰 {payment['amount']:,} so‘m\n"
            f"👤 User ID: <code>{payment['user_id']}</code>",
            call.message.chat.id,
            call.message.message_id
        )

        try:
            bot.send_message(
                payment["user_id"],
                "❌ <b>To‘lovingiz rad etildi.</b>\n\n"
                "Chekni tekshirib, qaytadan yuborishingiz mumkin."
            )
        except:
            pass

    bot.answer_callback_query(
        call.id,
        "Tayyor."
    )


# =========================================================
# REFERRAL
# =========================================================

def referral_info(message):
    user_id = message.from_user.id

    bot_username = bot.get_me().username

    link = (
        f"https://t.me/{bot_username}"
        f"?start={user_id}"
    )

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*) AS count
        FROM referrals
        WHERE inviter_id=?
    """, (user_id,))

    count = cur.fetchone()["count"]

    conn.close()

    bonus = get_setting(
        "referral_bonus",
        "100"
    )

    bot.send_message(
        message.chat.id,
        "🎁 <b>Referral tizimi</b>\n\n"
        f"👥 Taklif qilganlaringiz: <b>{count}</b>\n"
        f"💰 Har bir taklif uchun: <b>{int(bonus):,} so‘m</b>\n\n"
        "🔗 Sizning havolangiz:\n"
        f"<code>{link}</code>\n\n"
        "Havolani do‘stlaringizga yuboring."
    )


# =========================================================
# HISTORY
# =========================================================

def history(message):
    user_id = message.from_user.id

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT * FROM transactions
        WHERE user_id=?
        ORDER BY id DESC
        LIMIT 10
    """, (user_id,))

    rows = cur.fetchall()

    conn.close()

    if not rows:
        bot.send_message(
            message.chat.id,
            "📜 Hali tranzaksiyalar yo‘q."
        )
        return

    text = "📜 <b>Oxirgi tranzaksiyalar</b>\n\n"

    for row in rows:
        amount = row["amount"]

        if amount >= 0:
            sign = "+"
        else:
            sign = ""

        text += (
            f"{sign}{amount:,} so‘m — "
            f"{row['description']}\n"
            f"🕐 {row['created_at']}\n\n"
        )

    bot.send_message(
        message.chat.id,
        text
    )


# =========================================================
# HELP
# =========================================================

def help_message(message):
    bot.send_message(
        message.chat.id,
        "🆘 <b>Yordam</b>\n\n"
        "📱 QR yaratish — QR kod yaratish\n"
        "💳 Hisob to‘ldirish — balansni to‘ldirish\n"
        "💰 Hisobim — balansni ko‘rish\n"
        "🎁 Bonus — referral bonus\n"
        "📜 Tarix — tranzaksiyalar\n\n"
        "Muammo bo‘lsa administratorga murojaat qiling."
    )


def about(message):
    bot.send_message(
        message.chat.id,
        "ℹ️ <b>QR Kod Bot</b>\n\n"
        "⚡ Tez QR kod yaratish xizmati.\n"
        f"💰 1 QR: <b>{get_qr_price():,} so‘m</b>\n\n"
        "🔐 To‘lovlar admin tomonidan tekshiriladi."
    )


# =========================================================
# ADMIN PANEL
# =========================================================

@bot.message_handler(commands=["admin"])
def admin_command(message):
    if not is_admin(message.from_user.id):
        bot.send_message(
            message.chat.id,
            "🚫 Ruxsat yo‘q."
        )
        return

    bot.send_message(
        message.chat.id,
        "👑 <b>Admin panel</b>",
        reply_markup=admin_menu()
    )


@bot.callback_query_handler(
    func=lambda call:
        call.data.startswith("admin_")
)
def admin_callback(call):
    if not is_admin(call.from_user.id):
        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q."
        )
        return

    data = call.data

    if data == "admin_users":
        admin_users(call)

    elif data == "admin_stats":
        admin_stats(call)

    elif data == "admin_payments":
        admin_payments(call)

    elif data == "admin_bonus":
        admin_input(call, "admin_bonus")

    elif data == "admin_add_money":
        admin_input(call, "admin_add_money")

    elif data == "admin_remove_money":
        admin_input(call, "admin_remove_money")

    elif data == "admin_block":
        admin_input(call, "admin_block")

    elif data == "admin_unblock":
        admin_input(call, "admin_unblock")

    elif data == "admin_broadcast":
        admin_input(call, "admin_broadcast")

    elif data == "admin_price":
        admin_input(call, "admin_price")

    elif data == "admin_admins":
        admin_admins(call)

    elif data == "admin_qr_history":
        admin_qr_history(call)

    bot.answer_callback_query(call.id)


# =========================================================
# ADMIN USERS
# =========================================================

def admin_users(call):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT * FROM users
        ORDER BY id DESC
        LIMIT 50
    """)

    users = cur.fetchall()

    conn.close()

    if not users:
        bot.send_message(
            call.message.chat.id,
            "👥 Foydalanuvchilar yo‘q."
        )
        return

    text = "👥 <b>Oxirgi 50 foydalanuvchi</b>\n\n"

    for user in users:
        status = (
            "🚫"
            if user["is_blocked"]
            else "🟢"
        )

        username = (
            f"@{user['username']}"
            if user["username"]
            else "-"
        )

        text += (
            f"{status} <b>{user['first_name'] or '-'}</b>\n"
            f"🆔 <code>{user['id']}</code>\n"
            f"🔹 {username}\n"
            f"📞 {user['phone'] or '-'}\n"
            f"💰 {user['balance']:,} so‘m\n"
            "────────────\n"
        )

    bot.send_message(
        call.message.chat.id,
        text
    )


# =========================================================
# ADMIN STATS
# =========================================================

def admin_stats(call):
    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT COUNT(*) AS count FROM users"
    )
    users = cur.fetchone()["count"]

    cur.execute(
        "SELECT COUNT(*) AS count FROM users WHERE is_blocked=1"
    )
    blocked = cur.fetchone()["count"]

    cur.execute(
        "SELECT COUNT(*) AS count FROM qr_codes"
    )
    qr_count = cur.fetchone()["count"]

    cur.execute("""
        SELECT COALESCE(SUM(amount),0) AS total
        FROM payments
        WHERE status='approved'
    """)

    income = cur.fetchone()["total"]

    cur.execute("""
        SELECT COUNT(*) AS count
        FROM payments
        WHERE status='pending'
    """)

    pending = cur.fetchone()["count"]

    conn.close()

    text = (
        "📊 <b>STATISTIKA</b>\n\n"
        f"👥 Jami foydalanuvchilar: <b>{users}</b>\n"
        f"🚫 Bloklanganlar: <b>{blocked}</b>\n"
        f"📱 Jami QR: <b>{qr_count}</b>\n"
        f"💰 Tasdiqlangan tushum: <b>{income:,} so‘m</b>\n"
        f"⏳ Kutilayotgan to‘lovlar: <b>{pending}</b>"
    )

    bot.send_message(
        call.message.chat.id,
        text
    )


# =========================================================
# ADMIN PAYMENTS
# =========================================================

def admin_payments(call):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT * FROM payments
        ORDER BY id DESC
        LIMIT 20
    """)

    rows = cur.fetchall()

    conn.close()

    if not rows:
        bot.send_message(
            call.message.chat.id,
            "💳 To‘lovlar yo‘q."
        )
        return

    text = "💳 <b>To‘lovlar</b>\n\n"

    for row in rows:
        status_map = {
            "pending": "⏳",
            "approved": "✅",
            "rejected": "❌"
        }

        status = status_map.get(
            row["status"],
            "❓"
        )

        text += (
            f"{status} #{row['id']} — "
            f"<b>{row['amount']:,} so‘m</b>\n"
            f"👤 <code>{row['user_id']}</code>\n"
            f"🕐 {row['created_at']}\n\n"
        )

    bot.send_message(
        call.message.chat.id,
        text
    )


# =========================================================
# ADMIN INPUT
# =========================================================

def admin_input(call, action):
    user_states[call.from_user.id] = {
        "action": action
    }

    instructions = {
        "admin_bonus":
            "🎁 Foydalanuvchi ID va bonus summasini yuboring.\n"
            "<code>ID SUMMA</code>\n\n"
            "Masalan: <code>123456789 500</code>",

        "admin_add_money":
            "➕ Foydalanuvchi ID va summani yuboring.\n"
            "<code>ID SUMMA</code>",

        "admin_remove_money":
            "➖ Foydalanuvchi ID va summani yuboring.\n"
            "<code>ID SUMMA</code>",

        "admin_block":
            "🚫 Bloklanadigan foydalanuvchi ID'sini yuboring.",

        "admin_unblock":
            "🔓 Blokdan chiqariladigan ID'ni yuboring.",

        "admin_broadcast":
            "📢 Barcha foydalanuvchilarga yuboriladigan xabarni yozing.",

        "admin_price":
            "💰 Yangi QR narxini yuboring.\n"
            "Masalan: <code>150</code>"
    }

    bot.send_message(
        call.message.chat.id,
        instructions[action]
    )


# =========================================================
# ADMIN BONUS
# =========================================================

def admin_bonus_process(message):
    if not is_admin(message.from_user.id):
        return

    try:
        parts = message.text.split()

        user_id = int(parts[0])
        amount = int(parts[1])

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            UPDATE users
            SET bonus=bonus+?
            WHERE id=?
        """, (
            amount,
            user_id
        ))

        conn.commit()
        conn.close()

        user_states.pop(
            message.from_user.id,
            None
        )

        bot.send_message(
            message.chat.id,
            f"✅ {user_id} ga "
            f"{amount:,} bonus berildi."
        )

        try:
            bot.send_message(
                user_id,
                f"🎁 Sizga <b>{amount:,} bonus</b> berildi!"
            )
        except:
            pass

    except:
        bot.send_message(
            message.chat.id,
            "❌ Format noto‘g‘ri."
        )


# =========================================================
# ADMIN ADD MONEY
# =========================================================

def admin_add_money_process(message):
    if not is_admin(message.from_user.id):
        return

    try:
        parts = message.text.split()

        user_id = int(parts[0])
        amount = int(parts[1])

        user = get_user(user_id)

        if not user:
            bot.send_message(
                message.chat.id,
                "❌ Foydalanuvchi topilmadi."
            )
            return

        add_balance(
            user_id,
            amount,
            f"Admin tomonidan qo‘shildi"
        )

        user_states.pop(
            message.from_user.id,
            None
        )

        bot.send_message(
            message.chat.id,
            f"✅ {amount:,} so‘m qo‘shildi."
        )

        try:
            bot.send_message(
                user_id,
                f"➕ Admin hisobingizga "
                f"<b>{amount:,} so‘m</b> qo‘shdi."
            )
        except:
            pass

    except:
        bot.send_message(
            message.chat.id,
            "❌ Format noto‘g‘ri."
        )


# =========================================================
# ADMIN REMOVE MONEY
# =========================================================

def admin_remove_money_process(message):
    if not is_admin(message.from_user.id):
        return

    try:
        parts = message.text.split()

        user_id = int(parts[0])
        amount = int(parts[1])

        success = remove_balance(
            user_id,
            amount,
            "Admin tomonidan ayirildi"
        )

        if not success:
            bot.send_message(
                message.chat.id,
                "❌ Foydalanuvchi topilmadi yoki balans yetarli emas."
            )
            return

        user_states.pop(
            message.from_user.id,
            None
        )

        bot.send_message(
            message.chat.id,
            f"✅ {amount:,} so‘m ayirildi."
        )

        try:
            bot.send_message(
                user_id,
                f"➖ Hisobingizdan "
                f"<b>{amount:,} so‘m</b> ayirildi."
            )
        except:
            pass

    except:
        bot.send_message(
            message.chat.id,
            "❌ Format noto‘g‘ri."
        )


# =========================================================
# ADMIN BLOCK
# =========================================================

def admin_block_process(message):
    if not is_admin(message.from_user.id):
        return

    try:
        user_id = int(message.text)

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            UPDATE users
            SET is_blocked=1
            WHERE id=?
        """, (user_id,))

        conn.commit()
        conn.close()

        user_states.pop(
            message.from_user.id,
            None
        )

        bot.send_message(
            message.chat.id,
            f"🚫 <code>{user_id}</code> bloklandi."
        )

    except:
        bot.send_message(
            message.chat.id,
            "❌ ID noto‘g‘ri."
        )


# =========================================================
# ADMIN UNBLOCK
# =========================================================

def admin_unblock_process(message):
    if not is_admin(message.from_user.id):
        return

    try:
        user_id = int(message.text)

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            UPDATE users
            SET is_blocked=0
            WHERE id=?
        """, (user_id,))

        conn.commit()
        conn.close()

        user_states.pop(
            message.from_user.id,
            None
        )

        bot.send_message(
            message.chat.id,
            f"🔓 <code>{user_id}</code> blokdan chiqarildi."
        )

    except:
        bot.send_message(
            message.chat.id,
            "❌ ID noto‘g‘ri."
        )


# =========================================================
# BROADCAST
# =========================================================

def admin_broadcast_process(message):
    if not is_admin(message.from_user.id):
        return

    text = message.text

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM users WHERE is_blocked=0"
    )

    users = cur.fetchall()

    conn.close()

    sent = 0
    failed = 0

    for user in users:
        try:
            bot.send_message(
                user["id"],
                text
            )

            sent += 1

        except:
            failed += 1

    user_states.pop(
        message.from_user.id,
        None
    )

    bot.send_message(
        message.chat.id,
        "📢 <b>Broadcast tugadi</b>\n\n"
        f"✅ Yuborildi: {sent}\n"
        f"❌ Xato: {failed}"
    )


# =========================================================
# ADMIN PRICE
# =========================================================

def admin_price_process(message):
    if not is_admin(message.from_user.id):
        return

    try:
        price = int(message.text)

        if price <= 0:
            raise ValueError

        set_setting(
            "qr_price",
            price
        )

        user_states.pop(
            message.from_user.id,
            None
        )

        bot.send_message(
            message.chat.id,
            f"✅ QR narxi <b>{price:,} so‘m</b> qilib o‘rnatildi."
        )

    except:
        bot.send_message(
            message.chat.id,
            "❌ Narx noto‘g‘ri."
        )


# =========================================================
# ADMIN LIST
# =========================================================

def admin_admins(call):
    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT user_id FROM admins"
    )

    rows = cur.fetchall()

    conn.close()

    text = "👑 <b>Adminlar</b>\n\n"

    for row in rows:
        text += f"🆔 <code>{row['user_id']}</code>\n"

    bot.send_message(
        call.message.chat.id,
        text
    )


# =========================================================
# QR HISTORY ADMIN
# =========================================================

def admin_qr_history(call):
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT * FROM qr_codes
        ORDER BY id DESC
        LIMIT 30
    """)

    rows = cur.fetchall()

    conn.close()

    if not rows:
        bot.send_message(
            call.message.chat.id,
            "📜 QR tarixi bo‘sh."
        )
        return

    text = "📜 <b>QR tarixi</b>\n\n"

    for row in rows:
        text += (
            f"#{row['id']} | "
            f"👤 {row['user_id']} | "
            f"{row['qr_type']} | "
            f"{row['price']:,} so‘m\n"
            f"🕐 {row['created_at']}\n\n"
        )

    bot.send_message(
        call.message.chat.id,
        text
    )


# =========================================================
# ADMIN COMMAND MENU
# =========================================================

@bot.message_handler(commands=["id"])
def get_id(message):
    bot.send_message(
        message.chat.id,
        f"🆔 Sizning Telegram ID'ingiz:\n"
        f"<code>{message.from_user.id}</code>"
    )


@bot.message_handler(commands=["phone"])
def phone_request(message):
    if is_blocked(message.from_user.id):
        return

    kb = types.ReplyKeyboardMarkup(
        resize_keyboard=True,
        one_time_keyboard=True
    )

    button = types.KeyboardButton(
        "📞 Telefon raqamimni yuborish",
        request_contact=True
    )

    kb.add(button)

    bot.send_message(
        message.chat.id,
        "📞 Telefon raqamingizni yuboring:",
        reply_markup=kb
    )


# =========================================================
# ERROR HANDLER
# =========================================================

def safe_polling():
    while True:
        try:
            logging.info("Bot ishga tushmoqda...")
            bot.infinity_polling(
                skip_pending=True,
                timeout=30,
                long_polling_timeout=30
            )
        except Exception as e:
            logging.exception(
                "Polling xatosi: %s",
                e
            )


# =========================================================
# START
# =========================================================

if __name__ == "__main__":
    init_db()

    print("=" * 50)
    print("QR CODE BOT ISHGA TUSHMOQDA")
    print("=" * 50)

    safe_polling()
