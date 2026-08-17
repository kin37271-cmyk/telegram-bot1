# ============================================================
# QR CODE BOT — 1-QISM
# /start | /id | /admin | ADMIN PANEL
# ============================================================

import os
import sqlite3
import logging
import time

import telebot
from telebot import types


# ============================================================
# SOZLAMALAR
# ============================================================

BOT_TOKEN = "8819693468:AAGK2a8jqYfDtXQuis2fKesOHJMGfy2P238"

# O'ZINGIZNING TELEGRAM ID'ingizni yozing
ADMIN_ID = 7600986332

DB_NAME = "qr_bot.db"


# ============================================================
# BOT
# ============================================================

bot = telebot.TeleBot(
    BOT_TOKEN,
    parse_mode="HTML"
)


# ============================================================
# LOG
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)


# ============================================================
# DATABASE
# ============================================================

def get_db():
    conn = sqlite3.connect(
        DB_NAME,
        check_same_thread=False
    )

    conn.row_factory = sqlite3.Row

    return conn


def init_db():

    conn = get_db()
    cur = conn.cursor()

    # USERS
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            balance INTEGER DEFAULT 0,
            blocked INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ADMINS
    cur.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            user_id INTEGER PRIMARY KEY
        )
    """)

    # QR HISTORY
    cur.execute("""
        CREATE TABLE IF NOT EXISTS qr_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            qr_type TEXT,
            data TEXT,
            price INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ASOSIY ADMINNI BAZAGA QO'SHISH
    cur.execute(
        "INSERT OR IGNORE INTO admins(user_id) VALUES(?)",
        (ADMIN_ID,)
    )

    conn.commit()
    conn.close()

    logging.info(
        "Database tayyor. ADMIN_ID=%s",
        ADMIN_ID
    )


# ============================================================
# USER
# ============================================================

def register_user(user):

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT OR IGNORE INTO users
        (
            user_id,
            username,
            first_name
        )
        VALUES (?, ?, ?)
    """, (
        user.id,
        user.username or "",
        user.first_name or ""
    ))

    conn.commit()
    conn.close()


def get_user(user_id):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM users WHERE user_id=?",
        (user_id,)
    )

    row = cur.fetchone()

    conn.close()

    return row


# ============================================================
# ADMIN TEKSHIRISH
# ============================================================

def is_admin(user_id):

    # ASOSIY ADMIN
    if int(user_id) == int(ADMIN_ID):
        return True

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT user_id FROM admins WHERE user_id=?",
        (user_id,)
    )

    row = cur.fetchone()

    conn.close()

    return row is not None


# ============================================================
# BLOCK TEKSHIRISH
# ============================================================

def is_blocked(user_id):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT blocked FROM users WHERE user_id=?",
        (user_id,)
    )

    row = cur.fetchone()

    conn.close()

    if not row:
        return False

    return bool(row["blocked"])


# ============================================================
# USER MENU
# ============================================================

def main_menu(user_id):

    kb = types.ReplyKeyboardMarkup(
        resize_keyboard=True
    )

    kb.row(
        "📱 QR yaratish",
        "💳 Hisob"
    )

    kb.row(
        "📜 Tarix",
        "🎁 Bonus"
    )

    kb.row(
        "🆘 Yordam",
        "ℹ️ Bot haqida"
    )

    # FAQAT ADMIN KO'RADI
    if is_admin(user_id):
        kb.row(
            "👑 Admin panel"
        )

    return kb


# ============================================================
# ADMIN MENU
# ============================================================

def admin_menu():

    kb = types.InlineKeyboardMarkup(
        row_width=2
    )

    kb.add(
        types.InlineKeyboardButton(
            "👥 Foydalanuvchilar",
            callback_data="admin_users"
        ),
        types.InlineKeyboardButton(
            "📊 Statistika",
            callback_data="admin_stats"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "💰 To'lovlar",
            callback_data="admin_payments"
        ),
        types.InlineKeyboardButton(
            "➕ Pul qo'shish",
            callback_data="admin_add_money"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "➖ Pul ayirish",
            callback_data="admin_remove_money"
        ),
        types.InlineKeyboardButton(
            "🚫 Bloklash",
            callback_data="admin_block"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "🔓 Blokdan chiqarish",
            callback_data="admin_unblock"
        ),
        types.InlineKeyboardButton(
            "📢 Xabar yuborish",
            callback_data="admin_broadcast"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "👑 Adminlar",
            callback_data="admin_admins"
        ),
        types.InlineKeyboardButton(
            "📜 QR tarixi",
            callback_data="admin_qr_history"
        )
    )

    return kb


# ============================================================
# START
# ============================================================

@bot.message_handler(commands=["start"])
def start_command(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz botdan foydalanish uchun bloklangansiz."
        )

        return

    text = (
        "👋 <b>QR CODE BOT</b>\n\n"
        "Assalomu alaykum!\n"
        "QR kod yaratish botiga xush kelibsiz.\n\n"
        f"🆔 ID: <code>{user_id}</code>\n\n"
        "👇 Kerakli bo'limni tanlang:"
    )

    bot.send_message(
        message.chat.id,
        text,
        reply_markup=main_menu(user_id)
    )


# ============================================================
# /ID
# ============================================================

@bot.message_handler(commands=["id"])
def id_command(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    bot.send_message(
        message.chat.id,
        "🆔 <b>SIZNING TELEGRAM ID INGIZ</b>\n\n"
        f"<code>{user_id}</code>\n\n"
        "👆 Shu ID'ni ADMIN_ID ga yozing."
    )


# ============================================================
# /CHECKADMIN
# ============================================================

@bot.message_handler(commands=["checkadmin"])
def check_admin(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_admin(user_id):

        bot.send_message(
            message.chat.id,
            "✅ <b>SIZ ADMINSIZ!</b>\n\n"
            f"🆔 ID: <code>{user_id}</code>\n"
            f"👑 Asosiy admin: "
            f"<b>{'HA' if user_id == ADMIN_ID else 'YO‘Q'}</b>"
        )

    else:

        bot.send_message(
            message.chat.id,
            "❌ <b>Siz admin emassiz.</b>\n\n"
            f"🆔 Sizning ID: <code>{user_id}</code>\n"
            f"🔐 Admin ID: <code>{ADMIN_ID}</code>"
        )


# ============================================================
# /ADMIN
# ============================================================

@bot.message_handler(commands=["admin"])
def admin_command(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    # ADMIN EMAS
    if not is_admin(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 <b>RUXSAT YO'Q</b>\n\n"
            f"🆔 Sizning ID: <code>{user_id}</code>\n\n"
            "Siz admin sifatida ro'yxatdan o'tmagansiz."
        )

        return

    # ADMIN
    bot.send_message(
        message.chat.id,
        "👑 <b>ADMIN PANEL</b>\n\n"
        f"🆔 Admin ID: <code>{user_id}</code>\n\n"
        "Kerakli bo'limni tanlang:",
        reply_markup=admin_menu()
    )


# ============================================================
# ADMIN PANEL BUTTON
# ============================================================

@bot.message_handler(
    func=lambda message:
    message.text == "👑 Admin panel"
)
def admin_panel_button(message):

    user_id = message.from_user.id

    if not is_admin(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz admin emassiz."
        )

        return

    bot.send_message(
        message.chat.id,
        "👑 <b>ADMIN PANEL</b>\n\n"
        f"🆔 ID: <code>{user_id}</code>\n\n"
        "Kerakli bo'limni tanlang:",
        reply_markup=admin_menu()
    )


# ============================================================
# ADMIN CALLBACK
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data.startswith("admin_")
)
def admin_callback(call):

    user_id = call.from_user.id

    # ENG MUHIM TEKSHIRUV
    if not is_admin(user_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Siz admin emassiz!",
            show_alert=True
        )

        return

    data = call.data

    bot.answer_callback_query(
        call.id
    )

    # USERS
    if data == "admin_users":

        conn = get_db()
        cur = conn.cursor()

        cur.execute(
            "SELECT COUNT(*) AS count FROM users"
        )

        count = cur.fetchone()["count"]

        conn.close()

        bot.send_message(
            call.message.chat.id,
            "👥 <b>FOYDALANUVCHILAR</b>\n\n"
            f"👤 Jami: <b>{count}</b>"
        )

    # STATS
    elif data == "admin_stats":

        conn = get_db()
        cur = conn.cursor()

        cur.execute(
            "SELECT COUNT(*) AS count FROM users"
        )

        users = cur.fetchone()["count"]

        cur.execute(
            "SELECT COUNT(*) AS count FROM qr_codes"
        )

        qrs = cur.fetchone()["count"]

        conn.close()

        bot.send_message(
            call.message.chat.id,
            "📊 <b>STATISTIKA</b>\n\n"
            f"👥 Foydalanuvchilar: <b>{users}</b>\n"
            f"📱 Yaratilgan QR: <b>{qrs}</b>"
        )

    # ADMINS
    elif data == "admin_admins":

        conn = get_db()
        cur = conn.cursor()

        cur.execute(
            "SELECT user_id FROM admins ORDER BY user_id"
        )

        rows = cur.fetchall()

        conn.close()

        text = "👑 <b>ADMINLAR</b>\n\n"

        if not rows:

            text += "Adminlar topilmadi."

        else:

            for row in rows:

                admin_id = row["user_id"]

                if admin_id == ADMIN_ID:

                    text += (
                        f"👑 <code>{admin_id}</code>"
                        " — Asosiy admin\n"
                    )

                else:

                    text += (
                        f"🛡 <code>{admin_id}</code>\n"
                    )

        bot.send_message(
            call.message.chat.id,
            text
        )

    # QR HISTORY
    elif data == "admin_qr_history":

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            SELECT *
            FROM qr_codes
            ORDER BY id DESC
            LIMIT 30
        """)

        rows = cur.fetchall()

        conn.close()

        if not rows:

            bot.send_message(
                call.message.chat.id,
                "📜 QR tarixi hozircha bo'sh."
            )

        else:

            text = "📜 <b>QR TARIXI</b>\n\n"

            for row in rows:

                text += (
                    f"#{row['id']} | "
                    f"🆔 <code>{row['user_id']}</code>\n"
                    f"📱 Turi: <b>{row['qr_type']}</b>\n"
                    f"💰 Narxi: "
                    f"<b>{row['price']:,} so'm</b>\n"
                    f"🕐 {row['created_at']}\n"
                    "────────────\n"
                )

            bot.send_message(
                call.message.chat.id,
                text
            )

    # QOLGAN BO'LIMLAR
    else:

        bot.send_message(
            call.message.chat.id,
            "🚧 Bu bo'lim keyingi qismda ulanadi."
        )


# ============================================================
# USER TEXT
# ============================================================

@bot.message_handler(content_types=["text"])
def text_handler(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    text = message.text

    if text == "📱 QR yaratish":

        bot.send_message(
            message.chat.id,
            "📱 <b>QR yaratish</b>\n\n"
            "Bu bo'lim 2-qismda ulanadi."
        )

        return

    if text == "💳 Hisob":

        user = get_user(user_id)

        balance = user["balance"] if user else 0

        bot.send_message(
            message.chat.id,
            "💳 <b>HISOB</b>\n\n"
            f"💰 Balans: <b>{balance:,} so'm</b>"
        )

        return

    if text == "📜 Tarix":

        bot.send_message(
            message.chat.id,
            "📜 Sizning QR tarixingiz keyingi qismda."
        )

        return

    if text == "🎁 Bonus":

        bot.send_message(
            message.chat.id,
            "🎁 Bonus tizimi keyingi qismda."
        )

        return

    if text == "🆘 Yordam":

        bot.send_message(
            message.chat.id,
            "🆘 <b>YORDAM</b>\n\n"
            "Savollar bo'lsa administratorga murojaat qiling."
        )

        return

    if text == "ℹ️ Bot haqida":

        bot.send_message(
            message.chat.id,
            "ℹ️ <b>QR CODE BOT</b>\n\n"
            "Tez va qulay QR kod yaratish bot."
        )

        return


# ============================================================
# ERROR SAFE POLLING
# ============================================================

def start_bot():

    while True:

        try:

            logging.info(
                "Bot ishga tushmoqda..."
            )

            bot.remove_webhook()

            time.sleep(1)

            bot.infinity_polling(
                skip_pending=True,
                timeout=30,
                long_polling_timeout=30,
                allowed_updates=[
                    "message",
                    "callback_query"
                ]
            )

        except Exception as e:

            logging.exception(
                "BOT ERROR: %s",
                e
            )

            time.sleep(5)


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("QR CODE BOT")
    print("=" * 60)

    print(
        f"ADMIN ID: {ADMIN_ID}"
    )

    init_db()

    print(
        "ADMIN DATABASE'DA: OK"
    )

    print(
        "BOT ISHGA TUSHMOQDA..."
    )

    # ============================================================
# 2-QISM — QR CODE YARATISH
# LINK / TEXT / PHONE / LOCATION / WIFI
# ============================================================

import io
import qrcode


# ============================================================
# QR NARXI
# ============================================================

QR_PRICE = 150


# ============================================================
# QR HOLATLARI
# ============================================================

qr_states = {}


# ============================================================
# QR MENU
# ============================================================

def qr_menu():

    kb = types.InlineKeyboardMarkup(row_width=2)

    kb.add(
        types.InlineKeyboardButton(
            "🔗 Link",
            callback_data="qr_link"
        ),
        types.InlineKeyboardButton(
            "📝 Text",
            callback_data="qr_text"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "📞 Telefon",
            callback_data="qr_phone"
        ),
        types.InlineKeyboardButton(
            "📍 Lokatsiya",
            callback_data="qr_location"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "📶 Wi-Fi",
            callback_data="qr_wifi"
        )
    )

    return kb


# ============================================================
# QR YARATISH BUTTONINI ULASH
# ============================================================

def send_qr_menu(message):

    bot.send_message(
        message.chat.id,
        "📱 <b>QR KOD YARATISH</b>\n\n"
        f"💰 Narxi: <b>{QR_PRICE:,} so'm</b>\n\n"
        "QR kod turini tanlang:",
        reply_markup=qr_menu()
    )


# ============================================================
# QR CALLBACK
# ============================================================

@bot.callback_query_handler(
    func=lambda call: call.data.startswith("qr_")
)
def qr_callback(call):

    user_id = call.from_user.id

    if is_blocked(user_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Siz bloklangansiz!",
            show_alert=True
        )

        return

    data = call.data

    if data == "qr_link":

        qr_states[user_id] = {
            "type": "link"
        }

        bot.answer_callback_query(
            call.id
        )

        bot.send_message(
            call.message.chat.id,
            "🔗 <b>LINK QR</b>\n\n"
            "Sayt yoki Telegram linkini yuboring.\n\n"
            "Masalan:\n"
            "<code>https://google.com</code>"
        )

        return

    if data == "qr_text":

        qr_states[user_id] = {
            "type": "text"
        }

        bot.answer_callback_query(
            call.id
        )

        bot.send_message(
            call.message.chat.id,
            "📝 <b>TEXT QR</b>\n\n"
            "QR ichiga joylashtirmoqchi bo'lgan "
            "matnni yuboring."
        )

        return

    if data == "qr_phone":

        qr_states[user_id] = {
            "type": "phone"
        }

        bot.answer_callback_query(
            call.id
        )

        bot.send_message(
            call.message.chat.id,
            "📞 <b>TELEFON QR</b>\n\n"
            "Telefon raqamini yuboring.\n\n"
            "Masalan:\n"
            "<code>+998901234567</code>"
        )

        return

    if data == "qr_location":

        qr_states[user_id] = {
            "type": "location"
        }

        bot.answer_callback_query(
            call.id
        )

        bot.send_message(
            call.message.chat.id,
            "📍 <b>LOKATSIYA QR</b>\n\n"
            "Quyidagi formatda yuboring:\n\n"
            "<code>41.311081,69.240562</code>\n\n"
            "Birinchi raqam — latitude.\n"
            "Ikkinchi raqam — longitude."
        )

        return

    if data == "qr_wifi":

        qr_states[user_id] = {
            "type": "wifi",
            "step": "ssid"
        }

        bot.answer_callback_query(
            call.id
        )

        bot.send_message(
            call.message.chat.id,
            "📶 <b>WI-FI QR</b>\n\n"
            "Wi-Fi nomini (SSID) yuboring."
        )

        return


# ============================================================
# QR GENERATOR
# ============================================================

def create_qr(data):

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=12,
        border=4
    )

    qr.add_data(data)

    qr.make(
        fit=True
    )

    image = qr.make_image(
        fill_color="black",
        back_color="white"
    )

    output = io.BytesIO()

    image.save(
        output,
        format="PNG"
    )

    output.seek(0)

    return output


# ============================================================
# QR SAQLASH
# ============================================================

def save_qr(user_id, qr_type, data):

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO qr_codes
        (
            user_id,
            qr_type,
            data,
            price
        )
        VALUES (?, ?, ?, ?)
    """, (
        user_id,
        qr_type,
        data,
        QR_PRICE
    ))

    conn.commit()
    conn.close()


# ============================================================
# QR YUBORISH
# ============================================================

def send_generated_qr(message, qr_type, data):

    try:

        image = create_qr(data)

        save_qr(
            message.from_user.id,
            qr_type,
            data
        )

        caption = (
            "✅ <b>QR KOD TAYYOR!</b>\n\n"
            f"📱 Turi: <b>{qr_type}</b>\n"
            f"💰 Narxi: <b>{QR_PRICE:,} so'm</b>\n\n"
            "📷 QR kodni skaner qilishingiz mumkin."
        )

        bot.send_photo(
            message.chat.id,
            image,
            caption=caption
        )

    except Exception as e:

        logging.exception(
            "QR ERROR: %s",
            e
        )

        bot.send_message(
            message.chat.id,
            "❌ QR yaratishda xatolik yuz berdi."
        )


# ============================================================
# QR TEXT HANDLER
# ============================================================

def process_qr_message(message):

    user_id = message.from_user.id

    state = qr_states.get(user_id)

    if not state:
        return False

    qr_type = state.get("type")

    text = message.text.strip()

    # --------------------------------------------------------
    # LINK
    # --------------------------------------------------------

    if qr_type == "link":

        if not (
            text.startswith("http://")
            or text.startswith("https://")
        ):

            bot.send_message(
                message.chat.id,
                "❌ Link noto'g'ri.\n\n"
                "https:// bilan boshlanadigan link yuboring."
            )

            return True

        send_generated_qr(
            message,
            "Link",
            text
        )

        qr_states.pop(
            user_id,
            None
        )

        return True

    # --------------------------------------------------------
    # TEXT
    # --------------------------------------------------------

    if qr_type == "text":

        if len(text) < 1:

            bot.send_message(
                message.chat.id,
                "❌ Matn bo'sh bo'lmasligi kerak."
            )

            return True

        send_generated_qr(
            message,
            "Text",
            text
        )

        qr_states.pop(
            user_id,
            None
        )

        return True

    # --------------------------------------------------------
    # PHONE
    # --------------------------------------------------------

    if qr_type == "phone":

        phone = text.replace(
            " ",
            ""
        )

        if not phone.startswith("+"):

            bot.send_message(
                message.chat.id,
                "❌ Telefon raqami + bilan boshlansin.\n\n"
                "Masalan:\n"
                "<code>+998901234567</code>"
            )

            return True

        qr_data = "tel:" + phone

        send_generated_qr(
            message,
            "Telefon",
            qr_data
        )

        qr_states.pop(
            user_id,
            None
        )

        return True

    # --------------------------------------------------------
    # LOCATION
    # --------------------------------------------------------

    if qr_type == "location":

        try:

            parts = text.split(",")

            if len(parts) != 2:
                raise ValueError

            latitude = float(
                parts[0].strip()
            )

            longitude = float(
                parts[1].strip()
            )

            if not (
                -90 <= latitude <= 90
            ):
                raise ValueError

            if not (
                -180 <= longitude <= 180
            ):
                raise ValueError

            qr_data = (
                f"geo:{latitude},{longitude}"
            )

            send_generated_qr(
                message,
                "Lokatsiya",
                qr_data
            )

            qr_states.pop(
                user_id,
                None
            )

        except Exception:

            bot.send_message(
                message.chat.id,
                "❌ Lokatsiya noto'g'ri.\n\n"
                "Masalan:\n"
                "<code>41.311081,69.240562</code>"
            )

        return True

    # --------------------------------------------------------
    # WIFI
    # --------------------------------------------------------

    if qr_type == "wifi":

        step = state.get("step")

        # SSID
        if step == "ssid":

            qr_states[user_id]["ssid"] = text
            qr_states[user_id]["step"] = "password"

            bot.send_message(
                message.chat.id,
                "🔐 Wi-Fi parolini yuboring.\n\n"
                "Agar parol bo'lmasa:\n"
                "<code>none</code>"
            )

            return True

        # PASSWORD
        if step == "password":

            qr_states[user_id]["password"] = text
            qr_states[user_id]["step"] = "security"

            kb = types.InlineKeyboardMarkup(
                row_width=3
            )

            kb.add(
                types.InlineKeyboardButton(
                    "🔒 WPA/WPA2",
                    callback_data="wifi_wpa"
                ),
                types.InlineKeyboardButton(
                    "🔓 Ochiq",
                    callback_data="wifi_none"
                )
            )

            bot.send_message(
                message.chat.id,
                "🔐 <b>Wi-Fi himoyasi</b>\n\n"
                "Himoya turini tanlang:",
                reply_markup=kb
            )

            return True

        return True

    return False


# ============================================================
# WIFI SECURITY CALLBACK
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data in [
        "wifi_wpa",
        "wifi_none"
    ]
)
def wifi_security(call):

    user_id = call.from_user.id

    if user_id not in qr_states:

        bot.answer_callback_query(
            call.id,
            "❌ Sessiya tugagan.",
            show_alert=True
        )

        return

    state = qr_states[user_id]

    if state.get("type") != "wifi":

        return

    ssid = state.get(
        "ssid",
        ""
    )

    password = state.get(
        "password",
        ""
    )

    if call.data == "wifi_none":

        security = "nopass"
        password = ""

    else:

        security = "WPA"

        if password.lower() == "none":
            password = ""

    # QR Wi-Fi format
    qr_data = (
        f"WIFI:"
        f"T:{security};"
        f"S:{ssid};"
        f"P:{password};;"
    )

    bot.answer_callback_query(
        call.id
    )

    # Fake message emas — to'g'ridan-to'g'ri yaratamiz
    try:

        image = create_qr(
            qr_data
        )

        save_qr(
            user_id,
            "Wi-Fi",
            qr_data
        )

        bot.send_photo(
            call.message.chat.id,
            image,
            caption=(
                "✅ <b>WI-FI QR TAYYOR!</b>\n\n"
                f"📶 Wi-Fi: <b>{ssid}</b>\n"
                f"🔐 Himoya: <b>{security}</b>\n\n"
                "📷 Telefon kamerasi bilan skaner qiling."
            )
        )

        qr_states.pop(
            user_id,
            None
        )

    except Exception as e:

        logging.exception(
            "WIFI QR ERROR: %s",
            e
        )

        bot.send_message(
            call.message.chat.id,
            "❌ Wi-Fi QR yaratishda xatolik."
        )


# ============================================================
# TEXT HANDLER ICHIGA QRNI ULASH
# ============================================================

    # ============================================================
# 3-QISM — BALANS / PUL QO‘SHISH / QR UCHUN PUL YECHISH
# ============================================================

# ============================================================
# BALANSNI OLISH
# ============================================================

def get_balance(user_id):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT balance FROM users WHERE user_id=?",
        (user_id,)
    )

    row = cur.fetchone()

    conn.close()

    if not row:
        return 0

    return int(row["balance"] or 0)


# ============================================================
# BALANSNI O‘ZGARTIRISH
# ============================================================

def change_balance(user_id, amount):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT balance FROM users WHERE user_id=?",
        (user_id,)
    )

    row = cur.fetchone()

    if not row:
        conn.close()
        return False

    new_balance = int(row["balance"] or 0) + int(amount)

    if new_balance < 0:
        conn.close()
        return False

    cur.execute(
        "UPDATE users SET balance=? WHERE user_id=?",
        (new_balance, user_id)
    )

    conn.commit()
    conn.close()

    return True


# ============================================================
# HISOB MENU
# ============================================================

def balance_menu():

    kb = types.InlineKeyboardMarkup(row_width=1)

    kb.add(
        types.InlineKeyboardButton(
            "💳 Hisob to‘ldirish",
            callback_data="balance_add"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "🔄 Balansni yangilash",
            callback_data="balance_refresh"
        )
    )

    return kb


# ============================================================
# HISOBNI KO‘RSATISH
# ============================================================

def show_balance(message):

    user_id = message.from_user.id

    balance = get_balance(user_id)

    bot.send_message(
        message.chat.id,
        "💳 <b>MENING HISOBIM</b>\n\n"
        f"💰 Balans: <b>{balance:,} so‘m</b>\n\n"
        f"📱 1 ta QR: <b>{QR_PRICE:,} so‘m</b>",
        reply_markup=balance_menu()
    )


# ============================================================
# BALANCE CALLBACK
# ============================================================

@bot.callback_query_handler(
    func=lambda call: call.data.startswith("balance_")
)
def balance_callback(call):

    user_id = call.from_user.id

    if is_blocked(user_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Siz bloklangansiz!",
            show_alert=True
        )

        return

    data = call.data

    # --------------------------------------------------------
    # REFRESH
    # --------------------------------------------------------

    if data == "balance_refresh":

        balance = get_balance(user_id)

        bot.answer_callback_query(
            call.id,
            "✅ Balans yangilandi!"
        )

        bot.edit_message_text(
            "💳 <b>MENING HISOBIM</b>\n\n"
            f"💰 Balans: <b>{balance:,} so‘m</b>\n\n"
            f"📱 1 ta QR: <b>{QR_PRICE:,} so‘m</b>",
            call.message.chat.id,
            call.message.message_id,
            reply_markup=balance_menu()
        )

        return

    # --------------------------------------------------------
    # ADD MONEY
    # --------------------------------------------------------

    if data == "balance_add":

        bot.answer_callback_query(
            call.id
        )

        bot.send_message(
            call.message.chat.id,
            "💳 <b>HISOB TO‘LDIRISH</b>\n\n"
            "Kerakli summani so‘mda yuboring.\n\n"
            "Masalan:\n"
            "<code>10000</code>"
        )

        payment_states[user_id] = {
            "action": "amount"
        }

        return


# ============================================================
# PAYMENT STATES
# ============================================================

payment_states = {}


# ============================================================
# TO‘LOV SUMMASI
# ============================================================

def process_payment_amount(message):

    user_id = message.from_user.id

    if user_id not in payment_states:
        return False

    state = payment_states[user_id]

    if state.get("action") != "amount":
        return False

    try:

        amount = int(
            message.text.replace(
                " ",
                ""
            )
        )

        if amount < 1000:

            bot.send_message(
                message.chat.id,
                "❌ Minimal to‘lov <b>1 000 so‘m</b>."
            )

            return True

    except ValueError:

        bot.send_message(
            message.chat.id,
            "❌ Faqat raqam yuboring.\n\n"
            "Masalan: <code>10000</code>"
        )

        return True

    payment_states.pop(
        user_id,
        None
    )

    # --------------------------------------------------------
    # BU YERDA REAL KARTA TO‘LOVI ULASHILADI
    # --------------------------------------------------------

    bot.send_message(
        message.chat.id,
        "💳 <b>TO‘LOV MA’LUMOTI</b>\n\n"
        f"💰 Summa: <b>{amount:,} so‘m</b>\n\n"
        "🏦 Karta:\n"
        "<code>6262 7201 2331 5395</code>\n\n"
        "📸 To‘lovni amalga oshirgach, "
        "chek rasmini shu yerga yuboring."
    )

    payment_states[user_id] = {
        "action": "receipt",
        "amount": amount
    }

    return True


# ============================================================
# CHEK QABUL QILISH
# ============================================================

@bot.message_handler(
    content_types=["photo"]
)
def payment_receipt(message):

    user_id = message.from_user.id

    state = payment_states.get(user_id)

    if not state:
        return

    if state.get("action") != "receipt":
        return

    amount = int(
        state.get("amount", 0)
    )

    photo = message.photo[-1]

    file_id = photo.file_id

    payment_states.pop(
        user_id,
        None
    )

    # --------------------------------------------------------
    # ADMINLARGA CHEK YUBORISH
    # --------------------------------------------------------

    caption = (
        "💳 <b>YANGI TO‘LOV</b>\n\n"
        f"👤 User ID: <code>{user_id}</code>\n"
        f"💰 Summa: <b>{amount:,} so‘m</b>\n\n"
        "Tekshirib, balansga qo‘shing."
    )

    try:

        bot.send_photo(
            ADMIN_ID,
            file_id,
            caption=caption,
            reply_markup=payment_admin_keyboard(
                user_id,
                amount
            )
        )

    except Exception as e:

        logging.exception(
            "ADMIN RECEIPT ERROR: %s",
            e
        )

    bot.send_message(
        message.chat.id,
        "✅ <b>Chek qabul qilindi!</b>\n\n"
        f"💰 Summa: <b>{amount:,} so‘m</b>\n\n"
        "👨‍💼 Admin tekshirganidan keyin "
        "balansingiz to‘ldiriladi."
    )


# ============================================================
# ADMIN TO‘LOV TUGMALARI
# ============================================================

def payment_admin_keyboard(user_id, amount):

    kb = types.InlineKeyboardMarkup(row_width=2)

    kb.add(
        types.InlineKeyboardButton(
            "✅ Tasdiqlash",
            callback_data=f"pay_ok:{user_id}:{amount}"
        ),
        types.InlineKeyboardButton(
            "❌ Rad etish",
            callback_data=f"pay_no:{user_id}:{amount}"
        )
    )

    return kb


# ============================================================
# ADMIN PAYMENT CALLBACK
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data.startswith("pay_")
)
def payment_admin_callback(call):

    admin_id = call.from_user.id

    if not is_admin(admin_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    parts = call.data.split(":")

    if len(parts) != 3:

        bot.answer_callback_query(
            call.id,
            "❌ Xato!",
            show_alert=True
        )

        return

    action = parts[0]
    user_id = int(parts[1])
    amount = int(parts[2])

    # --------------------------------------------------------
    # TASDIQLASH
    # --------------------------------------------------------

    if action == "pay_ok":

        success = change_balance(
            user_id,
            amount
        )

        if not success:

            bot.answer_callback_query(
                call.id,
                "❌ Balansni o‘zgartirib bo‘lmadi!",
                show_alert=True
            )

            return

        new_balance = get_balance(
            user_id
        )

        bot.answer_callback_query(
            call.id,
            "✅ To‘lov tasdiqlandi!",
            show_alert=True
        )

        try:

            bot.send_message(
                user_id,
                "✅ <b>TO‘LOV TASDIQLANDI</b>\n\n"
                f"💰 Qo‘shildi: <b>{amount:,} so‘m</b>\n"
                f"💳 Yangi balans: "
                f"<b>{new_balance:,} so‘m</b>"
            )

        except Exception:
            pass

        bot.edit_message_caption(
            "✅ <b>TO‘LOV TASDIQLANDI</b>\n\n"
            f"👤 User ID: <code>{user_id}</code>\n"
            f"💰 Summa: <b>{amount:,} so‘m</b>\n"
            f"💳 Yangi balans: "
            f"<b>{new_balance:,} so‘m</b>\n"
            f"👑 Admin: <code>{admin_id}</code>",
            call.message.chat.id,
            call.message.message_id
        )

        return

    # --------------------------------------------------------
    # RAD ETISH
    # --------------------------------------------------------

    if action == "pay_no":

        bot.answer_callback_query(
            call.id,
            "❌ To‘lov rad etildi.",
            show_alert=True
        )

        try:

            bot.send_message(
                user_id,
                "❌ <b>TO‘LOV RAD ETILDI</b>\n\n"
                f"💰 Summa: <b>{amount:,} so‘m</b>\n\n"
                "Chekni qayta tekshirib yuboring."
            )

        except Exception:
            pass

        bot.edit_message_caption(
            "❌ <b>TO‘LOV RAD ETILDI</b>\n\n"
            f"👤 User ID: <code>{user_id}</code>\n"
            f"💰 Summa: <b>{amount:,} so‘m</b>\n"
            f"👑 Admin: <code>{admin_id}</code>",
            call.message.chat.id,
            call.message.message_id
        )

        return


# ============================================================
# ADMIN PUL QO‘SHISH
# ============================================================

admin_states = {}


@bot.callback_query_handler(
    func=lambda call:
    call.data == "admin_add_money"
)
def admin_add_money_start(call):

    if not is_admin(call.from_user.id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    admin_states[call.from_user.id] = {
        "action": "add_money"
    }

    bot.answer_callback_query(
        call.id
    )

    bot.send_message(
        call.message.chat.id,
        "➕ <b>PUL QO‘SHISH</b>\n\n"
        "Quyidagi formatda yuboring:\n\n"
        "<code>USER_ID SUMMA</code>\n\n"
        "Masalan:\n"
        "<code>123456789 10000</code>"
    )


# ============================================================
# ADMIN PUL AYIRISH
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data == "admin_remove_money"
)
def admin_remove_money_start(call):

    if not is_admin(call.from_user.id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    admin_states[call.from_user.id] = {
        "action": "remove_money"
    }

    bot.answer_callback_query(
        call.id
    )

    bot.send_message(
        call.message.chat.id,
        "➖ <b>PUL AYIRISH</b>\n\n"
        "Quyidagi formatda yuboring:\n\n"
        "<code>USER_ID SUMMA</code>\n\n"
        "Masalan:\n"
        "<code>123456789 5000</code>"
    )


# ============================================================
# ADMIN PUL STATE
# ============================================================

def process_admin_money(message):

    admin_id = message.from_user.id

    state = admin_states.get(
        admin_id
    )

    if not state:
        return False

    if not is_admin(admin_id):
        return False

    try:

        parts = message.text.split()

        if len(parts) != 2:
            raise ValueError

        target_user = int(
            parts[0]
        )

        amount = int(
            parts[1]
        )

        if amount <= 0:
            raise ValueError

    except Exception:

        bot.send_message(
            message.chat.id,
            "❌ Format noto‘g‘ri.\n\n"
            "Masalan:\n"
            "<code>123456789 10000</code>"
        )

        return True

    user = get_user(
        target_user
    )

    if not user:

        bot.send_message(
            message.chat.id,
            "❌ Bunday foydalanuvchi topilmadi."
        )

        return True

    action = state.get(
        "action"
    )

    if action == "add_money":

        success = change_balance(
            target_user,
            amount
        )

        if success:

            new_balance = get_balance(
                target_user
            )

            bot.send_message(
                message.chat.id,
                "✅ <b>PUL QO‘SHILDI</b>\n\n"
                f"👤 User: <code>{target_user}</code>\n"
                f"➕ Summa: <b>{amount:,} so‘m</b>\n"
                f"💳 Balans: <b>{new_balance:,} so‘m</b>"
            )

            try:

                bot.send_message(
                    target_user,
                    "💰 <b>BALANSINGIZ TO‘LDIRILDI</b>\n\n"
                    f"➕ Qo‘shildi: <b>{amount:,} so‘m</b>\n"
                    f"💳 Balans: <b>{new_balance:,} so‘m</b>"
                )

            except Exception:
                pass

    elif action == "remove_money":

        balance = get_balance(
            target_user
        )

        if amount > balance:

            bot.send_message(
                message.chat.id,
                "❌ Foydalanuvchining balansi "
                "yetarli emas."
            )

            return True

        success = change_balance(
            target_user,
            -amount
        )

        if success:

            new_balance = get_balance(
                target_user
            )

            bot.send_message(
                message.chat.id,
                "✅ <b>PUL AYIRILDI</b>\n\n"
                f"👤 User: <code>{target_user}</code>\n"
                f"➖ Summa: <b>{amount:,} so‘m</b>\n"
                f"💳 Balans: <b>{new_balance:,} so‘m</b>"
            )

            try:

                bot.send_message(
                    target_user,
                    "💸 <b>BALANSINGIZDAN PUL AYIRILDI</b>\n\n"
                    f"➖ Ayirildi: <b>{amount:,} so‘m</b>\n"
                    f"💳 Balans: <b>{new_balance:,} so‘m</b>"
                )

            except Exception:
                pass

    admin_states.pop(
        admin_id,
        None
    )

    return True

# ============================================================
# 4-QISM — ADMIN BOSHQARUVI
# ============================================================

# ============================================================
# ADMINLAR RO‘YXATI
# ============================================================

def get_admins():

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT user_id
        FROM admins
        ORDER BY user_id
    """)

    rows = cur.fetchall()

    conn.close()

    return [int(row["user_id"]) for row in rows]


# ============================================================
# ADMIN QO‘SHISH
# ============================================================

def add_admin(user_id):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "INSERT OR IGNORE INTO admins(user_id) VALUES(?)",
        (user_id,)
    )

    conn.commit()
    conn.close()


# ============================================================
# ADMIN O‘CHIRISH
# ============================================================

def remove_admin(user_id):

    # ASOSIY ADMINNI O‘CHIRISHGA YO‘L QO‘YILMAYDI
    if int(user_id) == int(ADMIN_ID):
        return False

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "DELETE FROM admins WHERE user_id=?",
        (user_id,)
    )

    deleted = cur.rowcount > 0

    conn.commit()
    conn.close()

    return deleted


# ============================================================
# ADMINLAR MENYUSI
# ============================================================

def admins_menu():

    kb = types.InlineKeyboardMarkup(row_width=2)

    kb.add(
        types.InlineKeyboardButton(
            "➕ Admin qo‘shish",
            callback_data="add_admin"
        ),
        types.InlineKeyboardButton(
            "➖ Admin o‘chirish",
            callback_data="remove_admin"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "📋 Adminlar",
            callback_data="list_admins"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "⬅️ Admin panel",
            callback_data="back_admin"
        )
    )

    return kb


# ============================================================
# BARCHA FOYDALANUVCHILAR
# ============================================================

def users_menu():

    kb = types.InlineKeyboardMarkup(row_width=2)

    kb.add(
        types.InlineKeyboardButton(
            "👥 Oxirgi foydalanuvchilar",
            callback_data="users_list"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "🔎 User ID orqali",
            callback_data="user_search"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "⬅️ Admin panel",
            callback_data="back_admin"
        )
    )

    return kb


# ============================================================
# ADMIN CALLBACK — 4-QISM
# ============================================================

@bot.callback_query_handler(
    func=lambda call: call.data in [
        "admin_admins",
        "add_admin",
        "remove_admin",
        "list_admins",
        "admin_users",
        "users_list",
        "user_search",
        "back_admin"
    ]
)
def admin_management_callback(call):

    admin_id = call.from_user.id

    # FAQAT ADMIN
    if not is_admin(admin_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    data = call.data

    bot.answer_callback_query(call.id)

    # ========================================================
    # ADMINLAR BO‘LIMI
    # ========================================================

    if data == "admin_admins":

        admins = get_admins()

        text = (
            "👑 <b>ADMINLAR BOSHQARUVI</b>\n\n"
            f"👥 Jami adminlar: <b>{len(admins)}</b>\n\n"
        )

        for number, uid in enumerate(admins, 1):

            if uid == ADMIN_ID:

                text += (
                    f"{number}. 👑 "
                    f"<code>{uid}</code> — ASOSIY ADMIN\n"
                )

            else:

                text += (
                    f"{number}. 🛡 "
                    f"<code>{uid}</code>\n"
                )

        bot.send_message(
            call.message.chat.id,
            text,
            reply_markup=admins_menu()
        )

        return

    # ========================================================
    # ADMIN QO‘SHISH
    # ========================================================

    if data == "add_admin":

        admin_states[admin_id] = {
            "action": "add_admin"
        }

        bot.send_message(
            call.message.chat.id,
            "➕ <b>ADMIN QO‘SHISH</b>\n\n"
            "Yangi adminning Telegram ID'sini yuboring.\n\n"
            "Masalan:\n"
            "<code>123456789</code>"
        )

        return

    # ========================================================
    # ADMIN O‘CHIRISH
    # ========================================================

    if data == "remove_admin":

        admin_states[admin_id] = {
            "action": "remove_admin"
        }

        bot.send_message(
            call.message.chat.id,
            "➖ <b>ADMIN O‘CHIRISH</b>\n\n"
            "Adminning Telegram ID'sini yuboring.\n\n"
            "Masalan:\n"
            "<code>123456789</code>\n\n"
            "⚠️ Asosiy admin o‘chirib bo‘lmaydi."
        )

        return

    # ========================================================
    # ADMINLAR RO‘YXATI
    # ========================================================

    if data == "list_admins":

        admins = get_admins()

        text = "📋 <b>ADMINLAR RO‘YXATI</b>\n\n"

        for uid in admins:

            if uid == ADMIN_ID:

                text += (
                    "👑 <code>"
                    f"{uid}"
                    "</code> — Asosiy admin\n"
                )

            else:

                text += (
                    "🛡 <code>"
                    f"{uid}"
                    "</code>\n"
                )

        bot.send_message(
            call.message.chat.id,
            text,
            reply_markup=admins_menu()
        )

        return

    # ========================================================
    # FOYDALANUVCHILAR
    # ========================================================

    if data == "admin_users":

        bot.send_message(
            call.message.chat.id,
            "👥 <b>FOYDALANUVCHILAR</b>\n\n"
            "Kerakli bo‘limni tanlang:",
            reply_markup=users_menu()
        )

        return

    # ========================================================
    # OXIRGI USERLAR
    # ========================================================

    if data == "users_list":

        conn = get_db()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                user_id,
                username,
                first_name,
                balance,
                blocked,
                created_at
            FROM users
            ORDER BY id DESC
            LIMIT 30
        """)

        rows = cur.fetchall()

        conn.close()

        if not rows:

            bot.send_message(
                call.message.chat.id,
                "👥 Hozircha foydalanuvchilar yo‘q."
            )

            return

        text = "👥 <b>OXIRGI 30 FOYDALANUVCHI</b>\n\n"

        for row in rows:

            uid = row["user_id"]

            username = row["username"]

            name = row["first_name"] or "Noma’lum"

            balance = row["balance"] or 0

            blocked = row["blocked"]

            status = "🚫 BLOK" if blocked else "🟢 Faol"

            if username:

                username_text = (
                    f"@{username}"
                )

            else:

                username_text = "username yo‘q"

            text += (
                f"👤 <b>{name}</b>\n"
                f"🆔 <code>{uid}</code>\n"
                f"🔗 {username_text}\n"
                f"💰 {balance:,} so‘m\n"
                f"{status}\n"
                "──────────────\n"
            )

        bot.send_message(
            call.message.chat.id,
            text
        )

        return

    # ========================================================
    # USER QIDIRISH
    # ========================================================

    if data == "user_search":

        admin_states[admin_id] = {
            "action": "search_user"
        }

        bot.send_message(
            call.message.chat.id,
            "🔎 <b>USER QIDIRISH</b>\n\n"
            "Telegram ID yuboring:\n\n"
            "Masalan:\n"
            "<code>123456789</code>"
        )

        return

    # ========================================================
    # ADMIN PANELGA QAYTISH
    # ========================================================

    if data == "back_admin":

        bot.send_message(
            call.message.chat.id,
            "👑 <b>ADMIN PANEL</b>\n\n"
            "Kerakli bo‘limni tanlang:",
            reply_markup=admin_menu()
        )

        return


# ============================================================
# USERNI BLOKLASH
# ============================================================

def block_user(user_id):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "UPDATE users SET blocked=1 WHERE user_id=?",
        (user_id,)
    )

    changed = cur.rowcount > 0

    conn.commit()
    conn.close()

    return changed


# ============================================================
# USERNI BLOKDAN CHIQARISH
# ============================================================

def unblock_user(user_id):

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "UPDATE users SET blocked=0 WHERE user_id=?",
        (user_id,)
    )

    changed = cur.rowcount > 0

    conn.commit()
    conn.close()

    return changed


# ============================================================
# BLOK MENYUSI
# ============================================================

def block_menu():

    kb = types.InlineKeyboardMarkup(row_width=2)

    kb.add(
        types.InlineKeyboardButton(
            "🚫 Bloklash",
            callback_data="block_user"
        ),
        types.InlineKeyboardButton(
            "🔓 Blokdan chiqarish",
            callback_data="unblock_user"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "⬅️ Admin panel",
            callback_data="back_admin"
        )
    )

    return kb


# ============================================================
# BLOK CALLBACK
# ============================================================

@bot.callback_query_handler(
    func=lambda call: call.data in [
        "block_user",
        "unblock_user"
    ]
)
def block_callback(call):

    admin_id = call.from_user.id

    if not is_admin(admin_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    action = call.data

    admin_states[admin_id] = {
        "action": action
    }

    bot.answer_callback_query(call.id)

    if action == "block_user":

        bot.send_message(
            call.message.chat.id,
            "🚫 <b>USER BLOKLASH</b>\n\n"
            "User ID yuboring:"
        )

    else:

        bot.send_message(
            call.message.chat.id,
            "🔓 <b>USERNI BLOKDAN CHIQARISH</b>\n\n"
            "User ID yuboring:"
        )


# ============================================================
# ADMIN TEXT ACTIONS
# ============================================================

def process_admin_actions(message):

    admin_id = message.from_user.id

    if not is_admin(admin_id):
        return False

    state = admin_states.get(admin_id)

    if not state:
        return False

    action = state.get("action")

    # ========================================================
    # ADMIN QO‘SHISH
    # ========================================================

    if action == "add_admin":

        try:
            new_admin = int(
                message.text.strip()
            )
        except ValueError:

            bot.send_message(
                message.chat.id,
                "❌ Faqat Telegram ID yuboring."
            )

            return True

        add_admin(new_admin)

        admin_states.pop(
            admin_id,
            None
        )

        bot.send_message(
            message.chat.id,
            "✅ <b>ADMIN QO‘SHILDI</b>\n\n"
            f"🆔 ID: <code>{new_admin}</code>"
        )

        try:

            bot.send_message(
                new_admin,
                "👑 Siz botga admin sifatida qo‘shildingiz."
            )

        except Exception:
            pass

        return True

    # ========================================================
    # ADMIN O‘CHIRISH
    # ========================================================

    if action == "remove_admin":

        try:
            old_admin = int(
                message.text.strip()
            )
        except ValueError:

            bot.send_message(
                message.chat.id,
                "❌ Faqat Telegram ID yuboring."
            )

            return True

        if old_admin == ADMIN_ID:

            bot.send_message(
                message.chat.id,
                "🚫 Asosiy adminni o‘chirib bo‘lmaydi."
            )

            admin_states.pop(
                admin_id,
                None
            )

            return True

        success = remove_admin(
            old_admin
        )

        admin_states.pop(
            admin_id,
            None
        )

        if success:

            bot.send_message(
                message.chat.id,
                "✅ <b>ADMIN O‘CHIRILDI</b>\n\n"
                f"🆔 ID: <code>{old_admin}</code>"
            )

        else:

            bot.send_message(
                message.chat.id,
                "❌ Bu ID admin emas."
            )

        return True

    # ========================================================
    # USER SEARCH
    # ========================================================

    if action == "search_user":

        try:
            target_id = int(
                message.text.strip()
            )
        except ValueError:

            bot.send_message(
                message.chat.id,
                "❌ To‘g‘ri Telegram ID yuboring."
            )

            return True

        user = get_user(
            target_id
        )

        admin_states.pop(
            admin_id,
            None
        )

        if not user:

            bot.send_message(
                message.chat.id,
                "❌ Foydalanuvchi topilmadi."
            )

            return True

        username = user["username"]

        username_text = (
            f"@{username}"
            if username
            else "username yo‘q"
        )

        status = (
            "🚫 BLOKLANGAN"
            if user["blocked"]
            else "🟢 FAOL"
        )

        bot.send_message(
            message.chat.id,
            "👤 <b>FOYDALANUVCHI</b>\n\n"
            f"🆔 ID: <code>{user['user_id']}</code>\n"
            f"👤 Ism: <b>{user['first_name']}</b>\n"
            f"🔗 Username: {username_text}\n"
            f"💰 Balans: <b>{user['balance']:,} so‘m</b>\n"
            f"📅 Ro‘yxatdan o‘tgan: "
            f"<b>{user['created_at']}</b>\n\n"
            f"Holat: {status}"
        )

        return True

    # ========================================================
    # BLOCK
    # ========================================================

    if action == "block_user":

        try:
            target_id = int(
                message.text.strip()
            )
        except ValueError:

            bot.send_message(
                message.chat.id,
                "❌ To‘g‘ri Telegram ID yuboring."
            )

            return True

        if target_id == ADMIN_ID:

            bot.send_message(
                message.chat.id,
                "🚫 Asosiy adminni bloklab bo‘lmaydi."
            )

            admin_states.pop(
                admin_id,
                None
            )

            return True

        success = block_user(
            target_id
        )

        admin_states.pop(
            admin_id,
            None
        )

        if success:

            bot.send_message(
                message.chat.id,
                "🚫 <b>USER BLOKLANDI</b>\n\n"
                f"🆔 ID: <code>{target_id}</code>"
            )

            try:

                bot.send_message(
                    target_id,
                    "🚫 Siz bot tomonidan bloklandingiz."
                )

            except Exception:
                pass

        else:

            bot.send_message(
                message.chat.id,
                "❌ Foydalanuvchi topilmadi."
            )

        return True

    # ========================================================
    # UNBLOCK
    # ========================================================

    if action == "unblock_user":

        try:
            target_id = int(
                message.text.strip()
            )
        except ValueError:

            bot.send_message(
                message.chat.id,
                "❌ To‘g‘ri Telegram ID yuboring."
            )

            return True

        success = unblock_user(
            target_id
        )

        admin_states.pop(
            admin_id,
            None
        )

        if success:

            bot.send_message(
                message.chat.id,
                "🔓 <b>USER BLOKDAN CHIQARILDI</b>\n\n"
                f"🆔 ID: <code>{target_id}</code>"
            )

            try:

                bot.send_message(
                    target_id,
                    "✅ Siz bot blokidan chiqarildingiz."
                )

            except Exception:
                pass

        else:

            bot.send_message(
                message.chat.id,
                "❌ Foydalanuvchi topilmadi."
            )

        return True

    return False
# ============================================================
# 5-QISM — STATISTIKA / BROADCAST / QR NARXI
# ============================================================


# ============================================================
# ADMIN STATISTIKA
# ============================================================

def get_statistics():

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT COUNT(*) AS count FROM users"
    )
    users = cur.fetchone()["count"]

    cur.execute(
        "SELECT COUNT(*) AS count FROM users WHERE blocked=1"
    )
    blocked = cur.fetchone()["count"]

    cur.execute(
        "SELECT COUNT(*) AS count FROM admins"
    )
    admins = cur.fetchone()["count"]

    cur.execute(
        "SELECT COUNT(*) AS count FROM qr_codes"
    )
    qrs = cur.fetchone()["count"]

    cur.execute(
        "SELECT COALESCE(SUM(balance),0) AS total FROM users"
    )
    balance = cur.fetchone()["total"]

    cur.execute(
        "SELECT COALESCE(SUM(price),0) AS total FROM qr_codes"
    )
    qr_income = cur.fetchone()["total"]

    conn.close()

    return {
        "users": users,
        "blocked": blocked,
        "admins": admins,
        "qrs": qrs,
        "balance": balance,
        "qr_income": qr_income
    }


# ============================================================
# STATISTIKA
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data == "admin_stats"
)
def statistics_callback(call):

    if not is_admin(call.from_user.id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    stats = get_statistics()

    bot.answer_callback_query(
        call.id
    )

    text = (
        "📊 <b>BOT STATISTIKASI</b>\n\n"
        f"👥 Foydalanuvchilar: "
        f"<b>{stats['users']}</b>\n"
        f"🚫 Bloklanganlar: "
        f"<b>{stats['blocked']}</b>\n"
        f"👑 Adminlar: "
        f"<b>{stats['admins']}</b>\n"
        f"📱 Yaratilgan QR: "
        f"<b>{stats['qrs']}</b>\n\n"
        f"💳 Foydalanuvchilar balanslari jami: "
        f"<b>{stats['balance']:,} so‘m</b>\n"
        f"📈 QR tushumi: "
        f"<b>{stats['qr_income']:,} so‘m</b>\n\n"
        f"💰 Hozirgi QR narxi: "
        f"<b>{QR_PRICE:,} so‘m</b>"
    )

    kb = types.InlineKeyboardMarkup()

    kb.add(
        types.InlineKeyboardButton(
            "🔄 Yangilash",
            callback_data="admin_stats"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "⬅️ Admin panel",
            callback_data="back_admin"
        )
    )

    bot.send_message(
        call.message.chat.id,
        text,
        reply_markup=kb
    )


# ============================================================
# QR NARXINI O‘ZGARTIRISH
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data == "admin_qr_price"
)
def qr_price_start(call):

    if not is_admin(call.from_user.id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    admin_states[call.from_user.id] = {
        "action": "change_qr_price"
    }

    bot.answer_callback_query(
        call.id
    )

    bot.send_message(
        call.message.chat.id,
        "💰 <b>QR NARXINI O‘ZGARTIRISH</b>\n\n"
        "Yangi narxni so‘mda yuboring.\n\n"
        "Masalan:\n"
        "<code>500</code>"
    )


# ============================================================
# QR NARXINI STATE ORQALI O‘ZGARTIRISH
# ============================================================

def process_qr_price(message):

    global QR_PRICE

    admin_id = message.from_user.id

    state = admin_states.get(
        admin_id
    )

    if not state:
        return False

    if state.get("action") != "change_qr_price":
        return False

    if not is_admin(admin_id):
        return False

    try:

        new_price = int(
            message.text.replace(
                " ",
                ""
            )
        )

        if new_price <= 0:
            raise ValueError

    except ValueError:

        bot.send_message(
            message.chat.id,
            "❌ Narx noto‘g‘ri.\n\n"
            "Masalan:\n"
            "<code>500</code>"
        )

        return True

    QR_PRICE = new_price

    admin_states.pop(
        admin_id,
        None
    )

    bot.send_message(
        message.chat.id,
        "✅ <b>QR NARXI O‘ZGARTIRILDI</b>\n\n"
        f"💰 Yangi narx: "
        f"<b>{QR_PRICE:,} so‘m</b>"
    )

    return True


# ============================================================
# BROADCAST BOSHLASH
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data == "admin_broadcast"
)
def broadcast_start(call):

    if not is_admin(call.from_user.id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    admin_states[call.from_user.id] = {
        "action": "broadcast"
    }

    bot.answer_callback_query(
        call.id
    )

    bot.send_message(
        call.message.chat.id,
        "📢 <b>BROADCAST</b>\n\n"
        "Barcha foydalanuvchilarga yubormoqchi "
        "bo‘lgan xabaringizni yozing.\n\n"
        "Matn, rasm yoki video yuborishingiz mumkin."
    )


# ============================================================
# BROADCAST TEXT
# ============================================================

def broadcast_text(message):

    admin_id = message.from_user.id

    state = admin_states.get(
        admin_id
    )

    if not state:
        return False

    if state.get("action") != "broadcast":
        return False

    if not is_admin(admin_id):
        return False

    conn = get_db()
    cur = conn.cursor()

    cur.execute(
        "SELECT user_id FROM users WHERE blocked=0"
    )

    users = cur.fetchall()

    conn.close()

    total = len(users)
    success = 0
    failed = 0

    bot.send_message(
        message.chat.id,
        "📢 <b>Broadcast boshlandi...</b>\n\n"
        f"👥 Foydalanuvchilar: <b>{total}</b>"
    )

    for row in users:

        target_id = int(
            row["user_id"]
        )

        try:

            bot.copy_message(
                target_id,
                message.chat.id,
                message.message_id
            )

            success += 1

        except Exception:

            failed += 1

        # Telegram flood limitidan saqlanish
        time.sleep(0.05)

    admin_states.pop(
        admin_id,
        None
    )

    bot.send_message(
        message.chat.id,
        "✅ <b>BROADCAST TUGADI</b>\n\n"
        f"👥 Jami: <b>{total}</b>\n"
        f"✅ Yetkazildi: <b>{success}</b>\n"
        f"❌ Yetkazilmadi: <b>{failed}</b>"
    )

    return True


# ============================================================
# BROADCAST PHOTO
# ============================================================

@bot.message_handler(
    content_types=["photo"],
    func=lambda message:
    message.from_user.id in admin_states
    and
    admin_states.get(
        message.from_user.id,
        {}
    ).get("action") == "broadcast"
)
def broadcast_photo(message):

    broadcast_text(
        message
    )


# ============================================================
# BROADCAST VIDEO
# ============================================================

@bot.message_handler(
    content_types=["video"],
    func=lambda message:
    message.from_user.id in admin_states
    and
    admin_states.get(
        message.from_user.id,
        {}
    ).get("action") == "broadcast"
)
def broadcast_video(message):

    broadcast_text(
        message
    )


# ============================================================
# ADMIN PANELGA QR NARX BUTTONINI QO‘SHISH
# ============================================================

# ESKI admin_menu() FUNKSIYASINI SHU BILAN ALMASHTIR
def admin_menu():

    kb = types.InlineKeyboardMarkup(
        row_width=2
    )

    kb.add(
        types.InlineKeyboardButton(
            "👥 Foydalanuvchilar",
            callback_data="admin_users"
        ),
        types.InlineKeyboardButton(
            "📊 Statistika",
            callback_data="admin_stats"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "💳 To‘lovlar",
            callback_data="admin_payments"
        ),
        types.InlineKeyboardButton(
            "➕ Pul qo‘shish",
            callback_data="admin_add_money"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "➖ Pul ayirish",
            callback_data="admin_remove_money"
        ),
        types.InlineKeyboardButton(
            "🚫 Bloklash",
            callback_data="block_user"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "🔓 Blokdan chiqarish",
            callback_data="unblock_user"
        ),
        types.InlineKeyboardButton(
            "📢 Broadcast",
            callback_data="admin_broadcast"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "👑 Adminlar",
            callback_data="admin_admins"
        ),
        types.InlineKeyboardButton(
            "📜 QR tarixi",
            callback_data="admin_qr_history"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "💰 QR narxi",
            callback_data="admin_qr_price"
        )
    )

    return kb


# ============================================================
# ADMIN PAYMENTS
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data == "admin_payments"
)
def admin_payments(call):

    if not is_admin(call.from_user.id):

        bot.answer_callback_query(
            call.id,
            "🚫 Ruxsat yo‘q!",
            show_alert=True
        )

        return

    bot.answer_callback_query(
        call.id
    )

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            COUNT(*) AS count,
            COALESCE(SUM(price), 0) AS total
        FROM qr_codes
    """)

    row = cur.fetchone()

    conn.close()

    count = row["count"]
    total = row["total"]

    bot.send_message(
        call.message.chat.id,
        "💳 <b>TO‘LOVLAR</b>\n\n"
        f"📱 QR soni: <b>{count}</b>\n"
        f"💰 QR tushumi: <b>{total:,} so‘m</b>\n\n"
        "📌 Haqiqiy karta to‘lovlari "
        "admin tasdig‘i orqali balansga qo‘shiladi."
    )


# ============================================================
# TEXT HANDLERGA ULASH
# ============================================================

# 1-qismdagi text_handler() ICHIDA,
# "text = message.text" DAN KEYIN SHU TARTIBDA QO‘Y:

def process_part5_states(message):

    # QR narxi
    if process_qr_price(message):
        return True

    # Admin buyruqlari
    if process_admin_actions(message):
        return True

    # Payment amount
    if process_payment_amount(message):
        return True

    # Broadcast
    if broadcast_text(message):
        return True

    return False

# ============================================================
# 6-QISM — TARIX TIZIMI
# ============================================================

# ============================================================
# QR TARIXI — USER
# ============================================================

def user_qr_history(message):

    user_id = message.from_user.id

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            id,
            qr_type,
            data,
            price,
            created_at
        FROM qr_codes
        WHERE user_id=?
        ORDER BY id DESC
        LIMIT 20
    """, (user_id,))

    rows = cur.fetchall()

    conn.close()

    if not rows:

        bot.send_message(
            message.chat.id,
            "📜 <b>QR TARIXI</b>\n\n"
            "Siz hali QR yaratmagansiz."
        )

        return

    text = "📜 <b>QR TARIXI</b>\n\n"

    for row in rows:

        qr_type = row["qr_type"]
        price = int(row["price"] or 0)
        created = row["created_at"]

        text += (
            f"🔹 <b>#{row['id']}</b>\n"
            f"📱 Turi: <b>{qr_type}</b>\n"
            f"💰 Narxi: <b>{price:,} so‘m</b>\n"
            f"🕐 {created}\n"
            "────────────\n"
        )

    bot.send_message(
        message.chat.id,
        text
    )


# ============================================================
# USER — TRANZAKSIYA TARIXI
# ============================================================

def user_transaction_history(message):

    user_id = message.from_user.id

    conn = get_db()
    cur = conn.cursor()

    # Agar transactions jadvali yo‘q bo‘lsa yaratadi
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            type TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        SELECT
            amount,
            type,
            description,
            created_at
        FROM transactions
        WHERE user_id=?
        ORDER BY id DESC
        LIMIT 20
    """, (user_id,))

    rows = cur.fetchall()

    conn.commit()
    conn.close()

    if not rows:

        bot.send_message(
            message.chat.id,
            "📜 <b>TRANZAKSIYALAR</b>\n\n"
            "Hali tranzaksiya mavjud emas."
        )

        return

    text = "📜 <b>TRANZAKSIYA TARIXI</b>\n\n"

    for row in rows:

        amount = int(
            row["amount"] or 0
        )

        if amount >= 0:
            sign = "➕"
        else:
            sign = "➖"

        text += (
            f"{sign} <b>{abs(amount):,} so‘m</b>\n"
            f"📝 {row['description'] or '-'}\n"
            f"🕐 {row['created_at']}\n"
            "────────────\n"
        )

    bot.send_message(
        message.chat.id,
        text
    )


# ============================================================
# TRANSACTION QO‘SHISH
# ============================================================

def add_transaction(
    user_id,
    amount,
    transaction_type,
    description
):

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            type TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        INSERT INTO transactions
        (
            user_id,
            amount,
            type,
            description
        )
        VALUES (?, ?, ?, ?)
    """, (
        user_id,
        amount,
        transaction_type,
        description
    ))

    conn.commit()
    conn.close()


# ============================================================
# BALANS O‘ZGARISHINI TRANZAKSIYAGA ULASH
# ============================================================

def change_balance_with_history(
    user_id,
    amount,
    description
):

    success = change_balance(
        user_id,
        amount
    )

    if not success:
        return False

    if amount > 0:

        transaction_type = "credit"

    elif amount < 0:

        transaction_type = "debit"

    else:

        transaction_type = "system"

    add_transaction(
        user_id,
        amount,
        transaction_type,
        description
    )

    return True


# ============================================================
# QR YARATILGANDA TRANZAKSIYA
# ============================================================

def charge_qr(user_id):

    balance = get_balance(
        user_id
    )

    if balance < QR_PRICE:

        return False

    success = change_balance_with_history(
        user_id,
        -QR_PRICE,
        "QR kod yaratish uchun to‘lov"
    )

    return success


# ============================================================
# USER QR YARATISHNI PULLIK QILISH
# ============================================================

def send_paid_qr(
    message,
    qr_type,
    data
):

    user_id = message.from_user.id

    balance = get_balance(
        user_id
    )

    if balance < QR_PRICE:

        bot.send_message(
            message.chat.id,
            "❌ <b>Balansingiz yetarli emas.</b>\n\n"
            f"💰 QR narxi: <b>{QR_PRICE:,} so‘m</b>\n"
            f"💳 Balansingiz: <b>{balance:,} so‘m</b>\n\n"
            "Hisobingizni to‘ldiring."
        )

        return False

    # PUL YECHISH
    success = charge_qr(
        user_id
    )

    if not success:

        bot.send_message(
            message.chat.id,
            "❌ Balansdan pul yechilmadi."
        )

        return False

    try:

        image = create_qr(
            data
        )

        # QR TARIXI
        save_qr(
            user_id,
            qr_type,
            data
        )

        new_balance = get_balance(
            user_id
        )

        bot.send_photo(
            message.chat.id,
            image,
            caption=(
                "✅ <b>QR KOD TAYYOR!</b>\n\n"
                f"📱 Turi: <b>{qr_type}</b>\n"
                f"💰 To‘lov: <b>{QR_PRICE:,} so‘m</b>\n"
                f"💳 Qolgan balans: "
                f"<b>{new_balance:,} so‘m</b>\n\n"
                "📷 Telefon kamerasi bilan "
                "skaner qilishingiz mumkin."
            )
        )

        return True

    except Exception as e:

        # QR yaratish xato bo‘lsa pulni qaytarish
        change_balance_with_history(
            user_id,
            QR_PRICE,
            "QR yaratishda xatolik — pul qaytarildi"
        )

        logging.exception(
            "PAID QR ERROR: %s",
            e
        )

        bot.send_message(
            message.chat.id,
            "❌ QR yaratishda xatolik.\n\n"
            "💰 Pul balansingizga qaytarildi."
        )

        return False


# ============================================================
# ADMIN — TO‘LIQ QR TARIXI
# ============================================================

def admin_full_qr_history(call):

    if not is_admin(
        call.from_user.id
    ):
        return

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        SELECT
            id,
            user_id,
            qr_type,
            price,
            created_at
        FROM qr_codes
        ORDER BY id DESC
        LIMIT 50
    """)

    rows = cur.fetchall()

    conn.close()

    if not rows:

        bot.send_message(
            call.message.chat.id,
            "📜 QR tarixi bo‘sh."
        )

        return

    text = "📜 <b>ADMIN — QR TARIXI</b>\n\n"

    for row in rows:

        text += (
            f"#{row['id']}\n"
            f"👤 User: <code>{row['user_id']}</code>\n"
            f"📱 Turi: <b>{row['qr_type']}</b>\n"
            f"💰 Narxi: <b>{row['price']:,} so‘m</b>\n"
            f"🕐 {row['created_at']}\n"
            "────────────\n"
        )

    bot.send_message(
        call.message.chat.id,
        text
    )


# ============================================================
# ADMIN — USER TRANZAKSIYALARI
# ============================================================

def admin_user_transactions(
    message,
    target_user_id
):

    if not is_admin(
        message.from_user.id
    ):
        return

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            type TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        SELECT
            amount,
            type,
            description,
            created_at
        FROM transactions
        WHERE user_id=?
        ORDER BY id DESC
        LIMIT 30
    """, (
        target_user_id,
    ))

    rows = cur.fetchall()

    conn.commit()
    conn.close()

    if not rows:

        bot.send_message(
            message.chat.id,
            "📜 Bu foydalanuvchida "
            "tranzaksiya yo‘q."
        )

        return

    text = (
        "📜 <b>USER TRANZAKSIYALARI</b>\n\n"
        f"🆔 ID: <code>{target_user_id}</code>\n\n"
    )

    for row in rows:

        amount = int(
            row["amount"] or 0
        )

        sign = "+" if amount >= 0 else ""

        text += (
            f"{sign}{amount:,} so‘m\n"
            f"📝 {row['description'] or '-'}\n"
            f"🕐 {row['created_at']}\n"
            "────────────\n"
        )

    bot.send_message(
        message.chat.id,
        text
    )


# ============================================================
# HISTORY MENU
# ============================================================

def history_menu():

    kb = types.InlineKeyboardMarkup(
        row_width=1
    )

    kb.add(
        types.InlineKeyboardButton(
            "📱 QR tarixim",
            callback_data="my_qr_history"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "💳 Pul tarixim",
            callback_data="my_transactions"
        )
    )

    return kb


# ============================================================
# HISTORY CALLBACK
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data in [
        "my_qr_history",
        "my_transactions"
    ]
)
def history_callback(call):

    user_id = call.from_user.id

    if is_blocked(user_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Siz bloklangansiz!",
            show_alert=True
        )

        return

    bot.answer_callback_query(
        call.id
    )

    if call.data == "my_qr_history":

        user_qr_history(
            call.message
        )

    elif call.data == "my_transactions":

        user_transaction_history(
            call.message
        )


# ============================================================
# HISTORY BUTTON
# ============================================================

def show_history_menu(message):

    bot.send_message(
        message.chat.id,
        "📜 <b>TARIX</b>\n\n"
        "Kerakli bo‘limni tanlang:",
        reply_markup=history_menu()
    )
    
    
# ============================================================
# 7-QISM — USER MENU + QR TO'LOVINI TO'LIQ ULASH
# ============================================================

# ============================================================
# QR YARATISH BUTTONI
# ============================================================

@bot.message_handler(
    func=lambda message: message.text == "📱 QR yaratish"
)
def qr_create_button(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz botdan foydalanish uchun bloklangansiz."
        )

        return

    send_qr_menu(message)


# ============================================================
# HISOB BUTTONI
# ============================================================

@bot.message_handler(
    func=lambda message: message.text == "💳 Hisob"
)
def balance_button(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    show_balance(message)


# ============================================================
# TARIX BUTTONI
# ============================================================

@bot.message_handler(
    func=lambda message: message.text == "📜 Tarix"
)
def history_button(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    show_history_menu(message)


# ============================================================
# BONUS BUTTONI
# ============================================================

@bot.message_handler(
    func=lambda message: message.text == "🎁 Bonus"
)
def bonus_button(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    balance = get_balance(user_id)

    bot.send_message(
        message.chat.id,
        "🎁 <b>BONUS</b>\n\n"
        "Hozircha bonus tizimi faol emas.\n\n"
        f"💳 Sizning balansingiz: "
        f"<b>{balance:,} so‘m</b>\n\n"
        "Tez orada bonuslar qo‘shiladi."
    )


# ============================================================
# YORDAM BUTTONI
# ============================================================

@bot.message_handler(
    func=lambda message: message.text == "🆘 Yordam"
)
def help_button(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    bot.send_message(
        message.chat.id,
        "🆘 <b>YORDAM</b>\n\n"
        "📱 <b>QR yaratish</b> — QR kod yaratasiz.\n"
        "💳 <b>Hisob</b> — balansingizni ko‘rasiz.\n"
        "📜 <b>Tarix</b> — QR va pul tarixingiz.\n"
        "🎁 <b>Bonus</b> — bonuslar bo‘limi.\n\n"
        "Muammo bo‘lsa administratorga murojaat qiling."
    )


# ============================================================
# BOT HAQIDA
# ============================================================

@bot.message_handler(
    func=lambda message: message.text == "ℹ️ Bot haqida"
)
def about_button(message):

    user_id = message.from_user.id

    register_user(message.from_user)

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    bot.send_message(
        message.chat.id,
        "ℹ️ <b>QR CODE BOT</b>\n\n"
        "⚡ Tezkor QR kod yaratish\n"
        "🔗 Link\n"
        "📝 Text\n"
        "📞 Telefon\n"
        "📍 Lokatsiya\n"
        "📶 Wi-Fi\n\n"
        f"💰 1 ta QR: <b>{QR_PRICE:,} so‘m</b>\n\n"
        "🚀 Bot 24/7 ishlash uchun tayyorlangan."
    )


# ============================================================
# QR CALLBACK — PULLIK QR
# ============================================================

# Eski qr_callback() funksiyasini o‘zgartirish uchun
# yangi callback yaratmaymiz.
#
# Pastdagi process_qr_message() ichida
# send_generated_qr() o‘rniga send_paid_qr()
# ishlatiladi.


# ============================================================
# LINK — PULLIK QR
# ============================================================

def create_paid_link_qr(message, text):

    return send_paid_qr(
        message,
        "Link",
        text
    )


# ============================================================
# TEXT — PULLIK QR
# ============================================================

def create_paid_text_qr(message, text):

    return send_paid_qr(
        message,
        "Text",
        text
    )


# ============================================================
# PHONE — PULLIK QR
# ============================================================

def create_paid_phone_qr(message, phone):

    qr_data = "tel:" + phone

    return send_paid_qr(
        message,
        "Telefon",
        qr_data
    )


# ============================================================
# LOCATION — PULLIK QR
# ============================================================

def create_paid_location_qr(
    message,
    latitude,
    longitude
):

    qr_data = (
        f"geo:{latitude},{longitude}"
    )

    return send_paid_qr(
        message,
        "Lokatsiya",
        qr_data
    )


# ============================================================
# QR STATE PROCESS — YANGI VERSIYA
# ============================================================

def process_qr_message_paid(message):

    user_id = message.from_user.id

    state = qr_states.get(user_id)

    if not state:

        return False

    if not message.text:

        return True

    qr_type = state.get("type")

    text = message.text.strip()

    # ========================================================
    # LINK
    # ========================================================

    if qr_type == "link":

        if not (
            text.startswith("http://")
            or text.startswith("https://")
        ):

            bot.send_message(
                message.chat.id,
                "❌ <b>Link noto‘g‘ri.</b>\n\n"
                "https:// bilan boshlanadigan link yuboring.\n\n"
                "Masalan:\n"
                "<code>https://google.com</code>"
            )

            return True

        success = create_paid_link_qr(
            message,
            text
        )

        if success:

            qr_states.pop(
                user_id,
                None
            )

        return True

    # ========================================================
    # TEXT
    # ========================================================

    if qr_type == "text":

        if not text:

            bot.send_message(
                message.chat.id,
                "❌ Matn bo‘sh bo‘lmasligi kerak."
            )

            return True

        success = create_paid_text_qr(
            message,
            text
        )

        if success:

            qr_states.pop(
                user_id,
                None
            )

        return True

    # ========================================================
    # PHONE
    # ========================================================

    if qr_type == "phone":

        phone = text.replace(
            " ",
            ""
        ).replace(
            "-",
            ""
        )

        if not phone.startswith("+"):

            bot.send_message(
                message.chat.id,
                "❌ Telefon raqami + bilan boshlansin.\n\n"
                "Masalan:\n"
                "<code>+998901234567</code>"
            )

            return True

        if not phone[1:].isdigit():

            bot.send_message(
                message.chat.id,
                "❌ Telefon raqamida faqat raqamlar bo‘lsin."
            )

            return True

        success = create_paid_phone_qr(
            message,
            phone
        )

        if success:

            qr_states.pop(
                user_id,
                None
            )

        return True

    # ========================================================
    # LOCATION
    # ========================================================

    if qr_type == "location":

        try:

            parts = text.split(",")

            if len(parts) != 2:

                raise ValueError

            latitude = float(
                parts[0].strip()
            )

            longitude = float(
                parts[1].strip()
            )

            if not (
                -90 <= latitude <= 90
            ):

                raise ValueError

            if not (
                -180 <= longitude <= 180
            ):

                raise ValueError

            success = create_paid_location_qr(
                message,
                latitude,
                longitude
            )

            if success:

                qr_states.pop(
                    user_id,
                    None
                )

        except Exception:

            bot.send_message(
                message.chat.id,
                "❌ <b>Lokatsiya noto‘g‘ri.</b>\n\n"
                "Masalan:\n"
                "<code>41.311081,69.240562</code>"
            )

        return True

    # ========================================================
    # WIFI
    # ========================================================

    if qr_type == "wifi":

        step = state.get("step")

        # ----------------------------------------------------
        # SSID
        # ----------------------------------------------------

        if step == "ssid":

            if not text:

                bot.send_message(
                    message.chat.id,
                    "❌ Wi-Fi nomi bo‘sh bo‘lmasin."
                )

                return True

            qr_states[user_id]["ssid"] = text

            qr_states[user_id]["step"] = "password"

            bot.send_message(
                message.chat.id,
                "🔐 <b>Wi-Fi paroli</b>\n\n"
                "Parolni yuboring.\n\n"
                "Agar parol bo‘lmasa:\n"
                "<code>none</code>"
            )

            return True

        # ----------------------------------------------------
        # PASSWORD
        # ----------------------------------------------------

        if step == "password":

            qr_states[user_id]["password"] = text

            qr_states[user_id]["step"] = "security"

            kb = types.InlineKeyboardMarkup(
                row_width=2
            )

            kb.add(
                types.InlineKeyboardButton(
                    "🔒 WPA/WPA2",
                    callback_data="wifi_wpa"
                ),
                types.InlineKeyboardButton(
                    "🔓 Ochiq",
                    callback_data="wifi_none"
                )
            )

            bot.send_message(
                message.chat.id,
                "🔐 <b>Wi-Fi himoyasi</b>\n\n"
                "Himoya turini tanlang:",
                reply_markup=kb
            )

            return True

        return True

    return False


# ============================================================
# YANGI WIFI CALLBACK — PULLIK
# ============================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data in [
        "wifi_wpa",
        "wifi_none"
    ]
)
def paid_wifi_security(call):

    user_id = call.from_user.id

    if is_blocked(user_id):

        bot.answer_callback_query(
            call.id,
            "🚫 Siz bloklangansiz!",
            show_alert=True
        )

        return

    state = qr_states.get(user_id)

    if not state:

        bot.answer_callback_query(
            call.id,
            "❌ Sessiya tugagan.",
            show_alert=True
        )

        return

    if state.get("type") != "wifi":

        bot.answer_callback_query(
            call.id,
            "❌ Xato sessiya.",
            show_alert=True
        )

        return

    if state.get("step") != "security":

        bot.answer_callback_query(
            call.id,
            "❌ Wi-Fi ma'lumotlari to‘liq emas.",
            show_alert=True
        )

        return

    ssid = state.get(
        "ssid",
        ""
    )

    password = state.get(
        "password",
        ""
    )

    if call.data == "wifi_none":

        security = "nopass"

        password = ""

    else:

        security = "WPA"

        if password.lower() == "none":

            password = ""

    qr_data = (
        f"WIFI:"
        f"T:{security};"
        f"S:{ssid};"
        f"P:{password};;"
    )

    # --------------------------------------------------------
    # BALANS TEKSHIRISH
    # --------------------------------------------------------

    balance = get_balance(
        user_id
    )

    if balance < QR_PRICE:

        bot.answer_callback_query(
            call.id,
            "❌ Balans yetarli emas!",
            show_alert=True
        )

        bot.send_message(
            call.message.chat.id,
            "❌ <b>Balansingiz yetarli emas.</b>\n\n"
            f"💰 QR narxi: <b>{QR_PRICE:,} so‘m</b>\n"
            f"💳 Balansingiz: <b>{balance:,} so‘m</b>\n\n"
            "💳 Hisob bo‘limidan balansni to‘ldiring."
        )

        qr_states.pop(
            user_id,
            None
        )

        return

    bot.answer_callback_query(
        call.id,
        "⏳ QR tayyorlanmoqda..."
    )

    try:

        success = charge_qr(
            user_id
        )

        if not success:

            bot.send_message(
                call.message.chat.id,
                "❌ Balansdan pul yechib bo‘lmadi."
            )

            return

        image = create_qr(
            qr_data
        )

        save_qr(
            user_id,
            "Wi-Fi",
            qr_data
        )

        new_balance = get_balance(
            user_id
        )

        bot.send_photo(
            call.message.chat.id,
            image,
            caption=(
                "✅ <b>WI-FI QR TAYYOR!</b>\n\n"
                f"📶 Wi-Fi: <b>{ssid}</b>\n"
                f"🔐 Himoya: <b>{security}</b>\n"
                f"💰 To‘lov: <b>{QR_PRICE:,} so‘m</b>\n"
                f"💳 Qolgan balans: "
                f"<b>{new_balance:,} so‘m</b>\n\n"
                "📷 Telefon kamerasi bilan skaner qiling."
            )
        )

        qr_states.pop(
            user_id,
            None
        )

    except Exception as e:

        logging.exception(
            "PAID WIFI ERROR: %s",
            e
        )

        # QR yaratishda xato bo‘lsa pulni qaytarish
        change_balance_with_history(
            user_id,
            QR_PRICE,
            "Wi-Fi QR yaratishda xatolik — pul qaytarildi"
        )

        bot.send_message(
            call.message.chat.id,
            "❌ Wi-Fi QR yaratishda xatolik.\n\n"
            "💰 Pul balansingizga qaytarildi."
        )


# ============================================================
# UMUMIY TEXT ROUTER
# ============================================================

@bot.message_handler(
    content_types=["text"]
)
def universal_text_handler(message):

    user_id = message.from_user.id

    register_user(
        message.from_user
    )

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz botdan foydalanish uchun bloklangansiz."
        )

        return

    text = message.text.strip()

    # ========================================================
    # ADMIN / STATE
    # ========================================================

    if process_part5_states(message):

        return

    # ========================================================
    # QR STATE
    # ========================================================

    if process_qr_message_paid(message):

        return

    # ========================================================
    # MENU
    # ========================================================

    if text == "📱 QR yaratish":

        send_qr_menu(
            message
        )

        return

    if text == "💳 Hisob":

        show_balance(
            message
        )

        return

    if text == "📜 Tarix":

        show_history_menu(
            message
        )

        return

    if text == "🎁 Bonus":

        bonus_button(
            message
        )

        return

    if text == "🆘 Yordam":

        help_button(
            message
        )

        return

    if text == "ℹ️ Bot haqida":

        about_button(
            message
        )

        return

    if text == "👑 Admin panel":

        if is_admin(user_id):

            bot.send_message(
                message.chat.id,
                "👑 <b>ADMIN PANEL</b>\n\n"
                "Kerakli bo‘limni tanlang:",
                reply_markup=admin_menu()
            )

        else:

            bot.send_message(
                message.chat.id,
                "🚫 Ruxsat yo‘q."
            )

        return


# ============================================================
# USER MENU /start NI YANGILASH
# ============================================================

def send_main_menu(message):

    user_id = message.from_user.id

    register_user(
        message.from_user
    )

    if is_blocked(user_id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    bot.send_message(
        message.chat.id,
        "🏠 <b>ASOSIY MENYU</b>\n\n"
        "👇 Kerakli bo‘limni tanlang:",
        reply_markup=main_menu(user_id)
    )


# ============================================================
# CANCEL / BEKOR QILISH
# ============================================================

def cancel_all_states(user_id):

    qr_states.pop(
        user_id,
        None
    )

    payment_states.pop(
        user_id,
        None
    )

    admin_states.pop(
        user_id,
        None
    )


# ============================================================
# /CANCEL
# ============================================================

@bot.message_handler(
    commands=["cancel"]
)
def cancel_command(message):

    user_id = message.from_user.id

    cancel_all_states(
        user_id
    )

    bot.send_message(
        message.chat.id,
        "❌ Joriy amal bekor qilindi.\n\n"
        "🏠 Asosiy menyu:",
        reply_markup=main_menu(user_id)
    )


# ============================================================
# /MENU
# ============================================================

@bot.message_handler(
    commands=["menu"]
)
def menu_command(message):

    send_main_menu(
        message
    )


# ============================================================
# DATABASE TRANSACTION TABLE
# ============================================================

def init_transactions():

    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            type TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


# ============================================================
# START BOT — YAKUNIY ISHGA TUSHIRISH
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("QR CODE BOT — 7-QISM")
    print("=" * 60)

    init_db()

    init_transactions()

    print(
        f"ADMIN ID: {ADMIN_ID}"
    )

    print(
        f"QR PRICE: {QR_PRICE} so'm"
    )

    print(
        "DATABASE: OK"
    )

    print(
        "BOT ISHGA TUSHMOQDA..."
    )

    start_bot()

