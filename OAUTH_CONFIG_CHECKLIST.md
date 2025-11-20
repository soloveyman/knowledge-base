# Чеклист конфигурации OAuth для uppstaff.net

## ✅ Правильные URL

### 1. Redirect URI (для Google Cloud Console)
```
https://uppstaff.net/api/auth/callback/google
```

### 2. NEXTAUTH_URL (для Vercel Environment Variables)
```
https://uppstaff.net
```

## 📋 Чеклист проверки

### Google Cloud Console
- [ ] Открыть: https://console.cloud.google.com/apis/credentials
- [ ] Найти OAuth 2.0 Client ID (тип: Web application)
- [ ] В разделе **"Authorized redirect URIs"** есть:
  - [ ] `https://uppstaff.net/api/auth/callback/google` ✅
  - [ ] `http://localhost:3000/api/auth/callback/google` (для разработки)
- [ ] Нажать **"SAVE"** (если вносили изменения)

### Vercel Environment Variables
- [ ] Открыть: Vercel Dashboard → Project → Settings → Environment Variables
- [ ] Проверить переменную `NEXTAUTH_URL`:
  - [ ] Значение: `https://uppstaff.net` ✅
  - [ ] Без слеша в конце
  - [ ] Установлена для Production environment
- [ ] Если изменили — пересобрать и задеплоить приложение

### Локальная разработка (.env.local)
- [ ] Файл `.env.local` содержит:
  ```env
  NEXTAUTH_URL="http://localhost:3000"
  GOOGLE_CLIENT_ID="ваш-client-id"
  GOOGLE_CLIENT_SECRET="ваш-client-secret"
  ```

## 🔍 Проверка работоспособности

### Production (uppstaff.net)
1. Открыть: https://uppstaff.net/auth/signin
2. Нажать "Войти через Google"
3. Должно перенаправить на Google OAuth
4. После авторизации должно вернуть на `https://uppstaff.net`

### Localhost
1. Открыть: http://localhost:3000/auth/signin
2. Нажать "Войти через Google"
3. Должно перенаправить на Google OAuth
4. После авторизации должно вернуть на `http://localhost:3000`

## ⚠️ Частые ошибки

### ❌ Неправильно:
- `NEXTAUTH_URL="https://uppstaff.net/"` (лишний слеш)
- Redirect URI: `https://uppstaff.net/api/auth/callback/google/` (лишний слеш)
- Redirect URI: `http://uppstaff.net/api/auth/callback/google` (http вместо https)
- `NEXTAUTH_URL` не установлен в Vercel

### ✅ Правильно:
- `NEXTAUTH_URL="https://uppstaff.net"` (без слеша)
- Redirect URI: `https://uppstaff.net/api/auth/callback/google` (без слеша, https)

## 🚨 Если ошибка сохраняется

1. **Проверить логи Vercel:**
   - Vercel Dashboard → Project → Deployments → View Function Logs
   - Искать предупреждения о `NEXTAUTH_URL`

2. **Проверить кэш Google:**
   - Подождать 2-3 минуты после изменения redirect URI
   - Очистить кэш браузера или использовать режим инкогнито

3. **Проверить точное совпадение:**
   - Redirect URI должен совпадать **точно**, включая протокол, домен и путь
   - Никаких лишних пробелов или символов

4. **Проверить переменные окружения:**
   - Убедиться, что `GOOGLE_CLIENT_ID` и `GOOGLE_CLIENT_SECRET` установлены в Vercel
   - Проверить, что они совпадают с теми, что в Google Cloud Console

## 📝 Быстрая ссылка

- **Google Cloud Console (Credentials):** https://console.cloud.google.com/apis/credentials
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Production site:** https://uppstaff.net

