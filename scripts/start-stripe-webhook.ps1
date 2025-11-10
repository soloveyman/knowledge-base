# Stripe Webhook Forwarding Script
# This script helps you set up Stripe webhook forwarding for local development

$stripeExe = "$env:TEMP\stripe-cli\stripe.exe"

# Check if Stripe CLI is installed
if (-not (Test-Path $stripeExe)) {
    Write-Host "❌ Stripe CLI not found. Installing..." -ForegroundColor Red
    
    # Download and extract Stripe CLI
    $ProgressPreference = 'SilentlyContinue'
    $zipPath = "$env:TEMP\stripe-cli.zip"
    $extractPath = "$env:TEMP\stripe-cli"
    
    Write-Host "Downloading Stripe CLI..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://github.com/stripe/stripe-cli/releases/download/v1.32.0/stripe_1.32.0_windows_x86_64.zip" -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    
    Write-Host "✅ Stripe CLI installed!" -ForegroundColor Green
}

Write-Host "`n🔐 Step 1: Authenticate with Stripe" -ForegroundColor Cyan
Write-Host "This will open a browser window for authentication..." -ForegroundColor Yellow
& $stripeExe login

Write-Host "`n📡 Step 2: Starting webhook forwarding..." -ForegroundColor Cyan
Write-Host "Forwarding webhooks to: http://localhost:3000/api/stripe/webhook" -ForegroundColor Yellow
Write-Host "`n⚠️  IMPORTANT: Copy the webhook secret (whsec_...) from the output below!" -ForegroundColor Yellow
Write-Host "Add it to your .env.local file as: STRIPE_WEBHOOK_SECRET=whsec_..." -ForegroundColor Yellow
Write-Host "`nPress Ctrl+C to stop the webhook forwarding`n" -ForegroundColor Gray

# Start webhook forwarding
& $stripeExe listen --forward-to localhost:3000/api/stripe/webhook
