# Результаты проверки кода OAuth конфигурации

## ✅ Что проверено

### 1. Конфигурация NextAuth (`lib/auth.ts`)

**Статус:** ✅ Правильно настроено

- `trustHost: true` - включен (позволяет использовать host из заголовков запроса)
- `GoogleProvider` настроен с `clientId` и `clientSecret` из переменных окружения
- Callback path: `/api/auth/callback/google` (стандартный для NextAuth)

### 2. Обработчик маршрута (`app/api/auth/[...nextauth]/route.ts`)

**Статус:** ✅ Правильно настроено

- Обработка ошибок присутствует
- Логирование для отладки включено в development
- Rate limiting настроен

### 3. Формирование redirect URI

**Как работает:**
- NextAuth автоматически формирует redirect URI как: `${NEXTAUTH_URL}/api/auth/callback/google`
- Если `NEXTAUTH_URL` не установлен, используется `trustHost: true` для определения из заголовков запроса
- Fallback: `VERCEL_URL` или `http://localhost:3000` для development

## 🔍 Потенциальные проблемы

### Проблема 1: NEXTAUTH_URL может не использоваться правильно

**Описание:**
В production на Vercel, если `NEXTAUTH_URL` не установлен явно, NextAuth может использовать `VERCEL_URL` (например, `https://project-name.vercel.app`) вместо кастомного домена `https://uppstaff.net`.

**Решение:**
✅ Убедитесь, что в Vercel Environment Variables установлено:
```
NEXTAUTH_URL=https://uppstaff.net
```
(для Production environment)

### Проблема 2: Переменная nextAuthUrl вычисляется, но не используется

**Описание:**
В коде вычисляется `nextAuthUrl`, но она не передается явно в конфигурацию NextAuth. NextAuth использует `NEXTAUTH_URL` напрямую из `process.env`.

**Статус:** ✅ Это нормально - NextAuth v5 автоматически использует `NEXTAUTH_URL` из переменных окружения.

### Проблема 3: Кэширование Google

**Описание:**
Google может кэшировать настройки OAuth до 5-10 минут после изменения redirect URI.

**Решение:**
- Подождите 5-10 минут после изменения
- Очистите кэш браузера
- Используйте режим инкогнито

## ✅ Рекомендации

### 1. Проверить переменные окружения в Vercel

Убедитесь, что установлены для **Production**:
- `NEXTAUTH_URL=https://uppstaff.net` (без слеша)
- `GOOGLE_CLIENT_ID=ваш-client-id`
- `GOOGLE_CLIENT_SECRET=ваш-client-secret`

### 2. Включить debug логирование (временно)

В `lib/auth.ts` уже добавлено:
```typescript
debug: process.env.NODE_ENV === 'development'
```

Для production можно временно включить:
```typescript
debug: true
```

Это покажет в логах Vercel, какой redirect URI фактически используется.

### 3. Проверить логи Vercel

После попытки входа через Google:
1. Vercel Dashboard → Project → Deployments
2. Выберите последний deployment
3. Function Logs
4. Найдите логи с redirect URI

### 4. Проверить Network tab в браузере

1. Откройте https://uppstaff.net/auth/signin
2. F12 → Network tab
3. Нажмите "Войти через Google"
4. Найдите запрос к `accounts.google.com` или `oauth2.googleapis.com`
5. Проверьте параметр `redirect_uri` в URL запроса

Ожидаемый redirect_uri:
```
https://uppstaff.net/api/auth/callback/google
```

## 📝 Чеклист для проверки

- [ ] `NEXTAUTH_URL="https://uppstaff.net"` установлен в Vercel для Production
- [ ] `GOOGLE_CLIENT_ID` совпадает с Client ID в Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` совпадает с Client Secret в Google Cloud Console
- [ ] Redirect URI `https://uppstaff.net/api/auth/callback/google` добавлен в Google Cloud Console
- [ ] Приложение пересобрано и задеплоено после изменения переменных
- [ ] Подождали 5-10 минут после изменения redirect URI
- [ ] Проверили логи Vercel на наличие ошибок
- [ ] Проверили Network tab в браузере для фактического redirect_uri

## 🚨 Если проблема сохраняется

1. **Временно включить debug:**
   В `lib/auth.ts` изменить:
   ```typescript
   debug: true, // Временно для диагностики
   ```

2. **Проверить фактический redirect URI:**
   - Network tab в браузере
   - Логи Vercel

3. **Создать новый OAuth Client ID:**
   Если ничего не помогает, создайте новый OAuth Client ID в Google Cloud Console и обновите переменные в Vercel.

