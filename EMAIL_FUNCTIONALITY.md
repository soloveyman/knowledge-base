# Email Functionality Overview

## Currently Implemented

### ✅ Password Reset Email
- **Function**: `sendPasswordResetEmail()` in `lib/email.ts`
- **Triggered by**: `/api/auth/forgot-password` route
- **Status**: ✅ Implemented and working (requires SMTP configuration)
- **Email includes**: Reset link with 1-hour expiration

## Email Service Infrastructure

### Core Functions
- `sendEmail(options)` - Generic email sending function
- `sendPasswordResetEmail(email, resetUrl)` - Password reset specific

### Configuration
All emails use the same SMTP configuration:
- `SMTP_HOST` - SMTP server (e.g., `smtp.gmail.com`)
- `SMTP_PORT` - Port (587 for TLS, 465 for SSL)
- `SMTP_SECURE` - `"true"` for SSL, `"false"` for TLS
- `SMTP_USER` - Email address
- `SMTP_PASSWORD` - App password (for Gmail)
- `SMTP_FROM` - From address (optional, defaults to SMTP_USER)

## Potential Email Features (Not Yet Implemented)

### 1. Welcome Email (Registration)
- **Where**: `app/api/auth/register/route.ts`
- **When**: New user registers
- **Content**: Welcome message, login instructions, trial info

### 2. User Creation Notification
- **Where**: `app/api/users/route.ts` (POST)
- **When**: Admin creates a new user
- **Content**: Account credentials, login link, welcome message

### 3. Assignment Notification
- **Where**: `app/api/assignments/route.ts` (POST)
- **When**: Assignment is created for users
- **Content**: Assignment details, due date, test link

### 4. Test Completion Notification
- **Where**: Test attempt completion
- **When**: User completes a test
- **Content**: Score, results, feedback

### 5. Subscription/Payment Emails
- **Where**: `app/api/stripe/webhook/route.ts`
- **When**: Payment successful, subscription updated
- **Content**: Receipt, subscription details, plan changes

### 6. Password Changed Confirmation
- **Where**: `app/api/auth/reset-password/route.ts`
- **When**: Password is successfully reset
- **Content**: Confirmation that password was changed

## How to Add New Email Functions

1. Add function to `lib/email.ts`:
```typescript
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const subject = 'Welcome to Knowledge Base'
  const html = `...`
  const text = `...`
  
  await sendEmail({ to: email, subject, html, text })
}
```

2. Call it in the appropriate route:
```typescript
import { sendWelcomeEmail } from '@/lib/email'

// In your route handler
try {
  await sendWelcomeEmail(user.email, user.name)
} catch (emailError) {
  console.error('Failed to send welcome email:', emailError)
  // Don't fail the request if email fails
}
```

## Current Status

- ✅ Email service infrastructure: Complete
- ✅ Password reset emails: Implemented
- ⚠️ SMTP configuration: Required for production
- ❌ Other email types: Not yet implemented

## Notes

- All emails use the same SMTP configuration
- In development, emails are logged to console instead of being sent
- Email failures are logged but don't fail the main request (best practice)
- The generic `sendEmail()` function can be used for any custom email needs

