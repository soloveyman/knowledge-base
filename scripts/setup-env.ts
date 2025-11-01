/**
 * Setup Environment Variables
 * 
 * Creates or updates .env.local with required variables
 * 
 * Run: tsx scripts/setup-env.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const envLocalPath = join(process.cwd(), '.env.local')
const envExamplePath = join(process.cwd(), 'env.example')

const requiredVars = {
  'NEXTAUTH_URL': 'http://localhost:3000',
  'NEXTAUTH_SECRET': 'your-secret-key-here-change-in-production',
  'DATABASE_URL': 'postgresql://postgres:postgres@localhost:5432/knowledge_base',
}

function generateSecret(): string {
  // Generate a random secret for local development
  return Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64').substring(0, 32)
}

async function setupEnv() {
  console.log('\n🔧 Setting up environment variables...\n')
  
  let envContent = ''
  
  // Read existing .env.local if it exists
  if (existsSync(envLocalPath)) {
    console.log('📄 Found existing .env.local')
    envContent = readFileSync(envLocalPath, 'utf-8')
  } else if (existsSync(envExamplePath)) {
    console.log('📄 Creating .env.local from env.example')
    envContent = readFileSync(envExamplePath, 'utf-8')
  }
  
  // Check which variables are missing
  const missing: string[] = []
  const lines = envContent.split('\n')
  const existingVars = new Set<string>()
  
  // Parse existing variables
  lines.forEach(line => {
    const match = line.match(/^([A-Z_]+)=/)
    if (match) {
      existingVars.add(match[1])
    }
  })
  
  // Check for required variables
  Object.keys(requiredVars).forEach(key => {
    if (!existingVars.has(key)) {
      missing.push(key)
    }
  })
  
  if (missing.length > 0) {
    console.log(`⚠️  Missing variables: ${missing.join(', ')}\n`)
    
    // Add missing variables
    missing.forEach(key => {
      let value = requiredVars[key as keyof typeof requiredVars]
      
      // Generate secret if it's NEXTAUTH_SECRET and using default
      if (key === 'NEXTAUTH_SECRET' && value === 'your-secret-key-here-change-in-production') {
        value = generateSecret()
        console.log(`✅ Generated ${key}: ${value.substring(0, 20)}...`)
      } else {
        console.log(`✅ Added ${key}=${value}`)
      }
      
      // Add to env content
      envContent += `\n${key}="${value}"`
    })
    
    // Write updated content
    writeFileSync(envLocalPath, envContent, 'utf-8')
    console.log('\n✅ Updated .env.local with missing variables')
  } else {
    console.log('✅ All required variables are present in .env.local')
  }
  
  // Verify NEXTAUTH_URL doesn't have trailing slash
  const nextAuthUrlMatch = envContent.match(/NEXTAUTH_URL="([^"]+)"/)
  if (nextAuthUrlMatch && nextAuthUrlMatch[1].endsWith('/')) {
    console.log('\n⚠️  Warning: NEXTAUTH_URL has trailing slash')
    console.log(`   Current: ${nextAuthUrlMatch[1]}`)
    console.log(`   Should be: ${nextAuthUrlMatch[1].replace(/\/$/, '')}`)
    console.log('   Please remove the trailing slash manually')
  }
  
  console.log('\n📝 Next Steps:')
  console.log('1. Review .env.local to ensure all values are correct')
  console.log('2. Restart your dev server: npm run dev')
  console.log('3. Try signing in again\n')
}

setupEnv().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})

