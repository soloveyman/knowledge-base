import { db } from '../lib/db'
import { users } from '../lib/db/schema'

async function createTestUsers() {
  try {
    console.log('Creating test users...')
    
    // Create test users for each role
    const testUsers = [
      {
        email: 'owner@test.com',
        name: 'John Owner',
        role: 'owner' as const,
      },
      {
        email: 'manager@test.com', 
        name: 'Jane Manager',
        role: 'manager' as const,
      },
      {
        email: 'employee@test.com',
        name: 'Bob Employee', 
        role: 'employee' as const,
      }
    ]

    for (const user of testUsers) {
      try {
        await db.insert(users).values(user)
        console.log(`✅ Created ${user.role}: ${user.email}`)
      } catch (error) {
        console.log(`⚠️  User ${user.email} might already exist`)
      }
    }
    
    console.log('\n🎉 Test users created successfully!')
    console.log('\nTest Credentials:')
    console.log('Owner:    owner@test.com    (any password)')
    console.log('Manager:  manager@test.com  (any password)')
    console.log('Employee: employee@test.com (any password)')
    console.log('\nNote: The auth system currently accepts any password for these emails')
    
  } catch (error) {
    console.error('❌ Error creating test users:', error)
  }
}

createTestUsers()
