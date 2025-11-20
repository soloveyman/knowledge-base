# Исправление redirect_uri_mismatch для production (uppstaff.net)

## Проблема

Ошибка `Error 400: redirect_uri_mismatch` на https://uppstaff.net означает, что в Google Cloud Console не добавлен правильный production redirect URI.

## Быстрое исправление

### 1. Открыть Google Cloud Console
https://console.cloud.google.com/apis/credentials

### 2. Найти OAuth 2.0 Client ID
- Тип: **Web application**
- Нажать для редактирования

### 3. Добавить production redirect URI

В разделе **"Authorized redirect URIs"** добавить:

```
https://uppstaff.net/api/auth/callback/google
```

⚠️ **Важно:**
- Используйте `https://` (не `http://`)
- Без слеша в конце
- Точный путь: `/api/auth/callback/google`

### 4. Проверить localhost URI (для разработки)

Также должно быть:
```
http://localhost:3000/api/auth/callback/google
```

### 5. Сохранить
Нажать **"SAVE"** в Google Cloud Console

### 6. Проверить NEXTAUTH_URL в Vercel

В настройках Vercel (Environment Variables) должно быть:

```env
NEXTAUTH_URL="https://uppstaff.net"
```

⚠️ Без слеша в конце!

Если изменили NEXTAUTH_URL, нужно пересобрать и задеплоить приложение.

## Проверка

После добавления redirect URI:
1. Подождите 1-2 минуты (Google может кэшировать настройки)
2. Попробуйте войти через Google на https://uppstaff.net
3. Ошибка должна исчезнуть

## Если ошибка сохраняется

1. Проверьте, что сохранили изменения в Google Cloud Console
2. Убедитесь, что `NEXTAUTH_URL="https://uppstaff.net"` установлен в Vercel
3. Проверьте, что нет лишних пробелов или символов в redirect URI
4. Попробуйте очистить кэш браузера или использовать режим инкогнито

## Полный список redirect URIs

В Google Cloud Console должны быть оба:

```
http://localhost:3000/api/auth/callback/google
https://uppstaff.net/api/auth/callback/google
```

