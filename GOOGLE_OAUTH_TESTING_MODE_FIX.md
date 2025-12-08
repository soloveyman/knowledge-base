# Решение проблемы "Access blocked: приложение не прошло проверку Google"

## Проблема

При попытке использовать Google Drive Import появляется ошибка:
```
Доступ заблокирован: приложение "uppstaff.net" не прошло проверку Google
Ошибка 403: access_denied
```

Это происходит потому, что приложение находится в режиме **Testing** (тестирование) в OAuth Consent Screen.

## Почему это происходит?

В Google Cloud Console приложения по умолчанию создаются в режиме **Testing**. В этом режиме:
- ✅ Доступ имеют только пользователи, добавленные в список "Test users"
- ❌ Остальные пользователи не могут использовать приложение

## Решение: Два варианта

### Вариант 1: Добавить пользователя в Test users (быстрое решение)

**Подходит для:** небольшого количества пользователей или тестирования

1. Откройте [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Найдите раздел **"Test users"** (или перейдите к Step 3)
3. Нажмите **"ADD USERS"**
4. Добавьте email адреса всех пользователей, которым нужен доступ:
   - `uppstaffknowledge@gmail.com`
   - Другие email адреса пользователей
5. Нажмите **"ADD"**
6. Нажмите **"SAVE AND CONTINUE"**

**Важно:** После добавления пользователей подождите 2-5 минут, чтобы изменения применились.

### Вариант 2: Опубликовать приложение (рекомендуется для продакшена)

**Подходит для:** когда нужно, чтобы приложение работало для всех пользователей

📖 **Подробная пошаговая инструкция:** См. [GOOGLE_OAUTH_PUBLISH_PRODUCTION.md](./GOOGLE_OAUTH_PUBLISH_PRODUCTION.md)

#### Краткое резюме:

1. **Создать Privacy Policy:**
   - Страница уже создана: `https://uppstaff.net/privacy`
   - Если нужно изменить - отредактируйте `app/privacy/page.tsx`

2. **Настроить OAuth Consent Screen:**
   - Добавить Privacy Policy link: `https://uppstaff.net/privacy`
   - Заполнить все обязательные поля
   - Проверить scopes

3. **Опубликовать:**
   - Нажать **"PUBLISH APP"** в OAuth Consent Screen
   - Для `drive.file` проверка Google не требуется (non-sensitive scope)

**Примечание:** Для `drive.file` scope проверка не требуется, приложение может быть опубликовано сразу.

## Как проверить текущий статус

1. Откройте [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
2. Посмотрите на статус вверху страницы:
   - **"Testing"** - только тестовые пользователи
   - **"In production"** - доступно для всех

## Быстрая инструкция (для вашего случая)

### Сейчас (быстрое решение):

1. Перейдите: https://console.cloud.google.com/apis/credentials/consent
2. Найдите раздел **"Test users"**
3. Нажмите **"ADD USERS"**
4. Добавьте: `uppstaffknowledge@gmail.com`
5. Нажмите **"ADD"** и **"SAVE"**
6. Подождите 2-5 минут
7. Попробуйте снова

### Позже (для продакшена):

1. Создайте страницу Privacy Policy: `https://uppstaff.net/privacy`
2. В OAuth Consent Screen добавьте ссылку на Privacy Policy
3. Нажмите **"PUBLISH APP"**
4. Приложение станет доступным для всех пользователей

## Дополнительная информация

- **Test users лимит:** до 100 пользователей
- **Публикация:** после публикации приложение доступно для всех пользователей Google
- **Проверка Google:** для `drive.file` не требуется (non-sensitive scope), но может занять несколько дней для других scopes

## Ссылки

- [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Документация Google OAuth](https://developers.google.com/identity/protocols/oauth2)

