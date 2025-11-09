#!/usr/bin/env tsx
/**
 * Setup script for Docker database
 * Creates/updates .env.local with Docker database configuration
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const envLocalPath = join(process.cwd(), '.env.local');
const envExamplePath = join(process.cwd(), 'env.example');

const dockerDatabaseUrl = 'postgresql://postgres:postgres@localhost:5432/knowledge_base';

function setupDockerDb() {
  console.log('🐳 Setting up Docker database configuration...\n');

  // Read env.example if it exists
  let envContent = '';
  if (existsSync(envExamplePath)) {
    envContent = readFileSync(envExamplePath, 'utf-8');
  }

  // Read existing .env.local if it exists
  let existingEnv = '';
  if (existsSync(envLocalPath)) {
    existingEnv = readFileSync(envLocalPath, 'utf-8');
    console.log('📝 Found existing .env.local, updating DATABASE_URL...\n');
  } else {
    console.log('📝 Creating new .env.local from env.example...\n');
    envContent = envContent || `# Database Configuration
DATABASE_URL="${dockerDatabaseUrl}"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"
`;
  }

  // Update or add DATABASE_URL
  const lines = existingEnv || envContent;
  const updatedLines = lines.split('\n').map(line => {
    if (line.startsWith('DATABASE_URL=') || line.startsWith('# DATABASE_URL=')) {
      return `DATABASE_URL="${dockerDatabaseUrl}"`;
    }
    return line;
  });

  // If DATABASE_URL wasn't found, add it
  if (!updatedLines.some(line => line.startsWith('DATABASE_URL='))) {
    updatedLines.unshift(`DATABASE_URL="${dockerDatabaseUrl}"`);
  }

  // Write to .env.local
  writeFileSync(envLocalPath, updatedLines.join('\n'), 'utf-8');

  console.log('✅ Docker database configuration set up successfully!\n');
  console.log(`📌 DATABASE_URL: ${dockerDatabaseUrl}\n`);
  console.log('🚀 Next steps:');
  console.log('   1. Start Docker database: npm run docker:up');
  console.log('   2. Push database schema: npm run db:push');
  console.log('   3. Start development server: npm run dev\n');
}

setupDockerDb();

