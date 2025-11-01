/**
 * Security & Rate Limiting Test Suite
 * 
 * Tests all security and rate limiting features before production deployment.
 * 
 * Run: npm run test:security
 * Or: tsx scripts/test-security.ts
 */

const SECURITY_TEST_BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

interface SecurityTestResult {
  name: string
  passed: boolean
  error?: string
  details?: string
}

const securityTestResults: SecurityTestResult[] = []

function securityLog(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const symbols = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️'
  }
  console.log(`${symbols[type]} ${message}`)
}

function addSecurityResult(name: string, passed: boolean, error?: string, details?: string) {
  securityTestResults.push({ name, passed, error, details })
  if (passed) {
    securityLog(`${name}: PASSED`, 'success')
  } else {
    securityLog(`${name}: FAILED${error ? ` - ${error}` : ''}`, 'error')
    if (details) securityLog(`  Details: ${details}`, 'info')
  }
}

async function testRateLimit(endpoint: string, maxRequests: number): Promise<boolean> {
  try {
    securityLog(`Testing rate limit: ${endpoint} (max ${maxRequests} requests)`, 'info')
    
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
          securityLog(`  Request ${i}: Rate limited (expected after limit)`, 'info')
          break
        }
        securityLog(`  Request ${i}: Status ${response.status}, Remaining: ${rateLimitRemaining || 'N/A'}`, 'info')
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
      
      securityLog(`  Rate limit triggered correctly (429)`, 'success')
      securityLog(`  Headers: Limit=${limit}, Remaining=${remaining}, Retry-After=${retryAfter}`, 'info')
      return true
    }
    
    return false
  } catch (error) {
    securityLog(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testSecurityHeaders(): Promise<boolean> {
  try {
    securityLog('Testing security headers', 'info')
    
    const response = await fetch(`${SECURITY_TEST_BASE_URL}/`)
    const headers = {
      'strict-transport-security': response.headers.get('strict-transport-security'),
      'x-frame-options': response.headers.get('x-frame-options'),
      'x-content-type-options': response.headers.get('x-content-type-options'),
      'x-xss-protection': response.headers.get('x-xss-protection'),
      'referrer-policy': response.headers.get('referrer-policy'),
      'permissions-policy': response.headers.get('permissions-policy'),
    }
    
    securityLog(`  Headers received:`, 'info')
    Object.entries(headers).forEach(([key, value]) => {
      securityLog(`    ${key}: ${value || '❌ MISSING'}`, value ? 'success' : 'error')
    })
    
    const allPresent = Object.values(headers).every(h => h !== null)
    return allPresent
  } catch (error) {
    securityLog(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testApiRateLimit(): Promise<boolean> {
  try {
    securityLog('Testing API rate limiting (middleware)', 'info')
    
    // Make a few requests to any API endpoint
    // Note: This will fail auth but should still respect rate limits
    for (let i = 1; i <= 5; i++) {
      const response = await fetch(`${SECURITY_TEST_BASE_URL}/api/users`, {
        method: 'GET',
      })
      
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
      securityLog(`  Request ${i}: Status ${response.status}, Remaining: ${rateLimitRemaining || 'N/A'}`, 'info')
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
    securityLog(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testBuild(): Promise<boolean> {
  try {
    securityLog('Testing production build', 'info')
    
    // Check if build works without errors
    const { execSync } = await import('child_process')
    securityLog('  Running: npm run build', 'info')
    
    try {
      execSync('npm run build', { 
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'production' }
      })
      securityLog('  Build completed successfully', 'success')
      return true
    } catch (error: any) {
      securityLog(`  Build failed: ${error.message}`, 'error')
      if (error.stdout) securityLog(`  stdout: ${error.stdout.toString()}`, 'info')
      if (error.stderr) securityLog(`  stderr: ${error.stderr.toString()}`, 'error')
      return false
    }
  } catch (error) {
    securityLog(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testHoneypot(): Promise<boolean> {
  try {
    securityLog('Testing honeypot field', 'info')
    
    // Test that honeypot field exists in the signin page
    const response = await fetch(`${SECURITY_TEST_BASE_URL}/auth/signin`)
    const html = await response.text()
    
    // Check for honeypot field indicators
    const hasHoneypot = html.includes('name="website"') || 
                       html.includes('honeypot') ||
                       html.includes('display: none')
    
    if (hasHoneypot) {
      securityLog('  Honeypot field detected in HTML', 'success')
      return true
    }
    
    securityLog('  Honeypot field not found', 'error')
    return false
  } catch (error) {
    securityLog(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testTypeCheck(): Promise<boolean> {
  try {
    securityLog('Running TypeScript type check', 'info')
    
    const { execSync } = await import('child_process')
    
    try {
      execSync('npm run typecheck', { 
        stdio: 'pipe'
      })
      securityLog('  Type check passed', 'success')
      return true
    } catch (error: any) {
      securityLog(`  Type check failed: ${error.message}`, 'error')
      if (error.stdout) securityLog(`  stdout: ${error.stdout.toString()}`, 'info')
      if (error.stderr) securityLog(`  stderr: ${error.stderr.toString()}`, 'error')
      return false
    }
  } catch (error) {
    securityLog(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return false
  }
}

async function testLint(): Promise<boolean> {
  try {
    securityLog('Running ESLint check', 'info')
    
    const { execSync } = await import('child_process')
    
    try {
      execSync('npm run lint', { 
        stdio: 'pipe'
      })
      securityLog('  Lint check passed', 'success')
      return true
    } catch (error: any) {
      securityLog(`  Lint check failed: ${error.message}`, 'error')
      if (error.stdout) securityLog(`  stdout: ${error.stdout.toString()}`, 'info')
      if (error.stderr) securityLog(`  stderr: ${error.stderr.toString()}`, 'error')
      return false
    }
  } catch (error) {
    securityLog(`  Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
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
      securityLog('⚠️  Server may not be running. Start with: npm run dev', 'warn')
      securityLog('⚠️  Some tests may fail if server is not running\n', 'warn')
    } else {
      securityLog('✅ Server is running\n', 'success')
    }
  } catch {
    securityLog('⚠️  Could not verify server status\n', 'warn')
  }
  
  // Run all tests
  securityLog('\n=== Running Tests ===\n', 'info')
  
  // Test 1: Type checking
  const typeCheckPassed = await testTypeCheck()
  addSecurityResult('TypeScript Type Check', typeCheckPassed)
  
  // Test 2: Linting
  const lintPassed = await testLint()
  addSecurityResult('ESLint Check', lintPassed)
  
  // Test 3: Security Headers
  const headersPassed = await testSecurityHeaders()
  addSecurityResult('Security Headers', headersPassed)
  
  // Test 4: Honeypot Field
  const honeypotPassed = await testHoneypot()
  addSecurityResult('Honeypot Field', honeypotPassed)
  
  // Test 5: Registration Rate Limiting
  const registrationRateLimitPassed = await testRateLimit('/api/auth/register', 5)
  addSecurityResult('Registration Rate Limiting', registrationRateLimitPassed)
  
  // Test 6: API Rate Limiting (Middleware)
  const apiRateLimitPassed = await testApiRateLimit()
  addSecurityResult('API Rate Limiting (Middleware)', apiRateLimitPassed)
  
  // Test 7: Production Build
  const buildPassed = await testBuild()
  addSecurityResult('Production Build', buildPassed)
  
  // Summary
  console.log('\n=== Test Summary ===\n')
  
  const passed = securityTestResults.filter(r => r.passed).length
  const failed = securityTestResults.filter(r => !r.passed).length
  const total = securityTestResults.length

  securityTestResults.forEach(result => {
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

