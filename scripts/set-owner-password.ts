import { db, users } from '../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function setOwnerPassword() {
  try {
    console.log('🔐 Setting password for owner user...')
    
    // Find the owner user
    const ownerUsers = await db.select().from(users).where(eq(users.role, 'owner'))
    
    if (ownerUsers.length === 0) {
      console.log('❌ No owner user found!')
      return
    }
    
    const owner = ownerUsers[0]
    console.log(`Found owner: ${owner.name} (${owner.email})`)
    
    // Set password to "password123" for testing
    const password = 'password123'
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // Update the owner user with password
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, owner.id))
    
    console.log('✅ Owner password set successfully!')
    console.log(`📧 Email: ${owner.email}`)
    console.log(`🔑 Password: ${password}`)
    console.log('🎉 Owner can now log in with these credentials!')
    
  } catch (error) {
    console.error('❌ Error setting owner password:', error)
    process.exit(1)
  }
}

// Run the script
setOwnerPassword().then(() => {
  console.log('Script completed successfully')
  process.exit(0)
}).catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
