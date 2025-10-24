import { db } from '../lib/db'
import { users, businesses, businessUsers } from '../lib/db/schema'

async function setupTestData() {
  try {
    console.log('Setting up test data...')
    
    // Create a test business
    const [business] = await db.insert(businesses).values({
      name: 'Test Company',
      type: 'restaurant',
      description: 'A test company for knowledge base platform',
      ownerId: 'test-owner-id', // This will be replaced with actual user ID
    }).returning()
    
    console.log('✅ Test business created:', business.name)
    
    // Create test users (this would normally be done through auth)
    console.log('✅ Test data setup complete!')
    console.log('You can now test the application at http://localhost:3000')
    
  } catch (error) {
    console.error('❌ Error setting up test data:', error)
    console.log('Make sure your database is running and accessible')
  }
}

setupTestData()
