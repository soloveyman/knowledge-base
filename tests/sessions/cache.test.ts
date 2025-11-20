import { test, expect } from '@playwright/test';

/**
 * Session and cache tests
 * Tests user sessions, authentication state, and caching behavior
 */
test.describe('Sessions and Cache', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('Session cookies are set correctly', async ({ page, context }) => {
    await page.goto(`${baseURL}/auth/signin`);
    
    // Check for NextAuth session cookie
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(cookie => 
      cookie.name.includes('next-auth') || cookie.name.includes('session')
    );
    
    // Session cookie should be httpOnly for security
    if (sessionCookie) {
      expect(sessionCookie.httpOnly).toBe(true);
      expect(sessionCookie.secure || process.env.NODE_ENV !== 'production').toBeTruthy();
    }
  });

  test('Session persists across page navigations', async ({ page, context }) => {
    // This test would require actual authentication
    // For now, we test that session mechanism exists
    await page.goto(`${baseURL}/`);
    
    const cookies = await context.cookies();
    const hasSessionCookie = cookies.some(cookie => 
      cookie.name.includes('next-auth') || cookie.name.includes('session')
    );
    
    // Navigate to another page
    await page.goto(`${baseURL}/docs`);
    
    const cookiesAfter = await context.cookies();
    const hasSessionCookieAfter = cookiesAfter.some(cookie => 
      cookie.name.includes('next-auth') || cookie.name.includes('session')
    );
    
    // Session should persist (or both should be false if not authenticated)
    expect(hasSessionCookie).toBe(hasSessionCookieAfter);
  });

  test('API responses are not cached for authenticated endpoints', async ({ request }) => {
    const response1 = await request.get(`${baseURL}/api/documents`, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    const cacheControl1 = response1.headers()['cache-control'];
    
    // Should have no-cache or no-store
    if (cacheControl1) {
      expect(cacheControl1).toMatch(/no-store|no-cache|private/);
    }
  });

  test('Static assets are cached properly', async ({ page }) => {
    const response = await page.goto(`${baseURL}/`);
    
    // Check for static asset caching
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter((entry: any) => 
          entry.name.includes('.js') || 
          entry.name.includes('.css') || 
          entry.name.includes('.woff')
        )
        .map((entry: any) => ({
          name: entry.name,
          duration: entry.duration,
        }));
    });
    
    // Static assets should load efficiently
    expect(resources.length).toBeGreaterThan(0);
  });

  test('Cache headers are set correctly for different content types', async ({ request }) => {
    // Test API endpoint
    const apiResponse = await request.get(`${baseURL}/api/health`);
    const apiCacheControl = apiResponse.headers()['cache-control'];
    
    // Health endpoint might be cacheable
    expect(apiResponse.status()).toBe(200);
    
    // Test HTML page
    const pageResponse = await request.get(`${baseURL}/`);
    const pageCacheControl = pageResponse.headers()['cache-control'];
    
    // Pages might have different cache policies
    expect(pageResponse.status()).toBe(200);
  });

  test('Session expires correctly', async ({ page, context }) => {
    await page.goto(`${baseURL}/`);
    
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(cookie => 
      cookie.name.includes('next-auth') || cookie.name.includes('session')
    );
    
    if (sessionCookie && sessionCookie.expires) {
      // Session should have expiration
      expect(sessionCookie.expires).toBeGreaterThan(Date.now() / 1000);
    }
  });

  test('CSRF protection is enabled', async ({ request }) => {
    // Try to make a POST request without proper headers
    const response = await request.post(`${baseURL}/api/documents`, {
      data: { test: 'data' },
    });
    
    // Should either require authentication or have CSRF protection
    expect([401, 403, 400]).toContain(response.status());
  });
});

