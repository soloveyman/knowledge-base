# Диагностика OAuth ошибки redirect_uri_mismatch

Если все URL совпадают, но ошибка сохраняется, проверьте следующие моменты:

## 🔍 Шаг 1: Проверить правильный Client ID

### Проблема
Может быть несколько OAuth Client ID в Google Cloud Console, и используется не тот.

### Решение
1. Откройте Vercel Dashboard → Project → Settings → Environment Variables
2. Найдите значение `GOOGLE_CLIENT_ID`
3. Скопируйте его полностью (должно заканчиваться на `.apps.googleusercontent.com`)
4. Откройте Google Cloud Console: https://console.cloud.google.com/apis/credentials
5. Найдите OAuth 2.0 Client ID с **точно таким же** Client ID
6. Проверьте redirect URI именно в этом Client ID

⚠️ **Важно:** Если у вас несколько проектов Google Cloud, убедитесь, что используете правильный проект.

## 🔍 Шаг 2: Проверить кэш Google

Google может кэшировать настройки OAuth до 5-10 минут.

### Решение
1. Подождите 5-10 минут после изменения redirect URI
2. Очистите кэш браузера или используйте режим инкогнито
3. Попробуйте снова

## 🔍 Шаг 3: Проверить переменные окружения в Vercel

### Проблема
Переменные окружения могут быть установлены только для Preview, а не для Production.

### Решение
1. Откройте Vercel Dashboard → Project → Settings → Environment Variables
2. Проверьте каждую переменную:
   - `NEXTAUTH_URL` - должна быть для **Production**
   - `GOOGLE_CLIENT_ID` - должна быть для **Production**
   - `GOOGLE_CLIENT_SECRET` - должна быть для **Production**
3. Если переменная установлена только для Preview/Development:
   - Нажмите на переменную
   - Выберите **Production** в списке environments
   - Сохраните
4. **Пересоберите и задеплойте** приложение после изменения

## 🔍 Шаг 4: Проверить логи Vercel

### Решение
1. Откройте Vercel Dashboard → Project → Deployments
2. Выберите последний deployment
3. Откройте **Function Logs**
4. Попробуйте войти через Google
5. Проверьте логи на наличие:
   - Предупреждений о `NEXTAUTH_URL`
   - Ошибок с redirect URI
   - Сообщений о том, какой redirect URI используется

## 🔍 Шаг 5: Проверить, какой redirect URI отправляется

### Диагностика
1. Откройте https://uppstaff.net/auth/signin в браузере
2. Откройте Developer Tools (F12) → Network tab
3. Нажмите "Войти через Google"
4. Найдите запрос к `accounts.google.com` или `oauth2.googleapis.com`
5. Посмотрите параметр `redirect_uri` в URL запроса
6. Убедитесь, что он точно совпадает с тем, что в Google Cloud Console

Ожидаемый redirect_uri:
```
https://uppstaff.net/api/auth/callback/google
```

## 🔍 Шаг 6: Проверить несколько доменов

### Проблема
Если у вас есть несколько доменов (например, `www.uppstaff.net`), нужно добавить оба.

### Решение
В Google Cloud Console добавьте все варианты:
```
https://uppstaff.net/api/auth/callback/google
https://www.uppstaff.net/api/auth/callback/google
```

## 🔍 Шаг 7: Проверить OAuth Consent Screen

### Проблема
Если приложение в статусе "Testing", нужно добавить email пользователя в Test users.

### Решение
1. Откройте: https://console.cloud.google.com/apis/credentials/consent
2. Проверьте статус приложения:
   - Если "Testing" → добавьте email `uppstaffknowledge@gmail.com` в Test users
   - Если "In production" → должно работать для всех

## 🔍 Шаг 8: Проверить VERCEL_URL vs NEXTAUTH_URL

### Проблема
Если `NEXTAUTH_URL` не установлен, NextAuth может использовать `VERCEL_URL`, который может быть другим доменом.

### Решение
1. В Vercel Environment Variables убедитесь, что `NEXTAUTH_URL` установлен явно:
   ```
   NEXTAUTH_URL=https://uppstaff.net
   ```
2. Убедитесь, что это для **Production** environment
3. Пересоберите и задеплойте приложение

## 🔍 Шаг 9: Проверить точное совпадение (включая пробелы)

### Проблема
Могут быть невидимые пробелы или символы.

### Решение
1. В Google Cloud Console:
   - Удалите redirect URI
   - Добавьте заново, скопировав точно: `https://uppstaff.net/api/auth/callback/google`
   - Убедитесь, что нет пробелов в начале или конце
2. Сохраните

## 🔍 Шаг 10: Временное решение - добавить все возможные варианты

Если ничего не помогает, добавьте все возможные варианты redirect URI в Google Cloud Console:

```
https://uppstaff.net/api/auth/callback/google
http://uppstaff.net/api/auth/callback/google
https://www.uppstaff.net/api/auth/callback/google
http://www.uppstaff.net/api/auth/callback/google
```

⚠️ Это временное решение для диагностики. После того как найдете правильный вариант, удалите лишние.

## 📝 Чеклист для отправки в поддержку

Если ничего не помогло, соберите следующую информацию:

- [ ] Client ID из Vercel Environment Variables
- [ ] Список всех redirect URIs из Google Cloud Console (скриншот)
- [ ] Логи Vercel (последние 50 строк при попытке входа)
- [ ] Network tab из браузера (параметр redirect_uri из запроса к Google)
- [ ] Статус OAuth Consent Screen (Testing/In production)
- [ ] Список Test users (если статус Testing)

## 🚨 Быстрая проверка

Выполните все эти команды/проверки:

1. ✅ Client ID в Vercel совпадает с Client ID в Google Cloud Console
2. ✅ Redirect URI в Google Cloud Console: `https://uppstaff.net/api/auth/callback/google`
3. ✅ `NEXTAUTH_URL="https://uppstaff.net"` установлен в Vercel для Production
4. ✅ Пересобрали и задеплоили приложение после изменения переменных
5. ✅ Подождали 5-10 минут после изменения redirect URI
6. ✅ Очистили кэш браузера или использовали режим инкогнито
7. ✅ Проверили логи Vercel на наличие ошибок

Если все проверки пройдены, но ошибка сохраняется - возможно, проблема на стороне Google. Попробуйте создать новый OAuth Client ID.

