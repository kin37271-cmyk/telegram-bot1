# ============================================================
# QR MASTER BOT
# Telegram QR Code Generator
# Python + TeleBot + SQLite
# ============================================================

import os
import io
import csv
import sqlite3
import logging
from datetime import datetime

import telebot
from telebot import types
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw


# ============================================================
# SOZLAMALAR
# ============================================================

BOT_TOKEN = "8603441927:AAF5IyXi_idt6vkkrQQaipuqatkjlrM0F_0"

# Bir nechta admin qo'yish mumkin:
# ADMIN_IDS = [123456789, 987654321]
ADMIN_IDS = [7600986332]

DB_NAME = "qr_bot.db"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")


# ============================================================
# DATABASE
# ============================================================

def db():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT DEFAULT '',
            first_name TEXT DEFAULT '',
            last_name TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            joined_at TEXT,
            last_seen TEXT,
            qr_count INTEGER DEFAULT 0,
            blocked INTEGER DEFAULT 0
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS qr_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            qr_type TEXT,
            content TEXT,
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

    for admin_id in ADMIN_IDS:
        cur.execute(
            "INSERT OR IGNORE INTO admins(user_id) VALUES(?)",
            (admin_id,)
        )

    conn.commit()
    conn.close()


init_db()


# ============================================================
# YORDAMCHI FUNKSIYALAR
# ============================================================

def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def is_admin(user_id):
    conn = db()
    cur = conn.cursor()

    cur.execute(
        "SELECT user_id FROM admins WHERE user_id=?",
        (user_id,)
    )

    result = cur.fetchone()
    conn.close()

    return result is not None


def get_user(user_id):
    conn = db()
    cur = conn.cursor()

    cur.execute(
        "SELECT * FROM users WHERE id=?",
        (user_id,)
    )

    result = cur.fetchone()
    conn.close()

    return result


def is_blocked(user_id):
    user = get_user(user_id)

    if not user:
        return False

    return user["blocked"] == 1


def save_user(user):
    conn = db()
    cur = conn.cursor()

    username = user.username or ""
    first_name = user.first_name or ""
    last_name = user.last_name or ""

    cur.execute("""
        INSERT INTO users
        (
            id,
            username,
            first_name,
            last_name,
            joined_at,
            last_seen
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            username=excluded.username,
            first_name=excluded.first_name,
            last_name=excluded.last_name,
            last_seen=excluded.last_seen
    """, (
        user.id,
        username,
        first_name,
        last_name,
        now(),
        now()
    ))

    conn.commit()
    conn.close()


def save_phone(user_id, phone):
    conn = db()
    cur = conn.cursor()

    cur.execute(
        "UPDATE users SET phone=? WHERE id=?",
        (phone, user_id)
    )

    conn.commit()
    conn.close()


def increase_qr(user_id, qr_type, content):
    conn = db()
    cur = conn.cursor()

    cur.execute(
        "UPDATE users SET qr_count=qr_count+1 WHERE id=?",
        (user_id,)
    )

    cur.execute("""
        INSERT INTO qr_codes
        (user_id, qr_type, content, created_at)
        VALUES (?, ?, ?, ?)
    """, (
        user_id,
        qr_type,
        content,
        now()
    ))

    conn.commit()
    conn.close()


def get_stats():
    conn = db()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM users")
    users = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM qr_codes")
    qrs = cur.fetchone()[0]

    today = datetime.now().strftime("%Y-%m-%d")

    cur.execute(
        "SELECT COUNT(*) FROM users WHERE joined_at LIKE ?",
        (today + "%",)
    )
    today_users = cur.fetchone()[0]

    cur.execute(
        "SELECT COUNT(*) FROM qr_codes WHERE created_at LIKE ?",
        (today + "%",)
    )
    today_qrs = cur.fetchone()[0]

    cur.execute(
        "SELECT COUNT(*) FROM users WHERE blocked=1"
    )
    blocked = cur.fetchone()[0]

    conn.close()

    return users, qrs, today_users, today_qrs, blocked


# ============================================================
# KLAVIATURALAR
# ============================================================

def main_menu():
    kb = types.ReplyKeyboardMarkup(
        resize_keyboard=True,
        row_width=2
    )

    kb.add(
        types.KeyboardButton("🔗 Link QR"),
        types.KeyboardButton("📝 Text QR")
    )

    kb.add(
        types.KeyboardButton("📞 Telefon QR"),
        types.KeyboardButton("👤 Kontakt QR")
    )

    kb.add(
        types.KeyboardButton("📍 Location QR"),
        types.KeyboardButton("📶 Wi-Fi QR")
    )

    kb.add(
        types.KeyboardButton("✉️ Email QR"),
        types.KeyboardButton("📜 Tarix")
    )

    kb.add(
        types.KeyboardButton("ℹ️ Bot haqida")
    )

    return kb


def contact_menu():
    kb = types.ReplyKeyboardMarkup(
        resize_keyboard=True
    )

    button = types.KeyboardButton(
        "📱 Kontaktni yuborish",
        request_contact=True
    )

    kb.add(button)

    return kb


def admin_menu():
    kb = types.InlineKeyboardMarkup(row_width=2)

    kb.add(
        types.InlineKeyboardButton(
            "📊 Statistika",
            callback_data="admin_stats"
        ),
        types.InlineKeyboardButton(
            "👥 Foydalanuvchilar",
            callback_data="admin_users"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "🏆 TOP QR",
            callback_data="admin_top"
        ),
        types.InlineKeyboardButton(
            "🚫 Bloklanganlar",
            callback_data="admin_blocked"
        )
    )

    kb.add(
        types.InlineKeyboardButton(
            "📢 Reklama",
            callback_data="admin_broadcast"
        ),
        types.InlineKeyboardButton(
            "📥 CSV",
            callback_data="admin_csv"
        )
    )

    return kb


# ============================================================
# /START
# ============================================================

@bot.message_handler(commands=["start"])
def start(message):

    if is_blocked(message.from_user.id):
        bot.send_message(
            message.chat.id,
            "🚫 <b>Siz botdan bloklangansiz.</b>"
        )
        return

    save_user(message.from_user)

    user = get_user(message.from_user.id)

    if not user["phone"]:
        bot.send_message(
            message.chat.id,
            """
👋 <b>QR MASTER BOT</b>

Assalomu alaykum!

Bu bot orqali deyarli barcha ma'lumotlardan
chiroyli QR Code yaratishingiz mumkin.

🔐 Botdan foydalanish uchun avval
telefon raqamingizni yuboring.
""",
            reply_markup=contact_menu()
        )
        return

    bot.send_message(
        message.chat.id,
        """
🚀 <b>QR MASTER</b>

Kerakli QR turini tanlang 👇
""",
        reply_markup=main_menu()
    )


# ============================================================
# KONTAKT
# ============================================================

@bot.message_handler(content_types=["contact"])
def contact_handler(message):

    if is_blocked(message.from_user.id):
        return

    contact = message.contact

    if contact.user_id != message.from_user.id:
        bot.send_message(
            message.chat.id,
            "⚠️ Iltimos, <b>o'zingizning kontaktingizni</b> yuboring.",
            reply_markup=contact_menu()
        )
        return

    save_user(message.from_user)
    save_phone(
        message.from_user.id,
        contact.phone_number
    )

    bot.send_message(
        message.chat.id,
        """
✅ <b>Kontakt muvaffaqiyatli saqlandi!</b>

Endi QR Code yaratishingiz mumkin 🚀
""",
        reply_markup=main_menu()
    )


# ============================================================
# ADMIN PANEL
# ============================================================

@bot.message_handler(commands=["admin"])
def admin_command(message):

    if not is_admin(message.from_user.id):
        bot.send_message(
            message.chat.id,
            "⛔ Siz admin emassiz."
        )
        return

    bot.send_message(
        message.chat.id,
        """
👑 <b>ADMIN PANEL</b>

Kerakli bo'limni tanlang:
""",
        reply_markup=admin_menu()
    )


# ============================================================
# ADMIN CALLBACK
# ============================================================

@bot.callback_query_handler(func=lambda call: call.data.startswith("admin_"))
def admin_callbacks(call):

    if not is_admin(call.from_user.id):
        bot.answer_callback_query(
            call.id,
            "⛔ Ruxsat yo'q!",
            show_alert=True
        )
        return

    action = call.data

    # --------------------------------------------------------
    # STATISTIKA
    # --------------------------------------------------------

    if action == "admin_stats":

        users, qrs, today_users, today_qrs, blocked = get_stats()

        text = f"""
📊 <b>BOT STATISTIKASI</b>

👥 Jami foydalanuvchilar: <b>{users}</b>

🔳 Jami QR: <b>{qrs}</b>

📅 Bugun qo'shilganlar: <b>{today_users}</b>

⚡ Bugun yaratilgan QR: <b>{today_qrs}</b>

🚫 Bloklanganlar: <b>{blocked}</b>
"""

        bot.edit_message_text(
            text,
            call.message.chat.id,
            call.message.message_id,
            reply_markup=admin_back()
        )

    # --------------------------------------------------------
    # USERLAR
    # --------------------------------------------------------

    elif action == "admin_users":

        conn = db()
        cur = conn.cursor()

        cur.execute("""
            SELECT *
            FROM users
            ORDER BY last_seen DESC
            LIMIT 30
        """)

        users = cur.fetchall()
        conn.close()

        if not users:
            text = "👥 Foydalanuvchilar yo'q."
        else:

            text = "👥 <b>FOYDALANUVCHILAR</b>\n\n"

            for i, user in enumerate(users, 1):

                username = (
                    "@" + user["username"]
                    if user["username"]
                    else "username yo'q"
                )

                status = "🚫" if user["blocked"] else "✅"

                text += (
                    f"{status} <b>{i}. "
                    f"{user['first_name']}</b>\n"
                    f"👤 {username}\n"
                    f"🆔 <code>{user['id']}</code>\n"
                    f"📱 {user['phone'] or 'yo‘q'}\n"
                    f"🔳 QR: <b>{user['qr_count']}</b>\n\n"
                )

        bot.edit_message_text(
            text[:4000],
            call.message.chat.id,
            call.message.message_id,
            reply_markup=admin_back()
        )

    # --------------------------------------------------------
    # TOP
    # --------------------------------------------------------

    elif action == "admin_top":

        conn = db()
        cur = conn.cursor()

        cur.execute("""
            SELECT *
            FROM users
            ORDER BY qr_count DESC
            LIMIT 10
        """)

        users = cur.fetchall()
        conn.close()

        text = "🏆 <b>TOP 10 QR YARATUVCHILAR</b>\n\n"

        medals = [
            "🥇",
            "🥈",
            "🥉"
        ]

        for i, user in enumerate(users, 1):

            medal = medals[i - 1] if i <= 3 else f"{i}."

            username = (
                "@" + user["username"]
                if user["username"]
                else user["first_name"]
            )

            text += (
                f"{medal} {username} — "
                f"<b>{user['qr_count']} QR</b>\n"
            )

        bot.edit_message_text(
            text,
            call.message.chat.id,
            call.message.message_id,
            reply_markup=admin_back()
        )

    # --------------------------------------------------------
    # BLOCKED
    # --------------------------------------------------------

    elif action == "admin_blocked":

        conn = db()
        cur = conn.cursor()

        cur.execute("""
            SELECT *
            FROM users
            WHERE blocked=1
            ORDER BY last_seen DESC
        """)

        users = cur.fetchall()
        conn.close()

        if not users:
            text = "🚫 Bloklangan foydalanuvchilar yo'q."
        else:

            text = "🚫 <b>BLOKLANGANLAR</b>\n\n"

            for user in users:

                username = (
                    "@" + user["username"]
                    if user["username"]
                    else "username yo'q"
                )

                text += (
                    f"👤 {username}\n"
                    f"🆔 <code>{user['id']}</code>\n"
                    f"📱 {user['phone'] or 'yo‘q'}\n\n"
                )

        bot.edit_message_text(
            text[:4000],
            call.message.chat.id,
            call.message.message_id,
            reply_markup=admin_back()
        )

    # --------------------------------------------------------
    # CSV
    # --------------------------------------------------------

    elif action == "admin_csv":

        conn = db()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                id,
                username,
                first_name,
                last_name,
                phone,
                qr_count,
                blocked,
                joined_at,
                last_seen
            FROM users
            ORDER BY joined_at DESC
        """)

        users = cur.fetchall()
        conn.close()

        output = io.StringIO()

        writer = csv.writer(output)

        writer.writerow([
            "ID",
            "Username",
            "First Name",
            "Last Name",
            "Phone",
            "QR Count",
            "Blocked",
            "Joined",
            "Last Seen"
        ])

        for user in users:
            writer.writerow([
                user["id"],
                user["username"],
                user["first_name"],
                user["last_name"],
                user["phone"],
                user["qr_count"],
                user["blocked"],
                user["joined_at"],
                user["last_seen"]
            ])

        file_data = io.BytesIO(
            output.getvalue().encode("utf-8-sig")
        )

        file_data.name = "users.csv"

        bot.send_document(
            call.message.chat.id,
            file_data,
            caption="📥 <b>Barcha foydalanuvchilar</b>"
        )

    # --------------------------------------------------------
    # BROADCAST
    # --------------------------------------------------------

    elif action == "admin_broadcast":

        bot.answer_callback_query(call.id)

        msg = bot.send_message(
            call.message.chat.id,
            """
📢 <b>REKLAMA YUBORISH</b>

Endi barcha foydalanuvchilarga yubormoqchi
bo'lgan xabaringizni yuboring.

Bekor qilish uchun:
<b>/cancel</b>
"""
        )

        bot.register_next_step_handler(
            msg,
            broadcast_message
        )


def admin_back():

    kb = types.InlineKeyboardMarkup()

    kb.add(
        types.InlineKeyboardButton(
            "⬅️ Admin panel",
            callback_data="admin_back"
        )
    )

    return kb


@bot.callback_query_handler(func=lambda call: call.data == "admin_back")
def admin_back_callback(call):

    if not is_admin(call.from_user.id):
        return

    bot.edit_message_text(
        "👑 <b>ADMIN PANEL</b>",
        call.message.chat.id,
        call.message.message_id,
        reply_markup=admin_menu()
    )


# ============================================================
# BROADCAST
# ============================================================

def broadcast_message(message):

    if message.text == "/cancel":

        bot.send_message(
            message.chat.id,
            "❌ Reklama bekor qilindi.",
            reply_markup=main_menu()
        )

        return

    if not is_admin(message.from_user.id):
        return

    conn = db()
    cur = conn.cursor()

    cur.execute(
        "SELECT id FROM users WHERE blocked=0"
    )

    users = cur.fetchall()
    conn.close()

    success = 0
    failed = 0

    status = bot.send_message(
        message.chat.id,
        "📢 Reklama yuborilmoqda..."
    )

    for user in users:

        try:

            bot.copy_message(
                user["id"],
                message.chat.id,
                message.message_id
            )

            success += 1

        except Exception:

            failed += 1

    bot.edit_message_text(
        f"""
📢 <b>REKLAMA YAKUNLANDI</b>

✅ Yuborildi: <b>{success}</b>

❌ Xato: <b>{failed}</b>
""",
        message.chat.id,
        status.message_id
    )


# ============================================================
# QR GENERATOR
# ============================================================

def create_qr(data):

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=12,
        border=4
    )

    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(
        fill_color="#111827",
        back_color="white"
    ).convert("RGB")

    # Logo markaziga kichik QR MASTER yozuvi
    draw = ImageDraw.Draw(img)

    center_x = img.width // 2
    center_y = img.height // 2

    size = min(img.width, img.height) // 6

    left = center_x - size
    top = center_y - size
    right = center_x + size
    bottom = center_y + size

    draw.rounded_rectangle(
        [left, top, right, bottom],
        radius=20,
        fill="white"
    )

    draw.text(
        (center_x, center_y),
        "QR",
        fill="#111827",
        anchor="mm"
    )

    output = io.BytesIO()

    img.save(
        output,
        format="PNG"
    )

    output.seek(0)

    return output


def send_qr(message, qr_type, content):

    try:

        qr = create_qr(content)

        increase_qr(
            message.from_user.id,
            qr_type,
            content
        )

        user = get_user(message.from_user.id)

        bot.send_photo(
            message.chat.id,
            qr,
            caption=f"""
✅ <b>QR Code tayyor!</b>

📌 Turi: <b>{qr_type}</b>

🔳 Siz yaratgan QR: <b>{user['qr_count']}</b>

🚀 QR MASTER
"""
        )

    except Exception as e:

        logging.exception(e)

        bot.send_message(
            message.chat.id,
            "❌ QR yaratishda xatolik yuz berdi."
        )


# ============================================================
# QR TYPE STATE
# ============================================================

user_states = {}


def need_input(message, state, text):

    user_states[message.from_user.id] = state

    bot.send_message(
        message.chat.id,
        text + "\n\n❌ Bekor qilish: /cancel"
    )


# ============================================================
# TEXT QR
# ============================================================

@bot.message_handler(func=lambda m: m.text == "📝 Text QR")
def text_qr(message):

    if not check_user(message):
        return

    need_input(
        message,
        "text",
        "📝 QR ichiga yoziladigan <b>matnni</b> yuboring:"
    )


# ============================================================
# LINK QR
# ============================================================

@bot.message_handler(func=lambda m: m.text == "🔗 Link QR")
def link_qr(message):

    if not check_user(message):
        return

    need_input(
        message,
        "link",
        "🔗 <b>Linkni</b> yuboring:\n\nMasalan:\nhttps://google.com"
    )


# ============================================================
# TELEFON
# ============================================================

@bot.message_handler(func=lambda m: m.text == "📞 Telefon QR")
def phone_qr(message):

    if not check_user(message):
        return

    need_input(
        message,
        "phone",
        "📞 Telefon raqamini yuboring:\n\nMasalan:\n+998901234567"
    )


# ============================================================
# KONTAKT
# ============================================================

@bot.message_handler(func=lambda m: m.text == "👤 Kontakt QR")
def contact_qr(message):

    if not check_user(message):
        return

    need_input(
        message,
        "contact_name",
        "👤 Kontaktning <b>ism va familiyasini</b> yuboring:"
    )


# ============================================================
# LOCATION
# ============================================================

@bot.message_handler(func=lambda m: m.text == "📍 Location QR")
def location_qr(message):

    if not check_user(message):

        return

    need_input(
        message,
        "location",
        """
📍 Location QR

Quyidagi ko'rinishda yuboring:

<b>41.311081,69.240562</b>

Masalan:
41.311081,69.240562
"""
    )


# ============================================================
# WIFI
# ============================================================

@bot.message_handler(func=lambda m: m.text == "📶 Wi-Fi QR")
def wifi_qr(message):

    if not check_user(message):

        return

    need_input(
        message,
        "wifi_ssid",
        "📶 Wi-Fi nomini (SSID) yuboring:"
    )


# ============================================================
# EMAIL
# ============================================================

@bot.message_handler(func=lambda m: m.text == "✉️ Email QR")
def email_qr(message):

    if not check_user(message):

        return

    need_input(
        message,
        "email",
        "✉️ Email manzilini yuboring:"
    )


# ============================================================
# LOCATION MESSAGE
# ============================================================

@bot.message_handler(content_types=["location"])
def location_message(message):

    if not check_user(message):
        return

    if user_states.get(message.from_user.id) != "location":
        return

    lat = message.location.latitude
    lon = message.location.longitude

    content = f"geo:{lat},{lon}"

    user_states.pop(message.from_user.id, None)

    send_qr(
        message,
        "Location",
        content
    )


# ============================================================
# BARCHA INPUT
# ============================================================

@bot.message_handler(
    func=lambda m: m.from_user.id in user_states
)
def state_handler(message):

    if not check_user(message):
        return

    state = user_states.get(
        message.from_user.id
    )

    text = message.text.strip()

    if not text:
        return

    # --------------------------------------------------------
    # TEXT
    # --------------------------------------------------------

    if state == "text":

        user_states.pop(
            message.from_user.id,
            None
        )

        send_qr(
            message,
            "Text",
            text
        )

    # --------------------------------------------------------
    # LINK
    # --------------------------------------------------------

    elif state == "link":

        if not (
            text.startswith("http://")
            or text.startswith("https://")
        ):

            bot.send_message(
                message.chat.id,
                "⚠️ Link <b>http://</b> yoki <b>https://</b> bilan boshlanishi kerak."
            )
            return

        user_states.pop(
            message.from_user.id,
            None
        )

        send_qr(
            message,
            "Link",
            text
        )

    # --------------------------------------------------------
    # PHONE
    # --------------------------------------------------------

    elif state == "phone":

        user_states.pop(
            message.from_user.id,
            None
        )

        send_qr(
            message,
            "Telefon",
            "tel:" + text
        )

    # --------------------------------------------------------
    # CONTACT NAME
    # --------------------------------------------------------

    elif state == "contact_name":

        user_states[
            message.from_user.id
        ] = "contact_phone"

        user_states[
            str(message.from_user.id) + "_name"
        ] = text

        bot.send_message(
            message.chat.id,
            "📱 Endi kontaktning <b>telefon raqamini</b> yuboring:"
        )

    # --------------------------------------------------------
    # CONTACT PHONE
    # --------------------------------------------------------

    elif state == "contact_phone":

        name = user_states.get(
            str(message.from_user.id) + "_name",
            "Kontakt"
        )

        content = f"""BEGIN:VCARD
VERSION:3.0
FN:{name}
TEL:{text}
END:VCARD"""

        user_states.pop(
            message.from_user.id,
            None
        )

        user_states.pop(
            str(message.from_user.id) + "_name",
            None
        )

        send_qr(
            message,
            "Kontakt",
            content
        )

    # --------------------------------------------------------
    # LOCATION TEXT
    # --------------------------------------------------------

    elif state == "location":

        try:

            parts = text.split(",")

            lat = float(parts[0].strip())
            lon = float(parts[1].strip())

            content = f"geo:{lat},{lon}"

            user_states.pop(
                message.from_user.id,
                None
            )

            send_qr(
                message,
                "Location",
                content
            )

        except:

            bot.send_message(
                message.chat.id,
                "⚠️ Format noto'g'ri.\n\nMasalan: <code>41.311081,69.240562</code>"
            )

    # --------------------------------------------------------
    # WIFI SSID
    # --------------------------------------------------------

    elif state == "wifi_ssid":

        user_states[
            message.from_user.id
        ] = "wifi_password"

        user_states[
            str(message.from_user.id) + "_ssid"
        ] = text

        bot.send_message(
            message.chat.id,
            "🔐 Wi-Fi parolini yuboring:\n\nAgar parolsiz bo'lsa <code>none</code> yozing."
        )

    # --------------------------------------------------------
    # WIFI PASSWORD
    # --------------------------------------------------------

    elif state == "wifi_password":

        ssid = user_states.get(
            str(message.from_user.id) + "_ssid",
            ""
        )

        password = text

        if password.lower() == "none":
            content = f"WIFI:T:nopass;S:{ssid};;"
        else:
            content = f"WIFI:T:WPA;S:{ssid};P:{password};;"

        user_states.pop(
            message.from_user.id,
            None
        )

        user_states.pop(
            str(message.from_user.id) + "_ssid",
            None
        )

        send_qr(
            message,
            "Wi-Fi",
            content
        )

    # --------------------------------------------------------
    # EMAIL
    # --------------------------------------------------------

    elif state == "email":

        if "@" not in text:

            bot.send_message(
                message.chat.id,
                "⚠️ Email manzilini to'g'ri yuboring."
            )
            return

        user_states.pop(
            message.from_user.id,
            None
        )

        send_qr(
            message,
            "Email",
            "mailto:" + text
        )


# ============================================================
# TARIX
# ============================================================

@bot.message_handler(func=lambda m: m.text == "📜 Tarix")
def history(message):

    if not check_user(message):
        return

    conn = db()
    cur = conn.cursor()

    cur.execute("""
        SELECT qr_type, created_at
        FROM qr_codes
        WHERE user_id=?
        ORDER BY id DESC
        LIMIT 10
    """, (message.from_user.id,))

    rows = cur.fetchall()
    conn.close()

    if not rows:

        bot.send_message(
            message.chat.id,
            "📜 Sizda hali QR tarixi mavjud emas."
        )
        return

    text = "📜 <b>OXIRGI QR LAR</b>\n\n"

    for i, row in enumerate(rows, 1):

        text += (
            f"{i}. 🔳 {row['qr_type']}\n"
            f"🕐 {row['created_at']}\n\n"
        )

    bot.send_message(
        message.chat.id,
        text
    )


# ============================================================
# ABOUT
# ============================================================

@bot.message_handler(func=lambda m: m.text == "ℹ️ Bot haqida")
def about(message):

    if not check_user(message):
        return

    bot.send_message(
        message.chat.id,
        """
🚀 <b>QR MASTER BOT</b>

Bitta bot — ko'plab QR formatlar.

🔗 Link
📝 Text
📞 Telefon
👤 Kontakt
📍 Location
📶 Wi-Fi
✉️ Email

📊 Barcha QRlaringiz statistikada saqlanadi.

⚡ Tez
🔐 Ishonchli
🎨 Chiroyli
"""
    )


# ============================================================
# CANCEL
# ============================================================

@bot.message_handler(commands=["cancel"])
def cancel(message):

    user_states.pop(
        message.from_user.id,
        None
    )

    user_states.pop(
        str(message.from_user.id) + "_name",
        None
    )

    user_states.pop(
        str(message.from_user.id) + "_ssid",
        None
    )

    bot.send_message(
        message.chat.id,
        "❌ Amal bekor qilindi.",
        reply_markup=main_menu()
    )


# ============================================================
# CHECK USER
# ============================================================

def check_user(message):

    if is_blocked(message.from_user.id):

        bot.send_message(
            message.chat.id,
            "🚫 <b>Siz bloklangansiz.</b>"
        )

        return False

    save_user(message.from_user)

    user = get_user(message.from_user.id)

    if not user["phone"]:

        bot.send_message(
            message.chat.id,
            "📱 Avval telefon raqamingizni yuboring.",
            reply_markup=contact_menu()
        )

        return False

    return True


# ============================================================
# ADMIN BLOCK COMMAND
# ============================================================

@bot.message_handler(commands=["block"])
def block_user(message):

    if not is_admin(message.from_user.id):
        return

    parts = message.text.split()

    if len(parts) != 2:

        bot.send_message(
            message.chat.id,
            "Foydalanish:\n<code>/block USER_ID</code>"
        )
        return

    try:

        user_id = int(parts[1])

    except:

        bot.send_message(
            message.chat.id,
            "❌ ID noto'g'ri."
        )
        return

    conn = db()
    cur = conn.cursor()

    cur.execute(
        "UPDATE users SET blocked=1 WHERE id=?",
        (user_id,)
    )

    conn.commit()
    conn.close()

    bot.send_message(
        message.chat.id,
        f"🚫 <b>{user_id}</b> bloklandi."
    )

    try:

        bot.send_message(
            user_id,
            "🚫 <b>Siz botdan bloklandingiz.</b>"
        )

    except:
        pass


# ============================================================
# UNBLOCK
# ============================================================

@bot.message_handler(commands=["unblock"])
def unblock_user(message):

    if not is_admin(message.from_user.id):
        return

    parts = message.text.split()

    if len(parts) != 2:

        bot.send_message(
            message.chat.id,
            "Foydalanish:\n<code>/unblock USER_ID</code>"
        )
        return

    try:

        user_id = int(parts[1])

    except:

        bot.send_message(
            message.chat.id,
            "❌ ID noto'g'ri."
        )
        return

    conn = db()
    cur = conn.cursor()

    cur.execute(
        "UPDATE users SET blocked=0 WHERE id=?",
        (user_id,)
    )

    conn.commit()
    conn.close()

    bot.send_message(
        message.chat.id,
        f"✅ <b>{user_id}</b> blokdan chiqarildi."
    )


# ============================================================
# USER INFO
# ============================================================

@bot.message_handler(commands=["user"])
def user_info(message):

    if not is_admin(message.from_user.id):
        return

    parts = message.text.split()

    if len(parts) != 2:

        bot.send_message(
            message.chat.id,
            "Foydalanish:\n<code>/user USER_ID</code>"
        )
        return

    try:

        user_id = int(parts[1])

    except:

        return

    user = get_user(user_id)

    if not user:

        bot.send_message(
            message.chat.id,
            "❌ Foydalanuvchi topilmadi."
        )
        return

    username = (
        "@" + user["username"]
        if user["username"]
        else "username yo'q"
    )

    text = f"""
👤 <b>FOYDALANUVCHI</b>

🆔 ID: <code>{user['id']}</code>

👤 Username: {username}

📛 Ism: {user['first_name']}

📛 Familiya: {user['last_name']}

📱 Telefon: {user['phone'] or 'yo‘q'}

🔳 QR soni: <b>{user['qr_count']}</b>

🚫 Block: {"HA" if user["blocked"] else "YO‘Q"}

📅 Ro'yxatdan o'tgan:
{user['joined_at']}

🕐 Oxirgi faollik:
{user['last_seen']}
"""

    bot.send_message(
        message.chat.id,
        text
    )


# ============================================================
# ADMIN HELP
# ============================================================

@bot.message_handler(commands=["adminhelp"])
def admin_help(message):

    if not is_admin(message.from_user.id):
        return

    bot.send_message(
        message.chat.id,
        """
👑 <b>ADMIN BUYRUQLARI</b>

/admin — Admin panel

/block ID — bloklash

/unblock ID — blokdan chiqarish

/user ID — foydalanuvchi ma'lumoti

/adminhelp — yordam
"""
    )


# ============================================================
# ERROR HANDLER
# ============================================================

@bot.message_handler(func=lambda m: True)
def unknown(message):

    if is_blocked(message.from_user.id):
        return

    save_user(message.from_user)

    user = get_user(message.from_user.id)

    if not user["phone"]:

        bot.send_message(
            message.chat.id,
            "📱 Botdan foydalanish uchun kontaktni yuboring.",
            reply_markup=contact_menu()
        )

        return

    bot.send_message(
        message.chat.id,
        "👇 Menyudan kerakli QR turini tanlang.",
        reply_markup=main_menu()
    )


# ============================================================
# START BOT
# ============================================================

if __name__ == "__main__":

    print("=" * 50)
    print("QR MASTER BOT ISHLAYAPTI")
    print("=" * 50)

    bot.infinity_polling(
        skip_pending=True,
        timeout=60,
        long_polling_timeout=60
    )
