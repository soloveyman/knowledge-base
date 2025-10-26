import { db, users } from '../lib/db'
import { eq } from 'drizzle-orm'

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...')
    
    // Get all users
    const allUsers = await db.select().from(users)
    console.log(`Found ${allUsers.length} users:`)
    allUsers.forEach(user => {
      console.log(`- ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`)
    })
    
    // Test specific user lookup
    const testId = '3b20759b-a422-4d65-89bd-72db8222670d'
    console.log(`\n🔍 Looking for user with ID: ${testId}`)
    
    const specificUser = await db.select().from(users).where(eq(users.id, testId)).limit(1)
    console.log('Specific user result:', specificUser)
    
    if (specificUser.length > 0) {
      console.log('✅ User found:', specificUser[0])
    } else {
      console.log('❌ User not found')
    }
    
  } catch (error) {
    console.error('❌ Database test error:', error)
  }
}

testDatabaseConnection().then(() => {
  console.log('Database test completed')
  process.exit(0)
}).catch((error) => {
  console.error('Database test failed:', error)
  process.exit(1)
})
