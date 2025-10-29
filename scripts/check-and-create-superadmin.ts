import { db, users } from '../lib/db'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

async function checkAndCreateSuperAdmin() {
  try {
    console.log('🔍 Checking for super-admin user...')
    
    const email = 'superadmin@test.com'
    
    // Check if user exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    
    if (existingUser.length > 0) {
      const user = existingUser[0]
      console.log('✅ Super-admin user found!')
      console.log('📧 Email:', user.email)
      console.log('👤 Name:', user.name)
      console.log('🎭 Role:', user.role)
      console.log('🌍 Country:', user.country || 'Not set')
      
      // Check if password is set
      if (user.password) {
        console.log('🔑 Password: SET')
        // Test password
        const testPassword = await bcrypt.compare('admin123', user.password)
        if (testPassword) {
          console.log('✅ Password "admin123" is CORRECT')
        } else {
          console.log('⚠️  Password "admin123" is INCORRECT')
          console.log('📝 Updating password...')
          const hashedPassword = await bcrypt.hash('admin123', 12)
          await db.update(users)
            .set({ password: hashedPassword })
            .where(eq(users.email, email))
          console.log('✅ Password updated to "admin123"')
        }
      } else {
        console.log('⚠️  Password NOT SET')
        console.log('📝 Setting password...')
        const hashedPassword = await bcrypt.hash('admin123', 12)
        await db.update(users)
          .set({ 
            password: hashedPassword,
            role: 'super-admin'
          })
          .where(eq(users.email, email))
        console.log('✅ Password set to "admin123"')
      }
      
      // Check if role is correct
      if (user.role !== 'super-admin') {
        console.log('⚠️  Role is not "super-admin", updating...')
        await db.update(users)
          .set({ role: 'super-admin' })
          .where(eq(users.email, email))
        console.log('✅ Role updated to "super-admin"')
      }
      
    } else {
      console.log('❌ Super-admin user NOT FOUND')
      console.log('📝 Creating super-admin user...')
      
      const password = 'admin123'
      const hashedPassword = await bcrypt.hash(password, 12)
      
      const [newUser] = await db.insert(users).values({
        email,
        name: 'Super Admin',
        password: hashedPassword,
        role: 'super-admin',
        country: 'US',
      }).returning()
      
      console.log('✅ Super-admin created successfully!')
      console.log('📧 Email:', newUser.email)
    }
    
    console.log('\n🎉 Super Admin Credentials:')
    console.log('═══════════════════════════════')
    console.log('📧 Email:    superadmin@test.com')
    console.log('🔑 Password: admin123')
    console.log('═══════════════════════════════')
    console.log('\n🌐 Login at: http://localhost:3000/auth/signin')
    console.log('📊 Dashboard: http://localhost:3000/super-admin')
    console.log('\n')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.cause) {
      console.error('Cause:', error.cause.message)
    }
    process.exit(1)
  }
}

checkAndCreateSuperAdmin().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

