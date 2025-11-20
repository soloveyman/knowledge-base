#!/usr/bin/env node

/**
 * Cross-platform production build test script
 * Builds the production bundle and runs Playwright tests
 */

const { execSync } = require('child_process');
const { spawn } = require('child_process');

const isWindows = process.platform === 'win32';

console.log('🔨 Building production bundle...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully\n');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

console.log('🧪 Running Playwright tests against production build...');
console.log('   (Playwright will automatically start/stop the server)\n');

// Run Playwright tests
// Playwright's webServer config will handle starting/stopping the server
const testProcess = spawn('npx', ['playwright', 'test'], {
  stdio: 'inherit',
  shell: isWindows,
});

testProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log(`\n❌ Tests failed with exit code ${code}`);
  }
  process.exit(code);
});

testProcess.on('error', (error) => {
  console.error('❌ Failed to start test process:', error);
  process.exit(1);
});

