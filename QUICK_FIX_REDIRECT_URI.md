# Быстрое исправление: Error 400: redirect_uri_mismatch

## 🔍 Шаг 1: Проверить, какой redirect URI используется

Откройте в браузере:
```
https://uppstaff.net/api/auth/debug
```

Скопируйте значение `calculatedRedirectUri` из ответа.

## 🔧 Шаг 2: Добавить redirect URI в Google Cloud Console

1. Откройте: https://console.cloud.google.com/apis/credentials
2. Найдите ваш **OAuth 2.0 Client ID** (тип: Web application)
3. Нажмите на него для редактирования
4. В разделе **"Authorized redirect URIs"** добавьте:
   - Значение из `calculatedRedirectUri` (из шага 1)
   - Или если не работает, добавьте: `https://uppstaff.net/api/auth/callback/google`
5. Нажмите **"SAVE"**

## ⚙️ Шаг 3: Проверить NEXTAUTH_URL в Vercel

1. Откройте: Vercel Dashboard → Ваш проект → Settings → Environment Variables
2. Найдите переменную `NEXTAUTH_URL`
3. Убедитесь, что значение: `https://uppstaff.net` (без слеша в конце)
4. Убедитесь, что она установлена для **Production** environment
5. Если изменили — пересоберите и задеплойте приложение

## ✅ Шаг 4: Проверить результат

1. Подождите 2-5 минут (Google кэширует настройки)
2. Очистите кэш браузера или используйте режим инкогнито
3. Попробуйте войти через Google на https://uppstaff.net

## 🚨 Если не помогло

### Проверьте Client ID
Убедитесь, что `GOOGLE_CLIENT_ID` в Vercel совпадает с Client ID в Google Cloud Console.

### Проверьте OAuth Consent Screen
1. Откройте: https://console.cloud.google.com/apis/credentials/consent
2. Если статус "Testing", добавьте email `uppstaffknowledge@gmail.com` в Test users

### Проверьте логи Vercel
1. Vercel Dashboard → Deployments → последний deployment → Function Logs
2. Ищите предупреждения о `NEXTAUTH_URL` или ошибки с redirect URI

### Временное решение
Добавьте все возможные варианты в Google Cloud Console:
```
https://uppstaff.net/api/auth/callback/google
http://uppstaff.net/api/auth/callback/google
https://www.uppstaff.net/api/auth/callback/google
http://www.uppstaff.net/api/auth/callback/google
```
После того как найдете правильный, удалите лишние.

