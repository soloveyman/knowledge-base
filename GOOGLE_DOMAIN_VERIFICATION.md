# Верификация домена для Google OAuth

## Проблема

Google требует верификацию владения доменом `uppstaff.net` для публикации OAuth приложения.

## Решение: Верификация через Google Search Console

### Шаг 1: Открыть Google Search Console

1. Перейдите: https://search.google.com/search-console
2. Войдите с тем же Google аккаунтом, который используется для Google Cloud Console

### Шаг 2: Добавить свойство (домен)

1. Нажмите **"Add property"** (Добавить ресурс)
2. Выберите **"Domain"** (Домен)
3. Введите: `uppstaff.net` (без `https://` и без `www`)
4. Нажмите **"Continue"**

### Шаг 3: Верифицировать домен

Google предложит несколько способов верификации:

#### Вариант 1: HTML файл (рекомендуется)

1. Google предоставит HTML файл для загрузки (например: `google1234567890.html`)
2. Скачайте этот файл
3. Загрузите файл в корень вашего сайта на Vercel:
   - Создайте папку `public` в корне проекта (если нет)
   - Поместите файл туда: `public/google1234567890.html`
   - Задеплойте на Vercel
4. Файл должен быть доступен по: `https://uppstaff.net/google1234567890.html`
5. В Google Search Console нажмите **"Verify"**

#### Вариант 2: HTML тег

1. Google предоставит HTML тег (meta tag)
2. Добавьте этот тег в `<head>` вашего `app/layout.tsx`:
   ```tsx
   <head>
     {/* ... существующие теги ... */}
     <meta name="google-site-verification" content="ВАШ_КОД_ВЕРИФИКАЦИИ" />
   </head>
   ```
3. Задеплойте изменения
4. В Google Search Console нажмите **"Verify"**

#### Вариант 3: DNS запись (если у вас есть доступ к DNS)

1. Google предоставит TXT запись для добавления в DNS
2. Добавьте TXT запись в настройках DNS вашего домена
3. Подождите несколько минут для распространения DNS
4. В Google Search Console нажмите **"Verify"**

### Шаг 4: Подтвердить верификацию

После успешной верификации:
- ✅ Домен будет добавлен в Google Search Console
- ✅ Google автоматически проверит владение доменом для OAuth
- ✅ Статус верификации в OAuth Consent Screen обновится

## Альтернативный способ: Верификация через Google Cloud Console

Если у вас уже есть верифицированный домен в Google Search Console:

1. Откройте OAuth Consent Screen: https://console.cloud.google.com/apis/credentials/consent
2. Перейдите к **App information** (Step 1)
3. В разделе **Authorized domains** убедитесь, что домен `uppstaff.net` добавлен
4. Google может автоматически проверить домен, если он верифицирован в Search Console

## Проверка статуса

После верификации:

1. Подождите 24-48 часов для обновления статуса в Google
2. Проверьте статус в OAuth Consent Screen
3. Если статус не обновился, ответьте на email от Google Trust and Safety team

## Частые проблемы

### "Domain verification failed"

- Убедитесь, что файл/тег доступен по указанному URL
- Проверьте, что домен правильно настроен в Vercel
- Убедитесь, что используете правильный протокол (HTTPS для продакшена)

### "Verification pending"

- Подождите 24-48 часов
- Проверьте, что файл/тег все еще доступен
- Убедитесь, что домен не изменился

## Ссылки

- [Google Search Console](https://search.google.com/search-console)
- [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [Документация Google по верификации домена](https://support.google.com/webmasters/answer/9008080)

