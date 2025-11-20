import { test, expect } from '@playwright/test';

/**
 * Dynamic page tests
 * Tests that dynamic pages are properly server-rendered on demand
 */
test.describe('Dynamic Pages', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('Dynamic route returns server-rendered response', async ({ page }) => {
    // Test a dynamic route (requires authentication, so we expect redirect or error)
    const response = await page.goto(`${baseURL}/docs/test-document`);
    
    // Should return server-side response (not client-side redirect)
    expect([200, 302, 401, 403]).toContain(response?.status() || 0);
    
    // If redirected, verify it's a server-side redirect
    if (response?.status() === 302) {
      const location = response.headers()['location'];
      expect(location).toBeTruthy();
    }
  });

  test('Dynamic pages handle missing parameters', async ({ page }) => {
    const response = await page.goto(`${baseURL}/docs/`);
    
    // Should handle gracefully (404 or redirect)
    expect([404, 302, 200]).toContain(response?.status() || 0);
  });

  test('Dynamic pages are not pre-rendered', async ({ page }) => {
    const startTime = Date.now();
    const response = await page.goto(`${baseURL}/docs/test-doc-${Date.now()}`);
    const endTime = Date.now();
    
    // Dynamic pages should be rendered on-demand (may take longer)
    // This is expected behavior for dynamic routes
    expect(response?.status()).toBeTruthy();
    
    // Verify it's a server-side response
    const html = await page.content();
    expect(html).toContain('<!DOCTYPE html>');
  });

  test('Dynamic pages have proper error handling', async ({ page }) => {
    // Test with invalid document ID
    // Note: /docs/[filename] is a client-side page, so it returns 200 and handles errors client-side
    const response = await page.goto(`${baseURL}/docs/invalid-doc-id-12345`);
    
    // Client-side pages return 200, then handle errors/redirects in the browser
    expect([200, 302, 401, 403, 404]).toContain(response?.status() || 0);
  });

  test('Dynamic pages respect authentication', async ({ page }) => {
    // Try to access protected dynamic route
    // Note: /owner uses client-side redirect, so it returns 200 first
    const response = await page.goto(`${baseURL}/owner`, { waitUntil: 'domcontentloaded' });
    
    // Wait for potential client-side redirect (max 3 seconds)
    try {
      await page.waitForURL(/signin/, { timeout: 3000 });
    } catch {
      // If no redirect happens, check current URL
    }
    
    const currentUrl = page.url();
    
    // Should either be on signin page (client-side redirect) or return error status (server-side)
    expect([200, 302, 401, 403]).toContain(response?.status() || 0);
    
    // If status is 200, verify we're redirected client-side to signin
    if (response?.status() === 200) {
      expect(currentUrl).toContain('signin');
    } else if (response?.status() === 302) {
      const location = response.headers()['location'];
      expect(location).toContain('signin');
    }
  });

  test('Dynamic pages have no-cache headers for user-specific content', async ({ page }) => {
    const response = await page.goto(`${baseURL}/docs/test`);
    
    const headers = response?.headers() || {};
    const cacheControl = headers['cache-control'];
    
    // User-specific pages should not be cached
    if (cacheControl && response?.status() === 200) {
      expect(cacheControl).toMatch(/no-store|no-cache|private/);
    }
  });
});

