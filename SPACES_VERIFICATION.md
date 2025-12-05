# Проверка работы DigitalOcean Spaces для изображений

## 📋 Обзор системы

### Архитектура хранения изображений

1. **Загрузка изображений** → DigitalOcean Spaces (S3-compatible)
2. **Метаданные** → PostgreSQL (таблица `document_images`)
3. **Отображение** → Прямые URL из Spaces/CDN

## 🔍 Проверка конфигурации

### Переменные окружения (требуются)

```env
DO_SPACES_KEY=your-access-key
DO_SPACES_SECRET=your-secret-key
DO_SPACES_ENDPOINT=ams3.digitaloceanspaces.com
DO_SPACES_CDN_ENDPOINT=ams3.cdn.digitaloceanspaces.com
DO_SPACES_BUCKET=your-bucket-name
DO_SPACES_REGION=ams3
DO_SPACES_USE_CDN=true
```

### Проверка конфигурации в коде

**Файл:** `lib/storage/spaces.ts`

- ✅ Проверка наличия ключей при инициализации
- ✅ Логирование статуса конфигурации
- ✅ Ошибка при попытке загрузки без конфигурации

## 📤 Процесс сохранения изображений

### 1. При загрузке документа (`POST /api/documents`)

**Файл:** `app/api/documents/route.ts` (строки 352-427)

**Шаги:**
1. Изображения извлекаются из DOCX/XLSX файла
2. Каждое изображение конвертируется из base64 в Buffer
3. Загрузка в Spaces через `uploadImageToSpaces()`:
   ```typescript
   const uploadResult = await uploadImageToSpaces(
     imageBuffer,
     img.filename,
     img.type,
     `documents/${documentId}` // Папка в Spaces
   )
   ```
4. Сохранение метаданных в БД:
   ```typescript
   await db.insert(documentImages).values({
     documentId,
     filename: img.filename,
     url: uploadResult.url,        // URL из Spaces
     storageKey: uploadResult.key, // Ключ в Spaces
     type: img.type,
     position: img.position
   })
   ```
5. Замена base64 в `parsedContent` на URL из Spaces

**Обработка ошибок:**
- ❌ Если загрузка в Spaces не удалась → изображение **пропускается**
- ❌ Base64 **не сохраняется** (политика безопасности)
- ⚠️ Логируется ошибка, процесс продолжается

### 2. Функция загрузки (`uploadImageToSpaces`)

**Файл:** `lib/storage/spaces.ts` (строки 78-162)

**Процесс:**
1. Проверка конфигурации Spaces
2. Генерация уникального ключа: `documents/{documentId}/{timestamp}-{filename}`
3. Загрузка через AWS SDK S3 Client:
   ```typescript
   const command = new PutObjectCommand({
     Bucket: spacesBucket,
     Key: key,
     Body: buffer,
     ContentType: contentType,
     ACL: 'public-read', // Публичный доступ
   })
   await s3Client.send(command)
   ```
4. Формирование URL:
   - **Origin URL:** `https://{endpoint}/{bucket}/{key}`
   - **CDN URL:** `https://{bucket}.{cdn-endpoint}/{key}`
   - Возвращается CDN URL если `DO_SPACES_USE_CDN=true`

## 📥 Процесс получения изображений

### 1. При отображении документа

**Файл:** `app/docs/[filename]/page.tsx` и `app/read/[documentId]/page.tsx`

**Шаги:**
1. Документ загружается из БД с `parsedContent`
2. Изображения извлекаются из `parsedContent.images[]`
3. Каждое изображение имеет:
   - `url` - прямой URL из Spaces (приоритет)
   - `imageId` - ID в БД (fallback)
4. Изображения вставляются в markdown контент:
   ```markdown
   ![filename](https://bucket.cdn.digitaloceanspaces.com/documents/.../image.png)
   ```

### 2. API для получения изображения (`GET /api/documents/images/[id]`)

**Файл:** `app/api/documents/images/[id]/route.ts`

**Процесс:**
1. Проверка авторизации и доступа к документу
2. Получение изображения из БД по ID
3. Возврат URL из Spaces:
   ```json
   {
     "success": true,
     "data": {
       "id": "...",
       "filename": "...",
       "url": "https://bucket.cdn.digitaloceanspaces.com/..."
     }
   }
   ```
4. Если URL нет → ошибка 404 (base64 storage отключен)

### 3. Отображение в компоненте

**Файл:** `components/common/document-renderer.tsx`

**Процесс:**
1. Markdown парсится с изображениями
2. Для каждого изображения:
   - Проверка типа URL (data URL, external URL)
   - Для внешних URL (Spaces) используется `<img>` или Next.js `<Image>`
   - Поддержка lazy loading для больших изображений
   - Priority loading для маленьких (иконки, QR коды)

## ✅ Проверочный список

### Конфигурация
- [ ] Все переменные окружения установлены
- [ ] Spaces bucket существует и доступен
- [ ] CDN endpoint настроен (опционально)
- [ ] ACL настроен на `public-read` для изображений

### Загрузка
- [ ] Изображения успешно загружаются в Spaces
- [ ] URL сохраняются в БД в таблице `document_images`
- [ ] Base64 данные удаляются из `parsedContent`
- [ ] Ошибки загрузки логируются, но не блокируют процесс

### Отображение
- [ ] Изображения отображаются из Spaces URL
- [ ] CDN работает (если включен)
- [ ] Изображения загружаются с правильными заголовками CORS
- [ ] Lazy loading работает для больших изображений

### Безопасность
- [ ] Доступ к изображениям проверяется через доступ к документу
- [ ] Base64 storage отключен
- [ ] Все изображения публичные (ACL: public-read)

## 🧪 Тестирование

### 1. Проверка конфигурации

```typescript
// В консоли сервера должно быть:
✅ Spaces configured: bucket="your-bucket", endpoint="ams3.digitaloceanspaces.com"
✅ Spaces CDN: ams3.cdn.digitaloceanspaces.com, useCdn: true
```

### 2. Тест загрузки

1. Загрузите документ с изображениями
2. Проверьте логи:
   ```
   📤 Uploading to Spaces: { bucket, key, filename, contentType, size }
   ✅ Successfully uploaded to Spaces: documents/{id}/{timestamp}-{filename}
   ✅ Saved image to database: {id} for {filename}
   ```
3. Проверьте БД:
   ```sql
   SELECT id, filename, url, storage_key 
   FROM document_images 
   WHERE document_id = '{documentId}';
   ```
4. Проверьте Spaces:
   - URL должен быть доступен: `https://bucket.cdn.digitaloceanspaces.com/...`

### 3. Тест отображения

1. Откройте документ в браузере
2. Проверьте Network tab:
   - Изображения должны загружаться с CDN/Spaces URL
   - Статус 200 OK
   - Правильные заголовки CORS
3. Проверьте консоль:
   - Нет ошибок загрузки изображений
   - Все изображения отображаются

## 🐛 Типичные проблемы

### 1. "DigitalOcean Spaces not configured"
**Причина:** Отсутствуют переменные окружения
**Решение:** Установите `DO_SPACES_KEY` и `DO_SPACES_SECRET`

### 2. "Spaces upload failed"
**Причины:**
- Неверные credentials
- Bucket не существует
- Недостаточно прав
- Проблемы с сетью

**Решение:**
- Проверьте credentials в DigitalOcean
- Убедитесь, что bucket существует
- Проверьте права доступа (ACL)

### 3. Изображения не отображаются
**Причины:**
- URL неверный
- CORS не настроен
- Изображение не загружено в Spaces

**Решение:**
- Проверьте URL в БД
- Настройте CORS в Spaces settings
- Проверьте, что изображение существует в Spaces

### 4. CORS ошибки
**Решение:** Настройте CORS в DigitalOcean Spaces:
```
Allowed Origins: *
Allowed Methods: GET, HEAD
Allowed Headers: *
Max Age: 3600
```

## 📊 Мониторинг

### Логи для отслеживания

**Успешная загрузка:**
```
✅ Successfully uploaded to Spaces: {key} ({size} bytes)
✅ Saved image to database: {id} for {filename}
```

**Ошибки:**
```
❌ Spaces upload failed: {error, code, name}
❌ Failed to upload {filename} to Spaces: {error}
```

### Метрики

- Количество загруженных изображений
- Размер загруженных изображений
- Время загрузки
- Процент успешных загрузок
- Количество ошибок

## 🔗 Связанные файлы

- `lib/storage/spaces.ts` - Основная логика работы с Spaces
- `app/api/documents/route.ts` - Загрузка документов и изображений
- `app/api/documents/images/[id]/route.ts` - API получения изображений
- `components/common/document-renderer.tsx` - Отображение изображений
- `lib/image-loader.ts` - Загрузка изображений (legacy, не используется)

