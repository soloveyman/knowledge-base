# SMTP Configuration Test Guide

## Quick Test

### Method 1: Using Test Script (Recommended)

```bash
# Check SMTP configuration
npm run test:smtp

# Test connection and send test email
npm run test:smtp -- --send your-email@example.com
```

### Method 2: Using API Endpoint

**Check Configuration:**
```bash
curl http://localhost:3000/api/test-email
```

**Send Test Email:**
```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

## What Gets Checked

The test script checks:

1. ✅ **Required Variables:**
   - `SMTP_HOST` - SMTP server hostname
   - `SMTP_PORT` - SMTP port (587 for TLS, 465 for SSL)
   - `SMTP_USER` - Email address / username
   - `SMTP_PASSWORD` - Password / app password

2. ⚠️ **Optional Variables:**
   - `SMTP_FROM` - From email address (defaults to `SMTP_USER`)
   - `SMTP_SECURE` - "true" for SSL, "false" for TLS (auto-detected from port)

3. 🔌 **Connection Test:**
   - Verifies SMTP server connection
   - Tests authentication
   - Checks if credentials are valid

4. 📧 **Email Test (optional):**
   - Sends a test email to verify everything works
   - Includes message ID for tracking

## Expected Output

### ✅ Success:
```
🔍 Checking SMTP Configuration...

📋 Configuration Status:
──────────────────────────────────────────────────
SMTP_HOST:     ✅ smtp.gmail.com
SMTP_PORT:     ✅ 587
SMTP_USER:     ✅ you***
SMTP_PASSWORD: ✅ ********
SMTP_FROM:     ✅ your-email@gmail.com
SMTP_SECURE:   ⚠️  Not set (auto-detected from port)
──────────────────────────────────────────────────

📧 Detected Provider: Gmail

🔌 Testing SMTP Connection...
✅ SMTP connection verified successfully!

✅ SMTP configuration is working correctly!
```

### ❌ Missing Variables:
```
❌ SMTP is not fully configured!
Missing variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD

📖 See SMTP_PROVIDERS_SETUP.md for configuration guide
```

### ❌ Connection Failed:
```
❌ SMTP connection failed!
Error: Invalid login: 535-5.7.8 Username and Password not accepted

💡 Troubleshooting:
- Check your SMTP_HOST and SMTP_PORT
- Verify SMTP_USER and SMTP_PASSWORD are correct
- For Gmail: Use App Password (not regular password)
- Check firewall allows outbound SMTP connections
```

## Common Issues

### "Invalid login" or "Authentication failed"
- **Gmail/Yahoo:** Use App Password, not regular password
- **Outlook:** May need to enable "Less secure app access" or use App Password
- **SendGrid:** Username must be `"apikey"`, password is your API key

### "Connection timeout"
- Check `SMTP_HOST` is correct
- Verify `SMTP_PORT` matches your provider
- Check firewall allows outbound SMTP (port 587 or 465)

### "Connection refused"
- Verify SMTP server is accessible
- Check if port is blocked by firewall
- Try different port (587 vs 465)

## Testing in Production

### Vercel
1. Set SMTP variables in Vercel Dashboard → Settings → Environment Variables
2. Redeploy your application
3. Test via API endpoint: `https://your-app.vercel.app/api/test-email`

### Railway
1. Set SMTP variables in Railway Dashboard → Variables
2. Restart your service
3. Test via API endpoint: `https://your-app.railway.app/api/test-email`

## Next Steps

After verifying SMTP works:
- ✅ Test password reset flow
- ✅ Test email verification (if implemented)
- ✅ Monitor email delivery in production
- ✅ Check spam folder if emails don't arrive

## Related Documentation

- `SMTP_PROVIDERS_SETUP.md` - Provider-specific configurations
- `GMAIL_SMTP_SETUP.md` - Gmail-specific setup
- `EMAIL_FUNCTIONALITY.md` - Email features overview

