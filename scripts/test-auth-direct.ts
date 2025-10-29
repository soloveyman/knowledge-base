import { db, users } from '../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function testAuth() {
  try {
    const email = 'superadmin@test.com'
    const password = 'admin123'
    
    console.log('Testing authentication flow...\n')
    
    // Step 1: Get user from DB
    const dbUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)
    
    if (dbUsers.length === 0) {
      console.log('❌ User not found')
      return
    }
    
    const dbUser = dbUsers[0]
    console.log('✅ User found:', dbUser.email)
    console.log('   Role:', dbUser.role)
    console.log('   Password length:', dbUser.password?.length || 0)
    
    if (!dbUser.password) {
      console.log('❌ No password set')
      return
    }
    
    // Step 2: Verify password
    console.log('\n🔐 Verifying password...')
    const isValid = await bcrypt.compare(password, dbUser.password)
    
    if (isValid) {
      console.log('✅ Password is CORRECT!')
      console.log('\n🎉 Authentication should work!')
      console.log('Try logging in with:')
      console.log('   Email: superadmin@test.com')
      console.log('   Password: admin123')
    } else {
      console.log('❌ Password is INCORRECT')
      console.log('   Stored hash:', dbUser.password.substring(0, 30) + '...')
      console.log('\n⚠️  Regenerating password hash...')
      
      const newHash = await bcrypt.hash(password, 12)
      await db.update(users)
        .set({ password: newHash })
        .where(eq(users.email, email))
      
      console.log('✅ Password hash updated!')
      console.log('\nTry logging in again.')
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.cause) {
      console.error('   Cause:', error.cause.message)
    }
  }
}

testAuth().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('Fatal:', error)
  process.exit(1)
})

