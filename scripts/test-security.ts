/**
 * Security & Rate Limiting Test Suite
 * 
 * Tests all security and rate limiting features before production deployment.
 * 
 * Run: npm run test:security
 * Or: tsx scripts/test-security.ts
 */

const SECURITY_TEST_SECURITY_TEST_BASE_URL = process.env.SECURITY_TEST_BASE_URL || 'http://localhost:3000'

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

async function testRateLimit(endpoint: string, maxRequests: number): Promise<boolean> {
  try {
    log(`Testing rate limit: ${endpoint} (max ${maxRequests} requests)`, 'info')
    
    // Make requests up to the limit
    for (let i = 1; i <= maxRequests; i++) {
      const response = await fetch(`${SECURITY_TEST_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `test${i}@test.com`,
          password: 'testpassword123'
        })
      })
      
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
      
      if (i <= maxRequests) {
        if (response.status === 429) {
          log(`  Request ${i}: Rate limited (expected after limit)`, 'info')
          break
        }
        log(`  Request ${i}: Status ${response.status}, Remaining: ${rateLimitRemaining || 'N/A'}`, 'info')
      }
    }
    
    // Make one more request - should be rate limited
    const response = await fetch(`${SECURITY_TEST_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'shouldfail@test.com',
        password: 'testpassword123'
      })
    })
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      const limit = response.headers.get('X-RateLimit-Limit')
      const remaining = response.headers.get('X-RateLimit-Remaining')
      
      log(`  Rate limit triggered correctly (429)`, 'success')
      log(`  Headers: Limit=${limit}, Remaining=${remaining}, Retry-After=${retryAfter}`, 'info')
      return true
    }
    
    return false
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testSecurityHeaders(): Promise<boolean> {
  try {
    log('Testing security headers', 'info')
    
    const response = await fetch(`${SECURITY_TEST_BASE_URL}/`)
    const headers = {
      'strict-transport-security': response.headers.get('strict-transport-security'),
      'x-frame-options': response.headers.get('x-frame-options'),
      'x-content-type-options': response.headers.get('x-content-type-options'),
      'x-xss-protection': response.headers.get('x-xss-protection'),
      'referrer-policy': response.headers.get('referrer-policy'),
      'permissions-policy': response.headers.get('permissions-policy'),
    }
    
    log(`  Headers received:`, 'info')
    Object.entries(headers).forEach(([key, value]) => {
      log(`    ${key}: ${value || '❌ MISSING'}`, value ? 'success' : 'error')
    })
    
    const allPresent = Object.values(headers).every(h => h !== null)
    return allPresent
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testApiRateLimit(): Promise<boolean> {
  try {
    log('Testing API rate limiting (middleware)', 'info')
    
    // Make a few requests to any API endpoint
    // Note: This will fail auth but should still respect rate limits
    for (let i = 1; i <= 5; i++) {
      const response = await fetch(`${SECURITY_TEST_BASE_URL}/api/users`, {
        method: 'GET',
      })
      
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
      log(`  Request ${i}: Status ${response.status}, Remaining: ${rateLimitRemaining || 'N/A'}`, 'info')
    }
    
    // Check if rate limit headers are present
    const response = await fetch(`${SECURITY_TEST_BASE_URL}/api/users`, {
      method: 'GET',
    })
    
    const hasRateLimitHeaders = 
      response.headers.get('X-RateLimit-Limit') !== null ||
      response.headers.get('X-RateLimit-Remaining') !== null
    
    return hasRateLimitHeaders
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testBuild(): Promise<boolean> {
  try {
    log('Testing production build', 'info')
    
    // Check if build works without errors
    const { execSync } = await import('child_process')
    log('  Running: npm run build', 'info')
    
    try {
      execSync('npm run build', { 
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' }
      })
      log('  Build completed successfully', 'success')
      return true
    } catch (error: any) {
      log(`  Build failed: ${error.message}`, 'error')
      if (error.stdout) log(`  stdout: ${error.stdout.toString()}`, 'info')
      if (error.stderr) log(`  stderr: ${error.stderr.toString()}`, 'error')
      return false
    }
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testHoneypot(): Promise<boolean> {
  try {
    log('Testing honeypot field', 'info')
    
    // Test that honeypot field exists in the signin page
    const response = await fetch(`${SECURITY_TEST_BASE_URL}/auth/signin`)
    const html = await response.text()
    
    // Check for honeypot field indicators
    const hasHoneypot = html.includes('name="website"') || 
                       html.includes('honeypot') ||
                       html.includes('display: none')
    
    if (hasHoneypot) {
      log('  Honeypot field detected in HTML', 'success')
      return true
    }
    
    log('  Honeypot field not found', 'error')
    return false
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testTypeCheck(): Promise<boolean> {
  try {
    log('Running TypeScript type check', 'info')
    
    const { execSync } = await import('child_process')
    
    try {
      execSync('npm run typecheck', { 
        stdio: 'pipe'
      })
      log('  Type check passed', 'success')
      return true
    } catch (error: any) {
      log(`  Type check failed: ${error.message}`, 'error')
      if (error.stdout) log(`  stdout: ${error.stdout.toString()}`, 'info')
      if (error.stderr) log(`  stderr: ${error.stderr.toString()}`, 'error')
      return false
    }
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testLint(): Promise<boolean> {
  try {
    log('Running ESLint check', 'info')
    
    const { execSync } = await import('child_process')
    
    try {
      execSync('npm run lint', { 
        stdio: 'pipe'
      })
      log('  Lint check passed', 'success')
      return true
    } catch (error: any) {
      log(`  Lint check failed: ${error.message}`, 'error')
      if (error.stdout) log(`  stdout: ${error.stdout.toString()}`, 'info')
      if (error.stderr) log(`  stderr: ${error.stderr.toString()}`, 'error')
      return false
    }
  } catch (error) {
    log(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function main() {
  console.log('\n🔒 Security & Rate Limiting Test Suite\n')
  console.log(`Testing against: ${SECURITY_TEST_BASE_URL}\n`)
  
  // Check if server is running
  try {
    const healthCheck = await fetch(`${SECURITY_TEST_BASE_URL}/api/health`).catch(() => null)
    if (!healthCheck) {
      log('⚠️  Server may not be running. Start with: npm run dev', 'warn')
      log('⚠️  Some tests may fail if server is not running\n', 'warn')
    } else {
      log('✅ Server is running\n', 'success')
    }
  } catch {
    log('⚠️  Could not verify server status\n', 'warn')
  }
  
  // Run all tests
  log('\n=== Running Tests ===\n', 'info')
  
  // Test 1: Type checking
  const typeCheckPassed = await testTypeCheck()
  addResult('TypeScript Type Check', typeCheckPassed)
  
  // Test 2: Linting
  const lintPassed = await testLint()
  addResult('ESLint Check', lintPassed)
  
  // Test 3: Security Headers
  const headersPassed = await testSecurityHeaders()
  addResult('Security Headers', headersPassed)
  
  // Test 4: Honeypot Field
  const honeypotPassed = await testHoneypot()
  addResult('Honeypot Field', honeypotPassed)
  
  // Test 5: Registration Rate Limiting
  const registrationRateLimitPassed = await testRateLimit('/api/auth/register', 5)
  addResult('Registration Rate Limiting', registrationRateLimitPassed)
  
  // Test 6: API Rate Limiting (Middleware)
  const apiRateLimitPassed = await testApiRateLimit()
  addResult('API Rate Limiting (Middleware)', apiRateLimitPassed)
  
  // Test 7: Production Build
  const buildPassed = await testBuild()
  addResult('Production Build', buildPassed)
  
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
    console.log(`\n✅ All tests passed! Ready for production deployment.\n`)
    process.exit(0)
  }
}

// Run tests
main().catch(error => {
  console.error('❌ Test suite error:', error)
  process.exit(1)
})

