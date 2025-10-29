import { db, users } from '../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function verifySuperAdmin() {
  try {
    console.log('🔍 Verifying super-admin access...\n')
    
    const email = 'superadmin@test.com'
    const password = 'admin123'
    
    // Get user from DB
    const dbUsers = await db.select().from(users).where(eq(users.email, email)).limit(1)
    
    if (dbUsers.length === 0) {
      console.log('❌ User not found in database!')
      return
    }
    
    const dbUser = dbUsers[0]
    console.log('✅ User found:')
    console.log('   Email:', dbUser.email)
    console.log('   Name:', dbUser.name)
    console.log('   Role:', dbUser.role)
    console.log('   Has password:', !!dbUser.password)
    
    if (!dbUser.password) {
      console.log('\n❌ User has no password!')
      console.log('Creating new password...')
      const hashedPassword = await bcrypt.hash(password, 12)
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, email))
      console.log('✅ Password created!')
      console.log('\n🔑 New credentials:')
      console.log('   Email: superadmin@test.com')
      console.log('   Password: admin123')
      return
    }
    
    // Test password
    console.log('\n🔐 Testing password...')
    const isValid = await bcrypt.compare(password, dbUser.password)
    
    if (isValid) {
      console.log('✅ Password is CORRECT!')
      console.log('\n🎉 User can login with:')
      console.log('   Email: superadmin@test.com')
      console.log('   Password: admin123')
    } else {
      console.log('❌ Password is INCORRECT!')
      console.log('Updating password...')
      const hashedPassword = await bcrypt.hash(password, 12)
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.email, email))
      console.log('✅ Password updated!')
      console.log('\n🔑 Updated credentials:')
      console.log('   Email: superadmin@test.com')
      console.log('   Password: admin123')
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.cause) {
      console.error('Cause:', error.cause.message)
    }
    console.error('\n💡 Make sure:')
    console.error('   1. DATABASE_URL is set correctly in .env')
    console.error('   2. PostgreSQL is running (docker-compose up)')
    console.error('   3. Database tables exist')
  }
}

verifySuperAdmin().then(() => {
  console.log('\n✅ Verification complete!')
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

