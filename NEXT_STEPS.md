# Следующие шаги после включения API

## ✅ Выполнено:
- [x] Google Picker API включен
- [x] Google Drive API включен

## 📋 Что делать дальше:

### Шаг 1: Добавить scope в OAuth Consent Screen

1. Перейти: https://console.cloud.google.com/apis/credentials/consent

2. Если OAuth Consent Screen еще не настроен:
   - Нажать **"CREATE"** или **"CONFIGURE CONSENT SCREEN"**
   - Выбрать **"External"** (для тестирования)
   - Заполнить обязательные поля:
     - App name: `Knowledge Base` (или ваше название)
     - User support email: ваш email
     - Developer contact information: ваш email
   - Нажать **"Save and Continue"**

3. Добавить scope для Google Drive:
   - На странице OAuth Consent Screen нажать **"EDIT APP"** (или перейти к Step 2 - Scopes)
   - Найти раздел **"Scopes"** или нажать **"ADD OR REMOVE SCOPES"**
   - В поиске ввести: `drive.file`
   - Отметить: `https://www.googleapis.com/auth/drive.file`
   - Нажать **"UPDATE"** или **"SAVE"**
   - Нажать **"SAVE AND CONTINUE"**

4. Если приложение в статусе "Testing":
   - Перейти к **"Test users"**
   - Нажать **"ADD USERS"**
   - Добавить свой email (и email других тестировщиков)
   - Нажать **"ADD"**

### Шаг 2: Проверить/Создать OAuth Client ID

1. Перейти: https://console.cloud.google.com/apis/credentials

2. **Если OAuth Client ID уже есть:**
   - Найти OAuth 2.0 Client ID (тип: Web application)
   - Нажать на него для редактирования
   - Проверить **Authorized JavaScript origins**:
     - Должен быть: `http://localhost:3000`
     - Если нет - добавить
   - Проверить **Authorized redirect URIs**:
     - Должен быть: `http://localhost:3000/api/auth/callback/google`
     - Если нет - добавить
   - Нажать **"SAVE"**

3. **Если OAuth Client ID нет:**
   - Нажать **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
   - Application type: **"Web application"**
   - Name: `Knowledge Base Web Client`
   - Authorized JavaScript origins: добавить `http://localhost:3000`
   - Authorized redirect URIs: добавить `http://localhost:3000/api/auth/callback/google`
   - Нажать **"CREATE"**
   - ⚠️ **ВАЖНО**: Скопировать **Client ID** и **Client Secret** (Client Secret показывается только один раз!)

### Шаг 3: Настроить переменные окружения

1. Открыть файл `.env.local` в корне проекта (создать, если нет)

2. Добавить:
```bash
GOOGLE_CLIENT_ID="ваш-client-id-здесь.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="ваш-client-secret-здесь"
```

3. Заменить значения на реальные из шага 2

4. Сохранить файл

5. Перезапустить dev server:
```bash
# Остановить (Ctrl+C) и запустить снова
npm run dev
```

### Шаг 4: (Опционально) Создать API Key

Если хотите улучшить производительность Google Picker:

1. Перейти: https://console.cloud.google.com/apis/credentials
2. **"+ CREATE CREDENTIALS"** → **"API key"**
3. Скопировать API key
4. Нажать **"RESTRICT KEY"**
5. Application restrictions: **"HTTP referrers (web sites)"**
6. Website restrictions: добавить `http://localhost:3000/*`
7. API restrictions: выбрать **"Restrict key"** → отметить только **"Google Picker API"**
8. Нажать **"SAVE"**
9. Добавить в `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_API_KEY="ваш-api-key-здесь"
```

## 🧪 Проверка

После выполнения всех шагов:

1. Открыть: `http://localhost:3000/docs/import`
2. Нажать кнопку **"Import from Google Drive"**
3. Должно открыться окно авторизации Google
4. После авторизации должен открыться Google Picker

## ❓ Проблемы?

- **"redirect_uri_mismatch"**: Проверить точное совпадение redirect URI
- **"Access blocked"**: Проверить, что scope `drive.file` добавлен и вы в Test users
- **"Google OAuth not configured"**: Проверить `.env.local` и перезапустить dev server

