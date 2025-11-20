# Исправление redirect_uri_mismatch для Google Drive

## Проблема

При попытке входа в Google Drive появляется ошибка `Error 400: redirect_uri_mismatch`, хотя с localhost всё работало.

## Причина

Google Drive использует **Google Identity Services** (popup-based OAuth), который требует настройки **двух параметров**:
1. **Authorized JavaScript origins** - откуда загружается JavaScript (уже добавлено ✅)
2. **Authorized redirect URIs** - куда перенаправлять после авторизации (нужно добавить)

## Решение

### Шаг 1: Открыть Google Cloud Console

Перейти: https://console.cloud.google.com/apis/credentials

### Шаг 2: Найти OAuth 2.0 Client ID

1. Найти ваш **OAuth 2.0 Client ID** (тип: Web application)
2. Нажать на него для редактирования

### Шаг 3: Проверить Authorized JavaScript origins

Должно быть:
- ✅ `https://uppstaff.net` (уже добавлено)
- ✅ `http://localhost:3000` (для разработки)

### Шаг 4: Добавить Authorized redirect URIs

В разделе **"Authorized redirect URIs"** должно быть:

**Для production:**
```
https://uppstaff.net/api/auth/callback/google
```

**Для localhost (разработка):**
```
http://localhost:3000/api/auth/callback/google
```

⚠️ **Важно:**
- Используйте `https://` для production (не `http://`)
- Используйте `http://` для localhost (не `https://`)
- Без слеша в конце
- Точный путь: `/api/auth/callback/google`

### Шаг 5: Сохранить

Нажать **"SAVE"** в Google Cloud Console

### Шаг 6: Проверить результат

1. Подождите 2-5 минут (Google кэширует настройки)
2. Очистите кэш браузера или используйте режим инкогнито
3. Попробуйте открыть Google Drive снова на https://uppstaff.net

## Полный список для проверки

В Google Cloud Console в вашем OAuth 2.0 Client ID должно быть:

### Authorized JavaScript origins:
```
https://uppstaff.net
http://localhost:3000
```

### Authorized redirect URIs:
```
https://uppstaff.net/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

## Если ошибка сохраняется

1. **Проверьте точное совпадение:**
   - Redirect URI должен совпадать **точно**, включая протокол и путь
   - Никаких лишних пробелов или символов

2. **Проверьте OAuth Consent Screen:**
   - Откройте: https://console.cloud.google.com/apis/credentials/consent
   - Убедитесь, что добавлен scope: `https://www.googleapis.com/auth/drive.readonly`
   - Если приложение в статусе "Testing", добавьте email `uppstaffknowledge@gmail.com` в Test users

3. **Проверьте переменные окружения в Vercel:**
   - `GOOGLE_CLIENT_ID` должен совпадать с Client ID в Google Cloud Console
   - `NEXTAUTH_URL=https://uppstaff.net` должен быть установлен для Production

4. **Подождите дольше:**
   - Google может кэшировать настройки до 10 минут
   - Попробуйте через 10-15 минут после изменения

## Разница между OAuth для входа и Google Drive

- **OAuth для входа (NextAuth):** использует redirect-based flow → нужен redirect URI
- **Google Drive (Picker):** использует popup-based flow → нужны И origins, И redirect URI (для fallback)

Оба используют один и тот же OAuth Client ID, поэтому настройки должны быть одинаковыми.

