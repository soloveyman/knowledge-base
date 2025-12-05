import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://uppstaff.net'
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/owner/',
          '/manager/',
          '/employee/',
          '/super-admin/',
          '/docs/',
          '/read/',
          '/test/',
          '/test-session/',
          '/assignment-builder/',
          '/test-builder/',
          '/user-builder/',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/owner/',
          '/manager/',
          '/employee/',
          '/super-admin/',
          '/docs/',
          '/read/',
          '/test/',
          '/test-session/',
          '/assignment-builder/',
          '/test-builder/',
          '/user-builder/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

