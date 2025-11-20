# Исправление DO_SPACES_ENDPOINT в Vercel и Railway

## Проблема

Ошибка при загрузке изображений:
```
Hostname/IP does not match certificate's altnames: 
Host: uppstaff.uppstaff.ams3.digitaloceanspaces.com
```

Это происходит из-за неправильного формата `DO_SPACES_ENDPOINT`.

## Решение

Измените `DO_SPACES_ENDPOINT` в **оба** окружения (Vercel и Railway):

### ❌ Неправильно:
```
DO_SPACES_ENDPOINT=uppstaff.ams3.digitaloceanspaces.com
```

### ✅ Правильно:
```
DO_SPACES_ENDPOINT=ams3.digitaloceanspaces.com
```

**Важно:** Endpoint должен быть БЕЗ имени bucket!

## Инструкция для Vercel

1. Откройте [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите переменную `DO_SPACES_ENDPOINT`
5. Нажмите на неё для редактирования
6. Измените значение на: `ams3.digitaloceanspaces.com`
7. Нажмите **Save**
8. Перейдите в **Deployments**
9. Выберите последний деплой
10. Нажмите **Redeploy** (или дождитесь автоматического перезапуска)

## Инструкция для Railway

1. Откройте [Railway Dashboard](https://railway.app/dashboard)
2. Выберите ваш проект
3. Выберите ваш сервис (Next.js приложение)
4. Перейдите на вкладку **Variables**
5. Найдите переменную `DO_SPACES_ENDPOINT`
6. Нажмите на неё для редактирования
7. Измените значение на: `ams3.digitaloceanspaces.com`
8. Нажмите **Save**
9. Railway автоматически перезапустит деплой

## Проверка правильности настроек

После исправления проверьте, что все переменные установлены правильно:

```bash
DO_SPACES_ENDPOINT=ams3.digitaloceanspaces.com          # ✅ БЕЗ bucket
DO_SPACES_CDN_ENDPOINT=uppstaff.ams3.cdn.digitaloceanspaces.com  # ✅ С bucket
DO_SPACES_BUCKET=uppstaff                               # ✅ Имя bucket отдельно
DO_SPACES_REGION=ams3                                   # ✅ Регион
```

## После исправления

1. Дождитесь перезапуска деплоя
2. Попробуйте загрузить документ с изображениями
3. Проверьте логи - не должно быть ошибок с hostname
4. Изображения должны успешно загружаться в Spaces

## Почему это важно?

Код теперь использует **path-style URLs** (`forcePathStyle: true`), где:
- Endpoint: `ams3.digitaloceanspaces.com` (регион + домен)
- Bucket: `uppstaff` (отдельная переменная)
- URL формируется как: `https://ams3.digitaloceanspaces.com/uppstaff/key`

Если endpoint содержит bucket name, это создаёт дублирование и ошибку SSL certificate.

