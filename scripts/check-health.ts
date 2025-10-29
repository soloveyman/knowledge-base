// Simple health check script for testing database connection
// Usage: npx tsx scripts/check-health.ts

const healthUrl = process.env.HEALTH_URL || 'http://localhost:3000/api/health';

async function checkHealth() {
  try {
    console.log(`🔍 Checking health endpoint: ${healthUrl}`);
    const response = await fetch(healthUrl);
    const data = await response.json();
    
    console.log('\n📊 Health Status:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.status === 'healthy' && data.database.connected) {
      console.log('\n✅ All systems operational!');
      process.exit(0);
    } else {
      console.log('\n❌ Health check failed!');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Health check error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  }
}

checkHealth();

