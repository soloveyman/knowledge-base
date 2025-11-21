# Исправление ошибки 500 при использовании Google Drive

## Проблема

При попытке использовать Google Drive Import появляется ошибка:
```
500. That's an error.
There was an error. Please try again later.
```

## Возможные причины

### 1. GOOGLE_CLIENT_ID не установлен в Vercel

**Проверка:**
1. Откройте Vercel Dashboard: https://vercel.com/dashboard
2. Выберите проект
3. Перейдите: **Settings** → **Environment Variables**
4. Проверьте наличие `GOOGLE_CLIENT_ID`

**Решение:**
1. Если переменной нет - добавьте:
   - **Name:** `GOOGLE_CLIENT_ID`
   - **Value:** ваш Client ID из Google Cloud Console
   - **Environment:** Production, Preview, Development
2. Пересоберите проект (Redeploy)

### 2. Проблема с загрузкой конфигурации

**Проверка:**
1. Откройте консоль браузера (F12)
2. Перейдите на страницу `/docs/import`
3. Нажмите "Import from Google Drive"
4. Проверьте ошибки в консоли

**Решение:**
- Проверьте, что `/api/google-drive/config` возвращает данные
- Откройте: `https://uppstaff.net/api/google-drive/config` (должен вернуть JSON с `clientId`)

### 3. Проблема с загрузкой файла из Google Drive

**Проверка:**
1. Откройте консоль браузера (F12)
2. Перейдите на вкладку **Network**
3. Попробуйте импортировать файл
4. Найдите запрос к `www.googleapis.com/drive/v3/files/...`
5. Проверьте статус ответа

**Решение:**
- Если статус 401/403 - проблема с токеном доступа
- Если статус 404 - файл не найден
- Если статус 500 - проблема на стороне Google API

### 4. Проблема с парсингом файла

**Проверка:**
1. Проверьте логи Vercel:
   - Vercel Dashboard → Project → **Deployments** → выберите последний deployment → **Functions** → найдите `/api/documents`
2. Проверьте ошибки в логах

**Решение:**
- Убедитесь, что файл не поврежден
- Проверьте размер файла (максимум 20MB)
- Попробуйте другой файл

## Пошаговая диагностика

### Шаг 1: Проверить переменные окружения в Vercel

1. Vercel Dashboard → Project → **Settings** → **Environment Variables**
2. Убедитесь, что есть:
   - `GOOGLE_CLIENT_ID` ✅
   - `GOOGLE_CLIENT_SECRET` ✅ (для OAuth входа)
   - `NEXT_PUBLIC_GOOGLE_API_KEY` (опционально)

### Шаг 2: Проверить API endpoint

Откройте в браузере (должен быть авторизован):
```
https://uppstaff.net/api/google-drive/config
```

Должен вернуть:
```json
{
  "clientId": "ваш-client-id.apps.googleusercontent.com",
  "apiKey": "ваш-api-key" или null
}
```

Если возвращает ошибку 500:
- Проверьте, что `GOOGLE_CLIENT_ID` установлен в Vercel
- Пересоберите проект

### Шаг 3: Проверить консоль браузера

1. Откройте `/docs/import`
2. Откройте консоль (F12)
3. Нажмите "Import from Google Drive"
4. Проверьте ошибки

Ожидаемые логи:
- `[Google Drive] Processing file: ...`
- `[Google Drive] Downloading file from Drive API...`
- `[Google Drive] File downloaded: ...`

Если видите ошибку:
- Скопируйте полный текст ошибки
- Проверьте, на каком этапе происходит ошибка

### Шаг 4: Проверить логи Vercel

1. Vercel Dashboard → Project → **Deployments**
2. Выберите последний deployment
3. Перейдите на вкладку **Functions**
4. Найдите функцию `/api/documents` или `/api/google-drive/config`
5. Проверьте логи на наличие ошибок

## Быстрое решение

### Если ошибка при открытии Picker:

1. Проверьте `GOOGLE_CLIENT_ID` в Vercel
2. Пересоберите проект
3. Очистите кэш браузера
4. Попробуйте снова

### Если ошибка при загрузке файла:

1. Проверьте, что файл доступен в Google Drive
2. Проверьте, что вы авторизованы с правильным аккаунтом
3. Попробуйте другой файл
4. Проверьте размер файла (максимум 100MB)

### Если ошибка при сохранении документа:

1. Проверьте логи Vercel для `/api/documents`
2. Проверьте размер текстового содержимого (максимум 4.5MB для Vercel)
3. Убедитесь, что база данных доступна

## Проверка конфигурации OAuth

1. Откройте: https://console.cloud.google.com/apis/credentials
2. Найдите ваш OAuth 2.0 Client ID
3. Проверьте:
   - **Authorized JavaScript origins:** `https://uppstaff.net`
   - **Authorized redirect URIs:** `https://uppstaff.net/api/auth/callback/google`
4. Убедитесь, что приложение опубликовано (статус "In production")

## Дополнительная диагностика

Если проблема сохраняется:

1. **Проверьте Network tab в браузере:**
   - Какие запросы возвращают 500?
   - Какие заголовки отправляются?
   - Какое тело запроса?

2. **Проверьте логи Vercel:**
   - Есть ли stack trace?
   - Какая именно ошибка?

3. **Проверьте переменные окружения:**
   - Все ли переменные установлены?
   - Правильные ли значения?

## Связь с другими проблемами

Если вы недавно:
- Изменили переменные окружения → пересоберите проект
- Опубликовали приложение → подождите 5-10 минут
- Изменили OAuth настройки → подождите 5-10 минут

## Ссылки

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)

