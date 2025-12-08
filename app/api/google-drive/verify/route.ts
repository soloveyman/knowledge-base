import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const checks = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        isProduction: process.env.NODE_ENV === 'production',
      },
      config: {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        hasApiKey: !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
        clientIdFormat: null as string | null,
        clientIdDomain: null as string | null,
      },
      verification: {
        fileExists: false,
        filePath: null as string | null,
        fileContent: null as string | null,
        accessibleUrl: null as string | null,
      },
      oauth: {
        authorizedOrigins: [] as string[],
        redirectUris: [] as string[],
        recommendations: [] as string[],
      },
      status: 'unknown' as 'ok' | 'warning' | 'error',
      issues: [] as string[],
      recommendations: [] as string[],
    }

    // Проверка переменных окружения
    if (process.env.GOOGLE_CLIENT_ID) {
      checks.config.clientIdFormat = process.env.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')
        ? 'valid'
        : 'invalid'
      
      if (process.env.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com')) {
        const parts = process.env.GOOGLE_CLIENT_ID.split('.')
        if (parts.length > 0) {
          checks.config.clientIdDomain = parts[0]
        }
      }
    }

    // Проверка файла верификации
    try {
      const verificationFiles = [
        'googleeb35ed23b363bad2.html',
        // Можно добавить другие возможные файлы
      ]

      for (const fileName of verificationFiles) {
        try {
          const filePath = join(process.cwd(), 'public', fileName)
          const fileContent = await readFile(filePath, 'utf-8')
          
          checks.verification.fileExists = true
          checks.verification.filePath = filePath
          checks.verification.fileContent = fileContent.trim()
          
          // Определить URL для продакшена
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                         process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                         'https://uppstaff.net'
          checks.verification.accessibleUrl = `${baseUrl}/${fileName}`
          break
        } catch (fileError) {
          // Файл не найден, продолжаем поиск
          continue
        }
      }
    } catch (error) {
      checks.verification.filePath = 'not found'
    }

    // Рекомендации по OAuth настройкам
    const currentOrigin = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://uppstaff.net')

    checks.oauth.authorizedOrigins = [
      'http://localhost:3000',
      currentOrigin,
    ].filter(Boolean)

    checks.oauth.redirectUris = [
      'http://localhost:3000/api/auth/callback/google',
      `${currentOrigin}/api/auth/callback/google`,
    ].filter(Boolean)

    // Определение статуса и проблем
    if (!checks.config.hasClientId) {
      checks.status = 'error'
      checks.issues.push('GOOGLE_CLIENT_ID не установлен в переменных окружения')
    } else if (checks.config.clientIdFormat !== 'valid') {
      checks.status = 'warning'
      checks.issues.push('GOOGLE_CLIENT_ID имеет неверный формат (должен заканчиваться на .apps.googleusercontent.com)')
    } else {
      checks.status = 'ok'
    }

    if (!checks.config.hasClientSecret) {
      checks.status = checks.status === 'ok' ? 'warning' : checks.status
      checks.issues.push('GOOGLE_CLIENT_SECRET не установлен (требуется для OAuth)')
    }

    if (!checks.verification.fileExists) {
      checks.status = checks.status === 'error' ? 'error' : 'warning'
      checks.issues.push('Файл верификации домена не найден в public/')
      checks.recommendations.push('Добавьте файл верификации в папку public/ для верификации домена в Google Search Console')
    }

    // Рекомендации
    if (checks.status === 'ok') {
      checks.recommendations.push('✅ Базовая конфигурация выглядит правильно')
    }

    checks.recommendations.push(
      'Проверьте в Google Cloud Console:',
      '1. OAuth Consent Screen → Scopes → должен быть https://www.googleapis.com/auth/drive.file',
      '2. Credentials → OAuth 2.0 Client ID → Authorized JavaScript origins → должны быть: ' + checks.oauth.authorizedOrigins.join(', '),
      '3. Credentials → OAuth 2.0 Client ID → Authorized redirect URIs → должны быть: ' + checks.oauth.redirectUris.join(', '),
    )

    if (checks.verification.accessibleUrl) {
      checks.recommendations.push(
        `4. Проверьте доступность файла верификации: ${checks.verification.accessibleUrl}`,
        '5. В Google Search Console добавьте домен и верифицируйте через этот файл'
      )
    }

    return NextResponse.json(checks, {
      status: checks.status === 'error' ? 500 : checks.status === 'warning' ? 200 : 200
    })
  } catch (error) {
    console.error('Error verifying Google Drive setup:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

