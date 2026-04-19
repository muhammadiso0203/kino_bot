# 🎬 Kino Bot — Telegram Bot

NestJS + Telegraf.js + PostgreSQL + TypeORM asosida qurilgan Telegram Kino Bot.

## 📦 Texnologiyalar

| Texnologiya | Vazifasi |
|---|---|
| **NestJS** | Backend framework |
| **Telegraf.js** | Telegram Bot API |
| **nestjs-telegraf** | NestJS + Telegraf integratsiyasi |
| **TypeORM** | ORM (Object Relational Mapping) |
| **PostgreSQL** | Ma'lumotlar bazasi |
| **TypeScript** | Dasturlash tili |

---

## 🚀 O'rnatish va Ishga tushirish

### 1-qadam: PostgreSQL bazasini yaratish

```sql
CREATE DATABASE kinodb;
```

### 2-qadam: `.env` faylini sozlash

```bash
cp .env.example .env
```

`.env` faylini oching va ma'lumotlarni to'ldiring:

```env
# Telegram Bot Token (t.me/BotFather dan oling)
BOT_TOKEN=xxxxxxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Super Admin Telegram ID lari (vergul bilan ajrating)
ADMIN_IDS=123456789,987654321

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=kinodb

NODE_ENV=development
```

> **Super Admin ID ni qanday topish mumkin?** — @userinfobot botiga xabar yuboring.

### 3-qadam: Paketlarni o'rnatish

```bash
npm install
```

### 4-qadam: Ishga tushirish

**Development (tavsiya etiladi):**
```bash
npm run start:dev
```

**Production:**
```bash
npm run start:prod
```

---

## 🏗️ Loyiha Tuzilmasi

```
src/
├── main.ts                    # Kirish nuqtasi
├── app.module.ts              # Root modul
├── entities/                  # TypeORM Entity'lar
│   ├── user.entity.ts         # Foydalanuvchilar jadvali
│   ├── movie.entity.ts        # Kinolar jadvali
│   ├── admin.entity.ts        # Adminlar jadvali
│   └── channel.entity.ts      # Majburiy kanallar jadvali
├── bot/                       # Bot logikasi
│   ├── bot.module.ts
│   ├── bot.service.ts         # Broadcast, obuna tekshiruvi
│   ├── bot.update.ts          # Barcha handler'lar
│   └── keyboards/
│       └── admin.keyboard.ts  # Inline keyboard'lar
└── modules/                   # Biznes logika modullari
    ├── users/
    ├── movies/
    ├── admins/
    └── channels/
```

---

## ⚙️ Funksiyalar

### 👤 Foydalanuvchi qismi

| Funksiya | Tavsif |
|---|---|
| `/start` | Botni ishga tushirish |
| Kino kodi yuborish | Bot videoni qaytaradi |
| Majburiy obuna | Kanal(lar)ga obuna bo'lmasa, kirish bloklanadi |

### 🎛️ Admin Panel (`/admin`)

**🎬 Kinolar:**
- ➕ Kino qo'shish (kod, nom, video, tavsif)
- 🗑️ Kino o'chirish (kod orqali)
- 📋 Barcha kinolar ro'yxati (ko'rishlar soni bilan)

**📢 Kanallar:**
- ➕ Kanal qo'shish (ommaviy / maxfiy / so'rovli)
- 🗑️ Kanal o'chirish
- 📋 Kanallar ro'yxati

**📨 Broadcast:**
- Barcha botdan foydalangan foydalanuvchilarga xabar yuborish
- HTML formatlash qo'llab-quvvatlanadi

**📊 Statistika:**
- Jami foydalanuvchilar soni
- Faol foydalanuvchilar (so'nggi 7 kun)
- Jami kinolar soni
- Top 5 ko'rilgan kinolar

**👑 Adminlar:**
- ➕ Admin qo'shish (faqat super adminlar)
- 🗑️ Admin o'chirish (faqat super adminlar)
- 📋 Adminlar ro'yxati

---

## 🔑 Admin Turlari

| Tur | Vazifasi |
|---|---|
| **Super Admin** | `.env` fayldagi `ADMIN_IDS` da ro'yxatga olingan. Admin qo'sha/o'chira oladi. |
| **Oddiy Admin** | Super admin tomonidan qo'shilgan. Barcha boshqa funksiyalarga kirish huquqi bor. |

---

## 🗄️ Database Jadvallari

### `users` — Foydalanuvchilar
| Ustun | Tip | Tavsif |
|---|---|---|
| id | int PK | |
| telegram_id | bigint unique | Telegram ID |
| username | varchar | @username |
| first_name | varchar | Ism |
| last_name | varchar | Familiya |
| is_blocked | boolean | Bot bloklagan |
| created_at | timestamp | Ro'yxatdan o'tgan vaqt |
| last_active_at | timestamp | Oxirgi faollik |

### `movies` — Kinolar
| Ustun | Tip | Tavsif |
|---|---|---|
| id | int PK | |
| code | varchar unique | Kino kodi |
| name | varchar | Kino nomi |
| file_id | varchar | Telegram file_id |
| description | text | Tavsif (ixtiyoriy) |
| view_count | int | Ko'rishlar soni |
| created_at | timestamp | |

### `admins` — Adminlar
| Ustun | Tip | Tavsif |
|---|---|---|
| id | int PK | |
| telegram_id | bigint unique | Telegram ID |
| username | varchar | @username |
| added_by | bigint | Kim qo'shgani |
| is_super | boolean | Super admin |
| created_at | timestamp | |

### `channels` — Majburiy Kanallar
| Ustun | Tip | Tavsif |
|---|---|---|
| id | int PK | |
| channel_id | varchar unique | Telegram kanal ID |
| title | varchar | Kanal nomi |
| username | varchar | @username (ommaviy) |
| type | enum | public/private/request |
| invite_link | varchar | Taklif havolasi |
| created_at | timestamp | |

---

## 📝 Kanal qo'shish bo'yicha yo'riqnoma

1. Botni kanalga **admin** qiling (`Post Messages` va `Add Members` huquqlari bilan)
2. `/admin` → 📢 Kanallar → ➕ Kanal qo'shish
3. Kanal turini tanlang
4. Kanal ID yoki username kiriting:
   - Ommaviy kanal: `@kanalname`
   - Maxfiy kanal: `-1001234567890` (ID)

---

## 💡 Maslahatlar

- **Kino kodi** — har qanday matn bo'lishi mumkin (1234, movie1, avengers)
- **Video** — Telegram'ning o'z serveriga yuklanadi, `file_id` saqlanadi
- **Broadcast** — ko'p foydalanuvchilarda sekin ishlaydi (rate limit sababli)
- **Production** — `synchronize: false` qilib migration ishlatish tavsiya etiladi
