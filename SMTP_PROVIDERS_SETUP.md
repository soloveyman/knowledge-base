# SMTP Email Setup for Multiple Providers

The email service works with **any SMTP provider**, not just Gmail. You just need to configure the correct SMTP settings for your provider.

## Supported Providers

✅ **Gmail** (Google)  
✅ **Outlook** (Microsoft)  
✅ **Yahoo Mail**  
✅ **SendGrid**  
✅ **Mailgun**  
✅ **Amazon SES**  
✅ **Any custom SMTP server**

## Common Provider Configurations

### Gmail

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password"  # 16-char app password
SMTP_FROM="your-email@gmail.com"
```

**Requirements:**
- Enable 2-Step Verification
- Create App Password: https://support.google.com/accounts/answer/185833
- Use App Password (not regular password)

---

### Outlook / Microsoft 365

```bash
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@outlook.com"
SMTP_PASSWORD="your-password"
SMTP_FROM="your-email@outlook.com"
```

**Alternative (Office 365):**
```bash
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_SECURE="false"
```

**Requirements:**
- May need to enable "Less secure app access" or use App Password
- For Office 365: May require Modern Authentication

---

### Yahoo Mail

```bash
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@yahoo.com"
SMTP_PASSWORD="your-app-password"  # Generate app password
SMTP_FROM="your-email@yahoo.com"
```

**Requirements:**
- Generate App Password: Account Security → Generate app password

---

### SendGrid

```bash
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="apikey"
SMTP_PASSWORD="your-sendgrid-api-key"
SMTP_FROM="noreply@yourdomain.com"
```

**Requirements:**
- Create API key in SendGrid dashboard
- Username is always `"apikey"`
- Password is your API key

---

### Mailgun

```bash
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="postmaster@your-domain.mailgun.org"
SMTP_PASSWORD="your-mailgun-smtp-password"
SMTP_FROM="noreply@yourdomain.com"
```

**Requirements:**
- Get SMTP credentials from Mailgun dashboard
- Domain must be verified

---

### Amazon SES

```bash
SMTP_HOST="email-smtp.us-east-1.amazonaws.com"  # Use your region
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-ses-smtp-username"
SMTP_PASSWORD="your-ses-smtp-password"
SMTP_FROM="noreply@yourdomain.com"
```

**Requirements:**
- Create SMTP credentials in AWS SES
- Verify sending domain/email
- Move out of sandbox for production

**Regions:**
- `us-east-1`: `email-smtp.us-east-1.amazonaws.com`
- `us-west-2`: `email-smtp.us-west-2.amazonaws.com`
- `eu-west-1`: `email-smtp.eu-west-1.amazonaws.com`
- Check AWS docs for your region

---

### Custom SMTP Server

```bash
SMTP_HOST="smtp.yourdomain.com"
SMTP_PORT="587"  # or 465 for SSL
SMTP_SECURE="false"  # "true" for port 465
SMTP_USER="your-username"
SMTP_PASSWORD="your-password"
SMTP_FROM="noreply@yourdomain.com"
```

**Port Guide:**
- **587** (TLS): `SMTP_SECURE="false"` - Most common, recommended
- **465** (SSL): `SMTP_SECURE="true"` - Legacy but still used
- **25** (Plain): Usually blocked by ISPs, not recommended

---

## Security Best Practices

1. **Use App Passwords** when available (Gmail, Yahoo)
2. **Never commit** SMTP credentials to git
3. **Use environment variables** in production
4. **Enable 2FA** on email accounts
5. **Use dedicated email** for sending (not personal account)

---

## Testing Your Configuration

1. Set environment variables
2. Restart server / redeploy
3. Try password reset flow
4. Check server logs for:
   - `[Password Reset] Email sent successfully` ✅
   - `[Password Reset] Failed to send email` ❌

---

## Troubleshooting

### "Invalid login" or "Authentication failed"
- Check username/password are correct
- For Gmail/Yahoo: Use App Password, not regular password
- Verify credentials in provider dashboard

### "Connection timeout"
- Check firewall allows outbound SMTP
- Verify port (587/465) is not blocked
- Try different port if available

### "Email service not configured"
- All 4 required variables must be set: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- Check environment variables are loaded (restart server)

### Emails going to spam
- Set proper `SMTP_FROM` address
- Use verified domain (SendGrid, Mailgun, SES)
- Add SPF/DKIM records for your domain
- Use professional email service (SendGrid, Mailgun) for production

---

## Production Recommendations

For production, consider using:
- **SendGrid** - Free tier: 100 emails/day
- **Mailgun** - Free tier: 5,000 emails/month
- **Amazon SES** - Very cheap, pay per email
- **Postmark** - Great deliverability

These services provide:
- Better deliverability
- Email analytics
- Bounce/spam handling
- Higher sending limits

---

## Quick Reference

| Provider | Host | Port | Secure | Notes |
|----------|------|------|--------|-------|
| Gmail | `smtp.gmail.com` | 587 | false | App password required |
| Outlook | `smtp-mail.outlook.com` | 587 | false | May need app password |
| Yahoo | `smtp.mail.yahoo.com` | 587 | false | App password required |
| SendGrid | `smtp.sendgrid.net` | 587 | false | Username: `apikey` |
| Mailgun | `smtp.mailgun.org` | 587 | false | Domain verification |
| Amazon SES | `email-smtp.REGION.amazonaws.com` | 587 | false | Region-specific |

