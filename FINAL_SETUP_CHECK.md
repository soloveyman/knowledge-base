# Финальная проверка и настройка

## ✅ Выполнено:
- [x] Google Picker API включен
- [x] Google Drive API включен
- [x] Scope `drive.file` добавлен в OAuth Consent Screen
- [x] OAuth Client ID и Secret настроены

## 🔍 Финальная проверка OAuth Client ID

Перейти: https://console.cloud.google.com/apis/credentials

1. Найти ваш OAuth 2.0 Client ID (тип: Web application)
2. Нажать на него для редактирования
3. Проверить **Authorized JavaScript origins**:
   - Должен быть: `http://localhost:3000`
   - Если нет - добавить и нажать "SAVE"

4. Проверить **Authorized redirect URIs**:
   - Должен быть: `http://localhost:3000/api/auth/callback/google`
   - Если нет - добавить и нажать "SAVE"

## 📝 Настроить переменные окружения

1. Открыть файл `.env.local` в корне проекта

2. Найти или добавить:
```bash
GOOGLE_CLIENT_ID="ваш-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="ваш-client-secret"
```

3. **Где взять значения:**
   - Перейти: https://console.cloud.google.com/apis/credentials
   - Найти ваш OAuth 2.0 Client ID
   - Нажать на него
   - Скопировать **Client ID** и **Client Secret**
   - ⚠️ Если Client Secret не виден - нажать "RESET SECRET" (старый перестанет работать)

4. Вставить значения в `.env.local`:
```bash
GOOGLE_CLIENT_ID="123456789-abcdefghijklmnop.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abcdefghijklmnopqrstuvwxyz"
```

5. Сохранить файл

## 🚀 Запуск и проверка

1. **Перезапустить dev server:**
```bash
# Остановить (Ctrl+C) и запустить снова
npm run dev
```

2. **Открыть в браузере:**
   - `http://localhost:3000/docs/import`

3. **Нажать кнопку "Import from Google Drive"**

4. **Ожидаемое поведение:**
   - Откроется окно авторизации Google
   - После авторизации откроется Google Picker
   - Можно выбрать файл из Google Drive
   - Файл загрузится и обработается

## ❌ Если что-то не работает

### Ошибка "Google OAuth not configured"
- Проверить `.env.local` - значения должны быть в кавычках
- Перезапустить dev server
- Проверить, что нет лишних пробелов

### Ошибка "redirect_uri_mismatch"
- Проверить точное совпадение в Google Console:
  - Должно быть: `http://localhost:3000/api/auth/callback/google`
  - Не `https://` для localhost
  - Без лишних слешей в конце

### Ошибка "Access blocked"
- Проверить, что scope `drive.file` добавлен
- Если приложение в статусе "Testing" - добавить свой email в Test users:
  - https://console.cloud.google.com/apis/credentials/consent
  - Test users → Add Users → добавить email

### Picker не открывается
- Открыть консоль браузера (F12) → вкладка Console
- Проверить ошибки
- Убедиться, что Google Picker API включен

## ✅ Готово!

Если все шаги выполнены - Google Drive Import должен работать!

