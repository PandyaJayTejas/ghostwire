// GhostWire Android — Zero-Dependency HTTP Server
// Run: node server.js
// Then open Chrome → http://localhost:8080

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  // CORS headers for WebSocket connections
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Parse URL (strip query string)
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(DIR, urlPath);

  // Security — prevent directory traversal
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback → serve index.html for any missing route
      fs.readFile(path.join(DIR, 'index.html'), (e2, html) => {
        if (e2) {
          res.writeHead(404);
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        }
      });
    } else {
      // Cache static assets
      if (ext === '.svg' || ext === '.png' || ext === '.webp') {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║       ⚡ GHOSTWIRE ANDROID NODE ⚡        ║');
  console.log('  ║     Communication beyond the grid        ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  📱 Open Chrome → http://localhost:${PORT}`);
  console.log('  🔗 Enter your desktop IP in the app to connect');
  console.log('');
  console.log('  Steps:');
  console.log('    1. Open Chrome on this device');
  console.log(`    2. Go to http://localhost:${PORT}`);
  console.log('    3. Enter your callsign');
  console.log('    4. Enter your Windows laptop IP');
  console.log('    5. Start chatting!');
  console.log('');
  console.log('  ⏹  Press Ctrl+C to stop');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌ Port ${PORT} is already in use.`);
    console.error('  Try: node server.js  (after killing the other process)');
    console.error('  Or change PORT in server.js\n');
  } else {
    console.error('  Server error:', err);
  }
  process.exit(1);
});
