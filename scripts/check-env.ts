/**
 * Check Environment Variables for Authentication
 * 
 * Run: tsx scripts/check-env.ts
 */

console.log('\n🔍 Checking Environment Variables...\n')

const requiredVars = {
  'NEXTAUTH_URL': process.env.NEXTAUTH_URL || 'NOT SET',
  'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
  'DATABASE_URL': process.env.DATABASE_URL ? 'SET' : 'NOT SET',
}

const optionalVars = {
  'NODE_ENV': process.env.NODE_ENV || 'NOT SET',
  'VERCEL_URL': process.env.VERCEL_URL || 'NOT SET',
}

console.log('📋 Required Variables:')
Object.entries(requiredVars).forEach(([key, value]) => {
  const icon = value === 'NOT SET' ? '❌' : '✅'
  const displayValue = value === 'NOT SET' ? 'NOT SET' : 
    key === 'NEXTAUTH_SECRET' || key === 'DATABASE_URL' ? 'SET (hidden)' : 
    value
  console.log(`${icon} ${key}: ${displayValue}`)
})

console.log('\n📋 Optional Variables:')
Object.entries(optionalVars).forEach(([key, value]) => {
  const icon = value === 'NOT SET' ? '⚠️' : '✅'
  console.log(`${icon} ${key}: ${value}`)
})

// Check for common issues
console.log('\n🔍 Checking for Common Issues:\n')

if (!process.env.NEXTAUTH_URL) {
  console.log('❌ NEXTAUTH_URL is NOT SET')
  console.log('   This will cause authentication errors!')
  console.log('\n💡 Fix: Create or update .env.local with:')
  console.log('   NEXTAUTH_URL=http://localhost:3000')
  console.log('\n   Then restart your dev server: npm run dev')
} else {
  // Check for trailing slash
  if (process.env.NEXTAUTH_URL.endsWith('/')) {
    console.log('⚠️  NEXTAUTH_URL has trailing slash')
    console.log('   This may cause issues. Remove the trailing slash.')
    console.log(`   Current: ${process.env.NEXTAUTH_URL}`)
    console.log(`   Should be: ${process.env.NEXTAUTH_URL.replace(/\/$/, '')}`)
  } else {
    console.log('✅ NEXTAUTH_URL is set correctly')
  }
}

if (!process.env.NEXTAUTH_SECRET) {
  console.log('⚠️  NEXTAUTH_SECRET is NOT SET')
  console.log('   This is required in production!')
  console.log('\n💡 Fix: Add to .env.local:')
  console.log('   NEXTAUTH_SECRET=your-secret-key-here')
}

if (!process.env.DATABASE_URL) {
  console.log('⚠️  DATABASE_URL is NOT SET')
  console.log('   Database connection will fail!')
  console.log('\n💡 Fix: Add to .env.local:')
  console.log('   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knowledge_base')
}

console.log('\n📝 Next Steps:')
console.log('1. Ensure .env.local exists in the project root')
console.log('2. Add missing variables from env.example')
console.log('3. Restart your dev server (npm run dev)')
console.log('4. Try signing in again\n')

