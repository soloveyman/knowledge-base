/**
 * Comprehensive Test Suite Runner
 * 
 * Runs all test suites to ensure everything works fine in the app.
 * 
 * Run: tsx scripts/test-all.ts
 * Or: npm run test:all (if added to package.json)
 */

// Load environment variables
import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env file
config({ path: resolve(process.cwd(), '.env') })

import { execSync } from 'child_process'
import { existsSync } from 'fs'

interface TestSuite {
  name: string
  script: string
  description: string
}

const testSuites: TestSuite[] = [
  {
    name: 'Smoke Test',
    script: 'test:smoke',
    description: 'Database smoke test - checks basic data integrity'
  },
  {
    name: 'Authentication Flow',
    script: 'test:auth',
    description: 'Tests sign up and sign in functionality'
  },
  {
    name: 'Security & Rate Limiting',
    script: 'test:security',
    description: 'Tests security headers, rate limiting, and build checks'
  },
  {
    name: 'Account Deletion',
    script: 'tsx scripts/test-account-deletion.ts',
    description: 'Tests account deletion functionality and data cleanup'
  }
]

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const symbols = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️'
  }
  console.log(`${symbols[type]} ${message}`)
}

async function runTestSuite(suite: TestSuite): Promise<{ passed: boolean; output: string }> {
  try {
    log(`Running: ${suite.name}`, 'info')
    log(`  ${suite.description}`, 'info')
    
    // Use npm run for npm scripts, or direct command for tsx scripts
    const command = suite.script.startsWith('tsx') 
      ? suite.script 
      : `npm run ${suite.script}`
    
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: process.cwd(),
      env: process.env
    })
    
    log(`${suite.name}: PASSED`, 'success')
    return { passed: true, output }
  } catch (error: any) {
    log(`${suite.name}: FAILED`, 'error')
    let output = 'Unknown error'
    if (error.stdout) {
      output = error.stdout.toString()
    } else if (error.stderr) {
      output = error.stderr.toString()
    } else if (error.message) {
      output = error.message
    }
    return { passed: false, output }
  }
}

async function main() {
  console.log('\n🧪 Comprehensive Test Suite Runner\n')
  console.log('Running all test suites to ensure everything works fine...\n')
  
  const results: Array<{ suite: TestSuite; passed: boolean; output: string }> = []
  
  for (const suite of testSuites) {
    const result = await runTestSuite(suite)
    results.push({ suite, ...result })
    console.log('') // Add spacing between tests
  }
  
  // Summary
  console.log('\n=== Test Summary ===\n')
  
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length
  
  results.forEach(({ suite, passed: testPassed, output }) => {
    const icon = testPassed ? '✅' : '❌'
    console.log(`${icon} ${suite.name}`)
    if (!testPassed) {
      console.log(`   Error output: ${output.substring(0, 200)}...`)
    }
  })
  
  console.log(`\n📊 Results: ${passed}/${total} test suites passed`)
  
  if (failed > 0) {
    console.log(`\n❌ ${failed} test suite(s) failed. Please review the output above.\n`)
    process.exit(1)
  } else {
    console.log(`\n✅ All test suites passed! The app is working correctly.\n`)
    process.exit(0)
  }
}

main().catch(error => {
  console.error('❌ Test runner error:', error)
  process.exit(1)
})

