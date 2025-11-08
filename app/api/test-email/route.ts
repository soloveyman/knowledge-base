import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import nodemailer from 'nodemailer'

export async function GET() {
  try {
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM,
      secure: process.env.SMTP_SECURE,
    }

    const isConfigured = !!(
      smtpConfig.host &&
      smtpConfig.port &&
      smtpConfig.user &&
      smtpConfig.password
    )

    if (!isConfigured) {
      return NextResponse.json({
        configured: false,
        error: 'SMTP not configured',
        required: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
        config: {
          hasHost: !!smtpConfig.host,
          hasPort: !!smtpConfig.port,
          hasUser: !!smtpConfig.user,
          hasPassword: !!smtpConfig.password,
        },
      }, { status: 400 })
    }

    // Test connection
    const port = parseInt(smtpConfig.port!, 10)
    const secure = smtpConfig.secure === 'true' || port === 465

    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port,
      secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      },
    })

    // Verify connection
    let verified = false
    let verifyError: string | null = null

    try {
      await transporter.verify()
      verified = true
    } catch (error) {
      verifyError = error instanceof Error ? error.message : String(error)
    }

    return NextResponse.json({
      configured: true,
      verified,
      config: {
        host: smtpConfig.host,
        port,
        secure,
        user: smtpConfig.user?.substring(0, 3) + '***', // Mask user
        hasPassword: !!smtpConfig.password,
        from: smtpConfig.from || smtpConfig.user,
      },
      error: verifyError,
      provider: smtpConfig.host?.includes('mailgun') ? 'Mailgun' : 
                smtpConfig.host?.includes('sendgrid') ? 'SendGrid' :
                smtpConfig.host?.includes('gmail') ? 'Gmail' :
                smtpConfig.host?.includes('outlook') ? 'Outlook' :
                smtpConfig.host?.includes('yahoo') ? 'Yahoo' :
                smtpConfig.host?.includes('amazonaws') ? 'Amazon SES' :
                'Custom SMTP',
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { to } = await req.json()

    if (!to || typeof to !== 'string') {
      return NextResponse.json(
        { error: 'Email address (to) is required' },
        { status: 400 }
      )
    }

    // Check if SMTP is configured
    const isConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD
    )

    if (!isConfigured) {
      return NextResponse.json({
        error: 'SMTP not configured',
        required: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
      }, { status: 400 })
    }

    // Send test email
    const testUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    await sendEmail({
      to,
      subject: 'Test Email from Knowledge Base',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from your Knowledge Base application.</p>
        <p>If you received this, your email service (Mailgun) is working correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      text: `Test Email\n\nThis is a test email from your Knowledge Base application.\n\nIf you received this, your email service (Mailgun) is working correctly!\n\nSent at: ${new Date().toISOString()}`,
    })

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      to,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[Test Email] Error:', error)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
      } : undefined,
    }, { status: 500 })
  }
}

