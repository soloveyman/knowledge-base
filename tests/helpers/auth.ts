import { Page, BrowserContext } from '@playwright/test';

/**
 * Authentication helper for tests
 * Uses environment variables for credentials
 * 
 * SECURITY: Never commit real credentials to git!
 * Set TEST_USER_EMAIL and TEST_USER_PASSWORD as environment variables.
 */
export const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL;
export const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD;

if (!TEST_USER_EMAIL || !TEST_USER_PASSWORD) {
  console.warn('⚠️  TEST_USER_EMAIL and TEST_USER_PASSWORD must be set as environment variables');
  console.warn('   Set them before running authenticated tests:');
  console.warn('   export TEST_USER_EMAIL=your-email@example.com');
  console.warn('   export TEST_USER_PASSWORD=your-password');
}

/**
 * Sign in a user for testing
 */
export async function signIn(page: Page, email?: string, password?: string): Promise<boolean> {
  const userEmail = email || TEST_USER_EMAIL;
  const userPassword = password || TEST_USER_PASSWORD;
  
  if (!userEmail || !userPassword) {
    throw new Error('Email and password must be provided either as parameters or via TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables');
  }
  try {
    // Navigate to sign in page
    await page.goto('/auth/signin');
    
    // Wait for sign in form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
    
    // Fill in credentials
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    
    await emailInput.fill(userEmail);
    await passwordInput.fill(userPassword);
    
    // Submit form
    const submitButton = page.locator('button[type="submit"]').first();
    await submitButton.click();
    
    // Wait for navigation (either to dashboard or error)
    await page.waitForURL(/^\/(?!auth)/, { timeout: 10000 }).catch(() => {
      // If still on auth page, check for error
      return page.waitForSelector('.error, [role="alert"]', { timeout: 2000 }).catch(() => null);
    });
    
    // Check if we're authenticated (not on sign in page)
    const currentUrl = page.url();
    const isAuthenticated = !currentUrl.includes('/auth/signin');
    
    return isAuthenticated;
  } catch (error) {
    console.error('Sign in failed:', error);
    return false;
  }
}

/**
 * Sign out a user
 */
export async function signOut(page: Page): Promise<void> {
  try {
    // Look for sign out button/link
    const signOutButton = page.locator('button:has-text("Sign out"), a:has-text("Sign out"), [data-testid="signout"]').first();
    
    if (await signOutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signOutButton.click();
      await page.waitForURL(/\/auth\/signin/, { timeout: 5000 });
    }
  } catch (error) {
    console.error('Sign out failed:', error);
  }
}

/**
 * Get authenticated context (with cookies)
 */
export async function getAuthenticatedContext(
  context: BrowserContext,
  email?: string,
  password?: string
): Promise<BrowserContext> {
  const userEmail = email || TEST_USER_EMAIL;
  const userPassword = password || TEST_USER_PASSWORD;
  
  if (!userEmail || !userPassword) {
    throw new Error('Email and password must be provided either as parameters or via TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables');
  }
  // Create a new page for authentication
  const page = await context.newPage();
  
  try {
    const authenticated = await signIn(page, userEmail, userPassword);
    
    if (!authenticated) {
      throw new Error('Failed to authenticate');
    }
    
    // Return context with cookies set
    return context;
  } finally {
    await page.close();
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const currentUrl = page.url();
  
  // If on sign in page, not authenticated
  if (currentUrl.includes('/auth/signin')) {
    return false;
  }
  
  // Try to access a protected endpoint
  try {
    const response = await page.request.get('/api/documents');
    return response.status() !== 401;
  } catch {
    return false;
  }
}

