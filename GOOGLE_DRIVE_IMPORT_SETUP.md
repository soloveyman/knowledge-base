# Google Drive Import Setup

## Обзор

Реализован импорт документов напрямую из Google Drive через Google Picker API. Работает на iOS, Android и ноутбуках через браузер.

## Настройка Google Cloud Console

📖 **Детальная пошаговая инструкция**: См. [GOOGLE_CLOUD_SETUP_GUIDE.md](./GOOGLE_CLOUD_SETUP_GUIDE.md)

🔍 **Если у вас уже есть Google OAuth**: См. [GOOGLE_OAUTH_QUICK_CHECK.md](./GOOGLE_OAUTH_QUICK_CHECK.md)

### Краткое резюме:

1. **Включить API:**
   - Google Picker API (обязательно)
   - Google Drive API (рекомендуется)

2. **Настроить OAuth Consent Screen:**
   - Добавить scope: `https://www.googleapis.com/auth/drive.readonly`

3. **Создать/проверить OAuth 2.0 Client ID:**
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

4. **(Опционально) Создать API Key для Picker**

## Настройка переменных окружения

Добавить в `.env.local`:

```bash
# Обязательные для Google OAuth и Drive Import
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Опционально: улучшает производительность Picker
NEXT_PUBLIC_GOOGLE_API_KEY="your-api-key"
```

## Проверка работы

1. Запустить приложение: `npm run dev`
2. Перейти на страницу импорта: `/docs/import`
3. Нажать кнопку **"Import from Google Drive"**
4. Войти в Google аккаунт (если не авторизован)
5. Выбрать файл из Google Drive
6. Файл должен автоматически загрузиться и обработаться

## Поддерживаемые форматы

- DOCX (Word документы)
- XLSX (Excel таблицы)

## Ограничения

- Максимальный размер файла: 15MB (изображения хранятся отдельно в Spaces, учитывается только текстовое содержимое)
- Требуется авторизация через Google OAuth
- Файлы должны быть доступны выбранному Google аккаунту

## Troubleshooting

### Ошибка "Google OAuth not configured"
- Проверить, что `GOOGLE_CLIENT_ID` установлен в `.env.local`
- Перезапустить dev server после изменения `.env.local`

### Ошибка "Failed to load Google API"
- Проверить интернет-соединение
- Проверить, что нет блокировки Google API в браузере (ad blockers)

### Ошибка "Failed to download file"
- Проверить, что файл доступен выбранному Google аккаунту
- Проверить, что scope `drive.readonly` добавлен в OAuth consent screen

### Picker не открывается на мобильных
- Убедиться, что используется HTTPS в продакшене
- Проверить, что домен добавлен в Authorized JavaScript origins

