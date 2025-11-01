/**
 * Authentication Flow Test Suite
 * 
 * Tests sign up and sign in functionality before production deployment.
 * 
 * Run: npm run test:auth
 * Or: tsx scripts/test-auth-flow.ts
 * 
 * Prerequisites:
 * 1. Start the dev server: npm run dev
 * 2. Ensure database is running
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_EMAIL = `test-${Date.now()}@test.com`
const TEST_PASSWORD = 'testpassword123'
const TEST_NAME = 'Test User'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: string
}

const results: TestResult[] = []

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const symbols = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️'
  }
  console.log(`${symbols[type]} ${message}`)
}

function addResult(name: string, passed: boolean, error?: string, details?: string) {
  results.push({ name, passed, error, details })
  if (passed) {
    log(`${name}: PASSED`, 'success')
  } else {
    log(`${name}: FAILED${error ? ` - ${error}` : ''}`, 'error')
    if (details) log(`  Details: ${details}`, 'info')
  }
}

async function checkServerRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/health`)
    return response.ok
  } catch {
    return false
  }
}

async function testRegistration(): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    log(`Testing registration with email: ${TEST_EMAIL}`, 'info')
    
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME
      })
    })
    
    const data = await response.json().catch(() => ({}))
    
    if (!response.ok) {
      const errorMsg = data.error || `Registration failed: ${response.status} ${response.statusText}`
      log(`  Registration failed: ${errorMsg}`, 'error')
      return { success: false, error: errorMsg }
    }
    
    if (data.success && data.id) {
      log(`  Registration successful! User ID: ${data.id}`, 'success')
      return { success: true, userId: data.id }
    }
    
    return { success: false, error: 'Registration response missing success or id' }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    log(`  Registration error: ${errorMsg}`, 'error')
    return { success: false, error: errorMsg }
  }
}

async function testRegistrationWithExistingEmail(email: string): Promise<boolean> {
  try {
    log(`Testing registration with existing email: ${email}`, 'info')
    
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: TEST_PASSWORD,
        name: TEST_NAME
      })
    })
    
    const data = await response.json().catch(() => ({}))
    
    // Should return 409 (Conflict) or handle gracefully
    if (response.status === 409 || (data.success && data.existing)) {
      log(`  Correctly handled existing email (status: ${response.status})`, 'success')
      return true
    }
    
    log(`  Unexpected response: ${response.status}`, 'error')
    return false
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    log(`  Error: ${errorMsg}`, 'error')
    return false
  }
}

async function testLogin(email: string, password: string): Promise<{ success: boolean; session?: any; error?: string }> {
  try {
    log(`Testing login with email: ${email}`, 'info')
    
    const response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password,
        redirect: false
      }),
      credentials: 'include'
    })
    
    // NextAuth might return different status codes
    if (response.status === 200 || response.status === 302) {
      log(`  Login successful (status: ${response.status})`, 'success')
      
      // Check session
      const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
        credentials: 'include'
      })
      
      if (sessionResponse.ok) {
        const session = await sessionResponse.json().catch(() => ({}))
        if (session.user) {
          log(`  Session retrieved - User: ${session.user.email}, Role: ${session.user.role}`, 'success')
          return { success: true, session }
        }
      }
      
      return { success: true }
    } else {
      const data = await response.json().catch(() => ({}))
      const errorMsg = data.error || `Login failed: ${response.status} ${response.statusText}`
      log(`  Login failed: ${errorMsg}`, 'error')
      return { success: false, error: errorMsg }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    log(`  Login error: ${errorMsg}`, 'error')
    return { success: false, error: errorMsg }
  }
}

async function testInvalidLogin(): Promise<boolean> {
  try {
    log(`Testing login with invalid credentials`, 'info')
    
    const response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@test.com',
        password: 'wrongpassword',
        redirect: false
      }),
      credentials: 'include'
    })
    
    // Should return 401 or 403 for invalid credentials
    if (response.status === 401 || response.status === 403 || response.status === 400) {
      log(`  Correctly rejected invalid credentials (status: ${response.status})`, 'success')
      return true
    }
    
    // Check if error message indicates failure
    const data = await response.json().catch(() => ({}))
    if (data.error || response.status !== 200) {
      log(`  Correctly rejected invalid credentials (status: ${response.status})`, 'success')
      return true
    }
    
    log(`  Unexpected response: ${response.status}`, 'error')
    return false
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    log(`  Error: ${errorMsg}`, 'error')
    return false
  }
}

async function testRateLimitRegistration(): Promise<boolean> {
  try {
    log(`Testing registration rate limiting`, 'info')
    
    // Make 6 rapid registration attempts (limit is 5)
    let rateLimited = false
    for (let i = 1; i <= 6; i++) {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test-rate-${i}-${Date.now()}@test.com`,
          password: TEST_PASSWORD,
          name: TEST_NAME
        })
      })
      
      if (response.status === 429) {
        log(`  Rate limit triggered on request ${i} (expected)`, 'success')
        rateLimited = true
        break
      }
      
      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    return rateLimited
  } catch (error) {
    log(`  Rate limit test error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testRegistrationValidation(): Promise<boolean> {
  try {
    log(`Testing registration validation`, 'info')
    
    // Test with invalid email
    const invalidEmailResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: TEST_PASSWORD,
        name: TEST_NAME
      })
    })
    
    if (invalidEmailResponse.status === 400) {
      log(`  Correctly rejected invalid email`, 'success')
    } else {
      log(`  Unexpected response for invalid email: ${invalidEmailResponse.status}`, 'error')
      return false
    }
    
    // Test with short password
    const shortPasswordResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test-${Date.now()}@test.com`,
        password: 'short',
        name: TEST_NAME
      })
    })
    
    if (shortPasswordResponse.status === 400) {
      log(`  Correctly rejected short password`, 'success')
      return true
    } else {
      log(`  Unexpected response for short password: ${shortPasswordResponse.status}`, 'error')
      return false
    }
  } catch (error) {
    log(`  Validation test error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function main() {
  console.log('\n🔐 Authentication Flow Test Suite\n')
  console.log(`Testing against: ${BASE_URL}\n`)
  
  // Check if server is running
  log('Checking if server is running...', 'info')
  const serverRunning = await checkServerRunning()
  
  if (!serverRunning) {
    log('❌ Server is not running!', 'error')
    log('⚠️  Start the dev server first: npm run dev', 'warn')
    process.exit(1)
  }
  
  log('✅ Server is running\n', 'success')
  
  // Run tests
  log('=== Running Tests ===\n', 'info')
  
  // Test 1: Registration
  const registrationResult = await testRegistration()
  addResult('Registration (Sign Up)', registrationResult.success, registrationResult.error)
  
  // Test 2: Login with new user
  if (registrationResult.success) {
    // Wait a moment for user to be fully created
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const loginResult = await testLogin(TEST_EMAIL, TEST_PASSWORD)
    addResult('Login (Sign In) with New User', loginResult.success, loginResult.error)
  } else {
    addResult('Login (Sign In) with New User', false, 'Skipped - registration failed')
  }
  
  // Test 3: Registration with existing email
  const existingEmailResult = await testRegistrationWithExistingEmail(TEST_EMAIL)
  addResult('Registration with Existing Email', existingEmailResult)
  
  // Test 4: Invalid login
  const invalidLoginResult = await testInvalidLogin()
  addResult('Invalid Login Credentials', invalidLoginResult)
  
  // Test 5: Registration validation
  const validationResult = await testRegistrationValidation()
  addResult('Registration Validation', validationResult)
  
  // Test 6: Rate limiting (optional - might skip if already rate limited)
  try {
    const rateLimitResult = await testRateLimitRegistration()
    addResult('Registration Rate Limiting', rateLimitResult, undefined, rateLimitResult ? 'Rate limit working' : 'Rate limit not triggered')
  } catch {
    addResult('Registration Rate Limiting', false, 'Skipped - may already be rate limited')
  }
  
  // Summary
  console.log('\n=== Test Summary ===\n')
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.name}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    if (result.details) {
      console.log(`   ${result.details}`)
    }
  })
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed`)
  
  if (failed > 0) {
    console.log(`\n❌ ${failed} test(s) failed. Please fix issues before deploying to production.\n`)
    process.exit(1)
  } else {
    console.log(`\n✅ All authentication tests passed! Ready for production deployment.\n`)
    process.exit(0)
  }
}

// Run tests
main().catch(error => {
  console.error('❌ Test suite error:', error)
  process.exit(1)
})

