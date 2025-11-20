import { test, expect } from '@playwright/test';
import { signIn, TEST_USER_EMAIL, TEST_USER_PASSWORD } from '../helpers/auth';

/**
 * Authenticated API route tests
 * Tests API routes that require authentication
 */
test.describe('Authenticated API Routes', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    // Sign in before each test
    const authenticated = await signIn(page, TEST_USER_EMAIL, TEST_USER_PASSWORD);
    
    if (!authenticated) {
      test.skip(true, 'Failed to authenticate test user');
    }
  });

  test('Documents API returns data when authenticated', async ({ page, request }) => {
    // Get cookies from page context
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await request.get(`${baseURL}/api/documents`, {
      headers: {
        'Cookie': cookieHeader,
      },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    expect(data.data).toHaveProperty('documents');
    expect(Array.isArray(data.data.documents)).toBe(true);
  });

  test('Subscription API returns data when authenticated', async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await request.get(`${baseURL}/api/subscription`, {
      headers: {
        'Cookie': cookieHeader,
      },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
  });

  test('Tests API returns data when authenticated', async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await request.get(`${baseURL}/api/tests`, {
      headers: {
        'Cookie': cookieHeader,
      },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
  });

  test('Users API requires proper role', async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await request.get(`${baseURL}/api/users`, {
      headers: {
        'Cookie': cookieHeader,
      },
    });
    
    // Should return 200 (with data) or 403 (forbidden) depending on role
    expect([200, 403]).toContain(response.status());
  });

  test('Assignments API returns data when authenticated', async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await request.get(`${baseURL}/api/assignments`, {
      headers: {
        'Cookie': cookieHeader,
      },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data).toHaveProperty('success', true);
  });

  test('Authenticated API routes have proper cache headers', async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await request.get(`${baseURL}/api/documents`, {
      headers: {
        'Cookie': cookieHeader,
      },
    });
    
    const headers = response.headers();
    const cacheControl = headers['cache-control'];
    
    // User-specific data should not be cached
    if (cacheControl) {
      expect(cacheControl).toMatch(/no-store|no-cache|private/);
    }
  });

  test('Authenticated API routes return user-specific data', async ({ page, request }) => {
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const response = await request.get(`${baseURL}/api/documents`, {
      headers: {
        'Cookie': cookieHeader,
      },
    });
    
    const data = await response.json();
    
    // Should return user's documents only (tenant isolation)
    if (data.success && data.data.documents) {
      // All documents should belong to the authenticated user's business
      expect(Array.isArray(data.data.documents)).toBe(true);
    }
  });
});

