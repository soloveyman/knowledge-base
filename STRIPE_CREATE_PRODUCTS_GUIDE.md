# Пошаговая инструкция: Создание Products в Stripe

## Планы для создания

На основе вашей базы данных нужно создать:

1. **Standard Plan** - $45/месяц
2. **Pro Plan** - $99/месяц

---

## Шаг 1: Откройте Stripe Dashboard

1. Перейдите: https://dashboard.stripe.com/products
2. Убедитесь, что вы в правильном аккаунте (Live или Test режим)
3. Нажмите **"+ Add product"** (или **"+ Добавить продукт"**)

---

## Шаг 2: Создайте Product "Standard Plan"

### Основная информация:
- **Name**: `Standard Plan` (или `Uppstaff Standard`)
- **Description**: `For small teams and startups`

### Pricing:
- **Pricing model**: Выберите **"Standard pricing"**
- **Price**: `45.00`
- **Currency**: `USD` (или другая валюта, если нужно)
- **Billing period**: Выберите **"Monthly"** (ежемесячно)

### Дополнительно (опционально):
- Можно добавить изображение продукта
- Можно добавить метаданные

### Сохранение:
1. Нажмите **"Save product"** (или **"Сохранить продукт"**)
2. После сохранения вы увидите **Price ID** (начинается с `price_...`)
3. **ВАЖНО**: Скопируйте этот Price ID и сохраните его!

**Пример Price ID**: `price_1AbCdEfGhIjKlMnOpQrStUv`

---

## Шаг 3: Создайте Product "Pro Plan"

### Основная информация:
- **Name**: `Pro Plan` (или `Uppstaff Pro`)
- **Description**: `For growing companies and networks`

### Pricing:
- **Pricing model**: Выберите **"Standard pricing"**
- **Price**: `99.00`
- **Currency**: `USD`
- **Billing period**: Выберите **"Monthly"** (ежемесячно)

### Сохранение:
1. Нажмите **"Save product"**
2. Скопируйте **Price ID** для Pro плана

---

## Шаг 4: Запишите Price IDs

Создайте файл или запишите где-то:

```
Standard Plan:
Price ID: price_xxx (замените на реальный)

Pro Plan:
Price ID: price_yyy (замените на реальный)
```

---

## Шаг 5: Проверка

После создания Products:

1. Перейдите: https://dashboard.stripe.com/products
2. Вы должны увидеть оба продукта:
   - Standard Plan - $45.00/month
   - Pro Plan - $99.00/month

3. Нажмите на каждый продукт, чтобы увидеть Price ID

---

## Важные замечания

### Test vs Live режим:
- **Test режим**: Используйте для разработки и тестирования
- **Live режим**: Используйте для продакшена (реальные платежи)

⚠️ **Важно**: Price IDs разные для Test и Live режимов!

### Если нужны годовые планы:
Если вы планируете добавить годовые тарифы:
- Создайте отдельные Products для годовых планов
- Или добавьте дополнительные Prices к существующим Products

---

## Что дальше?

После создания Products и получения Price IDs:

1. ✅ Запустите миграцию: `tsx scripts/add-stripe-price-id-column.ts`
2. ✅ Обновите планы в базе данных с Price IDs
3. ✅ Протестируйте checkout

См. `STRIPE_PRODUCTS_SETUP.md` для следующих шагов.

---

## Скриншоты (примерный вид)

### Создание Product:
```
┌─────────────────────────────────────┐
│ Add product                         │
├─────────────────────────────────────┤
│ Name: [Standard Plan          ]     │
│ Description: [For small teams...]    │
│                                      │
│ Pricing:                             │
│ ○ One time                          │
│ ● Recurring                         │
│   Price: [$45.00]                   │
│   Currency: [USD ▼]                 │
│   Billing period: [Monthly ▼]       │
│                                      │
│ [Cancel]  [Save product]            │
└─────────────────────────────────────┘
```

### После создания (Price ID):
```
┌─────────────────────────────────────┐
│ Standard Plan                       │
├─────────────────────────────────────┤
│ Price ID: price_1AbCdEfGhIjKlMn... │
│ [Copy]                              │
│                                      │
│ $45.00 USD / month                  │
└─────────────────────────────────────┘
```

