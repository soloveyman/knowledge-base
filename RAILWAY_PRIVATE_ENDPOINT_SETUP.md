# Railway: Настройка приватного подключения к базе данных

## Проблема

Если вы видите предупреждение о `DATABASE_PUBLIC_URL`, это значит, что ваше приложение использует **публичную конечную точку** для подключения к базе данных. Это приводит к:
- ❌ Плате за исходящий трафик (egress fees)
- ❌ Медленному подключению (трафик идет через интернет)
- ❌ Дополнительным расходам

## Решение: Переключение на приватную конечную точку

### Шаг 1: Проверьте текущие переменные окружения

В Railway Dashboard:
1. Откройте ваш проект
2. Выберите сервис с приложением (не базу данных)
3. Перейдите в **Variables** (Переменные)
4. Найдите переменную `DATABASE_PUBLIC_URL` или `DATABASE_URL`

### Шаг 2: Получите приватную переменную из PostgreSQL сервиса

**⚠️ ВАЖНО:** Не используйте `RAILWAY_PRIVATE_DOMAIN` из вашего сервиса приложения! Это приватный домен вашего приложения, а не базы данных.

**Правильный способ:**

1. В том же проекте Railway откройте **PostgreSQL сервис** (не сервис приложения!)
2. Перейдите в **Variables**
3. Найдите переменную `DATABASE_URL` или `POSTGRES_URL`
4. **Скопируйте её полное значение** (это полная строка подключения)

**Формат приватного `DATABASE_URL` из PostgreSQL сервиса:**
```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```

или

```
postgresql://postgres:PASSWORD@CONTAINER.railway.app:PORT/railway
```

Где хост уже указывает на приватный домен PostgreSQL сервиса (не вашего приложения!).

**Разница:**
- `RAILWAY_PRIVATE_DOMAIN` в вашем сервисе приложения = приватный домен вашего приложения
- `DATABASE_URL` в PostgreSQL сервисе = полная строка подключения с приватным доменом базы данных

### Шаг 3: Настройте переменную в вашем приложении

#### Вариант A: Использовать стандартную переменную `DATABASE_URL` (Рекомендуется)

1. В сервисе вашего приложения откройте **Variables**
2. Удалите или переименуйте `DATABASE_PUBLIC_URL` (если она есть)
3. Добавьте/обновите переменную `DATABASE_URL`:
   - **Key:** `DATABASE_URL`
   - **Value:** Вставьте скопированное значение из PostgreSQL сервиса

**Формат приватного подключения:**
```
postgresql://postgres:PASSWORD@PRIVATE_HOST:PORT/railway
```

Где `PRIVATE_HOST` — это приватный домен Railway (например, `containers-us-west-123.railway.app`), который использует внутреннюю сеть.

#### Вариант B: Использовать приватные переменные Railway (Автоматически)

Railway автоматически предоставляет приватные переменные для сервисов в одном проекте:

1. В сервисе вашего приложения откройте **Variables**
2. Найдите переменные, начинающиеся с `PG*`:
   - `PGHOST` — приватный хост
   - `PGPORT` — порт
   - `PGUSER` — пользователь
   - `PGPASSWORD` — пароль
   - `PGDATABASE` — имя базы данных

3. Если эти переменные есть, используйте их вместо `DATABASE_URL`:

```typescript
// lib/db/index.ts
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
```

**Но проще всего:** Просто используйте `DATABASE_URL` из PostgreSQL сервиса — Railway автоматически использует приватную сеть для сервисов в одном проекте.

### Шаг 4: Убедитесь, что код использует правильную переменную

Ваш код уже использует `DATABASE_URL` (проверено в `lib/db/index.ts`):

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

✅ Код уже настроен правильно — просто убедитесь, что в Railway используется `DATABASE_URL`, а не `DATABASE_PUBLIC_URL`.

### Шаг 5: Удалите публичную переменную (если есть)

1. В сервисе приложения найдите `DATABASE_PUBLIC_URL`
2. Удалите её (или переименуйте в `DATABASE_URL` и обновите значение)

### Шаг 6: Перезапустите сервис

После изменения переменных:
1. Railway автоматически перезапустит сервис
2. Или вручную: **Settings** → **Restart Service**

## Проверка

### Как проверить, что используется приватное подключение:

1. **Проверьте логи Railway:**
   - Откройте **Deployments** → выберите последний деплой → **Logs**
   - Убедитесь, что нет ошибок подключения

2. **Проверьте переменные:**
   ```bash
   # В Railway CLI
   railway variables
   
   # Должна быть переменная DATABASE_URL (не DATABASE_PUBLIC_URL)
   ```

3. **Проверьте подключение:**
   ```bash
   # Запустите тест подключения
   npx tsx scripts/test-database-connection.ts
   ```

4. **Проверьте предупреждения:**
   - Предупреждение о `DATABASE_PUBLIC_URL` должно исчезнуть

## Когда нужна публичная конечная точка?

Публичная конечная точка (`DATABASE_PUBLIC_URL` или `RAILWAY_TCP_PROXY_DOMAIN`) нужна только если:
- ✅ Подключаетесь **извне Railway** (с локальной машины, другого облачного провайдера)
- ✅ Используете внешние инструменты (pgAdmin, DBeaver, и т.д.)

**Для сервисов внутри одного проекта Railway всегда используйте приватную конечную точку.**

## Структура переменных в Railway

### PostgreSQL сервис (автоматически создает):
- `DATABASE_URL` — приватное подключение (для сервисов в проекте)
- `POSTGRES_URL` — альтернативное имя (может быть публичным)
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` — приватные переменные

### Ваш сервис приложения (нужно настроить):
- `DATABASE_URL` — скопировать из PostgreSQL сервиса (приватное)
- Другие переменные приложения (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, и т.д.)

## Быстрая настройка через Railway CLI

```bash
# Установите Railway CLI (если еще не установлен)
npm i -g @railway/cli

# Войдите в Railway
railway login

# Выберите проект
railway link

# Получите переменные PostgreSQL сервиса
railway variables --service postgres

# Установите DATABASE_URL в вашем сервисе
railway variables set DATABASE_URL="<значение_из_postgres_сервиса>"

# Удалите публичную переменную (если есть)
railway variables unset DATABASE_PUBLIC_URL
```

## Итоговый чеклист

- [ ] Открыл PostgreSQL сервис в Railway
- [ ] Скопировал значение `DATABASE_URL` из PostgreSQL сервиса
- [ ] В сервисе приложения установил/обновил `DATABASE_URL` (приватное значение)
- [ ] Удалил `DATABASE_PUBLIC_URL` (если была)
- [ ] Перезапустил сервис
- [ ] Проверил, что предупреждение исчезло
- [ ] Проверил подключение к базе данных

## Дополнительные ресурсы

- [Railway Private Networking Docs](https://docs.railway.app/develop/private-networking)
- [Railway PostgreSQL Docs](https://docs.railway.app/databases/postgresql)
- [Railway Variables Docs](https://docs.railway.app/develop/variables)

## FAQ

**Q: Можно ли использовать `RAILWAY_PRIVATE_DOMAIN` из моего сервиса приложения?**  
A: ❌ Нет! `RAILWAY_PRIVATE_DOMAIN` в вашем сервисе — это приватный домен вашего приложения, а не базы данных. Нужно использовать полный `DATABASE_URL` из PostgreSQL сервиса, который уже содержит правильный приватный хост базы данных.

**Q: Что если у меня несколько сервисов в проекте?**  
A: Каждый сервис должен использовать `DATABASE_URL` из PostgreSQL сервиса. Railway автоматически использует приватную сеть для всех сервисов в одном проекте.

**Q: Можно ли использовать `DATABASE_PUBLIC_URL` для локальной разработки?**  
A: Да, для локальной разработки можно использовать публичную конечную точку, но это будет взимать плату за трафик. Лучше использовать локальную базу данных для разработки.

**Q: Как узнать, используется ли приватное подключение?**  
A: Приватное подключение обычно содержит:
- Хост вида `postgres.railway.internal` (внутренний домен)
- Или хост вида `CONTAINER.railway.app` (если сервисы в одном проекте, Railway автоматически использует приватную сеть)

Публичные подключения обычно содержат:
- `tcp-proxy` в домене
- Или явно указывают на публичный домен с портом

**Q: Где найти `DATABASE_URL` для PostgreSQL сервиса?**  
A: В Railway Dashboard:
1. Откройте ваш проект
2. Найдите сервис с типом **PostgreSQL** (не ваш сервис приложения!)
3. Откройте его → **Variables**
4. Найдите `DATABASE_URL` или `POSTGRES_URL`
5. Скопируйте полное значение

