# Исправление ошибки "Error 400: redirect_uri_mismatch"

## Проблема

Google OAuth отклоняет запрос, потому что redirect URI в Google Cloud Console не совпадает с тем, что отправляет NextAuth.

## Решение

### Шаг 1: Проверить текущий redirect URI

NextAuth использует следующий redirect URI:
- **Для localhost**: `http://localhost:3000/api/auth/callback/google`
- **Для production**: `https://yourdomain.com/api/auth/callback/google`

### Шаг 2: Проверить настройки в Google Cloud Console

1. Перейти: https://console.cloud.google.com/apis/credentials
2. Найти ваш **OAuth 2.0 Client ID** (тип: Web application)
3. Нажать на него для редактирования
4. Проверить раздел **"Authorized redirect URIs"**

### Шаг 3: Добавить правильный redirect URI

В разделе **"Authorized redirect URIs"** должно быть:

**Для localhost (разработка):**
```
http://localhost:3000/api/auth/callback/google
```

**Для production (uppstaff.net):**
```
https://uppstaff.net/api/auth/callback/google
```

⚠️ Если у вас есть другие домены (например, www.uppstaff.net), добавьте их тоже.

⚠️ **ВАЖНО:**
- Используйте `http://` (не `https://`) для localhost
- Используйте `https://` для production доменов
- URI должен совпадать **точно**, включая:
  - Протокол (`http://` или `https://`)
  - Домен (`localhost:3000` или ваш домен)
  - Путь (`/api/auth/callback/google`)
  - Отсутствие trailing slash в конце

### Шаг 4: Проверить NEXTAUTH_URL

**Для localhost (разработка):**
В `.env.local` должно быть:
```env
NEXTAUTH_URL="http://localhost:3000"
```

**Для production (Vercel):**
В настройках Vercel (Environment Variables) должно быть:
```env
NEXTAUTH_URL="https://uppstaff.net"
```

⚠️ **Без trailing slash в конце!**

### Шаг 5: Сохранить и перезапустить

1. Нажать **"SAVE"** в Google Cloud Console
2. **Для localhost:** Перезапустить dev server:
   ```bash
   # Остановить (Ctrl+C)
   npm run dev
   ```
3. **Для production:** Пересобрать и задеплоить приложение в Vercel (если изменили NEXTAUTH_URL)

## Проверка

После исправления:

1. Попробуйте войти через Google снова
2. Если ошибка сохраняется:
   - Проверьте, что сохранили изменения в Google Cloud Console
   - Убедитесь, что перезапустили dev server
   - Проверьте консоль браузера (F12) на наличие других ошибок

## Частые ошибки

### ❌ Неправильно:
- `https://localhost:3000/api/auth/callback/google` (https для localhost)
- `http://localhost:3000/api/auth/callback/google/` (trailing slash)
- `http://localhost:3000/auth/callback/google` (неправильный путь)
- `http://127.0.0.1:3000/api/auth/callback/google` (IP вместо localhost)

### ✅ Правильно:
- `http://localhost:3000/api/auth/callback/google` (для localhost)
- `https://uppstaff.net/api/auth/callback/google` (для production)

## Дополнительная информация

- NextAuth автоматически использует путь `/api/auth/callback/[provider]`
- Для Google provider это всегда `/api/auth/callback/google`
- Изменить этот путь нельзя без кастомной конфигурации NextAuth

