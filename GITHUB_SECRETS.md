# Переменные окружения для GitHub

## Какие переменные нужно скрыть

Все переменные с секретами, паролями, API ключами и токенами **НИКОГДА** не должны попадать в Git. Используйте `.env.local` для локальной разработки и переменные окружения на хостинге (Railway, Vercel и т.д.).

### ✅ Уже настроено в `.gitignore`

Следующие файлы автоматически игнорируются Git:
- `.env`
- `.env.local`
- `.env.development.local`
- `.env.test.local`
- `.env.production.local`
- `.env*.local`

## Список переменных, которые нужно скрыть

### 🔴 Критически важные (обязательно скрыть)

#### База данных
- `DATABASE_URL` - строка подключения к PostgreSQL (содержит пароль)
  ```
  DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/database"
  ```

#### NextAuth
- `NEXTAUTH_SECRET` - секретный ключ для шифрования сессий
  ```
  NEXTAUTH_SECRET="your-random-secret-key-here"
  ```
  **Как сгенерировать:** `openssl rand -base64 32`

#### Stripe (платежи)
- `STRIPE_SECRET_KEY` - секретный ключ API (начинается с `sk_test_` или `sk_live_`)
- `STRIPE_WEBHOOK_SECRET` - секрет для верификации webhook (начинается с `whsec_`)
- `STRIPE_PUBLISHABLE_KEY` - публичный ключ (можно оставить, но лучше скрыть)

#### OAuth провайдеры
- `GOOGLE_CLIENT_ID` - ID клиента Google OAuth
- `GOOGLE_CLIENT_SECRET` - секрет Google OAuth
- `GITHUB_CLIENT_ID` - ID клиента GitHub OAuth
- `GITHUB_CLIENT_SECRET` - секрет GitHub OAuth

#### Email (SMTP)
- `SMTP_PASSWORD` - пароль SMTP сервера
- `SMTP_USER` - email/username SMTP (может содержать чувствительную информацию)

### 🟡 Важные (рекомендуется скрыть)

#### AI/ML сервисы
- `GROK_API_KEY` - API ключ Grok
- `OPENAI_API_KEY` - API ключ OpenAI
- `ANTHROPIC_API_KEY` - API ключ Anthropic

#### Хранилище и кэш
- `KV_REST_API_TOKEN` - токен Vercel KV
- `KV_REST_API_READ_ONLY_TOKEN` - read-only токен Vercel KV
- `UPLOADTHING_SECRET` - секрет UploadThing
- `UPLOADTHING_APP_ID` - ID приложения UploadThing

### 🟢 Опциональные (можно оставить, но лучше скрыть)

- `SMTP_HOST` - хост SMTP (обычно не секрет, но лучше скрыть)
- `SMTP_PORT` - порт SMTP
- `SMTP_FROM` - email отправителя
- `DEBUG_DB` - флаг отладки БД

## Как правильно настроить

### 1. Локальная разработка

Создайте файл `.env.local` (он уже в `.gitignore`):

```bash
# Скопируйте env.example
cp env.example .env.local

# Отредактируйте .env.local и замените все значения на реальные
```

**Важно:** Никогда не коммитьте `.env.local` в Git!

### 2. Проверка перед коммитом

Перед каждым коммитом проверьте:

```bash
# Проверьте, что .env.local не отслеживается
git status

# Если видите .env.local в списке изменений - НЕ КОММИТЬТЕ!
# Удалите из индекса: git reset HEAD .env.local
```

### 3. Хостинг (Railway, Vercel)

#### Railway
1. Откройте Railway Dashboard → Ваш проект → Ваш сервис
2. Перейдите на вкладку **Variables**
3. Добавьте все переменные как **Runtime Variables** (не build-time!)
4. Убедитесь, что секреты не в разделе Build

#### Vercel
1. Откройте Vercel Dashboard → Ваш проект → Settings → Environment Variables
2. Добавьте переменные для нужных окружений (Production, Preview, Development)
3. Используйте **Encrypted** значения

### 4. Использование env.example

Файл `env.example` должен содержать **только примеры** без реальных значений:

```env
# ✅ Правильно
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base"
NEXTAUTH_SECRET="your-secret-key-here"
STRIPE_SECRET_KEY="sk_test_..."

# ❌ НЕПРАВИЛЬНО (реальные значения)
DATABASE_URL="postgresql://postgres:REAL_PASSWORD@real-host:5432/real_db"
NEXTAUTH_SECRET="actual-secret-key-abc123"
STRIPE_SECRET_KEY="sk_live_51AbCdEfGhIjKlMnOpQrStUvWxYz"
```

## Что делать, если секрет уже попал в Git

### Если секрет был закоммичен недавно

1. **Немедленно** измените секрет (сгенерируйте новый ключ/пароль)
2. Удалите секрет из истории Git:

```bash
# Удалить файл из истории
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Или используйте BFG Repo-Cleaner (быстрее)
# https://rtyley.github.io/bfg-repo-cleaner/
```

3. Принудительно отправьте изменения:
```bash
git push origin --force --all
```

4. Уведомите всех, кто клонировал репозиторий, что нужно переклонировать

### Если секрет в публичном репозитории

1. **Немедленно** измените все затронутые секреты
2. Проверьте, не использовал ли кто-то ваш секрет
3. Очистите историю Git (см. выше)
4. Рассмотрите возможность создания нового репозитория

## Проверка безопасности

### Автоматическая проверка

Используйте инструменты для проверки утечек секретов:

```bash
# Установите git-secrets (GitHub)
git secrets --install

# Или используйте truffleHog
pip install truffleHog
trufflehog --regex --entropy=False .

# Или используйте GitHub Secret Scanning (автоматически для публичных репозиториев)
```

### Ручная проверка

Перед коммитом проверьте:

```bash
# Проверьте, что нет .env файлов в индексе
git ls-files | grep -E "\.env$|\.env\.local$"

# Проверьте содержимое коммита
git diff --cached | grep -E "PASSWORD|SECRET|KEY|TOKEN"

# Проверьте историю на наличие секретов
git log -p | grep -E "PASSWORD|SECRET|KEY|TOKEN"
```

## Чеклист перед коммитом

- [ ] `.env.local` не отслеживается Git (`git status` не показывает его)
- [ ] В коде нет хардкодных секретов (только `process.env.VARIABLE_NAME`)
- [ ] `env.example` содержит только примеры, не реальные значения
- [ ] Все секреты добавлены в переменные окружения на хостинге
- [ ] Проверен `git diff` перед коммитом на наличие секретов

## Дополнительные рекомендации

1. **Используйте разные секреты** для development, staging и production
2. **Регулярно ротируйте** секреты (особенно после утечек)
3. **Ограничьте доступ** к переменным окружения на хостинге
4. **Используйте менеджеры секретов** (HashiCorp Vault, AWS Secrets Manager) для production
5. **Не логируйте** значения переменных окружения в консоль/логи

## Полезные команды

```bash
# Генерация случайного секрета для NEXTAUTH_SECRET
openssl rand -base64 32

# Проверка, что .env.local в .gitignore
git check-ignore -v .env.local

# Просмотр всех переменных окружения (только для локальной разработки!)
cat .env.local

# Проверка переменных на хостинге (Railway)
railway variables

# Проверка переменных на хостинге (Vercel)
vercel env ls
```

