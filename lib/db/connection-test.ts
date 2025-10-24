import { db } from './index';

export async function testDatabaseConnection() {
  try {
    // Test the database connection
    const result = await db.execute('SELECT NOW() as current_time');
    console.log('✅ Database connection successful!');
    console.log('Current time:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Test connection on import (for development)
if (process.env.NODE_ENV === 'development') {
  testDatabaseConnection();
}
