# Как получить Price IDs из Stripe Dashboard

## Способ 1: Через Products (рекомендуется)

1. Перейдите: https://dashboard.stripe.com/products
2. Найдите нужный Product (например, "Standard Plan")
3. Нажмите на Product
4. В разделе **"Pricing"** вы увидите Price ID
5. Скопируйте Price ID (начинается с `price_...`)

**Пример:**
```
Product: Standard Plan
├─ Pricing
   └─ $45.00 USD / month
      Price ID: price_1AbCdEfGhIjKlMnOpQrStUv
      [Copy]
```

## Способ 2: Через Payment Links

Если у вас есть Payment Links, можно получить Price ID:

1. Перейдите: https://dashboard.stripe.com/payment-links
2. Найдите нужный Payment Link
3. Нажмите на него
4. В разделе **"Line items"** вы увидите Price ID

## Ваши Payment Links:

- **Monthly: Standard** - https://buy.stripe.com/8x200l7QO9Uo1Lc8axcwg00
- **Monthly: PRO** - https://buy.stripe.com/eVqbJ32wu0jO2Pg8axcwg01
- **Annual: Standard** - https://buy.stripe.com/4gMdRb3AyfeI1Lc9eBcwg02
- **Annual: PRO** - https://buy.stripe.com/5kQdRbfjg3w0gG69eBcwg03

## После получения Price IDs:

1. **Добавьте поле в базу данных:**
   ```bash
   npx tsx scripts/add-stripe-price-id-column.ts
   ```

2. **Обновите планы:**
   ```bash
   npx tsx scripts/update-plans-with-price-ids.ts
   ```
   
   Или вручную через SQL:
   ```sql
   UPDATE subscription_plans 
   SET stripe_price_id = 'price_xxx' 
   WHERE name = 'standard' AND interval = 'month';
   
   UPDATE subscription_plans 
   SET stripe_price_id = 'price_yyy' 
   WHERE name = 'pro' AND interval = 'month';
   ```

## Важно:

- **Test vs Live**: Price IDs разные для Test и Live режимов
- **Формат**: Price ID начинается с `price_` (например, `price_1AbCdEfGhIjKlMnOpQrStUv`)
- **Проверка**: После обновления проверьте, что Price IDs правильно сохранены

