/**
 * Test SMTP Configuration
 * 
 * This script checks if SMTP environment variables are configured correctly
 * and optionally tests the connection by sending a test email.
 * 
 * Usage:
 *   npx tsx scripts/test-smtp.ts
 *   npx tsx scripts/test-smtp.ts --send test@example.com
 */

import nodemailer from 'nodemailer'
import { resolve } from 'path'

// Load environment variables from .env.local (primary) and .env (fallback)
const dotenv = require('dotenv')
const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')

// Load .env.local first, then .env as fallback
dotenv.config({ path: envLocalPath })
dotenv.config({ path: envPath })

interface SMTPConfig {
  host: string | undefined
  port: string | undefined
  user: string | undefined
  password: string | undefined
  from: string | undefined
  secure: string | undefined
}

function checkSMTPConfig(): { configured: boolean; config: SMTPConfig; missing: string[] } {
  const config: SMTPConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
    secure: process.env.SMTP_SECURE,
  }

  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']
  const missing = required.filter(key => !process.env[key])

  return {
    configured: missing.length === 0,
    config,
    missing,
  }
}

function detectProvider(host: string | undefined): string {
  if (!host) return 'Unknown'
  
  if (host.includes('gmail')) return 'Gmail'
  if (host.includes('outlook') || host.includes('office365')) return 'Outlook / Microsoft 365'
  if (host.includes('yahoo')) return 'Yahoo'
  if (host.includes('sendgrid')) return 'SendGrid'
  if (host.includes('mailgun')) return 'Mailgun'
  if (host.includes('amazonaws') || host.includes('ses')) return 'Amazon SES'
  
  return 'Custom SMTP'
}

async function testConnection(config: SMTPConfig): Promise<{ success: boolean; error?: string }> {
  if (!config.host || !config.port || !config.user || !config.password) {
    return { success: false, error: 'Missing required SMTP configuration' }
  }

  const port = parseInt(config.port, 10)
  const secure = config.secure === 'true' || port === 465

  const transporter = nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  })

  try {
    await transporter.verify()
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
}

async function sendTestEmail(config: SMTPConfig, to: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.host || !config.port || !config.user || !config.password) {
    return { success: false, error: 'Missing required SMTP configuration' }
  }

  const port = parseInt(config.port, 10)
  const secure = config.secure === 'true' || port === 465

  const transporter = nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  })

  try {
    const result = await transporter.sendMail({
      from: config.from || config.user || 'noreply@example.com',
      to,
      subject: 'Test Email from Knowledge Base',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from your Knowledge Base application.</p>
        <p>If you received this, your SMTP configuration is working correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      text: `Test Email\n\nThis is a test email from your Knowledge Base application.\n\nIf you received this, your SMTP configuration is working correctly!\n\nSent at: ${new Date().toISOString()}`,
    })

    return { success: true, messageId: result.messageId }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
}

async function main() {
  console.log('🔍 Checking SMTP Configuration...\n')

  const { configured, config, missing } = checkSMTPConfig()

  // Display configuration status
  console.log('📋 Configuration Status:')
  console.log('─'.repeat(50))
  console.log(`SMTP_HOST:     ${config.host ? '✅ ' + config.host : '❌ Not set'}`)
  console.log(`SMTP_PORT:     ${config.port ? '✅ ' + config.port : '❌ Not set'}`)
  console.log(`SMTP_USER:     ${config.user ? '✅ ' + config.user.substring(0, 3) + '***' : '❌ Not set'}`)
  console.log(`SMTP_PASSWORD: ${config.password ? '✅ ' + '*'.repeat(Math.min(config.password.length, 8)) : '❌ Not set'}`)
  console.log(`SMTP_FROM:     ${config.from ? '✅ ' + config.from : '⚠️  Not set (will use SMTP_USER)'}`)
  console.log(`SMTP_SECURE:  ${config.secure ? '✅ ' + config.secure : '⚠️  Not set (auto-detected from port)'}`)
  console.log('─'.repeat(50))

  if (!configured) {
    console.log('\n❌ SMTP is not fully configured!')
    console.log(`Missing variables: ${missing.join(', ')}`)
    console.log('\n📖 See SMTP_PROVIDERS_SETUP.md for configuration guide')
    process.exit(1)
  }

  // Detect provider
  const provider = detectProvider(config.host)
  console.log(`\n📧 Detected Provider: ${provider}`)

  // Test connection
  console.log('\n🔌 Testing SMTP Connection...')
  const connectionTest = await testConnection(config)

  if (connectionTest.success) {
    console.log('✅ SMTP connection verified successfully!')
  } else {
    console.log('❌ SMTP connection failed!')
    console.log(`Error: ${connectionTest.error}`)
    console.log('\n💡 Troubleshooting:')
    console.log('- Check your SMTP_HOST and SMTP_PORT')
    console.log('- Verify SMTP_USER and SMTP_PASSWORD are correct')
    console.log('- For Gmail: Use App Password (not regular password)')
    console.log('- Check firewall allows outbound SMTP connections')
    process.exit(1)
  }

  // Check if should send test email
  const sendArgIndex = process.argv.findIndex(arg => arg === '--send')
  const sendTo = sendArgIndex !== -1 && process.argv[sendArgIndex + 1] 
    ? process.argv[sendArgIndex + 1]
    : process.argv.find(arg => arg.startsWith('--send='))?.split('=')[1]

  if (sendTo) {
    console.log(`\n📨 Sending test email to: ${sendTo}...`)
    const emailTest = await sendTestEmail(config, sendTo)

    if (emailTest.success) {
      console.log('✅ Test email sent successfully!')
      console.log(`Message ID: ${emailTest.messageId}`)
      console.log(`Check ${sendTo} inbox for the test email`)
    } else {
      console.log('❌ Failed to send test email!')
      console.log(`Error: ${emailTest.error}`)
      process.exit(1)
    }
  } else {
    console.log('\n💡 To send a test email, run:')
    console.log(`   npx tsx scripts/test-smtp.ts --send your-email@example.com`)
  }

  console.log('\n✅ SMTP configuration is working correctly!')
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})

