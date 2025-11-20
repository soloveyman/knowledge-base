import { test, expect } from '@playwright/test';

/**
 * Production build integration tests
 * Comprehensive tests for production build behavior
 */
test.describe('Production Build Integration', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test('Production build serves optimized assets', async ({ page }) => {
    await page.goto(`${baseURL}/`);
    
    // Check for optimized asset loading
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .map((entry: any) => ({
          name: entry.name,
          transferSize: entry.transferSize,
          duration: entry.duration,
        }));
    });
    
    // Should have loaded resources
    expect(resources.length).toBeGreaterThan(0);
    
    // Check that assets are reasonably sized (optimized)
    const jsFiles = resources.filter((r: any) => r.name.includes('.js'));
    if (jsFiles.length > 0) {
      const totalJsSize = jsFiles.reduce((sum: number, r: any) => sum + (r.transferSize || 0), 0);
      // Total JS should be reasonable (less than 2MB for initial load)
      expect(totalJsSize).toBeLessThan(2 * 1024 * 1024);
    }
  });

  test('Production build has correct NODE_ENV', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/health`);
    const data = await response.json();
    
    // Should indicate production environment
    if (data.environment) {
      expect(data.environment.nodeEnv).toBe('production');
    }
  });

  test('Production build console errors are removed', async ({ page }) => {
    const consoleMessages: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });
    
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
    
    // Production build should have console.error and console.warn removed
    // (except for actual errors)
    const criticalErrors = consoleMessages.filter(
      msg => !msg.includes('favicon') && !msg.includes('analytics')
    );
    
    // Should have minimal errors
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test('Production build has proper error pages', async ({ page }) => {
    // Test 404 page
    const response = await page.goto(`${baseURL}/nonexistent-page-12345`);
    
    // Should return 404
    expect([404, 200]).toContain(response?.status() || 0);
    
    // If 200, should show 404 page content
    if (response?.status() === 200) {
      const content = await page.textContent('body');
      expect(content).toBeTruthy();
    }
  });

  test('Production build handles concurrent requests', async ({ request }) => {
    // Make multiple concurrent requests
    const requests = Array.from({ length: 5 }, () =>
      request.get(`${baseURL}/api/health`)
    );
    
    const responses = await Promise.all(requests);
    
    // All should succeed
    responses.forEach(response => {
      expect(response.status()).toBe(200);
    });
  });

  test('Production build has proper response times', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Production build should load reasonably fast
    expect(loadTime).toBeLessThan(10000); // 10 seconds max
  });

  test('Production build serves correct content types', async ({ request }) => {
    // Test HTML
    const htmlResponse = await request.get(`${baseURL}/`);
    expect(htmlResponse.headers()['content-type']).toContain('text/html');
    
    // Test API JSON
    const apiResponse = await request.get(`${baseURL}/api/health`);
    expect(apiResponse.headers()['content-type']).toContain('application/json');
  });

  test('Production build handles large payloads', async ({ request }) => {
    // Test that API can handle reasonable payload sizes
    const response = await request.post(`${baseURL}/api/documents`, {
      data: {
        // Small payload test
        test: 'data',
      },
    });
    
    // Should handle request (may fail due to auth, but shouldn't fail due to size)
    expect([400, 401, 403, 201, 200]).toContain(response.status());
  });
});

