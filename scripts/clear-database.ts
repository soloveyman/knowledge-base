import { db } from '../lib/db'
import { 
  users, 
  accounts, 
  sessions, 
  verificationTokens,
  modules,
  moduleVersions,
  sections,
  documents,
  questions,
  tests,
  userGroups,
  userGroupMembers,
  assignments,
  testAttempts,
  progress,
  subscriptionPlans,
  subscriptions,
  usage
} from '../lib/db/schema'

async function clearDatabase() {
  try {
    console.log('🗑️  Starting database cleanup...')
    
    // Delete in reverse order of dependencies to avoid foreign key constraints
    console.log('Deleting usage records...')
    await db.delete(usage)
    
    console.log('Deleting subscriptions...')
    await db.delete(subscriptions)
    
    console.log('Deleting subscription plans...')
    await db.delete(subscriptionPlans)
    
    console.log('Deleting progress records...')
    await db.delete(progress)
    
    console.log('Deleting test attempts...')
    await db.delete(testAttempts)
    
    console.log('Deleting assignments...')
    await db.delete(assignments)
    
    console.log('Deleting user group members...')
    await db.delete(userGroupMembers)
    
    console.log('Deleting user groups...')
    await db.delete(userGroups)
    
    console.log('Deleting tests...')
    await db.delete(tests)
    
    console.log('Deleting questions...')
    await db.delete(questions)
    
    console.log('Deleting documents...')
    await db.delete(documents)
    
    console.log('Deleting sections...')
    await db.delete(sections)
    
    console.log('Deleting module versions...')
    await db.delete(moduleVersions)
    
    console.log('Deleting modules...')
    await db.delete(modules)
    
    console.log('Deleting verification tokens...')
    await db.delete(verificationTokens)
    
    console.log('Deleting sessions...')
    await db.delete(sessions)
    
    console.log('Deleting accounts...')
    await db.delete(accounts)
    
    console.log('Deleting all users...')
    await db.delete(users)
    
    console.log('✅ Database cleared successfully!')
    
    // Create a default owner user
    console.log('👑 Creating default owner user...')
    const ownerUser = await db.insert(users).values({
      name: 'System Owner',
      email: 'owner@knowledgebase.local',
      role: 'owner'
    }).returning()
    
    console.log('✅ Owner user created:', ownerUser[0])
    console.log('🎉 Database reset complete! Ready for testing.')
    
  } catch (error) {
    console.error('❌ Error clearing database:', error)
    process.exit(1)
  }
}

// Run the cleanup
clearDatabase().then(() => {
  console.log('Script completed successfully')
  process.exit(0)
}).catch((error) => {
  console.error('Script failed:', error)
  process.exit(1)
})
