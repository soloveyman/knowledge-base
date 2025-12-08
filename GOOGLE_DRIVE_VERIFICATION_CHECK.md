# Проверка верификации Google для Drive

## Быстрая проверка через API

Создан endpoint для автоматической проверки конфигурации:

```bash
# Локально (требует авторизации)
curl http://localhost:3000/api/google-drive/verify

# На продакшене
curl https://uppstaff.net/api/google-drive/verify
```

Endpoint возвращает детальную информацию о:
- ✅ Наличии переменных окружения (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- ✅ Формате Client ID
- ✅ Наличии файла верификации домена
- ✅ Рекомендациях по настройке OAuth

## Ручная проверка

### 1. Проверка файла верификации

Файл верификации должен быть доступен по URL:
- **Локально**: `http://localhost:3000/googleeb35ed23b363bad2.html`
- **Продакшен**: `https://uppstaff.net/googleeb35ed23b363bad2.html`

**Текущий файл**: `public/googleeb35ed23b363bad2.html`

Проверьте доступность:
```bash
# Локально
curl http://localhost:3000/googleeb35ed23b363bad2.html

# Продакшен
curl https://uppstaff.net/googleeb35ed23b363bad2.html
```

### 2. Проверка переменных окружения

**Локально** (`.env.local`):
```bash
GOOGLE_CLIENT_ID="ваш-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="ваш-client-secret"
NEXT_PUBLIC_GOOGLE_API_KEY="ваш-api-key" # опционально
```

**Продакшен** (Vercel):
1. Откройте: https://vercel.com/dashboard
2. Выберите проект → Settings → Environment Variables
3. Проверьте наличие:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXT_PUBLIC_GOOGLE_API_KEY` (опционально)

### 3. Проверка Google Cloud Console

#### OAuth Consent Screen
Перейти: https://console.cloud.google.com/apis/credentials/consent

Проверить:
- ✅ Scope `https://www.googleapis.com/auth/drive.file` добавлен
- ✅ Authorized domains содержит `uppstaff.net` (для продакшена)

#### OAuth 2.0 Client ID
Перейти: https://console.cloud.google.com/apis/credentials

Проверить:
- ✅ **Authorized JavaScript origins** содержит:
  - `http://localhost:3000` (для разработки)
  - `https://uppstaff.net` (для продакшена)
  
- ✅ **Authorized redirect URIs** содержит:
  - `http://localhost:3000/api/auth/callback/google` (для разработки)
  - `https://uppstaff.net/api/auth/callback/google` (для продакшена)

#### Включенные API
Перейти: https://console.cloud.google.com/apis/library

Проверить, что включены:
- ✅ Google Picker API
- ✅ Google Drive API (рекомендуется)

### 4. Проверка Google Search Console

Для верификации домена:
1. Перейти: https://search.google.com/search-console
2. Добавить свойство (домен): `uppstaff.net`
3. Выбрать метод верификации: HTML файл
4. Загрузить файл `googleeb35ed23b363bad2.html` в папку `public/`
5. Проверить доступность файла по URL
6. Нажать "Verify" в Google Search Console

## Статусы проверки

### ✅ OK
Все настройки корректны, Google Drive должен работать.

### ⚠️ WARNING
Есть незначительные проблемы (например, отсутствует API key или файл верификации), но основная функциональность должна работать.

### ❌ ERROR
Критические проблемы (отсутствует GOOGLE_CLIENT_ID или неверный формат), Google Drive не будет работать.

## Частые проблемы

### "GOOGLE_CLIENT_ID не установлен"
**Решение**: Добавьте переменную окружения в `.env.local` (локально) или Vercel (продакшен)

### "Файл верификации не найден"
**Решение**: 
1. Убедитесь, что файл `googleeb35ed23b363bad2.html` находится в папке `public/`
2. Перезапустите dev server или пересоберите проект на Vercel

### "GOOGLE_CLIENT_ID имеет неверный формат"
**Решение**: Client ID должен заканчиваться на `.apps.googleusercontent.com`

### "redirect_uri_mismatch"
**Решение**: 
1. Проверьте точное совпадение redirect URI в Google Console и в коде
2. Убедитесь, что добавлены оба URI (localhost и продакшен)
3. Подождите 5-10 минут после изменения настроек

## Тестирование

После проверки конфигурации:

1. Откройте страницу импорта: `/docs/import`
2. Нажмите "Import from Google Drive"
3. Войдите в Google аккаунт
4. Выберите файл из Google Drive
5. Файл должен автоматически загрузиться

## Ссылки

- [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
- [Google Cloud Console - OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [Google Search Console](https://search.google.com/search-console)
- [API Verification Endpoint](/api/google-drive/verify)

