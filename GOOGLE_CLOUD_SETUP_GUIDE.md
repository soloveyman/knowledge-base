# Пошаговая настройка Google Cloud Console для Google Drive Import

## Шаг 1: Вход в Google Cloud Console

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Войдите в свой Google аккаунт (тот же, который будет использоваться для доступа к Drive)

## Шаг 2: Создать или выбрать проект

### Если проекта еще нет:

1. Нажмите на выпадающий список проектов вверху (рядом с логотипом Google Cloud)
2. Нажмите **"New Project"**
3. Заполните:
   - **Project name**: `knowledge-base` (или любое другое имя)
   - **Organization**: оставьте по умолчанию (если есть)
   - **Location**: оставьте по умолчанию
4. Нажмите **"Create"**
5. Дождитесь создания проекта (10-30 секунд)
6. Выберите созданный проект из списка

### Если проект уже есть:

1. Нажмите на выпадающий список проектов вверху
2. Выберите существующий проект

## Шаг 3: Включить необходимые API

1. В левом меню найдите **"APIs & Services"** > **"Library"**
   - Или перейдите по прямой ссылке: https://console.cloud.google.com/apis/library

2. **Включить Google Picker API:**
   - В поиске введите: `Google Picker API`
   - Нажмите на результат
   - Нажмите кнопку **"Enable"** (Включить)
   - Дождитесь активации (5-10 секунд)

3. **Включить Google Drive API (рекомендуется):**
   - Вернитесь в Library (нажмите "← APIs & Services" в хлебных крошках)
   - В поиске введите: `Google Drive API`
   - Нажмите на результат
   - Нажмите кнопку **"Enable"**
   - Дождитесь активации

## Шаг 4: Настроить OAuth Consent Screen

1. В левом меню: **"APIs & Services"** > **"OAuth consent screen"**
   - Или прямая ссылка: https://console.cloud.google.com/apis/credentials/consent

2. **Выбрать тип приложения:**
   - Выберите **"External"** (для тестирования и разработки)
   - Нажмите **"Create"**

3. **Заполнить обязательные поля (Step 1 - App information):**
   - **App name**: `Knowledge Base` (или ваше название)
   - **User support email**: выберите ваш email из списка
   - **App logo**: опционально (можно пропустить)
   - **Application home page**: 
     - Для разработки: `http://localhost:3000`
     - Для продакшена: `https://yourdomain.com`
   - **Application privacy policy link**: опционально
   - **Application terms of service link**: опционально
   - **Authorized domains**: 
     - Для разработки: `localhost`
     - Для продакшена: ваш домен (например: `yourdomain.com`)
   - **Developer contact information**: ваш email
   
   Нажмите **"Save and Continue"**

4. **Добавить Scopes (Step 2 - Scopes):**
   - Нажмите **"Add or Remove Scopes"**
   - В поиске введите: `drive.readonly`
   - Найдите и отметьте: `https://www.googleapis.com/auth/drive.readonly`
   - Нажмите **"Update"**
   - Нажмите **"Save and Continue"**

5. **Test users (Step 3 - Test users):**
   - Если приложение в статусе "Testing", добавьте тестовых пользователей:
     - Нажмите **"Add Users"**
     - Введите email адреса пользователей, которые будут тестировать
     - Нажмите **"Add"**
   - Нажмите **"Save and Continue"**

6. **Summary (Step 4 - Summary):**
   - Проверьте все настройки
   - Нажмите **"Back to Dashboard"**

## Шаг 5: Создать OAuth 2.0 Client ID

1. В левом меню: **"APIs & Services"** > **"Credentials"**
   - Или прямая ссылка: https://console.cloud.google.com/apis/credentials

2. **Проверить существующие credentials:**
   - Если у вас уже есть OAuth 2.0 Client ID для веб-приложения, можно использовать его
   - Если нет - создайте новый

3. **Создать новый OAuth Client ID:**
   - Нажмите **"+ CREATE CREDENTIALS"** вверху
   - Выберите **"OAuth client ID"**

4. **Настроить OAuth client:**
   - **Application type**: выберите **"Web application"**
   - **Name**: `Knowledge Base Web Client` (или любое имя)

5. **Authorized JavaScript origins:**
   Нажмите **"+ ADD URI"** и добавьте:
   ```
   http://localhost:3000
   ```
   
   Если у вас есть продакшен домен, добавьте также:
   ```
   https://yourdomain.com
   https://www.yourdomain.com
   ```
   (замените `yourdomain.com` на ваш реальный домен)

6. **Authorized redirect URIs:**
   Нажмите **"+ ADD URI"** и добавьте:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
   
   Если у вас есть продакшен домен, добавьте также:
   ```
   https://yourdomain.com/api/auth/callback/google
   https://www.yourdomain.com/api/auth/callback/google
   ```

7. Нажмите **"Create"**

8. **Скопировать credentials:**
   - Появится модальное окно с **Client ID** и **Client Secret**
   - ⚠️ **ВАЖНО**: Скопируйте оба значения сразу, Client Secret показывается только один раз!
   - Client ID выглядит так: `123456789-abcdefghijklmnop.apps.googleusercontent.com`
   - Client Secret выглядит так: `GOCSPX-abcdefghijklmnopqrstuvwxyz`

## Шаг 6: (Опционально) Создать API Key для Picker

API Key улучшает производительность Google Picker, но не обязателен.

1. В **"APIs & Services"** > **"Credentials"**
2. Нажмите **"+ CREATE CREDENTIALS"** > **"API key"**
3. Появится модальное окно с API key
4. ⚠️ **Скопируйте API key** (он показывается только один раз)
5. Нажмите **"Restrict key"** (рекомендуется для безопасности)

6. **Ограничить API key:**
   - **Application restrictions**: выберите **"HTTP referrers (web sites)"**
   - **Website restrictions**: добавьте:
     ```
     http://localhost:3000/*
     https://yourdomain.com/*
     ```
   - **API restrictions**: выберите **"Restrict key"**
   - Отметьте только: **"Google Picker API"**
   - Нажмите **"Save"**

## Шаг 7: Настроить переменные окружения

1. Откройте файл `.env.local` в корне проекта (создайте, если его нет)

2. Добавьте следующие строки:

```bash
# Google OAuth для входа и Google Drive Import
GOOGLE_CLIENT_ID="ваш-client-id-здесь.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="ваш-client-secret-здесь"

# Опционально: API Key для Google Picker (улучшает производительность)
NEXT_PUBLIC_GOOGLE_API_KEY="ваш-api-key-здесь"
```

3. Замените значения на реальные из шагов 5 и 6

4. Сохраните файл

## Шаг 8: Проверка настройки

1. Перезапустите dev server (если он запущен):
   ```bash
   # Остановите (Ctrl+C) и запустите снова
   npm run dev
   ```

2. Откройте браузер: `http://localhost:3000`

3. Перейдите на страницу импорта: `http://localhost:3000/docs/import`

4. Нажмите кнопку **"Import from Google Drive"**

5. Должно произойти:
   - Открыться окно авторизации Google
   - После авторизации открыться Google Picker
   - Можно выбрать файл из Google Drive

## Что делать, если уже есть OAuth Client ID

Если у вас уже настроен Google OAuth для входа в приложение:

1. Перейдите в **"APIs & Services"** > **"Credentials"**
2. Найдите существующий OAuth 2.0 Client ID
3. Нажмите на него для редактирования
4. **Проверьте Authorized JavaScript origins:**
   - Должен быть `http://localhost:3000`
   - Если есть продакшен домен - добавьте его
5. **Проверьте Authorized redirect URIs:**
   - Должен быть `http://localhost:3000/api/auth/callback/google`
   - Если есть продакшен домен - добавьте его
6. **Проверьте OAuth Consent Screen:**
   - Убедитесь, что добавлен scope: `https://www.googleapis.com/auth/drive.readonly`
   - Если нет - добавьте (см. Шаг 4, пункт 4)

## Частые проблемы

### "Error 400: redirect_uri_mismatch"
- Проверьте, что redirect URI точно совпадает с тем, что в Google Cloud Console
- Убедитесь, что добавили `http://localhost:3000/api/auth/callback/google` (не `https` для localhost)

### "Access blocked: This app's request is invalid"
- Проверьте OAuth Consent Screen - должно быть добавлено scope `drive.readonly`
- Если приложение в статусе "Testing", добавьте свой email в Test users

### "Failed to load Google API"
- Проверьте, что Google Picker API включен в проекте
- Проверьте интернет-соединение
- Отключите ad blockers

### Picker не открывается
- Проверьте, что `GOOGLE_CLIENT_ID` правильно скопирован в `.env.local`
- Перезапустите dev server после изменения `.env.local`
- Проверьте консоль браузера на ошибки (F12)

## Для продакшена (Vercel/Railway)

1. Добавьте те же переменные окружения в настройках вашего хостинга:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXT_PUBLIC_GOOGLE_API_KEY` (опционально)

2. В Google Cloud Console добавьте продакшен домены:
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google`

3. В OAuth Consent Screen добавьте продакшен домен в Authorized domains

4. Если приложение в статусе "Testing", запросите публикацию или добавьте всех пользователей в Test users

