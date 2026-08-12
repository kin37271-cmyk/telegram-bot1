import os
import sqlite3
import telebot
import qrcode

from telebot import types

# =========================================================
# SOZLAMALAR
# =========================================================

BOT_TOKEN = "8633658106:AAFjNIzpm1jS30eNCxtzr8uaeM_xRVKsBzI"
ADMIN_ID = 7600986332  # Telegram ID'ingizni yozing

QR_PRICE = 300
MIN_PAYMENT = 2000

CARD_NUMBER = "6262 7201 2331 5395"

bot = telebot.TeleBot(BOT_TOKEN, parse_mode="HTML")

DB_NAME = "qr_bot.db"


# =========================================================
# DATABASE
# =========================================================

def db_connect():
    return sqlite3.connect(DB_NAME)


def init_db():
    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT DEFAULT '',
            first_name TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            balance INTEGER DEFAULT 0,
            blocked INTEGER DEFAULT 0
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            phone TEXT,
            amount INTEGER,
            photo_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()


init_db()


# =========================================================
# USER FUNCTIONS
# =========================================================

def add_user(user):
    conn = db_connect()
    cur = conn.cursor()

    username = user.username or ""
    first_name = user.first_name or ""

    cur.execute("""
        INSERT OR IGNORE INTO users
        (user_id, username, first_name)
        VALUES (?, ?, ?)
    """, (user.id, username, first_name))

    cur.execute("""
        UPDATE users
        SET username = ?, first_name = ?
        WHERE user_id = ?
    """, (username, first_name, user.id))

    conn.commit()
    conn.close()


def get_user(user_id):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT user_id, username, first_name, phone, balance, blocked
        FROM users
        WHERE user_id = ?
    """, (user_id,))

    result = cur.fetchone()

    conn.close()

    return result


def get_balance(user_id):
    user = get_user(user_id)

    if not user:
        return 0

    return user[4]


def change_balance(user_id, amount):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        UPDATE users
        SET balance = balance + ?
        WHERE user_id = ?
    """, (amount, user_id))

    conn.commit()
    conn.close()


def set_phone(user_id, phone):
    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        UPDATE users
        SET phone = ?
        WHERE user_id = ?
    """, (phone, user_id))

    conn.commit()
    conn.close()


def is_blocked(user_id):
    user = get_user(user_id)

    if not user:
        return False

    return user[5] == 1


# =========================================================
# ADMIN CHECK
# =========================================================

def is_admin(user_id):
    return user_id == ADMIN_ID


# =========================================================
# MAIN MENU
# =========================================================

def main_menu():
    markup = types.ReplyKeyboardMarkup(
        resize_keyboard=True,
        row_width=2
    )

    markup.add(
        types.KeyboardButton("🧾 QR Code yaratish"),
        types.KeyboardButton("💰 Hisobim")
    )

    markup.add(
        types.KeyboardButton("➕ Hisobni to‘ldirish"),
        types.KeyboardButton("📞 Telefon raqamim")
    )

    markup.add(
        types.KeyboardButton("ℹ️ Yordam")
    )

    return markup


def admin_menu():
    markup = types.ReplyKeyboardMarkup(
        resize_keyboard=True,
        row_width=2
    )

    markup.add(
        types.KeyboardButton("👥 Foydalanuvchilar"),
        types.KeyboardButton("📊 Statistika")
    )

    markup.add(
        types.KeyboardButton("💰 Hisobiga pul kiritish"),
        types.KeyboardButton("🎁 Bonus berish")
    )

    markup.add(
        types.KeyboardButton("📞 Telefon raqamini ko‘rish"),
        types.KeyboardButton("💳 To‘lovlar")
    )

    markup.add(
        types.KeyboardButton("🚫 Bloklash"),
        types.KeyboardButton("✅ Blokdan chiqarish")
    )

    markup.add(
        types.KeyboardButton("⬅️ Oddiy menyu")
    )

    return markup


# =========================================================
# START
# =========================================================

@bot.message_handler(commands=["start"])
def start(message):

    add_user(message.from_user)

    if is_blocked(message.from_user.id):
        bot.send_message(
            message.chat.id,
            "🚫 Siz botdan foydalanishingiz bloklangan."
        )
        return

    text = f"""
<b>🤖 QR CODE YARATUVCHI BOT</b>

Assalomu alaykum, <b>{message.from_user.first_name}</b>!

🧾 QR Code yaratish: <b>{QR_PRICE} so‘m</b>

💰 Balansingiz: <b>{get_balance(message.from_user.id):,} so‘m</b>

Kerakli bo‘limni tanlang 👇
"""

    if is_admin(message.from_user.id):
        bot.send_message(
            message.chat.id,
            text,
            reply_markup=admin_menu()
        )
    else:
        bot.send_message(
            message.chat.id,
            text,
            reply_markup=main_menu()
        )


# =========================================================
# QR CODE YARATISH
# =========================================================

@bot.message_handler(func=lambda message: message.text == "🧾 QR Code yaratish")
def qr_start(message):

    if is_blocked(message.from_user.id):
        return

    balance = get_balance(message.from_user.id)

    if balance < QR_PRICE:

        need = QR_PRICE - balance

        bot.send_message(
            message.chat.id,
            f"""
❌ <b>Balansingiz yetarli emas.</b>

💰 Balans: <b>{balance:,} so‘m</b>
🧾 QR Code narxi: <b>{QR_PRICE:,} so‘m</b>

💵 Yetishmayotgan summa: <b>{need:,} so‘m</b>

Hisobingizni to‘ldiring.
""",
            reply_markup=main_menu()
        )

        return

    msg = bot.send_message(
        message.chat.id,
        """
🧾 <b>QR Code yaratish</b>

QR Code ichiga joylashtirmoqchi bo‘lgan
<b>matn yoki linkni</b> yuboring.

Masalan:

https://google.com
yoki
Salom dunyo!
"""
    )

    bot.register_next_step_handler(msg, create_qr)


def create_qr(message):

    if is_blocked(message.from_user.id):
        return

    text = message.text

    if not text:
        bot.send_message(
            message.chat.id,
            "❌ Matn yoki link yuboring."
        )
        return

    balance = get_balance(message.from_user.id)

    if balance < QR_PRICE:
        bot.send_message(
            message.chat.id,
            "❌ Balansingiz yetarli emas."
        )
        return

    filename = f"qr_{message.from_user.id}.png"

    try:

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=4
        )

        qr.add_data(text)
        qr.make(fit=True)

        image = qr.make_image(
            fill_color="black",
            back_color="white"
        )

        image.save(filename)

        change_balance(
            message.from_user.id,
            -QR_PRICE
        )

        new_balance = get_balance(message.from_user.id)

        with open(filename, "rb") as photo:

            bot.send_photo(
                message.chat.id,
                photo,
                caption=f"""
✅ <b>QR Code tayyor!</b>

💸 Yechildi: <b>{QR_PRICE:,} so‘m</b>
💰 Qolgan balans: <b>{new_balance:,} so‘m</b>
"""
            )

        if os.path.exists(filename):
            os.remove(filename)

    except Exception as e:

        bot.send_message(
            message.chat.id,
            f"❌ QR Code yaratishda xatolik:\n<code>{e}</code>"
        )


# =========================================================
# HISOBIM
# =========================================================

@bot.message_handler(func=lambda message: message.text == "💰 Hisobim")
def my_balance(message):

    balance = get_balance(message.from_user.id)

    bot.send_message(
        message.chat.id,
        f"""
💰 <b>Hisobingiz</b>

💵 Balans: <b>{balance:,} so‘m</b>

🧾 1 ta QR Code: <b>{QR_PRICE:,} so‘m</b>

📦 Siz taxminan <b>{balance // QR_PRICE}</b> ta QR Code yaratishingiz mumkin.
""",
        reply_markup=main_menu()
    )


# =========================================================
# TELEFON RAQAMI
# =========================================================

@bot.message_handler(func=lambda message: message.text == "📞 Telefon raqamim")
def phone_request(message):

    markup = types.ReplyKeyboardMarkup(
        resize_keyboard=True,
        one_time_keyboard=True
    )

    button = types.KeyboardButton(
        "📱 Telefon raqamni yuborish",
        request_contact=True
    )

    markup.add(button)
    markup.add(types.KeyboardButton("⬅️ Orqaga"))

    bot.send_message(
        message.chat.id,
        """
📞 Telefon raqamingizni yuboring.

Pastdagi tugmani bosing 👇
""",
        reply_markup=markup
    )


@bot.message_handler(content_types=["contact"])
def contact_handler(message):

    if message.contact.user_id != message.from_user.id:
        bot.send_message(
            message.chat.id,
            "❌ Iltimos, o‘zingizning telefon raqamingizni yuboring."
        )
        return

    phone = message.contact.phone_number

    set_phone(
        message.from_user.id,
        phone
    )

    bot.send_message(
        message.chat.id,
        f"""
✅ Telefon raqamingiz saqlandi.

📞 <b>{phone}</b>
""",
        reply_markup=main_menu()
    )


# =========================================================
# HISOBNI TO‘LDIRISH
# =========================================================

@bot.message_handler(func=lambda message: message.text == "➕ Hisobni to‘ldirish")
def deposit_start(message):

    bot.send_message(
        message.chat.id,
        f"""
💳 <b>Hisobni to‘ldirish</b>

💰 Minimal to‘lov: <b>{MIN_PAYMENT:,} so‘m</b>

🏦 Karta raqami:

<code>{CARD_NUMBER}</code>

⚠️ To‘lovni amalga oshirgandan keyin
chekni shu yerga <b>rasm qilib yuboring</b>.

Keyin summa so‘raladi.
"""
    )

    msg = bot.send_message(
        message.chat.id,
        f"💵 To‘lov summasini kiriting.\n\nMinimum: <b>{MIN_PAYMENT:,} so‘m</b>"
    )

    bot.register_next_step_handler(
        msg,
        payment_amount
    )


def payment_amount(message):

    try:

        amount = int(
            message.text.replace(" ", "").replace(",", "")
        )

    except:

        msg = bot.send_message(
            message.chat.id,
            "❌ Faqat raqam kiriting.\n\nMasalan: 2000"
        )

        bot.register_next_step_handler(
            msg,
            payment_amount
        )

        return

    if amount < MIN_PAYMENT:

        msg = bot.send_message(
            message.chat.id,
            f"""
❌ Minimal to‘lov <b>{MIN_PAYMENT:,} so‘m</b>.

Qaytadan kiriting:
"""
        )

        bot.register_next_step_handler(
            msg,
            payment_amount
        )

        return

    bot.send_message(
        message.chat.id,
        f"""
💰 Summa: <b>{amount:,} so‘m</b>

💳 Karta:
<code>{CARD_NUMBER}</code>

Endi to‘lovni amalga oshiring.

📸 Keyin <b>chek rasmini yuboring</b>.
"""
    )

    bot.register_next_step_handler(
        bot.send_message(
            message.chat.id,
            "📸 <b>Chek rasmini yuboring:</b>"
        ),
        payment_receipt,
        amount
    )


def payment_receipt(message, amount):

    if not message.photo:

        msg = bot.send_message(
            message.chat.id,
            "❌ Iltimos, chekni <b>rasm</b> ko‘rinishida yuboring."
        )

        bot.register_next_step_handler(
            msg,
            payment_receipt,
            amount
        )

        return

    photo_id = message.photo[-1].file_id

    user = get_user(message.from_user.id)

    username = user[1] if user else ""
    phone = user[3] if user else ""

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO payments
        (user_id, username, phone, amount, photo_id)
        VALUES (?, ?, ?, ?, ?)
    """, (
        message.from_user.id,
        username,
        phone,
        amount,
        photo_id
    ))

    payment_id = cur.lastrowid

    conn.commit()
    conn.close()

    markup = types.InlineKeyboardMarkup()

    markup.add(
        types.InlineKeyboardButton(
            "✅ Tasdiqlash",
            callback_data=f"approve_{payment_id}"
        ),
        types.InlineKeyboardButton(
            "❌ Rad etish",
            callback_data=f"reject_{payment_id}"
        )
    )

    admin_text = f"""
💳 <b>YANGI TO‘LOV</b>

🆔 To‘lov ID: <b>{payment_id}</b>

👤 Ism: <b>{message.from_user.first_name}</b>
🔹 Username: @{username if username else "yo‘q"}

🆔 User ID: <code>{message.from_user.id}</code>

📞 Telefon: <b>{phone if phone else "kiritilmagan"}</b>

💰 Summa: <b>{amount:,} so‘m</b>

⏳ Holat: <b>Kutilmoqda</b>
"""

    bot.send_photo(
        ADMIN_ID,
        photo_id,
        caption=admin_text,
        reply_markup=markup
    )

    bot.send_message(
        message.chat.id,
        """
✅ <b>Chek adminga yuborildi.</b>

⏳ Admin to‘lovni tekshiradi.

Tasdiqlangandan keyin pul balansingizga qo‘shiladi.
""",
        reply_markup=main_menu()
    )


# =========================================================
# PAYMENT CALLBACK
# =========================================================

@bot.callback_query_handler(
    func=lambda call:
    call.data.startswith("approve_") or
    call.data.startswith("reject_")
)
def payment_callback(call):

    if not is_admin(call.from_user.id):

        bot.answer_callback_query(
            call.id,
            "❌ Siz admin emassiz.",
            show_alert=True
        )

        return

    try:

        payment_id = int(
            call.data.split("_")[1]
        )

    except:

        return

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT user_id, amount, status
        FROM payments
        WHERE id = ?
    """, (payment_id,))

    payment = cur.fetchone()

    if not payment:

        conn.close()

        bot.answer_callback_query(
            call.id,
            "❌ To‘lov topilmadi.",
            show_alert=True
        )

        return

    user_id, amount, status = payment

    if status != "pending":

        conn.close()

        bot.answer_callback_query(
            call.id,
            "⚠️ Bu to‘lov allaqachon ko‘rib chiqilgan.",
            show_alert=True
        )

        return

    if call.data.startswith("approve_"):

        cur.execute("""
            UPDATE payments
            SET status = 'approved'
            WHERE id = ?
        """, (payment_id,))

        conn.commit()
        conn.close()

        change_balance(
            user_id,
            amount
        )

        new_balance = get_balance(user_id)

        try:

            bot.send_message(
                user_id,
                f"""
✅ <b>To‘lov tasdiqlandi!</b>

💰 Hisobingizga qo‘shildi:
<b>+{amount:,} so‘m</b>

💵 Yangi balans:
<b>{new_balance:,} so‘m</b>
"""
            )

        except:
            pass

        bot.answer_callback_query(
            call.id,
            "✅ To‘lov tasdiqlandi."
        )

        try:
            bot.edit_message_caption(
                f"""
✅ <b>TO‘LOV TASDIQLANDI</b>

🆔 To‘lov ID: <b>{payment_id}</b>
💰 Summa: <b>{amount:,} so‘m</b>
👤 User ID: <code>{user_id}</code>
""",
                call.message.chat.id,
                call.message.message_id
            )
        except:
            pass

    else:

        cur.execute("""
            UPDATE payments
            SET status = 'rejected'
            WHERE id = ?
        """, (payment_id,))

        conn.commit()
        conn.close()

        try:

            bot.send_message(
                user_id,
                f"""
❌ <b>To‘lov rad etildi.</b>

💰 Summa: <b>{amount:,} so‘m</b>

Agar to‘lovni amalga oshirgan bo‘lsangiz,
admin bilan bog‘laning.
"""
            )

        except:
            pass

        bot.answer_callback_query(
            call.id,
            "❌ To‘lov rad etildi."
        )

        try:
            bot.edit_message_caption(
                f"""
❌ <b>TO‘LOV RAD ETILDI</b>

🆔 To‘lov ID: <b>{payment_id}</b>
💰 Summa: <b>{amount:,} so‘m</b>
👤 User ID: <code>{user_id}</code>
""",
                call.message.chat.id,
                call.message.message_id
            )
        except:
            pass


# =========================================================
# HELP
# =========================================================

@bot.message_handler(func=lambda message: message.text == "ℹ️ Yordam")
def help_message(message):

    bot.send_message(
        message.chat.id,
        f"""
ℹ️ <b>Yordam</b>

🧾 QR Code yaratish — <b>{QR_PRICE} so‘m</b>

💰 Hisobim — balansingizni ko‘rsatadi.

➕ Hisobni to‘ldirish — karta orqali hisobni to‘ldirish.

📞 Telefon raqamim — telefon raqamingizni saqlash.

Minimal to‘lov: <b>{MIN_PAYMENT:,} so‘m</b>
"""
    )


# =========================================================
# ADMIN PANEL
# =========================================================

@bot.message_handler(
    func=lambda message:
    message.text == "⬅️ Oddiy menyu"
)
def normal_menu(message):

    bot.send_message(
        message.chat.id,
        "👤 Oddiy foydalanuvchi menyusi:",
        reply_markup=main_menu()
    )


@bot.message_handler(
    func=lambda message:
    message.text == "👥 Foydalanuvchilar"
)
def admin_users(message):

    if not is_admin(message.from_user.id):
        return

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*)
        FROM users
    """)

    count = cur.fetchone()[0]

    conn.close()

    bot.send_message(
        message.chat.id,
        f"""
👥 <b>Foydalanuvchilar</b>

Jami foydalanuvchilar: <b>{count}</b>
"""
    )


@bot.message_handler(
    func=lambda message:
    message.text == "📊 Statistika"
)
def admin_statistics(message):

    if not is_admin(message.from_user.id):
        return

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*)
        FROM users
    """)

    users = cur.fetchone()[0]

    cur.execute("""
        SELECT COUNT(*)
        FROM payments
        WHERE status = 'approved'
    """)

    payments = cur.fetchone()[0]

    cur.execute("""
        SELECT COALESCE(SUM(amount), 0)
        FROM payments
        WHERE status = 'approved'
    """)

    total_money = cur.fetchone()[0]

    conn.close()

    bot.send_message(
        message.chat.id,
        f"""
📊 <b>STATISTIKA</b>

👥 Foydalanuvchilar: <b>{users}</b>

💳 Tasdiqlangan to‘lovlar:
<b>{payments}</b>

💰 Jami tushum:
<b>{total_money:,} so‘m</b>
"""
    )


# =========================================================
# ADMIN: PUL KIRITISH
# =========================================================

@bot.message_handler(
    func=lambda message:
    message.text == "💰 Hisobiga pul kiritish"
)
def admin_add_money(message):

    if not is_admin(message.from_user.id):
        return

    msg = bot.send_message(
        message.chat.id,
        """
💰 <b>Hisobiga pul kiritish</b>

Foydalanuvchi Telegram ID sini kiriting:
"""
    )

    bot.register_next_step_handler(
        msg,
        admin_money_user
    )


def admin_money_user(message):

    try:
        user_id = int(message.text)
    except:

        bot.send_message(
            message.chat.id,
            "❌ ID noto‘g‘ri."
        )

        return

    user = get_user(user_id)

    if not user:

        bot.send_message(
            message.chat.id,
            "❌ Bunday foydalanuvchi topilmadi."
        )

        return

    msg = bot.send_message(
        message.chat.id,
        f"""
👤 Foydalanuvchi:
<code>{user_id}</code>

💵 Qancha pul kiritilsin?
"""
    )

    bot.register_next_step_handler(
        msg,
        admin_money_amount,
        user_id
    )


def admin_money_amount(message, user_id):

    try:

        amount = int(
            message.text.replace(" ", "").replace(",", "")
        )

    except:

        bot.send_message(
            message.chat.id,
            "❌ Summa noto‘g‘ri."
        )

        return

    change_balance(
        user_id,
        amount
    )

    balance = get_balance(user_id)

    bot.send_message(
        message.chat.id,
        f"""
✅ Hisob to‘ldirildi.

👤 User ID: <code>{user_id}</code>

💰 Qo‘shildi:
<b>+{amount:,} so‘m</b>

💵 Yangi balans:
<b>{balance:,} so‘m</b>
"""
    )

    try:

        bot.send_message(
            user_id,
            f"""
💰 <b>Hisobingiz admin tomonidan to‘ldirildi.</b>

➕ Qo‘shildi: <b>{amount:,} so‘m</b>

💵 Yangi balans: <b>{balance:,} so‘m</b>
"""
        )

    except:
        pass


# =========================================================
# ADMIN: BONUS
# =========================================================

@bot.message_handler(
    func=lambda message:
    message.text == "🎁 Bonus berish"
)
def admin_bonus(message):

    if not is_admin(message.from_user.id):
        return

    msg = bot.send_message(
        message.chat.id,
        """
🎁 <b>Bonus berish</b>

Foydalanuvchi Telegram ID sini kiriting:
"""
    )

    bot.register_next_step_handler(
        msg,
        admin_bonus_user
    )


def admin_bonus_user(message):

    try:

        user_id = int(message.text)

    except:

        bot.send_message(
            message.chat.id,
            "❌ ID noto‘g‘ri."
        )

        return

    user = get_user(user_id)

    if not user:

        bot.send_message(
            message.chat.id,
            "❌ Foydalanuvchi topilmadi."
        )

        return

    msg = bot.send_message(
        message.chat.id,
        """
🎁 Bonus summasini kiriting:

Masalan:
500
1000
5000
"""
    )

    bot.register_next_step_handler(
        msg,
        admin_bonus_amount,
        user_id
    )


def admin_bonus_amount(message, user_id):

    try:

        amount = int(
            message.text.replace(" ", "").replace(",", "")
        )

    except:

        bot.send_message(
            message.chat.id,
            "❌ Summa noto‘g‘ri."
        )

        return

    if amount <= 0:

        bot.send_message(
            message.chat.id,
            "❌ Bonus 0 dan katta bo‘lishi kerak."
        )

        return

    change_balance(
        user_id,
        amount
    )

    balance = get_balance(user_id)

    bot.send_message(
        message.chat.id,
        f"""
🎁 <b>Bonus berildi!</b>

👤 User ID:
<code>{user_id}</code>

➕ Bonus:
<b>{amount:,} so‘m</b>

💰 Yangi balans:
<b>{balance:,} so‘m</b>
"""
    )

    try:

        bot.send_message(
            user_id,
            f"""
🎁 <b>Sizga bonus berildi!</b>

➕ Bonus:
<b>{amount:,} so‘m</b>

💰 Yangi balans:
<b>{balance:,} so‘m</b>
"""
        )

    except:
        pass


# =========================================================
# ADMIN: TELEFON
# =========================================================

@bot.message_handler(
    func=lambda message:
    message.text == "📞 Telefon raqamini ko‘rish"
)
def admin_phone(message):

    if not is_admin(message.from_user.id):
        return

    msg = bot.send_message(
        message.chat.id,
        """
📞 Foydalanuvchi Telegram ID sini kiriting:
"""
    )

    bot.register_next_step_handler(
        msg,
        admin_phone_user
    )


def admin_phone_user(message):

    try:

        user_id = int(message.text)

    except:

        bot.send_message(
            message.chat.id,
            "❌ ID noto‘g‘ri."
        )

        return

    user = get_user(user_id)

    if not user:

        bot.send_message(
            message.chat.id,
            "❌ Foydalanuvchi topilmadi."
        )

        return

    phone = user[3] or "Kiritilmagan"

    bot.send_message(
        message.chat.id,
        f"""
📞 <b>Foydalanuvchi ma’lumoti</b>

🆔 ID:
<code>{user_id}</code>

👤 Ism:
<b>{user[2]}</b>

🔹 Username:
@{user[1] if user[1] else "yo‘q"}

📞 Telefon:
<b>{phone}</b>

💰 Balans:
<b>{user[4]:,} so‘m</b>
"""
    )


# =========================================================
# ADMIN: TO‘LOVLAR
# =========================================================

@bot.message_handler(
    func=lambda message:
    message.text == "💳 To‘lovlar"
)
def admin_payments(message):

    if not is_admin(message.from_user.id):
        return

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, user_id, amount, status, created_at
        FROM payments
        ORDER BY id DESC
        LIMIT 20
    """)

    payments = cur.fetchall()

    conn.close()

    if not payments:

        bot.send_message(
            message.chat.id,
            "💳 Hozircha to‘lovlar yo‘q."
        )

        return

    text = "💳 <b>OXIRGI TO‘LOVLAR</b>\n\n"

    for payment in payments:

        payment_id, user_id, amount, status, created = payment

        if status == "approved":
            status_text = "✅"
        elif status == "rejected":
            status_text = "❌"
        else:
            status_text = "⏳"

        text += (
            f"{status_text} ID: <b>{payment_id}</b> | "
            f"User: <code>{user_id}</code> | "
            f"<b>{amount:,}</b> so‘m\n"
        )

    bot.send_message(
        message.chat.id,
        text
    )


# =========================================================
# ADMIN: BLOCK
# =========================================================

@bot.message_handler(
    func=lambda message:
    message.text == "🚫 Bloklash"
)
def admin_block(message):

    if not is_admin(message.from_user.id):
        return

    msg = bot.send_message(
        message.chat.id,
        "🚫 Bloklanadigan foydalanuvchi ID sini kiriting:"
    )

    bot.register_next_step_handler(
        msg,
        block_user
    )


def block_user(message):

    try:
        user_id = int(message.text)
    except:
        bot.send_message(
            message.chat.id,
            "❌ ID noto‘g‘ri."
        )
        return

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        UPDATE users
        SET blocked = 1
        WHERE user_id = ?
    """, (user_id,))

    conn.commit()
    conn.close()

    bot.send_message(
        message.chat.id,
        f"🚫 <code>{user_id}</code> bloklandi."
    )


# =========================================================
# ADMIN: UNBLOCK
# =========================================================

@bot.message_handler(
    func=lambda message:
    message.text == "✅ Blokdan chiqarish"
)
def admin_unblock(message):

    if not is_admin(message.from_user.id):
        return

    msg = bot.send_message(
        message.chat.id,
        "✅ Foydalanuvchi ID sini kiriting:"
    )

    bot.register_next_step_handler(
        msg,
        unblock_user
    )


def unblock_user(message):

    try:
        user_id = int(message.text)
    except:
        bot.send_message(
            message.chat.id,
            "❌ ID noto‘g‘ri."
        )
        return

    conn = db_connect()
    cur = conn.cursor()

    cur.execute("""
        UPDATE users
        SET blocked = 0
        WHERE user_id = ?
    """, (user_id,))

    conn.commit()
    conn.close()

    bot.send_message(
        message.chat.id,
        f"✅ <code>{user_id}</code> blokdan chiqarildi."
    )


# =========================================================
# UNKNOWN MESSAGE
# =========================================================

@bot.message_handler(
    func=lambda message: True,
    content_types=["text"]
)
def unknown(message):

    add_user(message.from_user)

    if is_blocked(message.from_user.id):

        bot.send_message(
            message.chat.id,
            "🚫 Siz bloklangansiz."
        )

        return

    if is_admin(message.from_user.id):

        bot.send_message(
            message.chat.id,
            "Menyudan kerakli bo‘limni tanlang 👇",
            reply_markup=admin_menu()
        )

    else:

        bot.send_message(
            message.chat.id,
            "Menyudan kerakli bo‘limni tanlang 👇",
            reply_markup=main_menu()
        )


# =========================================================
# START BOT
# =========================================================

print("===================================")
print("       QR CODE BOT ISHLAMOQDA      ")
print("===================================")

bot.infinity_polling(
    skip_pending=True,
    timeout=60,
    long_polling_timeout=60
)
