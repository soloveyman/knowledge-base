# Настройка безопасности Google OAuth

## Проблемы безопасности, выявленные Google

Google Cloud Console выявил следующие проблемы безопасности:

1. **Use secure flows** - Приложение не использует безопасные OAuth потоки (параметр `state`)
2. **Cross-Account Protection** - Не настроена защита от перекрестных аккаунтов

## ✅ Что уже исправлено в коде

### 1. Параметр `state` и безопасные OAuth потоки

**Статус:** ✅ Исправлено

В `lib/auth.ts` обновлена конфигурация `GoogleProvider`:

```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      prompt: "consent",
      access_type: "offline",
      response_type: "code",
    },
  },
  checks: ["state", "pkce"],
})
```

**Что это делает:**
- `checks: ["state", "pkce"]` - Явно указывает NextAuth использовать параметр `state` для защиты от CSRF и PKCE для дополнительной безопасности
- `response_type: "code"` - Использует Authorization Code Flow (самый безопасный)
- NextAuth автоматически генерирует и проверяет параметр `state` для защиты от CSRF атак

### 2. PKCE (Proof Key for Code Exchange)

**Статус:** ✅ Включено по умолчанию в NextAuth v5

NextAuth v5 автоматически использует PKCE для дополнительной защиты OAuth потока.

## 🔧 Что нужно настроить в Google Cloud Console

### 1. Cross-Account Protection

**Важно:** Это настройка в Google Cloud Console, а не в коде.

#### Шаги для включения Cross-Account Protection:

1. **Откройте Google Cloud Console**
   - Перейдите: https://console.cloud.google.com/apis/credentials/consent

2. **Найдите раздел "OAuth consent screen"**
   - Выберите ваш проект
   - Перейдите в раздел "OAuth consent screen"

3. **Включите Cross-Account Protection**
   - Найдите раздел "Cross-Account Protection" или "User Type"
   - Убедитесь, что выбрано "External" (для публичных приложений)
   - В разделе "Security" найдите опцию "Cross-Account Protection"
   - Включите эту опцию

4. **Настройте домены**
   - Убедитесь, что ваш домен `uppstaff.net` добавлен в "Authorized domains"
   - Домены должны быть верифицированы

5. **Сохраните изменения**
   - Нажмите "Save and Continue"
   - Изменения могут занять несколько минут для применения

#### Альтернативный путь:

Если опция "Cross-Account Protection" не видна напрямую:

1. Перейдите в **APIs & Services** → **OAuth consent screen**
2. Убедитесь, что выбрано **"External"** (не "Internal")
3. В разделе **"Scopes"** проверьте, что используются только необходимые scopes
4. В разделе **"Test users"** (если приложение в режиме тестирования) добавьте тестовых пользователей
5. Для публикации приложения:
   - Заполните все обязательные поля
   - Добавьте Privacy Policy URL
   - Добавьте Terms of Service URL (если требуется)
   - Отправьте на верификацию

### 2. Проверка использования параметра `state`

Google должен автоматически обнаружить использование параметра `state` после обновления кода и деплоя.

**Как проверить:**

1. После деплоя обновленного кода подождите 24-48 часов
2. В Google Cloud Console перейдите в **APIs & Services** → **Credentials**
3. Найдите ваш OAuth 2.0 Client ID
4. Проверьте статус в разделе "App security"
5. Параметр `state` должен быть отмечен как используемый

### 3. OAuth App Verification

**Статус:** ⚠️ Требуется верификация

Для полной функциональности OAuth приложение должно быть верифицировано Google.

**Шаги для верификации:**

1. **Заполните OAuth Consent Screen**
   - App name: Uppstaff
   - User support email: ваш email
   - Developer contact information: ваш email
   - App logo: загрузите логотип (если есть)
   - App domain: `uppstaff.net`
   - Authorized domains: `uppstaff.net`
   - Privacy Policy URL: `https://uppstaff.net/privacy`
   - Terms of Service URL: (опционально)

2. **Настройте Scopes**
   - Используйте только необходимые scopes
   - Для входа через Google: `openid`, `email`, `profile`
   - Для Google Drive: `https://www.googleapis.com/auth/drive.file`

3. **Отправьте на верификацию**
   - Перейдите в раздел "Verification"
   - Заполните форму верификации
   - Приложите скриншоты приложения
   - Опишите использование OAuth

4. **Дождитесь одобрения**
   - Процесс верификации может занять несколько дней или недель
   - Google может запросить дополнительную информацию

## 📋 Чеклист безопасности

- [x] Параметр `state` явно указан в конфигурации GoogleProvider
- [x] PKCE включен (автоматически в NextAuth v5)
- [x] Используется Authorization Code Flow (`response_type: "code"`)
- [ ] Cross-Account Protection включен в Google Cloud Console
- [ ] OAuth приложение отправлено на верификацию
- [ ] Домены верифицированы в Google Cloud Console
- [ ] Privacy Policy доступна по URL

## 🔍 Проверка после деплоя

После деплоя обновленного кода:

1. **Проверьте логи**
   ```bash
   # В production логах должны быть успешные OAuth запросы
   # Параметр state должен присутствовать в запросах к Google
   ```

2. **Проверьте в Google Cloud Console**
   - Через 24-48 часов проверьте статус в разделе "App security"
   - Параметр `state` должен быть отмечен как используемый

3. **Протестируйте OAuth flow**
   - Попробуйте войти через Google
   - Проверьте, что процесс работает корректно
   - Убедитесь, что нет ошибок в консоли браузера

## 📚 Дополнительные ресурсы

- [Google OAuth 2.0 Security Best Practices](https://developers.google.com/identity/protocols/oauth2/security-best-practices)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#security)
- [Cross-Account Protection Documentation](https://support.google.com/cloud/answer/10311615)

## ⚠️ Важные замечания

1. **Cross-Account Protection** - это настройка в Google Cloud Console, не в коде. Код уже настроен правильно.

2. **Параметр `state`** - NextAuth автоматически использует его, но явное указание в конфигурации помогает Google правильно определить использование.

3. **Верификация приложения** - это отдельный процесс, который может занять время. Приложение может работать и без верификации, но с ограничениями (только тестовые пользователи в режиме тестирования).

4. **Изменения в Google Cloud Console** могут занять до 24-48 часов для применения.

