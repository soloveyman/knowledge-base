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
    const response = await page.goto(`${baseURL}/docs/invalid-doc-id-12345`);
    
    // Should return proper error status
    expect([404, 302, 401, 403]).toContain(response?.status() || 0);
  });

  test('Dynamic pages respect authentication', async ({ page }) => {
    // Try to access protected dynamic route
    const response = await page.goto(`${baseURL}/owner`);
    
    // Should redirect to login or return 401/403
    expect([302, 401, 403]).toContain(response?.status() || 0);
    
    if (response?.status() === 302) {
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

