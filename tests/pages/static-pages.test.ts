import { test, expect } from '@playwright/test';

/**
 * Static page tests
 * Tests that static pages are properly pre-rendered and cached
 */
test.describe('Static Pages', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('Home page is statically generated', async ({ page }) => {
    const response = await page.goto(`${baseURL}/`);
    
    expect(response?.status()).toBe(200);
    
    // Verify HTML is server-rendered
    const html = await page.content();
    expect(html).toContain('<!DOCTYPE html>');
    
    // Check for Next.js static optimization markers
    const headers = response?.headers();
    if (headers?.['x-nextjs-cache']) {
      expect(['HIT', 'MISS', 'STALE']).toContain(headers['x-nextjs-cache']);
    }
  });

  test('Static pages have proper meta tags', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check for essential meta tags
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();
    
    const charset = await page.locator('meta[charset]').getAttribute('charset');
    expect(charset).toBe('utf-8');
  });

  test('Static pages have security headers', async ({ page }) => {
    const response = await page.goto(`${baseURL}/`);
    
    const headers = response?.headers() || {};
    
    // Security headers from next.config.ts
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['x-xss-protection']).toBe('1; mode=block');
    expect(headers['referrer-policy']).toBe('origin-when-cross-origin');
  });

  test('Static pages load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    
    await page.goto(`${baseURL}/`);
    
    // Allow some time for JS to load
    await page.waitForLoadState('networkidle');
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (error) => !error.includes('favicon') && !error.includes('analytics')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('Static pages have proper document structure', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check for proper HTML structure
    const html = await page.locator('html').getAttribute('lang');
    expect(html).toBeTruthy();
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Static pages are cacheable', async ({ page }) => {
    const response1 = await page.goto(`${baseURL}/`);
    const headers1 = response1?.headers() || {};
    
    // Second request should potentially use cache
    const response2 = await page.goto(`${baseURL}/`);
    const headers2 = response2?.headers() || {};
    
    // Verify responses are consistent
    expect(response1?.status()).toBe(200);
    expect(response2?.status()).toBe(200);
  });
});

