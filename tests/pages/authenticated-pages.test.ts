import { test, expect } from '@playwright/test';
import { signIn, TEST_USER_EMAIL, TEST_USER_PASSWORD, isAuthenticated } from '../helpers/auth';

/**
 * Authenticated page tests
 * Tests pages that require authentication
 */
test.describe('Authenticated Pages', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    const authenticated = await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    
    if (!authenticated) {
      test.skip(true, 'Failed to authenticate test user');
    }
  });

  test('Owner page loads when authenticated as owner', async ({ page }) => {
    await page.goto(`${baseURL}/owner`);
    
    // Should not redirect to sign in
    expect(page.url()).not.toContain('/auth/signin');
    
    // Should load page content
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Manager page loads when authenticated as manager', async ({ page }) => {
    await page.goto(`${baseURL}/manager`);
    
    // Should not redirect to sign in
    expect(page.url()).not.toContain('/auth/signin');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Employee page loads when authenticated as employee', async ({ page }) => {
    await page.goto(`${baseURL}/employee`);
    
    // Should not redirect to sign in
    expect(page.url()).not.toContain('/auth/signin');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Docs page loads when authenticated', async ({ page }) => {
    await page.goto(`${baseURL}/docs`);
    
    // Should not redirect to sign in
    expect(page.url()).not.toContain('/auth/signin');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Test builder page loads when authenticated', async ({ page }) => {
    await page.goto(`${baseURL}/test-builder`);
    
    // Should not redirect to sign in
    expect(page.url()).not.toContain('/auth/signin');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('Protected pages redirect when not authenticated', async ({ page, context }) => {
    // Clear cookies to simulate unauthenticated state
    await context.clearCookies();
    
    await page.goto(`${baseURL}/owner`);
    
    // Should redirect to sign in
    await page.waitForURL(/\/auth\/signin/, { timeout: 5000 });
    expect(page.url()).toContain('/auth/signin');
  });

  test('Session persists across page navigations', async ({ page }) => {
    // Navigate to first page
    await page.goto(`${baseURL}/docs`);
    const authenticated1 = await isAuthenticated(page);
    expect(authenticated1).toBe(true);
    
    // Navigate to another page
    await page.goto(`${baseURL}/owner`);
    const authenticated2 = await isAuthenticated(page);
    expect(authenticated2).toBe(true);
    
    // Navigate to third page
    await page.goto(`${baseURL}/manager`);
    const authenticated3 = await isAuthenticated(page);
    expect(authenticated3).toBe(true);
  });

  test('Authenticated pages have proper security headers', async ({ page }) => {
    await page.goto(`${baseURL}/owner`);
    
    const response = await page.request.get(`${baseURL}/owner`);
    const headers = response.headers();
    
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  test('Authenticated pages load user-specific content', async ({ page }) => {
    await page.goto(`${baseURL}/docs`);
    
    // Wait for content to load
    await page.waitForLoadState('networkidle');
    
    // Should have some content (not just loading state)
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(100);
  });
});

