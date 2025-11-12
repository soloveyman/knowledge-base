# Тестирование Stripe с текущей настройкой (Live Mode)

## ⚠️ Важно: Вы используете Live режим

Ваши текущие ключи - **Live** (`sk_live_...`, `pk_live_...`). Это означает:
- ✅ Можно тестировать с тестовыми картами
- ⚠️ Будьте осторожны - некоторые операции могут создавать реальные платежи
- ✅ Test карты работают и в Live режиме для тестирования

---

## 🧪 Способы тестирования

### 1. Тестовые карты Stripe (безопасно)

Stripe позволяет использовать тестовые карты даже в Live режиме для проверки интеграции.

#### Успешный платеж:
```
Card Number: 4242 4242 4242 4242
Expiry: Любая будущая дата (12/34)
CVC: Любые 3 цифры (123)
ZIP: Любые 5 цифр (12345)
```

#### Другие сценарии:
```
❌ Отклоненная карта: 4000 0000 0000 0002
⚠️ Требует 3D Secure: 4000 0025 0000 3155
💳 Дебетовая карта: 4000 0566 5566 5556
```

**Полный список:** https://stripe.com/docs/testing

---

### 2. Проверка текущей конфигурации

```bash
# Проверить статус Stripe
npx tsx scripts/check-stripe-status.ts

# Проверить подключение к API
npx tsx scripts/verify-stripe.ts
```

---

### 3. Тестирование через приложение

#### Шаг 1: Откройте приложение
- Перейдите на страницу подписки (Owner → Settings)
- Выберите план (Standard или Pro)

#### Шаг 2: Создайте checkout
- Нажмите "Subscribe" или "Upgrade"
- Вас перенаправит на Stripe Checkout

#### Шаг 3: Используйте тестовую карту
- Введите: `4242 4242 4242 4242`
- Любая будущая дата (например, 12/34)
- Любой CVC (например, 123)
- Любой ZIP (например, 12345)

#### Шаг 4: Проверьте результат
- После успешного платежа вы вернетесь в приложение
- Проверьте, что подписка создана
- Проверьте логи Railway на наличие webhook событий

---

### 4. Тестирование Webhooks

#### Через Stripe Dashboard:

1. Перейдите: https://dashboard.stripe.com/webhooks
2. Найдите ваш webhook endpoint
3. Нажмите **"Send test webhook"**
4. Выберите событие:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `invoice.payment_succeeded`
5. Нажмите **"Send test webhook"**

#### Проверка логов Railway:

```powershell
# Через Railway CLI
railway logs --tail 50

# Или через Dashboard
# Railway → knowledge-base service → Logs
```

Ищите сообщения:
```
[Stripe Webhook] Received event: checkout.session.completed
[Stripe Webhook] Processing checkout.session.completed...
[Stripe Webhook] Successfully processed...
```

---

### 5. Проверка данных в базе

После тестирования checkout проверьте, что данные созданы:

```bash
# Проверить webhook и данные
npx tsx scripts/test-stripe-webhook.ts
```

Или через SQL:
```sql
-- Проверить подписки
SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 5;

-- Проверить платежи
SELECT * FROM payments ORDER BY created_at DESC LIMIT 5;
```

---

### 6. Тестирование через API напрямую

Можно создать тестовый checkout session через API:

```bash
# POST /api/stripe/create-checkout
# Body: { "planId": "your-plan-id" }
```

Или использовать curl:
```bash
curl -X POST https://knowledge-base.up.railway.app/api/stripe/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"planId":"your-plan-id"}'
```

---

## 🔍 Что проверить после тестирования

### ✅ Успешный сценарий:

1. **Checkout создан:**
   - ✅ Redirect на Stripe Checkout работает
   - ✅ Правильный план отображается
   - ✅ Цена корректная

2. **Платеж обработан:**
   - ✅ После оплаты возврат в приложение
   - ✅ Подписка создана в базе данных
   - ✅ Платеж записан в таблицу payments
   - ✅ Webhook события получены

3. **Данные в базе:**
   - ✅ `subscriptions` таблица содержит новую подписку
   - ✅ `payments` таблица содержит платеж
   - ✅ Статус подписки: `active`
   - ✅ Статус платежа: `completed`

---

## ⚠️ Важные предупреждения

1. **Test карты в Live режиме:**
   - Test карты (`4242 4242 4242 4242`) работают в Live режиме
   - Они **НЕ списывают реальные деньги**
   - Но создают реальные записи в Stripe Dashboard

2. **Реальные карты:**
   - Если используете реальную карту, будет реальный платеж!
   - Начните с минимальной суммы для тестирования

3. **Отмена тестовых подписок:**
   - После тестирования отмените тестовые подписки в Stripe Dashboard
   - Или через Customer Portal в приложении

---

## 🚀 Быстрый тест

1. **Откройте приложение:**
   ```
   https://knowledge-base.up.railway.app/owner?tab=settings
   ```

2. **Выберите план и нажмите Subscribe**

3. **Используйте тестовую карту:**
   - `4242 4242 4242 4242`
   - Дата: `12/34`
   - CVC: `123`

4. **Проверьте результат:**
   - Вернулись в приложение?
   - Подписка отображается?
   - Проверьте логи Railway

---

## 📊 Проверка после теста

```bash
# 1. Проверить статус Stripe
npx tsx scripts/check-stripe-status.ts

# 2. Проверить webhook данные
npx tsx scripts/test-stripe-webhook.ts

# 3. Проверить логи Railway
railway logs --tail 100
```

---

## 🆘 Если что-то не работает

1. **Проверьте ключи:**
   ```bash
   npx tsx scripts/check-stripe-status.ts
   ```

2. **Проверьте webhook:**
   - Убедитесь, что endpoint создан в Stripe Dashboard
   - Проверьте, что webhook secret правильный

3. **Проверьте логи:**
   - Railway logs для ошибок
   - Stripe Dashboard → Webhooks → Events для статуса

4. **Проверьте базу данных:**
   - Убедитесь, что таблицы существуют
   - Проверьте подключение к БД

---

## 📚 Полезные ссылки

- **Test Cards:** https://stripe.com/docs/testing
- **Webhooks:** https://dashboard.stripe.com/webhooks
- **Payments:** https://dashboard.stripe.com/payments
- **Subscriptions:** https://dashboard.stripe.com/subscriptions

