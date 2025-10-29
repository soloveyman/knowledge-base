import { db, users } from '../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function createSuperAdmin() {
  try {
    console.log('👑 Creating super-admin user...')
    
    const email = 'superadmin@test.com'
    const password = 'admin123'
    const name = 'Super Admin'
    
    // Check if super-admin already exists
    const existingSuperAdmin = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    
    if (existingSuperAdmin.length > 0) {
      console.log('⚠️  Super-admin already exists, updating password...')
      const hashedPassword = await bcrypt.hash(password, 12)
      
      await db.update(users)
        .set({ 
          password: hashedPassword,
          role: 'super-admin',
          name,
        })
        .where(eq(users.email, email))
      
      console.log('✅ Super-admin password updated!')
    } else {
      // Create new super-admin
      const hashedPassword = await bcrypt.hash(password, 12)
      
      const [superAdmin] = await db.insert(users).values({
        email,
        name,
        password: hashedPassword,
        role: 'super-admin',
        country: 'US', // Default country
      }).returning()
      
      console.log('✅ Super-admin created successfully!')
    }
    
    console.log('\n🎉 Super Admin Credentials:')
    console.log('═══════════════════════════════')
    console.log(`📧 Email:    ${email}`)
    console.log(`🔑 Password: ${password}`)
    console.log('═══════════════════════════════')
    console.log('\n🌐 Login at: http://localhost:3000/auth/signin')
    console.log('📊 Dashboard: http://localhost:3000/super-admin')
    console.log('\n')
    
  } catch (error) {
    console.error('❌ Error creating super-admin:', error)
    process.exit(1)
  }
}

// Run the script
createSuperAdmin().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

