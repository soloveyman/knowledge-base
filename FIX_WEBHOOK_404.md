# Исправление 404 для Webhook Endpoint

## Проблема

Webhook endpoint возвращает 404:
```
https://knowledge-base.up.railway.app/api/stripe/webhook → 404 Not Found
```

## Возможные причины

1. **Приложение не задеплоено на Railway**
2. **Маршрут не существует или неправильно настроен**
3. **Проблема с роутингом Next.js**

## Решения

### 1. Проверьте статус деплоя на Railway

1. Откройте: https://railway.app/dashboard
2. Выберите проект → сервис **knowledge-base**
3. Перейдите на вкладку **Deployments**
4. Проверьте:
   - ✅ Последний деплой имеет статус **Active** (зеленый)
   - ❌ Если статус **Failed** или **Building** - нужно подождать или перезапустить

### 2. Запустите новый деплой

Если деплой не активен:

**Вариант A: Через Railway Dashboard**
1. Railway Dashboard → knowledge-base service
2. **Deployments** → **Redeploy** (или **Deploy**)

**Вариант B: Через Railway CLI**
```powershell
railway up
```

**Вариант C: Push в Git (автоматический деплой)**
```powershell
git push
```

### 3. Проверьте, что приложение работает

После деплоя проверьте:

```powershell
# Проверка главной страницы
curl -I https://knowledge-base.up.railway.app

# Проверка health endpoint (если есть)
curl -I https://knowledge-base.up.railway.app/api/health

# Проверка webhook endpoint (должен вернуть 200 после добавления GET метода)
curl https://knowledge-base.up.railway.app/api/stripe/webhook
```

### 4. Проверьте логи Railway

```powershell
railway logs --tail 50
```

Ищите:
- ✅ "Ready" или "Compiled successfully"
- ❌ Ошибки компиляции или запуска
- ❌ Ошибки подключения к базе данных

### 5. Проверьте переменные окружения

Убедитесь, что все переменные установлены:

```powershell
railway variables --json | ConvertFrom-Json | Select-Object STRIPE_SECRET_KEY,STRIPE_PUBLISHABLE_KEY,STRIPE_WEBHOOK_SECRET,DATABASE_URL
```

---

## После исправления

После того как приложение задеплоится:

1. **Проверьте webhook endpoint:**
   ```powershell
   curl https://knowledge-base.up.railway.app/api/stripe/webhook
   ```
   
   Должен вернуть:
   ```json
   {
     "status": "ok",
     "endpoint": "/api/stripe/webhook",
     "configured": true,
     "message": "Stripe webhook endpoint is ready..."
   }
   ```

2. **Отправьте тестовый webhook из Stripe Dashboard:**
   - https://dashboard.stripe.com/webhooks
   - Выберите endpoint → **Send test webhook**
   - Событие: `checkout.session.completed`

3. **Проверьте логи:**
   ```powershell
   railway logs --tail 50
   ```
   
   Должны увидеть:
   ```
   [Stripe Webhook] Received event: checkout.session.completed
   ```

---

## Быстрая проверка

```powershell
# 1. Проверить статус
railway status

# 2. Проверить логи
railway logs --tail 20

# 3. Проверить endpoint (после деплоя)
curl https://knowledge-base.up.railway.app/api/stripe/webhook

# 4. Проверить конфигурацию
npx tsx scripts/check-stripe-status.ts
```

