import { db, users } from '../lib/db'
import { eq } from 'drizzle-orm'

async function checkEmailExists(email: string) {
  try {
    console.log(`🔍 Checking if email exists: ${email}`)
    
    const normalizedEmail = email.toLowerCase().trim()
    console.log(`📧 Normalized email: ${normalizedEmail}`)
    
    // Query database directly
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)
    
    if (existing.length > 0) {
      console.log('✅ Email EXISTS in database:')
      console.log('User:', JSON.stringify(existing[0], null, 2))
      return true
    } else {
      console.log('❌ Email does NOT exist in database')
      
      // Also check all users to see what's in the database
      const allUsers = await db.select().from(users)
      console.log(`\n📊 Total users in database: ${allUsers.length}`)
      console.log('All emails:')
      allUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} (ID: ${user.id})`)
      })
      
      return false
    }
  } catch (error) {
    console.error('❌ Error checking email:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error
  }
}

const email = process.argv[2] || 'bonapinsk@gmail.com'
checkEmailExists(email).then(() => {
  console.log('\n✅ Check completed')
  process.exit(0)
}).catch((error) => {
  console.error('\n❌ Check failed:', error)
  process.exit(1)
})

