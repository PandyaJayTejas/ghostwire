const { spawn } = require('child_process');
const http = require('http');

const VITE_URL = 'http://localhost:5173';
const MAX_RETRIES = 30;

function waitForVite(retries = 0) {
  return new Promise((resolve, reject) => {
    if (retries >= MAX_RETRIES) {
      reject(new Error('Vite dev server did not start in time'));
      return;
    }

    http.get(VITE_URL, (res) => {
      resolve();
    }).on('error', () => {
      setTimeout(() => {
        waitForVite(retries + 1).then(resolve).catch(reject);
      }, 500);
    });
  });
}

async function main() {
  console.log('⏳ Waiting for Vite dev server...');
  await waitForVite();
  console.log('✅ Vite is ready, starting Electron...');

  const electron = require('electron');
  const electronPath = typeof electron === 'string' ? electron : electron.default || electron;

  const child = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', VITE_DEV_SERVER_URL: VITE_URL },
  });

  child.on('close', (code) => {
    process.exit(code);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
