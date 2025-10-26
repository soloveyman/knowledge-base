// Browser Console Migration Script
// Run this in your browser console to migrate localStorage data to the database

console.log('🔄 localStorage to Database Migration Helper')
console.log('==========================================')

// Check what data exists in localStorage
function checkLocalStorageData() {
  const tests = JSON.parse(localStorage.getItem('savedTests') || '[]')
  const assignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')
  const users = JSON.parse(localStorage.getItem('savedUsers') || '[]')
  
  console.log('📊 Current localStorage data:')
  console.log(`- Tests: ${tests.length}`)
  console.log(`- Assignments: ${assignments.length}`)
  console.log(`- Users: ${users.length}`)
  
  return { tests, assignments, users }
}

// Migrate tests to database
async function migrateTests() {
  console.log('📚 Migrating tests...')
  
  const tests = JSON.parse(localStorage.getItem('savedTests') || '[]')
  
  for (const test of tests) {
    try {
      const response = await fetch('/api/tests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: test.title,
          description: `Migrated from localStorage: ${test.title}`,
          questionIds: test.questions.map(q => q.id),
          passingScore: 70,
          timeLimit: 15,
          maxAttempts: 1,
          shuffleQuestions: false,
          showCorrectAnswers: true,
          status: 'published'
        })
      })
      
      if (response.ok) {
        console.log(`✅ Migrated test: ${test.title}`)
      } else {
        console.error(`❌ Failed to migrate test: ${test.title}`)
      }
    } catch (error) {
      console.error(`❌ Error migrating test ${test.title}:`, error)
    }
  }
  
  console.log(`📚 Completed migrating ${tests.length} tests`)
}

// Migrate assignments to database
async function migrateAssignments() {
  console.log('📋 Migrating assignments...')
  
  const assignments = JSON.parse(localStorage.getItem('savedAssignments') || '[]')
  
  for (const assignment of assignments) {
    try {
      const response = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: assignment.name,
          description: assignment.description,
          moduleId: assignment.document.id.toString(),
          testId: assignment.test.id,
          assignedTo: assignment.assignedUsers[0]?.id.toString(),
          dueDate: assignment.dueDate,
          status: assignment.status === 'active' ? 'pending' : assignment.status
        })
      })
      
      if (response.ok) {
        console.log(`✅ Migrated assignment: ${assignment.name}`)
      } else {
        console.error(`❌ Failed to migrate assignment: ${assignment.name}`)
      }
    } catch (error) {
      console.error(`❌ Error migrating assignment ${assignment.name}:`, error)
    }
  }
  
  console.log(`📋 Completed migrating ${assignments.length} assignments`)
}

// Migrate users to database
async function migrateUsers() {
  console.log('👥 Migrating users...')
  
  const users = JSON.parse(localStorage.getItem('savedUsers') || '[]')
  
  for (const user of users) {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: user.name,
          job: user.job,
          email: user.email,
          password: 'temp-password-123', // Users will need to reset passwords
          role: user.role
        })
      })
      
      if (response.ok) {
        console.log(`✅ Migrated user: ${user.name}`)
      } else {
        console.error(`❌ Failed to migrate user: ${user.name}`)
      }
    } catch (error) {
      console.error(`❌ Error migrating user ${user.name}:`, error)
    }
  }
  
  console.log(`👥 Completed migrating ${users.length} users`)
}

// Clear localStorage data after successful migration
function clearLocalStorageData() {
  console.log('🧹 Clearing localStorage data...')
  
  localStorage.removeItem('savedTests')
  localStorage.removeItem('savedAssignments')
  localStorage.removeItem('savedUsers')
  localStorage.removeItem('editingTestId')
  localStorage.removeItem('editingAssignmentId')
  localStorage.removeItem('editingUserId')
  
  console.log('✅ localStorage data cleared')
}

// Main migration function
async function migrateAll() {
  console.log('🚀 Starting full migration...')
  
  try {
    // Check current data
    checkLocalStorageData()
    
    // Migrate each type
    await migrateTests()
    await migrateAssignments()
    await migrateUsers()
    
    // Clear localStorage
    clearLocalStorageData()
    
    console.log('🎉 Migration completed successfully!')
    console.log('📝 All data has been moved to the database')
    console.log('🔄 Please refresh the page to see the changes')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

// Make functions available globally
window.migrateLocalStorage = {
  check: checkLocalStorageData,
  migrateAll,
  migrateTests,
  migrateAssignments,
  migrateUsers,
  clear: clearLocalStorageData
}

console.log('🔧 Migration functions available:')
console.log('- migrateLocalStorage.check() - Check current localStorage data')
console.log('- migrateLocalStorage.migrateAll() - Migrate all data')
console.log('- migrateLocalStorage.migrateTests() - Migrate tests only')
console.log('- migrateLocalStorage.migrateAssignments() - Migrate assignments only')
console.log('- migrateLocalStorage.migrateUsers() - Migrate users only')
console.log('- migrateLocalStorage.clear() - Clear localStorage data')
console.log('')
console.log('💡 Recommended: Run migrateLocalStorage.migrateAll() to migrate everything')
