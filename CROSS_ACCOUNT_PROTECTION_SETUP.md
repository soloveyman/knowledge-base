# Пошаговая инструкция: Включение Cross-Account Protection

## Что такое Cross-Account Protection?

Cross-Account Protection (CAP) - это функция безопасности Google, которая помогает предотвратить атаки, когда злоумышленник пытается использовать учетные данные одного пользователя для доступа к аккаунту другого пользователя в вашем приложении.

## 📍 Где найти настройку

### Вариант 1: Через OAuth Consent Screen (Основной способ)

1. **Откройте Google Cloud Console**
   ```
   https://console.cloud.google.com/
   ```

2. **Выберите ваш проект**
   - В верхней части страницы выберите проект, где настроен OAuth

3. **Перейдите в OAuth Consent Screen**
   - В левом меню: **APIs & Services** → **OAuth consent screen**
   - Или прямая ссылка: https://console.cloud.google.com/apis/credentials/consent

4. **Проверьте тип приложения**
   - Убедитесь, что выбрано **"External"** (не "Internal")
   - Cross-Account Protection доступен только для внешних приложений

5. **Найдите раздел "Advanced Settings"**
   - Прокрутите страницу вниз до раздела **"Advanced Settings"**
   - Здесь вы увидите информацию о Sign in with Google (OpenID Connect)
   - Здесь же находятся настройки Cross-Account Protection

6. **Проверьте доступность опций**
   - Если видите текст "your app must be verified" - приложение не верифицировано
   - Для использования Advanced Settings нужно сначала верифицировать приложение
   - См. раздел "Если опция не видна" ниже

7. **Включите Cross-Account Protection** (если доступно)
   - Найдите переключатель **"Cross-Account Protection"**
   - Переключите в положение **"ON"** или **"Enabled"**
   - Настройте Session age claims, если нужно

8. **Сохраните изменения**
   - Нажмите **"Save and Continue"** или **"Save"**
   - Изменения вступят в силу через несколько минут

📖 **Подробнее о Advanced Settings:** См. [ADVANCED_SETTINGS_SETUP.md](./ADVANCED_SETTINGS_SETUP.md)

### Вариант 2: Через раздел "App security" в Credentials

1. **Перейдите в Credentials**
   - **APIs & Services** → **Credentials**
   - Или прямая ссылка: https://console.cloud.google.com/apis/credentials

2. **Найдите ваш OAuth 2.0 Client ID**
   - В списке "OAuth 2.0 Client IDs" найдите ваш клиент
   - Нажмите на название клиента, чтобы открыть настройки

3. **Проверьте раздел "App security"**
   - В настройках клиента найдите раздел "App security"
   - Здесь может быть опция Cross-Account Protection

### Вариант 3: Через Project Checkup (если доступно)

1. **Откройте Project Checkup**
   - Перейдите в: https://console.cloud.google.com/apis/credentials/consent
   - Найдите раздел **"Project Checkup"** или **"Security Check"**

2. **Проверьте статус безопасности**
   - В разделе "App security" найдите предупреждение о Cross-Account Protection
   - Нажмите на ссылку для настройки

## ⚠️ Если опция не видна

Cross-Account Protection может быть недоступен, если:

1. **Приложение в режиме "Internal"**
   - Решение: Измените тип приложения на "External" в OAuth consent screen

2. **Приложение не верифицировано**
   - Решение: Отправьте приложение на верификацию Google
   - Это может занять несколько дней

3. **Не выполнены предварительные требования**
   - Убедитесь, что:
     - ✅ Домен верифицирован (`uppstaff.net`)
     - ✅ Privacy Policy URL добавлен
     - ✅ OAuth consent screen полностью заполнен
     - ✅ Используются безопасные OAuth потоки (параметр `state`)

4. **Функция еще не доступна в вашем регионе/проекте**
   - Google может постепенно разворачивать эту функцию
   - Подождите несколько дней и проверьте снова

## 🔧 Предварительные требования

Перед включением Cross-Account Protection убедитесь:

### 1. OAuth Consent Screen настроен правильно

- [ ] **App name**: Uppstaff
- [ ] **User support email**: ваш email
- [ ] **Developer contact information**: ваш email
- [ ] **App domain**: `uppstaff.net`
- [ ] **Authorized domains**: `uppstaff.net` (верифицирован)
- [ ] **Privacy Policy URL**: `https://uppstaff.net/privacy`
- [ ] **Scopes**: только необходимые (`openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.file`)

### 2. Домен верифицирован

1. Перейдите в **APIs & Services** → **OAuth consent screen**
2. В разделе **"Authorized domains"** убедитесь, что `uppstaff.net` добавлен
3. Если домен не верифицирован:
   - Добавьте домен
   - Выполните верификацию через Google Search Console или DNS записи

### 3. Код использует безопасные OAuth потоки

✅ Уже исправлено в `lib/auth.ts`:
- Параметр `state` используется
- PKCE включен
- Authorization Code Flow используется

## 📋 Пошаговая инструкция (детальная)

### Шаг 1: Откройте OAuth Consent Screen

```
1. Откройте: https://console.cloud.google.com/
2. Выберите проект
3. APIs & Services → OAuth consent screen
```

### Шаг 2: Проверьте тип приложения

- Должно быть выбрано: **"External"**
- Если выбрано "Internal", измените на "External"

### Шаг 3: Заполните обязательные поля

Если какие-то поля не заполнены:

1. **App information**
   - App name: `Uppstaff`
   - User support email: ваш email
   - App logo: (опционально) загрузите логотип

2. **App domain**
   - Application home page: `https://uppstaff.net`
   - Authorized domains: `uppstaff.net`

3. **Developer contact information**
   - Email addresses: ваш email

### Шаг 4: Найдите Cross-Account Protection

1. Прокрутите страницу вниз
2. Ищите раздел:
   - **"Security"**
   - **"Advanced settings"**
   - **"Additional settings"**
   - **"Cross-Account Protection"**

3. Если не видите, попробуйте:
   - Сохранить текущие настройки и обновить страницу
   - Перейти в раздел "Verification" и вернуться обратно

### Шаг 5: Включите опцию

- Найдите переключатель **"Cross-Account Protection"**
- Переключите в положение **"ON"** или **"Enabled"**
- Прочитайте описание функции (если есть)

### Шаг 6: Сохраните

- Нажмите **"Save and Continue"** или **"Save"**
- Дождитесь подтверждения сохранения

### Шаг 7: Проверьте статус

1. Подождите 5-10 минут
2. Обновите страницу Project Checkup
3. Проверьте, что предупреждение исчезло

## 🔍 Альтернативный способ через API

Если интерфейс не позволяет включить Cross-Account Protection, можно попробовать через Google Cloud API:

```bash
# Это требует настройки gcloud CLI
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Проверьте текущие настройки
gcloud alpha iap oauth-clients describe YOUR_CLIENT_ID
```

**Примечание:** Этот способ требует дополнительной настройки и может быть недоступен для всех проектов.

## ✅ Проверка после включения

После включения Cross-Account Protection:

1. **Подождите 24-48 часов**
   - Google может занять время для обновления статуса

2. **Проверьте в Project Checkup**
   - Перейдите в раздел "App security"
   - Cross-Account Protection должен быть отмечен как включенный

3. **Протестируйте OAuth flow**
   - Попробуйте войти через Google
   - Убедитесь, что процесс работает корректно

## 🆘 Если ничего не помогает

Если опция Cross-Account Protection недоступна:

1. **Отправьте приложение на верификацию**
   - Многие функции безопасности доступны только для верифицированных приложений
   - Перейдите в раздел "Verification" в OAuth consent screen

2. **Свяжитесь с поддержкой Google**
   - Если приложение уже верифицировано, но опция недоступна
   - Используйте форму обратной связи в Google Cloud Console

3. **Проверьте документацию**
   - [Google OAuth Security Best Practices](https://developers.google.com/identity/protocols/oauth2/security-best-practices)
   - [Cross-Account Protection Documentation](https://support.google.com/cloud/answer/10311615)

## 📝 Важные замечания

1. **Cross-Account Protection** - это функция безопасности на стороне Google, не требующая изменений в коде
2. Код уже настроен правильно с использованием параметра `state` и PKCE
3. После включения может потребоваться время для применения изменений
4. Некоторые функции могут быть доступны только после верификации приложения

## 🔗 Полезные ссылки

- [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
- [Credentials](https://console.cloud.google.com/apis/credentials)
- [Google OAuth Security](https://developers.google.com/identity/protocols/oauth2/security-best-practices)

