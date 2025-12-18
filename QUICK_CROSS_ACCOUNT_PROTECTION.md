# 🚀 Быстрая инструкция: Включение Cross-Account Protection

## ⚡ Быстрый путь (3 шага)

### Шаг 1: Откройте OAuth Consent Screen
```
https://console.cloud.google.com/apis/credentials/consent
```

### Шаг 2: Найдите опцию
- Прокрутите страницу вниз
- Найдите раздел **"Security"** или **"Advanced settings"**
- Найдите переключатель **"Cross-Account Protection"**

### Шаг 3: Включите и сохраните
- Переключите в положение **"ON"**
- Нажмите **"Save and Continue"**

## ❌ Если не видите опцию

### Проверьте эти пункты:

1. ✅ **Тип приложения = "External"**
   - Если "Internal", измените на "External"

2. ✅ **Домен верифицирован**
   - `uppstaff.net` должен быть в "Authorized domains"
   - Домен должен быть верифицирован

3. ✅ **Privacy Policy URL добавлен**
   - Должен быть: `https://uppstaff.net/privacy`

4. ✅ **Приложение отправлено на верификацию**
   - Некоторые функции доступны только после верификации

## 📍 Точное расположение

```
Google Cloud Console
  └─ APIs & Services
      └─ OAuth consent screen
          └─ [Прокрутите вниз]
              └─ Security / Advanced settings
                  └─ Cross-Account Protection [ON/OFF]
```

## 🔍 Альтернативный способ найти

1. Откройте: https://console.cloud.google.com/apis/credentials/consent
2. Нажмите **"EDIT APP"** (если видите)
3. Прокрутите до конца страницы
4. Ищите раздел с настройками безопасности

## ⏱️ После включения

- Подождите 5-10 минут
- Обновите страницу Project Checkup
- Проверьте, что предупреждение исчезло

## 📖 Подробная инструкция

Если нужны детали, см. [CROSS_ACCOUNT_PROTECTION_SETUP.md](./CROSS_ACCOUNT_PROTECTION_SETUP.md)

