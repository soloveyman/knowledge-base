# Super Admin Credentials

## 📋 Учетные данные для входа

```
Email:    superadmin@test.com
Password: admin123
```

## 🚀 Инструкция по созданию Super Admin

### Вариант 1: Через SQL (рекомендуется)

1. Убедись, что база данных запущена:
   ```bash
   npm run docker:up
   ```

2. Выполни SQL скрипт:
   ```bash
   # Если используешь Docker PostgreSQL
   docker exec -i knowledge-base-db psql -U postgres -d knowledge_base < scripts/create-super-admin.sql
   
   # Или подключись через psql и выполни команды из scripts/create-super-admin.sql
   ```

### Вариант 2: Через TypeScript скрипт

1. Убедись, что база данных запущена и DATABASE_URL настроен в .env
2. Запусти скрипт:
   ```bash
   npx tsx scripts/create-super-admin.ts
   ```

### Вариант 3: Через API (если пользователь уже существует)

Если пользователь с email `superadmin@test.com` уже существует, используй:

```sql
UPDATE users 
SET 
  password = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5OZz5L5KK',
  role = 'super-admin',
  name = 'Super Admin'
WHERE email = 'superadmin@test.com';
```

## 🌐 Доступ к страницам

После входа Super Admin будет автоматически перенаправлен на:

**Dashboard:** `http://localhost:3000/super-admin`

**Страница входа:** `http://localhost:3000/auth/signin`

## 📊 Что доступно на странице Super Admin

1. **Статистика подписок:**
   - Total Revenue (общий доход)
   - Active Subscriptions (активные подписки)
   - Churn Rate (отток)
   - New This Month (новые за месяц)

2. **Таблица всех владельцев:**
   - Информация о каждом owner
   - План подписки
   - Статус (active/cancelled/expired)
   - Платежный провайдер (Stripe/Interkassa)
   - Месячный доход

3. **Фильтры:**
   - All Providers
   - Stripe Only
   - Interkassa Only

## 🔐 Пароль (bcrypt hash)

Пароль `admin123` имеет bcrypt hash:
```
$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5OZz5L5KK
```

## ⚠️ Важно

- Убедись, что миграции БД применены (должно быть поле `country` в `users` и таблица `payments`)
- Super Admin доступен только для пользователей с ролью `super-admin`
- Middleware автоматически перенаправляет super-admin на `/super-admin`

