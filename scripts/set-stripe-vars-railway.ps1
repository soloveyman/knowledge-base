# PowerShell script to set Stripe variables in Railway
# Usage: .\scripts\set-stripe-vars-railway.ps1

Write-Host "🔧 Setting Stripe Variables in Railway`n"

# Check if Railway CLI is available
try {
    railway --version | Out-Null
} catch {
    Write-Host "❌ Railway CLI not found"
    Write-Host "   Install: npm i -g @railway/cli"
    Write-Host "   Then run: railway login"
    exit 1
}

Write-Host "📋 You need to provide your Stripe keys:`n"
Write-Host "   1. Go to https://dashboard.stripe.com/apikeys"
Write-Host "   2. Copy Secret key (sk_test_... or sk_live_...)"
Write-Host "   3. Copy Publishable key (pk_test_... or pk_live_...)"
Write-Host "   4. Go to https://dashboard.stripe.com/webhooks"
Write-Host "   5. Create/select webhook endpoint for:"
Write-Host "      https://knowledge-base.up.railway.app/api/stripe/webhook"
Write-Host "   6. Copy Signing secret (whsec_...)`n"

$secretKey = Read-Host "Enter STRIPE_SECRET_KEY (sk_test_... or sk_live_...)"
$publishableKey = Read-Host "Enter STRIPE_PUBLISHABLE_KEY (pk_test_... or pk_live_...)"
$webhookSecret = Read-Host "Enter STRIPE_WEBHOOK_SECRET (whsec_...)"

if (-not $secretKey -or -not $publishableKey -or -not $webhookSecret) {
    Write-Host "`n❌ All three values are required"
    exit 1
}

Write-Host "`n🚀 Setting variables in Railway...`n"

try {
    railway variables --set "STRIPE_SECRET_KEY=$secretKey"
    Write-Host "✅ Set STRIPE_SECRET_KEY"
    
    railway variables --set "STRIPE_PUBLISHABLE_KEY=$publishableKey"
    Write-Host "✅ Set STRIPE_PUBLISHABLE_KEY"
    
    railway variables --set "STRIPE_WEBHOOK_SECRET=$webhookSecret"
    Write-Host "✅ Set STRIPE_WEBHOOK_SECRET"
    
    Write-Host "`n✅ All Stripe variables set successfully!`n"
    Write-Host "📝 Railway will automatically redeploy your service"
    Write-Host "   Check deployment status in Railway Dashboard`n"
    
} catch {
    Write-Host "`n❌ Error setting variables: $_"
    Write-Host "   Make sure you're logged in: railway login"
    exit 1
}

