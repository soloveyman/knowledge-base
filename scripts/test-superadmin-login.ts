import bcrypt from 'bcryptjs'

async function testPassword() {
  const password = 'admin123'
  const hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY5OZz5L5KK'
  
  console.log('Testing password verification...')
  const isValid = await bcrypt.compare(password, hash)
  console.log(`Password "admin123" matches hash: ${isValid}`)
  
  if (!isValid) {
    console.log('Generating new hash...')
    const newHash = await bcrypt.hash(password, 12)
    console.log('New hash:', newHash)
    console.log('\nUpdate SQL:')
    console.log(`UPDATE users SET password = '${newHash}' WHERE email = 'superadmin@test.com';`)
  }
}

testPassword().then(() => process.exit(0)).catch(console.error)

