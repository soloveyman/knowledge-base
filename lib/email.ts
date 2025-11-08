import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

type EmailOptions = {
  to: string
  subject: string
  html: string
  text?: string
}

type MailOptions = {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

const createTransporter = (): Transporter | { sendMail: (options: MailOptions) => Promise<{ messageId: string }> } => {
  // If SMTP is configured, use it (works in both development and production)
  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD
  ) {
    const port = parseInt(process.env.SMTP_PORT, 10)
    const secure = process.env.SMTP_SECURE === 'true' || port === 465
    
    console.log('[Email Service] Using SMTP:', process.env.SMTP_HOST, 'Port:', port)
    
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }

  // For development without SMTP, log to console
  if (process.env.NODE_ENV === 'development') {
    console.warn('[Email Service] SMTP not configured. Emails will be logged to console only.')
    console.warn('[Email Service] To send real emails, set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in .env.local')
    return {
      sendMail: async (options: MailOptions) => {
        console.log('\n📧 [Email Service] Would send email:')
        console.log('To:', options.to)
        console.log('Subject:', options.subject)
        console.log('Verification URL:', options.html.match(/https?:\/\/[^\s"<>]+/)?.[0] || 'Not found')
        console.log('---\n')
        return { messageId: 'dev-' + Date.now() }
      },
    }
  }

  // In production without SMTP, throw error
  throw new Error(
    'Email service not configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD environment variables.'
  )
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const transporter = createTransporter()
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    })
    console.log('[Email Service] Email sent successfully:', {
      to: options.to,
      subject: options.subject,
      messageId: result.messageId
    })
  } catch (error) {
    console.error('[Email Service] Error sending email:', error)
    if (error instanceof Error) {
      console.error('[Email Service] Error details:', error.message)
      if (error.message.includes('Invalid login')) {
        console.error('[Email Service] Check your SMTP_USER and SMTP_PASSWORD (use App Password for Gmail)')
      }
    }
    throw error
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const subject = 'Reset Your Password'
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #1A1D29; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: #fff; margin: 0;">Password Reset Request</h1>
        </div>
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
          <p>You requested to reset your password. Click the button below to reset it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
          <p style="font-size: 12px; color: #999; word-break: break-all;">${resetUrl}</p>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">This link will expire in 1 hour.</p>
          <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email.</p>
        </div>
      </body>
    </html>
  `
  const text = `Password Reset Request

You requested to reset your password. Click the link below to reset it:

${resetUrl}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.`

  await sendEmail({
    to: email,
    subject,
    html,
    text,
  })
}

