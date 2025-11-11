# PowerShell script to get Railway public database URL
# Run: .\scripts\get-railway-db-url.ps1

Write-Host "🔍 Getting Railway PostgreSQL public connection string...`n"

# Try to get from Railway CLI
try {
    $vars = railway variables --json | ConvertFrom-Json
    
    if ($vars.DATABASE_PUBLIC_URL) {
        Write-Host "✅ Found DATABASE_PUBLIC_URL:`n"
        Write-Host $vars.DATABASE_PUBLIC_URL
        Write-Host "`n📋 Copy this to .env.local as DATABASE_URL"
        exit 0
    }
    
    if ($vars.DATABASE_URL -and $vars.DATABASE_URL -notmatch "railway\.internal") {
        Write-Host "✅ Found public DATABASE_URL:`n"
        Write-Host $vars.DATABASE_URL
        Write-Host "`n📋 Copy this to .env.local as DATABASE_URL"
        exit 0
    }
    
    Write-Host "⚠️  Found internal DATABASE_URL (won't work from local)"
    Write-Host "   You need the PUBLIC connection string`n"
    Write-Host "📝 To get it:"
    Write-Host "   1. Go to Railway Dashboard"
    Write-Host "   2. Click PostgreSQL Service → Variables"
    Write-Host "   3. Look for connection string with 'proxy.rlwy.net' or '*.railway.app'"
    Write-Host "   4. Copy that value"
    
} catch {
    Write-Host "❌ Error getting Railway variables"
    Write-Host "   Make sure Railway CLI is installed: npm i -g @railway/cli"
    Write-Host "   And you're logged in: railway login"
}

