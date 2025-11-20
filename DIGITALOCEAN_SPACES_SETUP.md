# DigitalOcean Spaces - Настройка для Vercel и Railway

## Что нужно настроить

Для работы с DigitalOcean Spaces нужно добавить переменные окружения на Vercel и Railway.

## Переменные окружения

Добавьте следующие переменные в **оба** окружения (Vercel и Railway):

```bash
DO_SPACES_ENDPOINT=uppstaff.ams3.digitaloceanspaces.com
DO_SPACES_CDN_ENDPOINT=uppstaff.ams3.cdn.digitaloceanspaces.com
DO_SPACES_KEY=your-spaces-access-key
DO_SPACES_SECRET=your-spaces-secret-key
DO_SPACES_BUCKET=uppstaff
DO_SPACES_REGION=ams3
DO_SPACES_USE_CDN=true
```

## Где взять ключи

1. Откройте [DigitalOcean Dashboard](https://cloud.digitalocean.com/)
2. Перейдите в **Spaces** → выберите ваш Space (`uppstaff`)
3. Перейдите в **Settings** → **Spaces Keys**
4. Нажмите **Generate New Key**
5. Скопируйте:
   - **Access Key** → это `DO_SPACES_KEY`
   - **Secret Key** → это `DO_SPACES_SECRET`

**Важно:** Secret Key показывается только один раз! Сохраните его сразу.

## Настройка на Vercel

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте все переменные из списка выше:
   - Нажмите **Add New**
   - Введите **Key** (например, `DO_SPACES_KEY`)
   - Введите **Value** (ваш ключ)
   - Выберите окружения: **Production**, **Preview**, **Development**
   - Нажмите **Save**
5. Повторите для всех переменных
6. После добавления всех переменных:
   - Перейдите в **Deployments**
   - Выберите последний деплой
   - Нажмите **Redeploy** (или дождитесь автоматического перезапуска)

## Настройка на Railway

1. Откройте [Railway Dashboard](https://railway.app/dashboard)
2. Выберите ваш проект
3. Выберите ваш сервис (Next.js приложение)
4. Перейдите на вкладку **Variables**
5. Добавьте все переменные:
   - Нажмите **+ New Variable**
   - Введите **Key** (например, `DO_SPACES_KEY`)
   - Введите **Value** (ваш ключ)
   - Нажмите **Add**
6. Повторите для всех переменных
7. Railway автоматически перезапустит деплой после добавления переменных

## Миграция базы данных

После добавления переменных окружения нужно применить миграцию БД:

### На Railway

Миграция применяется автоматически при деплое, если настроен скрипт `db:migrate` в `package.json`.

Или вручную через Railway CLI:
```bash
railway run npm run db:migrate
```

### На Vercel

Vercel не поддерживает выполнение миграций напрямую. Варианты:

1. **Через Railway** (если БД на Railway):
   - Подключитесь к Railway
   - Выполните миграцию через Railway CLI или Dashboard

2. **Через локальную машину**:
   ```bash
   # Установите Railway CLI
   npm install -g @railway/cli
   
   # Подключитесь к проекту
   railway link
   
   # Выполните миграцию
   railway run npm run db:migrate
   ```

3. **Через SQL напрямую**:
   - Подключитесь к БД через pgAdmin или другой клиент
   - Выполните SQL из `drizzle/0008_add_spaces_storage.sql`:
   ```sql
   ALTER TABLE "document_images" 
   ADD COLUMN IF NOT EXISTS "url" text,
   ADD COLUMN IF NOT EXISTS "storage_key" text;

   ALTER TABLE "document_images" 
   ALTER COLUMN "data" DROP NOT NULL;
   ```

## Проверка работы

После настройки проверьте:

1. **Загрузите документ с изображениями**
   - Изображения должны загружаться в Spaces
   - В БД должны сохраняться `url` и `storage_key`

2. **Проверьте логи**:
   - В Vercel/Railway логах должны быть сообщения:
     - `✅ Uploaded image ... to Spaces: https://...`
   - Не должно быть ошибок типа `DigitalOcean Spaces not configured`

3. **Проверьте Spaces**:
   - Откройте DigitalOcean Dashboard → Spaces
   - В папке `documents/` должны появиться загруженные изображения

## Важные замечания

- **Bucket должен быть публичным** (ACL: public-read) для прямого доступа к изображениям
- Если bucket приватный, нужно настроить CORS и использовать signed URLs
- **CDN endpoint** (`uppstaff.ams3.cdn.digitaloceanspaces.com`) быстрее для публичных файлов
- **Origin endpoint** (`uppstaff.ams3.digitaloceanspaces.com`) используется для загрузки

## Устранение проблем

### Ошибка: "DigitalOcean Spaces not configured"
- Проверьте, что все переменные окружения добавлены
- Проверьте правильность ключей
- Перезапустите деплой после добавления переменных

### Ошибка: "Access Denied" при загрузке
- Проверьте права доступа ключей в DigitalOcean
- Убедитесь, что ключи имеют права на запись в bucket

### Изображения не отображаются
- Проверьте, что bucket публичный (ACL: public-read)
- Проверьте CORS настройки в Spaces
- Проверьте, что URL правильный в БД

## Безопасность

- **Никогда не коммитьте ключи в Git!**
- Используйте переменные окружения только в панелях Vercel/Railway
- Регулярно ротируйте ключи доступа
- Используйте минимально необходимые права доступа для ключей

