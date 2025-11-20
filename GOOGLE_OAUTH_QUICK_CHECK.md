# Быстрая проверка существующей Google OAuth конфигурации

Если у вас уже настроен Google OAuth для входа, проверьте следующие пункты:

## ✅ Чеклист для существующей конфигурации

### 1. Проверить включенные API ✅
Перейти: https://console.cloud.google.com/apis/library

- [x] **Google Picker API** - должен быть включен (Enabled) ✅
- [x] **Google Drive API** - рекомендуется включить ✅

**Отлично! API включены. Переходим к следующему шагу.**

### 2. Проверить OAuth Consent Screen ✅
Перейти: https://console.cloud.google.com/apis/credentials/consent

- [x] Проверить, что добавлен scope: `https://www.googleapis.com/auth/drive.readonly` ✅

**Отлично! Scope добавлен.**

### 3. Проверить OAuth Client ID ✅
Перейти: https://console.cloud.google.com/apis/credentials

- [x] Найти существующий OAuth 2.0 Client ID (тип: Web application) ✅
- [x] Client ID и Secret уже настроены ✅

**Важно проверить:**
- [ ] **Authorized JavaScript origins** содержит: `http://localhost:3000`
- [ ] **Authorized redirect URIs** содержит: `http://localhost:3000/api/auth/callback/google`

Если этих URI нет - добавить в настройках OAuth Client ID.

### 4. Проверить переменные окружения ⚠️

Файл `.env.local` должен содержать:

```bash
GOOGLE_CLIENT_ID="ваш-client-id"
GOOGLE_CLIENT_SECRET="ваш-client-secret"
```

**Проверить:**
- [ ] Файл `.env.local` существует в корне проекта
- [ ] `GOOGLE_CLIENT_ID` установлен (значение из Google Cloud Console)
- [ ] `GOOGLE_CLIENT_SECRET` установлен (значение из Google Cloud Console)
- [ ] Значения в кавычках, без лишних пробелов
- [ ] Dev server перезапущен после добавления переменных

**Где взять значения:**
1. Перейти: https://console.cloud.google.com/apis/credentials
2. Найти OAuth 2.0 Client ID
3. Нажать на него
4. Скопировать Client ID и Client Secret

### 5. (Опционально) Создать API Key для Picker

Если хотите улучшить производительность:

1. Перейти: https://console.cloud.google.com/apis/credentials
2. Create Credentials → API key
3. Скопировать API key
4. Ограничить: HTTP referrers + только Google Picker API
5. Добавить в `.env.local`:
   ```bash
   NEXT_PUBLIC_GOOGLE_API_KEY="ваш-api-key"
   ```

## 🔧 Что нужно изменить, если что-то не работает

### Если Picker не открывается:
1. Проверить, что Google Picker API включен
2. Проверить консоль браузера (F12) на ошибки
3. Перезапустить dev server после изменения `.env.local`

### Если ошибка "redirect_uri_mismatch":
1. Проверить точное совпадение redirect URI в Google Console и в коде
2. Для localhost должен быть `http://` (не `https://`)

### Если ошибка "Access blocked":
1. Проверить, что scope `drive.readonly` добавлен в OAuth Consent Screen
2. Если приложение в статусе "Testing" - добавить свой email в Test users

## 📝 Быстрая ссылка на настройки

- **APIs Library**: https://console.cloud.google.com/apis/library
- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent
- **Credentials**: https://console.cloud.google.com/apis/credentials

