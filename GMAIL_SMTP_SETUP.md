# Gmail SMTP Setup for Password Reset Emails

> **Note:** The email service works with any SMTP provider (Gmail, Outlook, SendGrid, etc.). This guide is Gmail-specific. For other providers, see `SMTP_PROVIDERS_SETUP.md`.

## Quick Setup

To enable password reset emails via Gmail, you need to configure SMTP environment variables.

### Step 1: Create a Gmail App Password

1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (must be enabled)
3. Scroll down to **App passwords**
4. Create a new app password for "Mail" and "Other (Custom name)"
5. Enter a name like "Knowledge Base App"
6. Copy the 16-character app password (format: `xxxx xxxx xxxx xxxx`)

### Step 2: Set Environment Variables

Add these to your `.env.local` (for local development) or your deployment platform (Vercel/Railway):

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-16-char-app-password"
SMTP_FROM="your-email@gmail.com"  # Optional, defaults to SMTP_USER
```

**Important Notes:**
- Use the **App Password**, not your regular Gmail password
- Remove spaces from the app password when setting it
- Port 587 uses TLS (SMTP_SECURE="false")
- Port 465 uses SSL (SMTP_SECURE="true")

### Step 3: Verify Configuration

After setting the environment variables:

1. **Restart your development server** (if local)
2. **Redeploy** (if on Vercel/Railway)
3. Try the password reset flow
4. Check server logs for email sending status

### Troubleshooting

**Email not sending?**
- Check server logs for `[Password Reset]` messages
- Verify all SMTP environment variables are set correctly
- Ensure 2-Step Verification is enabled on your Google account
- Make sure you're using an App Password, not your regular password
- Check that the app password doesn't have spaces

**Common Errors:**
- `Email service not configured` → Missing SMTP environment variables
- `Invalid login` → Wrong app password or email
- `Connection timeout` → Check firewall/network settings

### For Vercel Deployment

1. Go to your project settings → Environment Variables
2. Add all SMTP variables
3. Redeploy the application

### For Railway Deployment

1. Go to your project → Variables
2. Add all SMTP variables
3. The app will automatically redeploy

### Testing

In development mode, emails are logged to console instead of being sent. In production, emails will be sent via SMTP if configured.

