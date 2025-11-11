# Check Stripe setup in Railway
Write-Host "`n🔍 Checking Stripe Configuration in Railway...`n" -ForegroundColor Cyan

$vars = railway variables --json | ConvertFrom-Json

$secretKey = $vars.STRIPE_SECRET_KEY
$publishableKey = $vars.STRIPE_PUBLISHABLE_KEY
$webhookSecret = $vars.STRIPE_WEBHOOK_SECRET

Write-Host "📋 Stripe Variables Status:`n" -ForegroundColor Yellow

if ($secretKey) {
    $keyType = if ($secretKey -match "sk_test_") { "Test" } elseif ($secretKey -match "sk_live_") { "Live" } else { "Unknown" }
    Write-Host "  ✅ STRIPE_SECRET_KEY: Set ($keyType)" -ForegroundColor Green
    Write-Host "     Value: $($secretKey.Substring(0, [Math]::Min(20, $secretKey.Length)))...$($secretKey.Substring($secretKey.Length - 4))" -ForegroundColor Gray
} else {
    Write-Host "  ❌ STRIPE_SECRET_KEY: Missing" -ForegroundColor Red
}

if ($publishableKey) {
    $keyType = if ($publishableKey -match "pk_test_") { "Test" } elseif ($publishableKey -match "pk_live_") { "Live" } else { "Unknown" }
    Write-Host "  ✅ STRIPE_PUBLISHABLE_KEY: Set ($keyType)" -ForegroundColor Green
    Write-Host "     Value: $($publishableKey.Substring(0, [Math]::Min(20, $publishableKey.Length)))...$($publishableKey.Substring($publishableKey.Length - 4))" -ForegroundColor Gray
} else {
    Write-Host "  ❌ STRIPE_PUBLISHABLE_KEY: Missing" -ForegroundColor Red
}

if ($webhookSecret) {
    Write-Host "  ✅ STRIPE_WEBHOOK_SECRET: Set" -ForegroundColor Green
    Write-Host "     Value: $($webhookSecret.Substring(0, [Math]::Min(20, $webhookSecret.Length)))...$($webhookSecret.Substring($webhookSecret.Length - 4))" -ForegroundColor Gray
} else {
    Write-Host "  ⚠️  STRIPE_WEBHOOK_SECRET: Missing (Required for webhooks)" -ForegroundColor Yellow
    Write-Host "     Get it from: https://dashboard.stripe.com/webhooks" -ForegroundColor Gray
    Write-Host "     Endpoint URL: https://knowledge-base.up.railway.app/api/stripe/webhook" -ForegroundColor Gray
}

Write-Host "`n📝 Next Steps:`n" -ForegroundColor Cyan

if ($secretKey -and $publishableKey -and $webhookSecret) {
    Write-Host "  ✅ All Stripe variables are set!" -ForegroundColor Green
    Write-Host "  📍 Webhook endpoint: https://knowledge-base.up.railway.app/api/stripe/webhook" -ForegroundColor White
    Write-Host "  🧪 Test webhook in Stripe Dashboard → Send test webhook" -ForegroundColor White
    Write-Host "  📊 Check Railway logs to see webhook events" -ForegroundColor White
} elseif (-not $webhookSecret) {
    Write-Host "  ⚠️  Set STRIPE_WEBHOOK_SECRET:" -ForegroundColor Yellow
    Write-Host "     1. Go to https://dashboard.stripe.com/webhooks" -ForegroundColor White
    Write-Host "     2. Create endpoint: https://knowledge-base.up.railway.app/api/stripe/webhook" -ForegroundColor White
    Write-Host "     3. Select events: checkout.session.completed, customer.subscription.*, invoice.*" -ForegroundColor White
    Write-Host "     4. Copy Signing secret (whsec_...)" -ForegroundColor White
    Write-Host "     5. Set in Railway: railway variables --set `"STRIPE_WEBHOOK_SECRET=whsec_...`"" -ForegroundColor White
} else {
    Write-Host "  ❌ Missing required variables. Set them in Railway Dashboard Variables tab" -ForegroundColor Red
}

Write-Host ""

