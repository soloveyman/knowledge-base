# Подробная инструкция: Публикация Google OAuth приложения в продакшене

## Обзор

Эта инструкция поможет вам опубликовать ваше Google OAuth приложение, чтобы оно было доступно всем пользователям Google, а не только тестовым пользователям.

## Требования для публикации

Google требует следующие обязательные элементы для публикации OAuth приложения:

1. ✅ **App name** - название приложения
2. ✅ **User support email** - email для поддержки
3. ✅ **Developer contact information** - контакт разработчика
4. ✅ **Application home page** - главная страница приложения
5. ⚠️ **Application privacy policy link** - **ОБЯЗАТЕЛЬНО** для публикации
6. 📋 **Application terms of service link** - рекомендуется (не обязательно)
7. ✅ **Scopes** - разрешения, которые запрашивает приложение

## Пошаговая инструкция

### Шаг 1: Создать страницу Privacy Policy

#### 1.1. Проверить существующую страницу

Страница Privacy Policy уже создана по адресу: `https://uppstaff.net/privacy`

Если страница не работает, проверьте:
- Что файл `app/privacy/page.tsx` существует
- Что приложение задеплоено на Vercel
- Что домен `uppstaff.net` правильно настроен

#### 1.2. Настроить страницу (если нужно)

Если нужно изменить содержимое Privacy Policy:

1. Откройте файл `app/privacy/page.tsx`
2. Отредактируйте текст согласно вашим требованиям
3. Сохраните и задеплойте изменения

**Важно:** Privacy Policy должна быть доступна по публичному URL без авторизации.

### Шаг 2: Подготовить Terms of Service (опционально, но рекомендуется)

#### 2.1. Создать страницу Terms of Service

Создайте файл `app/terms/page.tsx` (аналогично Privacy Policy):

```typescript
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service - Knowledge Base",
  description: "Terms of Service for Knowledge Base application",
}

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      {/* Добавьте ваши условия использования */}
    </div>
  )
}
```

#### 2.2. Задеплоить страницу

После создания страницы задеплойте изменения на Vercel.

### Шаг 3: Настроить OAuth Consent Screen

#### 3.1. Открыть OAuth Consent Screen

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Выберите ваш проект
3. Перейдите: **APIs & Services** → **OAuth consent screen**
   - Прямая ссылка: https://console.cloud.google.com/apis/credentials/consent

#### 3.2. Проверить/Заполнить App Information (Step 1)

Нажмите **"EDIT APP"** или перейдите к **Step 1 - App information**

**Обязательные поля:**

1. **App name**: `Knowledge Base` (или ваше название)
2. **User support email**: выберите ваш email из списка
3. **Application home page**: 
   ```
   https://uppstaff.net
   ```
4. **Application privacy policy link**: ⚠️ **ОБЯЗАТЕЛЬНО**
   ```
   https://uppstaff.net/privacy
   ```
5. **Application terms of service link**: (рекомендуется)
   ```
   https://uppstaff.net/terms
   ```
   (Если страница Terms of Service не создана, можно оставить пустым)
6. **Authorized domains**: 
   ```
   uppstaff.net
   ```
   (Без `https://`, только домен)
7. **Developer contact information**: ваш email

**Важно:** 
- Все URL должны быть доступны публично (без авторизации)
- URL должны использовать HTTPS (для продакшена)
- Домен в "Authorized domains" должен совпадать с доменом в URL

#### 3.3. Проверить Scopes (Step 2)

Перейдите к **Step 2 - Scopes**

Убедитесь, что добавлены необходимые scopes:
- ✅ `https://www.googleapis.com/auth/drive.file` (для Google Drive)
- ✅ `openid`, `email`, `profile` (для OAuth входа, обычно добавляются автоматически)

**Для публикации важно:**
- Используйте только необходимые scopes
- Scope `drive.file` является нечувствительным (non-sensitive) и не требует проверки Google

#### 3.4. Test Users (Step 3) - можно пропустить для публикации

Если вы публикуете приложение, раздел Test Users не важен - приложение будет доступно всем.

#### 3.5. Summary (Step 4)

Проверьте все настройки и нажмите **"SAVE AND CONTINUE"** или **"BACK TO DASHBOARD"**

### Шаг 4: Опубликовать приложение

#### 4.1. Проверить готовность

Перед публикацией убедитесь:

- ✅ Все обязательные поля заполнены
- ✅ Privacy Policy доступна по ссылке
- ✅ Application home page работает
- ✅ Authorized domains настроены правильно
- ✅ Scopes добавлены и корректны

#### 4.2. Нажать "PUBLISH APP"

1. В OAuth Consent Screen найдите кнопку **"PUBLISH APP"** вверху страницы
2. Или перейдите к **Summary** и нажмите **"PUBLISH APP"**

#### 4.3. Подтвердить публикацию

Google покажет предупреждение о том, что приложение будет доступно всем пользователям.

**Для scope `drive.file`:**
- ✅ **Не требуется проверка Google** (non-sensitive scope)
- ✅ Приложение публикуется сразу
- ✅ Доступно для всех пользователей Google
- ✅ Не требуется ежегодная CASA сертификация

**Для других scopes (если используются):**
- ⚠️ Может потребоваться проверка Google (несколько дней)
- ⚠️ Google может запросить дополнительную информацию

#### 4.4. Проверить статус

После публикации:

1. Статус изменится с **"Testing"** на **"In production"**
2. Приложение станет доступным для всех пользователей Google
3. Test users больше не нужны (но можно оставить для тестирования)

### Шаг 5: Проверить работу

#### 5.1. Проверить доступ

1. Откройте приложение: `https://uppstaff.net`
2. Попробуйте использовать Google Drive Import
3. Войдите с любым Google аккаунтом (не обязательно тестовым)
4. Должно работать без ошибки "Access blocked"

#### 5.2. Если что-то не работает

- Подождите 5-10 минут (Google кэширует настройки)
- Очистите кэш браузера
- Проверьте, что статус действительно "In production"
- Проверьте, что все URL доступны публично

## Частые проблемы и решения

### Проблема: "Privacy Policy link is required"

**Решение:**
- Убедитесь, что ссылка на Privacy Policy добавлена в OAuth Consent Screen
- Проверьте, что страница доступна по указанному URL
- URL должен использовать HTTPS для продакшена

### Проблема: "Authorized domain mismatch"

**Решение:**
- Домен в "Authorized domains" должен совпадать с доменом в URL
- Например, если URL `https://uppstaff.net/privacy`, то домен должен быть `uppstaff.net`
- Не используйте `www.` в домене, если URL без `www.`

### Проблема: Приложение все еще в статусе "Testing"

**Решение:**
- Убедитесь, что нажали "PUBLISH APP"
- Проверьте, что все обязательные поля заполнены
- Обновите страницу через несколько минут

### Проблема: Google требует проверку

**Решение:**
- Для `drive.file` проверка не требуется (non-sensitive scope)
- Если Google запросил проверку для других scopes, заполните форму проверки
- Процесс может занять несколько дней
- В это время приложение остается в режиме Testing

## Дополнительная информация

### Безопасные scopes (не требуют проверки)

Следующие scopes не требуют проверки Google (non-sensitive):
- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/drive.file` (доступ к файлам, выбранным пользователем)

### Scopes, требующие проверки

Некоторые scopes требуют проверки Google:
- `https://www.googleapis.com/auth/drive` (полный доступ к Drive)
- Scopes для Gmail, Calendar и других сервисов

### Лимиты

- **Test users:** до 100 пользователей в режиме Testing
- **В продакшене:** неограниченное количество пользователей
- **Проверка Google:** может занять от нескольких дней до нескольких недель (для scopes, требующих проверки)

## Чеклист перед публикацией

- [ ] Privacy Policy создана и доступна по `https://uppstaff.net/privacy`
- [ ] Terms of Service создана (опционально) по `https://uppstaff.net/terms`
- [ ] Application home page настроен: `https://uppstaff.net`
- [ ] Authorized domains: `uppstaff.net`
- [ ] Все обязательные поля в OAuth Consent Screen заполнены
- [ ] Scopes добавлены и корректны
- [ ] Нажата кнопка "PUBLISH APP"
- [ ] Статус изменился на "In production"
- [ ] Проверена работа с обычным Google аккаунтом (не тестовым)

## Ссылки

- [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Документация Google OAuth](https://developers.google.com/identity/protocols/oauth2)
- [Требования Google для публикации](https://support.google.com/cloud/answer/9110914)

## После публикации

После успешной публикации:

1. ✅ Приложение доступно для всех пользователей Google
2. ✅ Не нужно добавлять пользователей в Test users
3. ✅ Можно удалить тестовых пользователей (опционально)
4. ✅ Приложение работает в продакшене

**Важно:** Если вы измените scopes или другие настройки после публикации, Google может снова запросить проверку.

