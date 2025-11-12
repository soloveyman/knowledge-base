# Настройка Products и Prices в Stripe

## Шаг 1: Создайте Products в Stripe Dashboard

1. Перейдите: https://dashboard.stripe.com/products
2. Нажмите **"+ Add product"**
3. Для каждого тарифа создайте Product:

### Product: Standard Plan
- **Name**: `Standard Plan` (или `Uppstaff Standard`)
- **Description**: `For small teams and startups`
- **Pricing model**: `Standard pricing`
- **Price**: `$45.00` USD
- **Billing period**: `Monthly` (или `Yearly` если нужен годовой)
- Нажмите **"Save product"**
- **Скопируйте Price ID** (начинается с `price_...`)

### Product: Pro Plan
- **Name**: `Pro Plan` (или `Uppstaff Pro`)
- **Description**: `For growing companies and networks`
- **Pricing model**: `Standard pricing`
- **Price**: `$99.00` USD
- **Billing period**: `Monthly`
- Нажмите **"Save product"**
- **Скопируйте Price ID**

## Шаг 2: Добавьте поле stripe_price_id в базу данных

Запустите миграцию:

```bash
tsx scripts/add-stripe-price-id-column.ts
```

Или вручную через SQL:

```sql
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
```

## Шаг 3: Обновите планы в базе данных

Подключитесь к базе данных и обновите планы:

```sql
-- Замените price_xxx на реальные Price IDs из Stripe
UPDATE subscription_plans 
SET stripe_price_id = 'price_xxx' 
WHERE name = 'standard';

UPDATE subscription_plans 
SET stripe_price_id = 'price_yyy' 
WHERE name = 'pro';
```

Или через скрипт (создайте файл `scripts/update-stripe-price-ids.ts`):

```typescript
// Пример обновления
await db
  .update(subscriptionPlans)
  .set({ stripePriceId: 'price_xxx' })
  .where(eq(subscriptionPlans.name, 'standard'));
```

## Шаг 4: Проверка

После обновления:
- Код будет использовать `stripePriceId` если он установлен
- Если `stripePriceId` не установлен, будет использоваться динамическое создание (`price_data`)
- Это обратная совместимость - старые планы продолжат работать

## Преимущества использования Price IDs

✅ **Лучше для продакшена:**
- Products и Prices видны в Stripe Dashboard
- Легче управлять ценами
- Можно создавать купоны и промокоды
- Лучшая аналитика в Stripe

✅ **Безопасность:**
- Цены контролируются в Stripe
- Невозможно случайно изменить цену через код

## Важно

- **Test vs Live**: Создайте отдельные Products/Prices для test и live режимов
- **Price ID формат**: `price_1234567890abcdef` (начинается с `price_`)
- **Обратная совместимость**: Если `stripePriceId` не установлен, код использует `price_data` (как сейчас)

