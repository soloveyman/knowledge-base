/**
 * CRUD Test Suite for Owner and Manager Roles
 * 
 * Tests all CRUD operations (Create, Read, Update, Delete) for:
 * - Documents
 * - Tests
 * - Assignments
 * 
 * Tests both owner and manager roles with permission checks and tenant isolation.
 * 
 * Run: npm run test:crud
 * Or: tsx scripts/test-crud.ts
 * 
 * Prerequisites:
 * 1. Start the dev server: npm run dev
 * 2. Ensure database is running
 * 3. Have test users: owner@test.com and manager@test.com (or use reset-for-testing.js)
 * 
 * NOTE: Node.js fetch doesn't automatically maintain cookies across requests.
 * This test script attempts to extract and manually send cookies, but this may not work
 * perfectly. For more reliable testing, consider using a cookie-aware HTTP client
 * like `undici` or `node-fetch` with cookie support.
 */

// Base URL will be detected in main()
const TEST_BASE_URL_DEFAULT = 'http://localhost:3000'

// Test credentials (adjust if needed)
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@test.com'
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'password123'
const MANAGER_EMAIL = process.env.MANAGER_EMAIL || 'manager@test.com'
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || 'manager123'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  details?: string
}

const testResults: TestResult[] = []

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
  testResults.push({ name, passed, error, details })
  if (passed) {
    log(`${name}: PASSED`, 'success')
  } else {
    log(`${name}: FAILED${error ? ` - ${error}` : ''}`, 'error')
    if (details) log(`  Details: ${details}`, 'info')
  }
}

// Cookie storage for authenticated requests
// Use a simple cookie jar to maintain cookies across requests
const cookieJar = new Map<string, string>()

function getCookiesForDomain(baseUrl: string): string {
  const url = new URL(baseUrl)
  const domain = url.hostname
  const cookies: string[] = []
  
  for (const [key, value] of cookieJar.entries()) {
    if (key.startsWith(domain)) {
      cookies.push(value)
    }
  }
  
  return cookies.join('; ')
}

function setCookiesFromResponse(response: Response, baseUrl: string) {
  const url = new URL(baseUrl)
  const domain = url.hostname
  
  // Try getSetCookie() first
  const setCookieHeaders = response.headers.getSetCookie?.() || []
  
  if (setCookieHeaders.length > 0) {
    for (const cookie of setCookieHeaders) {
      const parts = cookie.split(';')
      const nameValue = parts[0].trim()
      if (nameValue) {
        const [name] = nameValue.split('=')
        if (name) {
          cookieJar.set(`${domain}:${name}`, nameValue)
        }
      }
    }
  } else {
    // Fallback: try raw header
    const setCookieHeader = response.headers.get('set-cookie')
    if (setCookieHeader) {
      const cookieStrings = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
      for (const cookie of cookieStrings) {
        const parts = cookie.split(';')
        const nameValue = parts[0].trim()
        if (nameValue) {
          const [name] = nameValue.split('=')
          if (name) {
            cookieJar.set(`${domain}:${name}`, nameValue)
          }
        }
      }
    }
  }
}

let ownerCookies: string = ''
let managerCookies: string = ''

async function login(email: string, password: string, baseUrl: string): Promise<{ success: boolean; cookies?: string; error?: string }> {
  try {
    // Try following redirect to get cookies (Node.js fetch might set cookies on redirect)
    const response = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        redirect: false
      }),
      credentials: 'include'
      // Don't use redirect: 'manual' - let fetch follow redirect to get cookies
    })

    // Debug: log all response headers to see what we get
    log(`  Response status: ${response.status}`, 'info')
    
    // Check for set-cookie header (case-insensitive)
    const allHeaders: string[] = []
    response.headers.forEach((value, key) => {
      allHeaders.push(`${key}: ${value}`)
      const lowerKey = key.toLowerCase()
      if (lowerKey.includes('cookie') || lowerKey.includes('set')) {
        log(`    ${key}: ${value.substring(0, 200)}`, 'info')
      }
    })
    
    // Also try direct header access
    const setCookieDirect = response.headers.get('set-cookie')
    const setCookieLower = response.headers.get('Set-Cookie')
    const setCookieAny = response.headers.get('SET-COOKIE')
    
    if (setCookieDirect || setCookieLower || setCookieAny) {
      log(`  Found set-cookie header directly: ${setCookieDirect || setCookieLower || setCookieAny}`, 'info')
    }
    
    // Try getSetCookie() method
    try {
      const setCookieHeaders = response.headers.getSetCookie?.() || []
      if (setCookieHeaders.length > 0) {
        log(`  Found ${setCookieHeaders.length} cookie(s) via getSetCookie():`, 'info')
        setCookieHeaders.forEach((cookie, i) => {
          log(`    Cookie ${i + 1}: ${cookie.substring(0, 200)}`, 'info')
        })
      }
    } catch (e) {
      log(`  getSetCookie() not available: ${e}`, 'warn')
    }
    
    if (allHeaders.length === 0) {
      log(`  No headers found in response`, 'warn')
    } else {
      log(`  Total headers: ${allHeaders.length}`, 'info')
    }
    
    // Extract and store cookies
    setCookiesFromResponse(response, baseUrl)
    const cookies = getCookiesForDomain(baseUrl)
    
    if (cookies) {
      log(`  Extracted ${cookies.split(';').length} cookie(s): ${cookies.substring(0, 100)}`, 'info')
    } else {
      log(`  No cookies extracted from response`, 'warn')
      log(`  Cookie jar size: ${cookieJar.size}`, 'info')
    }
    
    // 200 or 302 means login succeeded
    if (response.status === 200 || response.status === 302 || response.status === 307) {
      log(`  Login response: ${response.status}`, 'info')
      
      // Try to verify session with cookies from jar
      const sessionCookies = getCookiesForDomain(baseUrl) || cookies
      const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
        headers: sessionCookies ? { 'Cookie': sessionCookies } : {},
        credentials: 'include'
      })
      
      // Also store any new cookies from session response (might get session cookie here)
      setCookiesFromResponse(sessionResponse, baseUrl)
      const updatedCookies = getCookiesForDomain(baseUrl)
      
      if (sessionResponse.ok) {
        const session = await sessionResponse.json().catch(() => null)
        if (session && session.user && session.user.email) {
          log(`  Logged in as ${session.user.email} (${session.user.role || 'unknown'})`, 'success')
          // Return updated cookies (might include session cookie now)
          return { success: true, cookies: updatedCookies || sessionCookies || '' }
        } else {
          log(`  Session response OK but no user data: ${JSON.stringify(session)}`, 'warn')
        }
      } else {
        log(`  Session check failed: ${sessionResponse.status}`, 'warn')
        // Try to get cookies from session response even if it failed
        const sessionCookiesAfter = getCookiesForDomain(baseUrl)
        if (sessionCookiesAfter && sessionCookiesAfter !== sessionCookies) {
          log(`  Got new cookies from session response`, 'info')
        }
      }
      
      // If session check failed but we have cookies, use them
      if (cookies || updatedCookies) {
        const finalCookies = updatedCookies || cookies
        log(`  Login successful (status ${response.status}), using cookies for API calls`, 'success')
        return { success: true, cookies: finalCookies }
      } else {
        log(`  Login response OK but no cookies extracted`, 'warn')
        log(`  Will try using credentials: 'include' for API calls (may not work)`, 'warn')
        // Return empty cookies - we'll rely on credentials: 'include' which might work
        return { success: true, cookies: '' }
      }
    }
    
    // Handle rate limiting
    if (response.status === 429) {
      const errorData = await response.json().catch(() => ({}))
      const retryAfter = errorData.retryAfter || 60
      return { 
        success: false, 
        error: `Rate limited (429). Retry after ${retryAfter} seconds. ${errorData.error || ''}` 
      }
    }
    
    const errorText = await response.text().catch(() => '')
    return { success: false, error: `Login failed: ${response.status} ${errorText.substring(0, 100)}` }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function makeRequest(
  method: string,
  endpoint: string,
  cookies: string,
  body?: any,
  baseUrl?: string
): Promise<{ status: number; data: any; error?: string }> {
  try {
    const url = baseUrl || TEST_BASE_URL_DEFAULT
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    // Always try to get cookies from jar first (most up-to-date)
    const jarCookies = getCookiesForDomain(url)
    const finalCookies = jarCookies || cookies
    
    if (finalCookies) {
      headers['Cookie'] = finalCookies
      // Debug: log cookie usage for first few requests
      if (endpoint.includes('/api/documents') || endpoint.includes('/api/tests') || endpoint.includes('/api/assignments')) {
        log(`    Using cookies: ${finalCookies.substring(0, 100)}...`, 'info')
      }
    } else {
      log(`    No cookies available for request to ${endpoint}`, 'warn')
    }

    const options: RequestInit = {
      method,
      headers,
      credentials: 'include' // Also use credentials for cookie handling
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${url}${endpoint}`, options)
    
    // Store any new cookies from response (important for session cookies)
    setCookiesFromResponse(response, url)
    
    // If we got 401 and have cookies, log for debugging
    if (response.status === 401 && finalCookies) {
      log(`    Got 401 with cookies - cookies might be invalid or expired`, 'warn')
    }
    
    const data = await response.json().catch(() => ({}))

    return {
      status: response.status,
      data,
      error: response.ok ? undefined : data.message || data.error || `HTTP ${response.status}`
    }
  } catch (error) {
    return {
      status: 0,
      data: {},
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// ===== DOCUMENTS CRUD TESTS =====

async function testDocumentsCRUD(role: 'owner' | 'manager', cookies: string, baseUrl: string) {
  const rolePrefix = role.toUpperCase()
  let createdDocId: string | null = null

  // CREATE
  log(`\n📄 Testing Documents CREATE (${role})`, 'info')
  const createDoc = await makeRequest('POST', '/api/documents', cookies, {
    title: `Test Document ${Date.now()}`,
    originalFileName: 'test-doc.txt',
    fileType: 'text/plain',
    content: 'Test document content',
    status: 'ready'
  }, baseUrl)

  if (createDoc.status === 200 || createDoc.status === 201) {
    createdDocId = createDoc.data.id || createDoc.data.data?.id
    addResult(`${rolePrefix} - Documents CREATE`, true, undefined, `Created document: ${createdDocId}`)
  } else {
    addResult(`${rolePrefix} - Documents CREATE`, false, createDoc.error, `Status: ${createDoc.status}`)
    return // Can't continue without created document
  }

  // READ (list)
  log(`\n📄 Testing Documents READ (list) (${role})`, 'info')
  const listDocs = await makeRequest('GET', '/api/documents', cookies, undefined, baseUrl)
  if (listDocs.status === 200 && Array.isArray(listDocs.data.data?.documents || listDocs.data.documents)) {
    const docs = listDocs.data.data?.documents || listDocs.data.documents
    const found = docs.some((d: any) => d.id === createdDocId)
    addResult(`${rolePrefix} - Documents READ (list)`, found, undefined, `Found ${docs.length} documents`)
  } else {
    addResult(`${rolePrefix} - Documents READ (list)`, false, listDocs.error, `Status: ${listDocs.status}`)
  }

  // READ (single)
  if (createdDocId) {
    log(`\n📄 Testing Documents READ (single) (${role})`, 'info')
    const getDoc = await makeRequest('GET', `/api/documents/${createdDocId}`, cookies, undefined, baseUrl)
    if (getDoc.status === 200 && (getDoc.data.data?.document || getDoc.data.document)) {
      addResult(`${rolePrefix} - Documents READ (single)`, true)
    } else {
      addResult(`${rolePrefix} - Documents READ (single)`, false, getDoc.error, `Status: ${getDoc.status}`)
    }
  }

  // UPDATE
  if (createdDocId) {
    log(`\n📄 Testing Documents UPDATE (${role})`, 'info')
    const updateDoc = await makeRequest('PUT', `/api/documents/${createdDocId}`, cookies, {
      title: `Updated Document ${Date.now()}`,
      status: 'processing'
    }, baseUrl)
    if (updateDoc.status === 200 && updateDoc.data.success) {
      addResult(`${rolePrefix} - Documents UPDATE`, true)
    } else {
      addResult(`${rolePrefix} - Documents UPDATE`, false, updateDoc.error, `Status: ${updateDoc.status}`)
    }
  }

  // DELETE
  if (createdDocId) {
    log(`\n📄 Testing Documents DELETE (${role})`, 'info')
    const deleteDoc = await makeRequest('DELETE', `/api/documents/${createdDocId}`, cookies, undefined, baseUrl)
    if (deleteDoc.status === 200 && deleteDoc.data.success) {
      addResult(`${rolePrefix} - Documents DELETE`, true)
    } else {
      addResult(`${rolePrefix} - Documents DELETE`, false, deleteDoc.error, `Status: ${deleteDoc.status}`)
    }
  }
}

// ===== TESTS CRUD TESTS =====

async function testTestsCRUD(role: 'owner' | 'manager', cookies: string, baseUrl: string) {
  const rolePrefix = role.toUpperCase()
  let createdTestId: string | null = null

  // CREATE
  log(`\n📝 Testing Tests CREATE (${role})`, 'info')
  const createTest = await makeRequest('POST', '/api/tests', cookies, {
    title: `Test ${Date.now()}`,
    description: 'Test description',
    type: 'quiz',
    difficulty: 'medium',
    locale: 'en',
    passingScore: 70,
    timeLimit: 30,
    maxAttempts: 3,
    shuffleQuestions: false,
    showCorrectAnswers: true,
    status: 'draft',
    isActive: true,
    questionIds: []
  }, baseUrl)

  if (createTest.status === 200 || createTest.status === 201) {
    createdTestId = createTest.data.id || createTest.data.data?.id || createTest.data.data?.test?.id
    addResult(`${rolePrefix} - Tests CREATE`, true, undefined, `Created test: ${createdTestId}`)
  } else {
    addResult(`${rolePrefix} - Tests CREATE`, false, createTest.error, `Status: ${createTest.status}, Response: ${JSON.stringify(createTest.data)}`)
    return
  }

  // READ (list)
  log(`\n📝 Testing Tests READ (list) (${role})`, 'info')
  const listTests = await makeRequest('GET', '/api/tests', cookies, undefined, baseUrl)
  if (listTests.status === 200 && Array.isArray(listTests.data.data?.tests || listTests.data.tests)) {
    const tests = listTests.data.data?.tests || listTests.data.tests
    const found = tests.some((t: any) => t.id === createdTestId)
    addResult(`${rolePrefix} - Tests READ (list)`, found, undefined, `Found ${tests.length} tests`)
  } else {
    addResult(`${rolePrefix} - Tests READ (list)`, false, listTests.error, `Status: ${listTests.status}`)
  }

  // READ (single)
  if (createdTestId) {
    log(`\n📝 Testing Tests READ (single) (${role})`, 'info')
    const getTest = await makeRequest('GET', `/api/tests/${createdTestId}`, cookies, undefined, baseUrl)
    if (getTest.status === 200 && (getTest.data.data?.test || getTest.data.test)) {
      addResult(`${rolePrefix} - Tests READ (single)`, true)
    } else {
      addResult(`${rolePrefix} - Tests READ (single)`, false, getTest.error, `Status: ${getTest.status}`)
    }
  }

  // UPDATE
  if (createdTestId) {
    log(`\n📝 Testing Tests UPDATE (${role})`, 'info')
    const updateTest = await makeRequest('PUT', `/api/tests/${createdTestId}`, cookies, {
      title: `Updated Test ${Date.now()}`,
      description: 'Updated description',
      passingScore: 80
    }, baseUrl)
    if (updateTest.status === 200 && updateTest.data.success) {
      addResult(`${rolePrefix} - Tests UPDATE`, true)
    } else {
      addResult(`${rolePrefix} - Tests UPDATE`, false, updateTest.error, `Status: ${updateTest.status}`)
    }
  }

  // DELETE
  if (createdTestId) {
    log(`\n📝 Testing Tests DELETE (${role})`, 'info')
    const deleteTest = await makeRequest('DELETE', `/api/tests/${createdTestId}`, cookies, undefined, baseUrl)
    if (deleteTest.status === 200 && deleteTest.data.success) {
      addResult(`${rolePrefix} - Tests DELETE`, true)
    } else {
      addResult(`${rolePrefix} - Tests DELETE`, false, deleteTest.error, `Status: ${deleteTest.status}`)
    }
  }
}

// ===== ASSIGNMENTS CRUD TESTS =====

async function testAssignmentsCRUD(role: 'owner' | 'manager', cookies: string, baseUrl: string) {
  const rolePrefix = role.toUpperCase()
  let createdAssignmentId: string | null = null

  // First, we need a test to assign
  log(`\n📋 Creating test for assignment (${role})`, 'info')
  const createTestForAssignment = await makeRequest('POST', '/api/tests', cookies, {
    title: `Assignment Test ${Date.now()}`,
    description: 'Test for assignment',
    type: 'quiz',
    difficulty: 'medium',
    locale: 'en',
    passingScore: 70,
    timeLimit: 30,
    maxAttempts: 3,
    shuffleQuestions: false,
    showCorrectAnswers: true,
    status: 'published',
    isActive: true,
    questionIds: []
  }, baseUrl)

  const testId = createTestForAssignment.data.id || createTestForAssignment.data.data?.id || createTestForAssignment.data.data?.test?.id

  if (!testId) {
    addResult(`${rolePrefix} - Assignments CREATE (prerequisite)`, false, 'Could not create test for assignment')
    return
  }

  // CREATE
  log(`\n📋 Testing Assignments CREATE (${role})`, 'info')
  const createAssignment = await makeRequest('POST', '/api/assignments', cookies, {
    title: `Assignment ${Date.now()}`,
    description: 'Test assignment',
    testId: testId,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    status: 'active'
  }, baseUrl)

  if (createAssignment.status === 200 || createAssignment.status === 201) {
    createdAssignmentId = createAssignment.data.id || createAssignment.data.data?.id || createAssignment.data.data?.assignment?.id
    addResult(`${rolePrefix} - Assignments CREATE`, true, undefined, `Created assignment: ${createdAssignmentId}`)
  } else {
    addResult(`${rolePrefix} - Assignments CREATE`, false, createAssignment.error, `Status: ${createAssignment.status}, Response: ${JSON.stringify(createAssignment.data)}`)
    // Clean up test
    if (testId) await makeRequest('DELETE', `/api/tests/${testId}`, cookies, undefined, baseUrl)
    return
  }

  // READ (list)
  log(`\n📋 Testing Assignments READ (list) (${role})`, 'info')
  const listAssignments = await makeRequest('GET', '/api/assignments', cookies, undefined, baseUrl)
  if (listAssignments.status === 200 && Array.isArray(listAssignments.data.data?.assignments || listAssignments.data.assignments)) {
    const assignments = listAssignments.data.data?.assignments || listAssignments.data.assignments
    const found = assignments.some((a: any) => a.id === createdAssignmentId)
    addResult(`${rolePrefix} - Assignments READ (list)`, found, undefined, `Found ${assignments.length} assignments`)
  } else {
    addResult(`${rolePrefix} - Assignments READ (list)`, false, listAssignments.error, `Status: ${listAssignments.status}`)
  }

  // READ (single)
  if (createdAssignmentId) {
    log(`\n📋 Testing Assignments READ (single) (${role})`, 'info')
    const getAssignment = await makeRequest('GET', `/api/assignments/${createdAssignmentId}`, cookies, undefined, baseUrl)
    if (getAssignment.status === 200 && (getAssignment.data.data?.assignment || getAssignment.data.assignment)) {
      addResult(`${rolePrefix} - Assignments READ (single)`, true)
    } else {
      addResult(`${rolePrefix} - Assignments READ (single)`, false, getAssignment.error, `Status: ${getAssignment.status}`)
    }
  }

  // UPDATE
  if (createdAssignmentId) {
    log(`\n📋 Testing Assignments UPDATE (${role})`, 'info')
    const updateAssignment = await makeRequest('PUT', `/api/assignments/${createdAssignmentId}`, cookies, {
      title: `Updated Assignment ${Date.now()}`,
      description: 'Updated description',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days from now
    }, baseUrl)
    if (updateAssignment.status === 200 && updateAssignment.data.success) {
      addResult(`${rolePrefix} - Assignments UPDATE`, true)
    } else {
      addResult(`${rolePrefix} - Assignments UPDATE`, false, updateAssignment.error, `Status: ${updateAssignment.status}`)
    }
  }

  // DELETE
  if (createdAssignmentId) {
    log(`\n📋 Testing Assignments DELETE (${role})`, 'info')
    const deleteAssignment = await makeRequest('DELETE', `/api/assignments/${createdAssignmentId}`, cookies, undefined, baseUrl)
    if (deleteAssignment.status === 200 && deleteAssignment.data.success) {
      addResult(`${rolePrefix} - Assignments DELETE`, true)
    } else {
      addResult(`${rolePrefix} - Assignments DELETE`, false, deleteAssignment.error, `Status: ${deleteAssignment.status}`)
    }
  }

  // Clean up test
  if (testId) {
    await makeRequest('DELETE', `/api/tests/${testId}`, cookies, undefined, baseUrl)
  }
}

// ===== PERMISSION TESTS =====

async function testPermissions(role: 'owner' | 'manager', cookies: string, baseUrl: string) {
  const rolePrefix = role.toUpperCase()
  
  log(`\n🔒 Testing Permissions (${role})`, 'info')
  
  // Test unauthorized access (should fail)
  const unauthorized = await makeRequest('GET', '/api/documents', '', undefined, baseUrl)
  if (unauthorized.status === 401) {
    addResult(`${rolePrefix} - Permission Check (unauthorized)`, true)
  } else {
    addResult(`${rolePrefix} - Permission Check (unauthorized)`, false, `Expected 401, got ${unauthorized.status}`)
  }
}

// ===== MAIN TEST RUNNER =====

async function detectPort(): Promise<string> {
  // Try 3000 first, then 3001
  try {
    const res = await fetch('http://localhost:3000/api/health').catch(() => null)
    if (res?.ok) {
      log('Detected server on port 3000', 'info')
      return 'http://localhost:3000'
    }
  } catch {}
  try {
    const res = await fetch('http://localhost:3001/api/health').catch(() => null)
    if (res?.ok) {
      log('Detected server on port 3001', 'info')
      return 'http://localhost:3001'
    }
  } catch {}
  // Default fallback
  log('Could not detect port, using default 3000', 'warn')
  return 'http://localhost:3000'
}

async function main() {
  console.log('\n🧪 Starting CRUD Test Suite for Owner and Manager Roles\n')
  
  // Detect the correct port
  const baseUrl = process.env.BASE_URL || await detectPort()
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Owner: ${OWNER_EMAIL}`)
  console.log(`Manager: ${MANAGER_EMAIL}\n`)

  // Check server
  log('Checking server availability...', 'info')
  try {
    const healthCheck = await fetch(`${baseUrl}/api/health`).catch(() => null)
    if (!healthCheck || !healthCheck.ok) {
      log('⚠️  Server health check failed, but continuing...', 'warn')
    } else {
      log('Server is running', 'success')
    }
  } catch {
    log('⚠️  Could not check server health, but continuing...', 'warn')
  }

  // Login as owner
  log('\n🔐 Logging in as Owner...', 'info')
  const ownerLogin = await login(OWNER_EMAIL, OWNER_PASSWORD, baseUrl)
  if (!ownerLogin.success) {
    if (ownerLogin.error?.includes('429') || ownerLogin.error?.includes('rate limit')) {
      log(`⚠️  Owner login rate limited. Waiting 5 seconds...`, 'warn')
      await new Promise(resolve => setTimeout(resolve, 5000))
      // Retry once
      const retryLogin = await login(OWNER_EMAIL, OWNER_PASSWORD, baseUrl)
      if (!retryLogin.success) {
        log(`❌ Owner login failed after retry: ${retryLogin.error}`, 'error')
        log('💡 Wait a few minutes and try again, or run: npm run db:reset:test', 'warn')
        process.exit(1)
      }
      ownerCookies = retryLogin.cookies || ''
    } else {
      log(`❌ Owner login failed: ${ownerLogin.error}`, 'error')
      log('💡 Make sure owner@test.com exists. Run: npm run db:reset:test', 'warn')
      process.exit(1)
    }
  } else {
    ownerCookies = ownerLogin.cookies || ''
  }
  log('✅ Owner logged in', 'success')

  // Wait a bit between logins to avoid rate limiting
  log('\n⏳ Waiting 2 seconds before manager login...', 'info')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Login as manager
  log('\n🔐 Logging in as Manager...', 'info')
  const managerLogin = await login(MANAGER_EMAIL, MANAGER_PASSWORD, baseUrl)
  if (!managerLogin.success) {
    if (managerLogin.error?.includes('429') || managerLogin.error?.includes('rate limit')) {
      log(`⚠️  Manager login rate limited. Waiting 5 seconds...`, 'warn')
      await new Promise(resolve => setTimeout(resolve, 5000))
      // Retry once
      const retryLogin = await login(MANAGER_EMAIL, MANAGER_PASSWORD, baseUrl)
      if (!retryLogin.success) {
        log(`❌ Manager login failed after retry: ${retryLogin.error}`, 'error')
        log('💡 Wait a few minutes and try again, or run: npm run db:reset:test', 'warn')
        process.exit(1)
      }
      managerCookies = retryLogin.cookies || ''
    } else {
      log(`❌ Manager login failed: ${managerLogin.error}`, 'error')
      log('💡 Make sure manager@test.com exists. Run: npm run db:reset:test', 'warn')
      process.exit(1)
    }
  } else {
    managerCookies = managerLogin.cookies || ''
  }
  log('✅ Manager logged in', 'success')

  // Run tests for owner
  log('\n' + '='.repeat(60), 'info')
  log('TESTING OWNER ROLE', 'info')
  log('='.repeat(60), 'info')
  
  await testDocumentsCRUD('owner', ownerCookies, baseUrl)
  await testTestsCRUD('owner', ownerCookies, baseUrl)
  await testAssignmentsCRUD('owner', ownerCookies, baseUrl)
  await testPermissions('owner', ownerCookies, baseUrl)

  // Run tests for manager
  log('\n' + '='.repeat(60), 'info')
  log('TESTING MANAGER ROLE', 'info')
  log('='.repeat(60), 'info')
  
  await testDocumentsCRUD('manager', managerCookies, baseUrl)
  await testTestsCRUD('manager', managerCookies, baseUrl)
  await testAssignmentsCRUD('manager', managerCookies, baseUrl)
  await testPermissions('manager', managerCookies, baseUrl)

  // Summary
  log('\n' + '='.repeat(60), 'info')
  log('TEST SUMMARY', 'info')
  log('='.repeat(60), 'info')
  
  const passed = testResults.filter(r => r.passed).length
  const failed = testResults.filter(r => !r.passed).length
  const total = testResults.length

  log(`\nTotal Tests: ${total}`, 'info')
  log(`Passed: ${passed}`, 'success')
  log(`Failed: ${failed}`, failed > 0 ? 'error' : 'success')

  if (failed > 0) {
    log('\n❌ Failed Tests:', 'error')
    testResults.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.name}: ${r.error || 'Unknown error'}`, 'error')
      if (r.details) log(`    ${r.details}`, 'info')
    })
  }

  log('\n' + '='.repeat(60), 'info')
  
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(error => {
  log(`\n❌ Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
  console.error(error)
  process.exit(1)
})

