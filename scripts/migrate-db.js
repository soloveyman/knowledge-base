const { exec } = require('child_process');

// Set environment variable and run migration
process.env.DATABASE_URL = 'postgresql://postgres:Murchegan5522@localhost:5432/horeca_saas_local';

const { spawn } = require('child_process');

const child = spawn('npm', ['run', 'db:push'], {
  stdio: 'inherit',
  shell: true
});

// Send 'y' to confirm the migration
setTimeout(() => {
  child.stdin.write('y\n');
}, 2000);

child.on('close', (code) => {
  console.log(`Migration completed with code ${code}`);
});
