# Vercel + Railway: Настройка подключения к базе данных

## Важно: Ограничения приватной сети

**⚠️ Приватная сеть Railway недоступна из Vercel!**

- Приватная сеть Railway работает **только между сервисами внутри одного проекта Railway**
- Vercel находится **вне сети Railway**, поэтому приватное подключение (`postgres.railway.internal`) **не будет работать**
- Подключение из Vercel в Railway **всегда публичное** (через интернет)
- Это нормально и ожидаемо — плата за трафик неизбежна при подключении извне Railway

## Решение: Использовать правильный `DATABASE_URL`

### Шаг 1: Получите `DATABASE_URL` из Railway PostgreSQL сервиса

1. Откройте Railway Dashboard
2. Выберите ваш проект → **PostgreSQL сервис**
3. Перейдите в **Variables**
4. Найдите `DATABASE_URL` или `POSTGRES_URL`
5. **Скопируйте полное значение**

**Формат подключения для Vercel:**

Railway предоставляет разные варианты `DATABASE_URL`:

1. **Приватный (для сервисов внутри Railway):**
   ```
   postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
   ```
   ❌ **НЕ работает из Vercel** — это внутренний домен, недоступен извне Railway

2. **Публичный TCP Proxy (для внешних подключений):**
   ```
   postgresql://postgres:PASSWORD@turntable.proxy.rlwy.net:57698/railway
   ```
   ✅ **Работает из Vercel** — это публичный прокси Railway

3. **Прямой публичный домен (если доступен):**
   ```
   postgresql://postgres:PASSWORD@CONTAINER.railway.app:PORT/railway
   ```
   ✅ **Работает из Vercel** — прямой публичный домен

**Для Vercel используйте:**
- ✅ `DATABASE_PUBLIC_URL` из PostgreSQL сервиса (если есть) — обычно содержит TCP Proxy
- ✅ Или `DATABASE_URL` с доменом `*.proxy.rlwy.net` или `*.railway.app`

### Шаг 2: Настройте переменную в Vercel

1. Откройте Vercel Dashboard
2. Выберите ваш проект → **Settings** → **Environment Variables**
3. Добавьте/обновите переменную:
   - **Key:** `DATABASE_URL`
   - **Value:** Вставьте скопированное значение из Railway PostgreSQL сервиса
   - **Environment:** Выберите все окружения (Production, Preview, Development)

### Шаг 3: Убедитесь, что используется правильная переменная

Ваш код уже использует `DATABASE_URL`:

```12:19:lib/db/index.ts
    // Validate DATABASE_URL only when actually needed
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set');
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Railway-optimized connection pool configuration
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
```

✅ Код уже настроен правильно.

### Шаг 4: Удалите `DATABASE_PUBLIC_URL` (если есть)

Если в Vercel есть переменная `DATABASE_PUBLIC_URL`:
1. Удалите её (она не нужна)
2. Используйте только `DATABASE_URL`

### Шаг 5: Перезапустите деплой

После изменения переменных:
1. Vercel автоматически перезапустит деплой
2. Или вручную: **Deployments** → выберите последний деплой → **Redeploy**

## Ваша ситуация: `proxy.rlwy.net` vs `railway.internal`

**Текущая конфигурация:**

В Vercel:
```
postgresql://postgres:PASSWORD@turntable.proxy.rlwy.net:57698/railway
```
✅ **Это правильно!** `proxy.rlwy.net` — это публичный TCP Proxy Railway, который работает из Vercel.

В Railway:
```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```
❌ **НЕ используйте это в Vercel!** `railway.internal` — это приватный домен, недоступен извне Railway.

## Решение: Используйте правильный URL для Vercel

### Вариант 1: Использовать `DATABASE_PUBLIC_URL` из Railway (Рекомендуется)

1. В Railway PostgreSQL сервисе откройте **Variables**
2. Найдите переменную `DATABASE_PUBLIC_URL`
3. Скопируйте её значение
4. В Vercel установите `DATABASE_URL` = значение `DATABASE_PUBLIC_URL` из Railway

**Формат `DATABASE_PUBLIC_URL`:**
```
postgresql://postgres:PASSWORD@turntable.proxy.rlwy.net:57698/railway
```

### Вариант 2: Оставить текущий `DATABASE_URL` в Vercel

Если ваш текущий `DATABASE_URL` в Vercel уже содержит `proxy.rlwy.net`:
```
postgresql://postgres:PASSWORD@turntable.proxy.rlwy.net:57698/railway
```

✅ **Это уже правильно!** Не нужно ничего менять.

**Важно:** 
- `proxy.rlwy.net` — это публичный прокси Railway, который работает из Vercel
- `railway.internal` — это приватный домен, который **НЕ работает** из Vercel
- Не пытайтесь заменить `proxy` на `internal` — это не сработает

## Проверка подключения

### 1. Проверьте переменные в Vercel

```bash
# Через Vercel CLI (если установлен)
vercel env ls

# Или через Dashboard
# Settings → Environment Variables
```

### 2. Проверьте логи Vercel

1. Откройте **Deployments** → выберите последний деплой → **Logs**
2. Убедитесь, что нет ошибок подключения к базе данных
3. Должны быть сообщения об успешном подключении

### 3. Проверьте подключение через API

Создайте тестовый endpoint:

```typescript
// app/api/test-db/route.ts
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db.execute(sql`SELECT 1 as test`);
    return Response.json({ 
      status: 'connected', 
      result: result.rows[0] 
    });
  } catch (error) {
    return Response.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}
```

Затем проверьте:
```bash
curl https://your-app.vercel.app/api/test-db
```

## Оптимизация подключения

### Connection Pooling

Ваш код уже настроен с пулом подключений:

```17:39:lib/db/index.ts
    // Railway-optimized connection pool configuration
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Railway connection limits:
      // - Hobby: ~20 connections
      // - Pro: ~100 connections
      // - Enterprise: Custom
      max: 10, // Conservative limit for Railway
      idleTimeoutMillis: 30000, // 30 seconds
      connectionTimeoutMillis: 10000, // 10 seconds
      // SSL for production and Railway (Railway uses SSL)
      // Also enable SSL if connection string contains 'railway.app' (connecting to Railway from anywhere)
      ssl:
        process.env.NODE_ENV === 'production' ||
        process.env.DATABASE_URL?.includes('railway.app')
          ? { rejectUnauthorized: false }
          : false,
      // Log connections in development
      ...(process.env.NODE_ENV === 'development' &&
        process.env.DEBUG_DB === 'true' && {
          log: (msg: string) => console.log('[DB Pool]', msg),
        }),
    });
```

✅ Настройки уже оптимизированы для Railway.

### SSL/TLS

Подключение автоматически использует SSL для Railway:

```29:33:lib/db/index.ts
      ssl:
        process.env.NODE_ENV === 'production' ||
        process.env.DATABASE_URL?.includes('railway.app')
          ? { rejectUnauthorized: false }
          : false,
```

✅ SSL уже настроен.

## Сравнение: Railway vs Vercel

| Аспект | Railway (оба сервиса в одном проекте) | Vercel → Railway |
|--------|--------------------------------------|------------------|
| **Приватная сеть** | ✅ Доступна (бесплатно) | ❌ Недоступна |
| **Плата за трафик** | ❌ Нет (приватная сеть) | ✅ Да (публичное подключение) |
| **Производительность** | ✅ Быстрее (внутренняя сеть) | ⚠️ Зависит от расстояния |
| **Настройка** | Проще (автоматически) | Требует публичного `DATABASE_URL` |

## FAQ

**Q: Можно ли использовать приватную сеть Railway из Vercel?**  
A: ❌ Нет. Приватная сеть Railway работает только между сервисами внутри одного проекта Railway. Vercel находится вне этой сети.

**Q: Как минимизировать плату за трафик?**  
A: 
- Используйте connection pooling (уже настроено)
- Оптимизируйте запросы к базе данных
- Используйте кэширование (Vercel Edge Cache, Redis)
- Рассмотрите перенос приложения на Railway для бесплатного приватного подключения

**Q: Можно ли заменить `proxy.rlwy.net` на `railway.internal` в Vercel?**  
A: ❌ Нет! `railway.internal` — это приватный домен, который работает только внутри Railway. Из Vercel он недоступен. Используйте `proxy.rlwy.net` или `DATABASE_PUBLIC_URL` из Railway.

**Q: Что делать, если `DATABASE_URL` содержит `proxy.rlwy.net`?**  
A: ✅ Это правильно! `proxy.rlwy.net` — это публичный TCP Proxy Railway, который работает из Vercel. Оставьте его как есть.

**Q: В чем разница между `DATABASE_URL` и `DATABASE_PUBLIC_URL` в Railway?**  
A: 
- `DATABASE_URL` в Railway обычно содержит `railway.internal` (приватный домен) — для сервисов внутри Railway
- `DATABASE_PUBLIC_URL` содержит `proxy.rlwy.net` (публичный прокси) — для внешних подключений (Vercel, локальная разработка)

**Q: Как проверить, что подключение работает?**  
A: Проверьте логи Vercel после деплоя. Должны быть сообщения об успешном подключении. Или создайте тестовый endpoint (см. выше).

**Q: Нужно ли использовать `DATABASE_PUBLIC_URL` в Vercel?**  
A: ❌ Нет. Используйте только `DATABASE_URL` из PostgreSQL сервиса Railway. `DATABASE_PUBLIC_URL` — это устаревшая переменная.

## Итоговый чеклист

- [ ] Открыл PostgreSQL сервис в Railway
- [ ] Скопировал значение `DATABASE_URL` из PostgreSQL сервиса
- [ ] В Vercel добавил/обновил переменную `DATABASE_URL`
- [ ] Удалил `DATABASE_PUBLIC_URL` из Vercel (если была)
- [ ] Перезапустил деплой в Vercel
- [ ] Проверил логи Vercel на наличие ошибок
- [ ] Проверил подключение через тестовый endpoint

## Дополнительные ресурсы

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Railway PostgreSQL Docs](https://docs.railway.app/databases/postgresql)
- [Railway Private Networking Docs](https://docs.railway.app/develop/private-networking)

## Альтернатива: Перенос на Railway

Если вы хотите избежать платы за трафик и использовать приватную сеть:

1. Перенесите приложение на Railway
2. Оба сервиса (приложение и база данных) будут в одном проекте
3. Используйте приватное подключение (бесплатно)
4. См. гайд: `RAILWAY_PRIVATE_ENDPOINT_SETUP.md`

