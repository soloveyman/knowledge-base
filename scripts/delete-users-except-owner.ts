import { db, users } from '../lib/db'
import { ne, eq } from 'drizzle-orm'

async function deleteUsersExceptOwner() {
  try {
    console.log('🗑️  Starting user cleanup (keeping owner only)...')
    
    // First, let's see what users exist
    const allUsers = await db.select().from(users)
    console.log(`Found ${allUsers.length} users in database:`)
    allUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`)
    })
    
    // Find the owner user
    const ownerUsers = await db.select().from(users).where(eq(users.role, 'owner'))
    
    if (ownerUsers.length === 0) {
      console.log('❌ No owner user found! Cannot proceed safely.')
      return
    }
    
    console.log(`\n👑 Owner user found: ${ownerUsers[0].name} (${ownerUsers[0].email})`)
    
    // Delete all users except owners
    const result = await db.delete(users).where(ne(users.role, 'owner'))
    
    console.log('✅ Non-owner users deleted successfully!')
    
    // Verify the cleanup
    const remainingUsers = await db.select().from(users)
    console.log(`\n📊 Remaining users: ${remainingUsers.length}`)
    remainingUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`)
    })
    
    console.log('🎉 User cleanup completed!')
    
  } catch (error) {
    console.error('❌ Error during user cleanup:', error)
    process.exit(1)
  }
}

// Run the cleanup
deleteUsersExceptOwner().then(() => {
  console.log('Script completed successfully')
  process.exit(0)
}).catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
