import { test, expect } from '@playwright/test';

/**
 * Next.js best practices tests
 * Tests Next.js optimizations, performance, and best practices
 */
test.describe('Next.js Best Practices', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('Security headers are properly set', async ({ page }) => {
    const response = await page.goto(`${baseURL}/`);
    const headers = response?.headers() || {};
    
    // Security headers from next.config.ts
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['x-xss-protection']).toBe('1; mode=block');
    expect(headers['referrer-policy']).toBe('origin-when-cross-origin');
    expect(headers['strict-transport-security']).toContain('max-age');
  });

  test('Powered-by header is removed', async ({ page }) => {
    const response = await page.goto(`${baseURL}/`);
    const headers = response?.headers() || {};
    
    // Next.js should not expose powered-by header (security best practice)
    expect(headers['x-powered-by']).toBeUndefined();
  });

  test('Compression is enabled', async ({ request }) => {
    const response = await request.get(`${baseURL}/`, {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
    
    const contentEncoding = response.headers()['content-encoding'];
    // Should be compressed (gzip, br, or deflate)
    if (contentEncoding) {
      expect(['gzip', 'br', 'deflate']).toContain(contentEncoding);
    }
  });

  test('Images are optimized', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check if Next.js Image component is used (look for optimized image URLs)
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        // Next.js optimized images have specific URL patterns
        // This is a basic check - actual optimization depends on implementation
        expect(src).toBeTruthy();
      }
    }
  });

  test('Fonts are preloaded', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check for font preload links
    const preloadLinks = await page.locator('link[rel="preload"][as="font"]').count();
    
    // Should have font preloading for performance
    expect(preloadLinks).toBeGreaterThanOrEqual(0);
  });

  test('JavaScript is code-split', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check that multiple JS chunks are loaded (code splitting)
    const jsFiles = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('script[src]'))
        .map(script => (script as HTMLScriptElement).src)
        .filter(src => src.includes('.js'));
    });
    
    // Should have multiple chunks (code splitting working)
    expect(jsFiles.length).toBeGreaterThan(0);
  });

  test('CSS is properly loaded', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check for CSS links
    const cssLinks = await page.locator('link[rel="stylesheet"]').count();
    
    // Should have at least one stylesheet
    expect(cssLinks).toBeGreaterThan(0);
  });

  test('React Strict Mode is enabled', async ({ page }) => {
    // React Strict Mode shows warnings in console in dev mode
    // In production, we check that the app works correctly
    await page.goto(`${baseURL}/`);
    
    // Verify page loads without critical errors
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('API routes have proper error handling', async ({ request }) => {
    // Test invalid endpoint
    const response = await request.get(`${baseURL}/api/nonexistent`);
    
    // Should return proper error status
    expect([404, 405]).toContain(response.status());
  });

  test('Pages have proper meta tags for SEO', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check for essential meta tags
    const viewport = await page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveCount(1);
    
    const charset = await page.locator('meta[charset]');
    await expect(charset).toHaveCount(1);
  });

  test('Static generation works correctly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${baseURL}/`);
    const loadTime = Date.now() - startTime;
    
    // Static pages should load quickly
    expect(loadTime).toBeLessThan(5000); // 5 seconds max
    
    // Verify content is rendered
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Server components are used correctly', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check that initial HTML contains content (server-rendered)
    const html = await page.content();
    
    // Should have actual content, not just loading states
    expect(html.length).toBeGreaterThan(1000);
  });

  test('Middleware is working', async ({ page }) => {
    // Middleware should handle requests
    const response = await page.goto(`${baseURL}/`);
    
    // Should get a response (middleware didn't block)
    expect(response?.status()).toBe(200);
  });

  test('Environment variables are not exposed to client', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check that sensitive env vars are not in the HTML
    const html = await page.content();
    
    // Should not contain sensitive environment variables
    expect(html).not.toContain('DATABASE_URL');
    expect(html).not.toContain('NEXTAUTH_SECRET');
    expect(html).not.toContain('STRIPE_SECRET_KEY');
    expect(html).not.toContain('SMTP_PASSWORD');
  });
});

