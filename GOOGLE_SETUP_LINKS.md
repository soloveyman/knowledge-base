# Быстрые ссылки для настройки Google Cloud Console

## 🔗 Прямые ссылки на настройки

### APIs & Services
- **APIs Library** (включить API): https://console.cloud.google.com/apis/library
- **OAuth Consent Screen**: https://console.cloud.google.com/apis/credentials/consent
- **Credentials** (OAuth Client ID, API Keys): https://console.cloud.google.com/apis/credentials

### Что нужно сделать

1. **Включить API** → [APIs Library](https://console.cloud.google.com/apis/library)
   - Найти: `Google Picker API` → Enable
   - Найти: `Google Drive API` → Enable

2. **Добавить scope** → [OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)
   - Edit App → Scopes → Add `https://www.googleapis.com/auth/drive.readonly`

3. **Проверить/создать OAuth Client** → [Credentials](https://console.cloud.google.com/apis/credentials)
   - Проверить Authorized JavaScript origins: `http://localhost:3000`
   - Проверить Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`

4. **(Опционально) API Key** → [Credentials](https://console.cloud.google.com/apis/credentials)
   - Create Credentials → API key → Ограничить для Google Picker API

## 📚 Документация

- **Детальная инструкция**: [GOOGLE_CLOUD_SETUP_GUIDE.md](./GOOGLE_CLOUD_SETUP_GUIDE.md)
- **Быстрая проверка существующей конфигурации**: [GOOGLE_OAUTH_QUICK_CHECK.md](./GOOGLE_OAUTH_QUICK_CHECK.md)
- **Общая информация**: [GOOGLE_DRIVE_IMPORT_SETUP.md](./GOOGLE_DRIVE_IMPORT_SETUP.md)

