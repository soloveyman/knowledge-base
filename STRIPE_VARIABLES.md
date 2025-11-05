# Переменные окружения для Stripe

## Обязательные переменные

### `STRIPE_SECRET_KEY`
**Тип:** `string`  
**Обязательность:** Обязательно для работы Stripe  
**Формат:** `sk_test_...` (test) или `sk_live_...` (production)

Секретный ключ API Stripe для серверной части. Используется для:
- Инициализации Stripe клиента (`lib/stripe/client.ts`)
- Создания checkout сессий (`app/api/stripe/create-checkout/route.ts`)
- Создания billing portal сессий (`app/api/stripe/create-portal/route.ts`)
- Обработки webhook событий (`app/api/stripe/webhook/route.ts`)

**Где получить:**
1. Зайдите на https://dashboard.stripe.com/apikeys
2. Скопируйте **Secret key** (не Publishable key)
3. Для разработки используйте test ключ (`sk_test_...`)
4. Для продакшена используйте live ключ (`sk_live_...`)

**Пример:**
```env
STRIPE_SECRET_KEY="sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
```

---

### `STRIPE_PUBLISHABLE_KEY` или `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
**Тип:** `string`  
**Обязательность:** Обязательно для работы Stripe на клиенте  
**Формат:** `pk_test_...` (test) или `pk_live_...` (production)

Публичный ключ Stripe для клиентской части. Используется в:
- Компонентах подписки для инициализации Stripe.js
- Функции `getStripePublishableKey()` в `lib/stripe/client.ts`

**Приоритет:** Если установлены обе переменные, используется `STRIPE_PUBLISHABLE_KEY`, затем `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

**Где получить:**
1. Зайдите на https://dashboard.stripe.com/apikeys
2. Скопируйте **Publishable key**
3. Для разработки используйте test ключ (`pk_test_...`)
4. Для продакшена используйте live ключ (`pk_live_...`)

**Пример:**
```env
STRIPE_PUBLISHABLE_KEY="pk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
# или
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
```

---

### `STRIPE_WEBHOOK_SECRET`
**Тип:** `string`  
**Обязательность:** Обязательно для обработки webhook событий  
**Формат:** `whsec_...` (test) или `whsec_...` (production)

Секрет webhook для верификации подписи событий от Stripe. Используется в:
- `app/api/stripe/webhook/route.ts` для верификации `stripe-signature` заголовка

**Где получить:**
1. Зайдите на https://dashboard.stripe.com/webhooks
2. Создайте endpoint или выберите существующий
3. Нажмите на endpoint → "Reveal" рядом с "Signing secret"
4. Скопируйте значение (начинается с `whsec_`)

**Важно:** 
- Для локальной разработки используйте Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- Каждый endpoint имеет свой уникальный webhook secret
- Test и Live режимы имеют разные secrets

**Пример:**
```env
STRIPE_WEBHOOK_SECRET="whsec_1234567890abcdefghijklmnopqrstuvwxyz"
```

---

## Проверка конфигурации

### Проверка наличия переменных

Функция `isStripeConfigured()` в `lib/stripe/client.ts` проверяет:
- Присутствие `STRIPE_SECRET_KEY`
- Успешную инициализацию Stripe клиента

```typescript
import { isStripeConfigured } from '@/lib/stripe/client';

if (isStripeConfigured()) {
  // Stripe готов к работе
} else {
  // Stripe не настроен
}
```

### Получение клиента

```typescript
import { requireStripe, stripe } from '@/lib/stripe/client';

// Безопасный способ (возвращает null если не настроен)
const client = stripe;

// С проверкой (бросает ошибку если не настроен)
const client = requireStripe();
```

### Получение публичного ключа

```typescript
import { getStripePublishableKey } from '@/lib/stripe/client';

const publishableKey = getStripePublishableKey();
// Возвращает STRIPE_PUBLISHABLE_KEY или NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

---

## Поведение при отсутствии переменных

### Разработка (`NODE_ENV=development`)
- При отсутствии `STRIPE_SECRET_KEY`: выводится предупреждение в консоль, Stripe функционал отключается
- API endpoints возвращают 503 с сообщением "Stripe is not configured"
- UI компоненты показывают состояние "Stripe не настроен"

### Продакшн (`NODE_ENV=production`)
- При отсутствии `STRIPE_SECRET_KEY`: Stripe клиент не инициализируется, ошибки логируются
- API endpoints возвращают 503
- Функционал подписок недоступен

---

## Настройка webhook для локальной разработки

1. Установите Stripe CLI: https://stripe.com/docs/stripe-cli
2. Авторизуйтесь: `stripe login`
3. Запустите форвардинг событий:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Скопируйте `whsec_...` из вывода и добавьте в `.env`:
   ```env
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

---

## Обрабатываемые события webhook

Webhook endpoint (`/api/stripe/webhook`) обрабатывает следующие события:

1. **`checkout.session.completed`** — завершение checkout сессии
2. **`customer.subscription.updated`** — обновление подписки
3. **`customer.subscription.deleted`** — удаление подписки
4. **`invoice.payment_succeeded`** — успешная оплата
5. **`invoice.payment_failed`** — неудачная оплата

---

## Безопасность

⚠️ **Важно:**
- Никогда не коммитьте секретные ключи в Git
- Используйте `.env` файл (который должен быть в `.gitignore`)
- В продакшене используйте переменные окружения платформы (Vercel, Railway и т.д.)
- Для production используйте Live ключи (`sk_live_...`, `pk_live_...`)
- Для разработки используйте Test ключи (`sk_test_...`, `pk_test_...`)
- Webhook secret должен быть разным для test и production endpoints

---

## Пример полной конфигурации

```env
# Stripe Payment Integration
# Test режим (для разработки)
STRIPE_SECRET_KEY="sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
STRIPE_PUBLISHABLE_KEY="pk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890"
STRIPE_WEBHOOK_SECRET="whsec_1234567890abcdefghijklmnopqrstuvwxyz"
```

---

## Ссылки

- [Stripe Dashboard - API Keys](https://dashboard.stripe.com/apikeys)
- [Stripe Dashboard - Webhooks](https://dashboard.stripe.com/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe API Version](https://stripe.com/docs/api/versioning) - используемая версия: `2025-10-29.clover`

