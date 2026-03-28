// GhostWire — PWA Static File Server
// Serves the mobile PWA on port 3849 for Android/iOS devices
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const CONSTANTS = require('../../shared/constants');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

class PwaServer {
  constructor() {
    this.server = null;
    this.pwaDir = path.join(__dirname, '../../pwa');
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this._handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        console.error('[PWA-Server] Error:', err.message);
        reject(err);
      });

      this.server.listen(CONSTANTS.WEB_PORT, '0.0.0.0', () => {
        const addresses = this._getLocalAddresses();
        console.log(`[PWA-Server] 📱 Mobile PWA serving on port ${CONSTANTS.WEB_PORT}`);
        console.log('[PWA-Server] Open on your Android device:');
        addresses.forEach((addr) => {
          console.log(`  → http://${addr}:${CONSTANTS.WEB_PORT}`);
        });
        resolve(addresses);
      });
    });
  }

  _handleRequest(req, res) {
    // CORS headers for local network
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API endpoint: server info
    if (req.url === '/api/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        hostname: os.hostname(),
        wsPort: CONSTANTS.WS_PORT,
        wsPath: CONSTANTS.WS_PATH,
        version: CONSTANTS.APP_VERSION,
      }));
      return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(this.pwaDir, filePath);

    // Security: prevent directory traversal
    if (!filePath.startsWith(this.pwaDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
      if (err) {
        if (err.code === 'ENOENT') {
          // SPA fallback: serve index.html for unknown routes
          fs.readFile(path.join(this.pwaDir, 'index.html'), (err2, html) => {
            if (err2) {
              res.writeHead(404);
              res.end('Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(html);
            }
          });
        } else {
          res.writeHead(500);
          res.end('Server Error');
        }
      } else {
        // Cache static assets
        if (ext !== '.html') {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      }
    });
  }

  _getLocalAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const nets of Object.values(interfaces)) {
      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
    return addresses;
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('[PWA-Server] Stopped.');
      });
    }
  }
}

module.exports = { PwaServer };
