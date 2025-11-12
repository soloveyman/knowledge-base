/**
 * Check complete Stripe integration status
 * 
 * Run: npx tsx scripts/check-stripe-status.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import Stripe from 'stripe';

// Load environment variables FIRST
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function checkStripeStatus() {
  console.log('\n🔍 Проверка состояния подключения к Stripe...\n');
  console.log('═'.repeat(80));

  // 1. Check environment variables
  console.log('\n📋 1. Переменные окружения:\n');
  
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let hasSecretKey = false;
  let hasPublishableKey = false;
  let hasWebhookSecret = false;

  if (secretKey) {
    const keyType = secretKey.startsWith('sk_test_') ? 'Test' : secretKey.startsWith('sk_live_') ? 'Live' : 'Unknown';
    console.log(`  ✅ STRIPE_SECRET_KEY: Установлен (${keyType})`);
    console.log(`     ${secretKey.substring(0, 20)}...${secretKey.substring(secretKey.length - 4)}`);
    hasSecretKey = true;
  } else {
    console.log(`  ❌ STRIPE_SECRET_KEY: Не установлен`);
  }

  if (publishableKey) {
    const keyType = publishableKey.startsWith('pk_test_') ? 'Test' : publishableKey.startsWith('pk_live_') ? 'Live' : 'Unknown';
    console.log(`  ✅ STRIPE_PUBLISHABLE_KEY: Установлен (${keyType})`);
    console.log(`     ${publishableKey.substring(0, 20)}...${publishableKey.substring(publishableKey.length - 4)}`);
    hasPublishableKey = true;
  } else {
    console.log(`  ❌ STRIPE_PUBLISHABLE_KEY: Не установлен`);
  }

  if (webhookSecret) {
    console.log(`  ✅ STRIPE_WEBHOOK_SECRET: Установлен`);
    console.log(`     ${webhookSecret.substring(0, 20)}...${webhookSecret.substring(webhookSecret.length - 4)}`);
    hasWebhookSecret = true;
  } else {
    console.log(`  ⚠️  STRIPE_WEBHOOK_SECRET: Не установлен (требуется для webhooks)`);
  }

  // 2. Test API connection
  console.log('\n🌐 2. Подключение к Stripe API:\n');
  
  let apiWorks = false;
  let accountInfo: any = null;

  if (hasSecretKey && secretKey) {
    try {
      const stripe = new Stripe(secretKey, {
        apiVersion: '2025-10-29.clover',
        typescript: true,
      });
      
      const account = await stripe.accounts.retrieve();
      accountInfo = account;
      apiWorks = true;
      
      console.log(`  ✅ Подключение успешно`);
      console.log(`     Account ID: ${account.id}`);
      console.log(`     Country: ${account.country || 'N/A'}`);
      console.log(`     Type: ${account.type || 'N/A'}`);
      console.log(`     Email: ${account.email || 'N/A'}`);
    } catch (error) {
      console.log(`  ❌ Подключение не удалось`);
      console.log(`     Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.message.includes('Invalid API Key')) {
        console.log(`     💡 Проверьте правильность STRIPE_SECRET_KEY`);
      }
    }
  } else {
    console.log(`  ⚠️  Нельзя проверить: STRIPE_SECRET_KEY не установлен`);
  }

  // 3. Check database schema
  console.log('\n💾 3. База данных:\n');
  
  let dbWorks = false;
  let hasPriceIdColumn = false;
  let plansWithPriceIds = 0;
  let totalPlans = 0;

  try {
    const { db, subscriptionPlans } = await import('@/lib/db');
    const { eq } = await import('drizzle-orm');
    
    // Check if stripe_price_id column exists
    const allPlans = await db.select().from(subscriptionPlans).limit(1);
    if (allPlans.length > 0) {
      hasPriceIdColumn = 'stripePriceId' in allPlans[0] || (allPlans[0] as any).stripePriceId !== undefined;
    }

    // Get all active plans
    const activePlans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true));
    
    totalPlans = activePlans.length;
    plansWithPriceIds = activePlans.filter(p => (p as any).stripePriceId).length;
    
    dbWorks = true;
    
    console.log(`  ✅ Подключение к базе данных: OK`);
    console.log(`  ${hasPriceIdColumn ? '✅' : '❌'} Колонка stripe_price_id: ${hasPriceIdColumn ? 'Существует' : 'Не найдена'}`);
    console.log(`  📊 Планов с Price ID: ${plansWithPriceIds}/${totalPlans}`);
    
    if (plansWithPriceIds > 0) {
      console.log(`\n     Планы с Price IDs:`);
      for (const plan of activePlans) {
        const priceId = (plan as any).stripePriceId;
        if (priceId) {
          console.log(`       - ${plan.displayName} (${plan.name}/${plan.interval}): ${priceId}`);
        }
      }
    }
  } catch (error) {
    console.log(`  ❌ Ошибка подключения к базе данных`);
    console.log(`     ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 4. Check webhook configuration
  console.log('\n🔐 4. Webhook конфигурация:\n');
  
  if (hasWebhookSecret) {
    console.log(`  ✅ Webhook Secret: Установлен`);
    console.log(`  📍 Webhook Endpoint: /api/stripe/webhook`);
    console.log(`  🌐 Production URL: https://knowledge-base.up.railway.app/api/stripe/webhook`);
    console.log(`  💡 Проверьте в Stripe Dashboard, что endpoint создан и активен`);
  } else {
    console.log(`  ⚠️  Webhook Secret: Не установлен`);
    console.log(`  💡 Создайте webhook endpoint в Stripe Dashboard`);
    console.log(`     URL: https://knowledge-base.up.railway.app/api/stripe/webhook`);
  }

  // 5. Summary
  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 Итоговый статус:\n');

  const status = {
    envVars: hasSecretKey && hasPublishableKey,
    apiConnection: apiWorks,
    database: dbWorks,
    priceIds: hasPriceIdColumn && plansWithPriceIds > 0,
    webhook: hasWebhookSecret,
  };

  const allGood = Object.values(status).every(v => v);

  if (allGood) {
    console.log('  ✅ Все компоненты настроены и работают!\n');
  } else {
    console.log('  ⚠️  Некоторые компоненты требуют настройки:\n');
    
    if (!status.envVars) {
      console.log('  ❌ Переменные окружения: Не все установлены');
    } else {
      console.log('  ✅ Переменные окружения: OK');
    }
    
    if (!status.apiConnection) {
      console.log('  ❌ API подключение: Не работает');
    } else {
      console.log('  ✅ API подключение: OK');
    }
    
    if (!status.database) {
      console.log('  ❌ База данных: Ошибка подключения');
    } else {
      console.log('  ✅ База данных: OK');
    }
    
    if (!status.priceIds) {
      console.log('  ⚠️  Price IDs: Не все планы имеют Price IDs');
    } else {
      console.log('  ✅ Price IDs: Настроены');
    }
    
    if (!status.webhook) {
      console.log('  ⚠️  Webhook: Secret не установлен');
    } else {
      console.log('  ✅ Webhook: Настроен');
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n📝 Следующие шаги:\n');

  if (!hasSecretKey || !hasPublishableKey) {
    console.log('  1. Установите Stripe ключи в Railway:');
    console.log('     railway variables --set "STRIPE_SECRET_KEY=sk_..."');
    console.log('     railway variables --set "STRIPE_PUBLISHABLE_KEY=pk_..."');
  }

  if (!hasWebhookSecret) {
    console.log('  2. Создайте webhook endpoint в Stripe Dashboard');
    console.log('     URL: https://knowledge-base.up.railway.app/api/stripe/webhook');
  }

  if (!hasPriceIdColumn) {
    console.log('  3. Добавьте колонку stripe_price_id:');
    console.log('     npx tsx scripts/add-stripe-price-id-column.ts');
  }

  if (plansWithPriceIds < totalPlans && totalPlans > 1) {
    console.log('  4. Обновите планы с Price IDs из Stripe');
  }

  console.log('\n');
}

checkStripeStatus().catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});

