// GhostWire — WebSocket Server
// Accepts incoming connections from peers on the LAN
const { WebSocketServer, WebSocket } = require('ws');
const CONSTANTS = require('../../shared/constants');
const { MessageType, createMessage } = require('../../shared/protocol');

class WsServer {
  constructor(identity, deviceName, onMessage, onPeerConnected, onPeerDisconnected) {
    this.identity = identity;
    this.deviceName = deviceName;
    this.onMessage = onMessage;
    this.onPeerConnected = onPeerConnected;
    this.onPeerDisconnected = onPeerDisconnected;

    this.wss = null;
    this.connections = new Map(); // fingerprint -> ws
    this.heartbeatInterval = null;
  }

  /**
   * Start the WebSocket server
   */
  start() {
    return new Promise((resolve, reject) => {
      this.wss = new WebSocketServer({
        port: CONSTANTS.WS_PORT,
        path: CONSTANTS.WS_PATH,
        maxPayload: CONSTANTS.MAX_MESSAGE_SIZE,
      });

      this.wss.on('listening', () => {
        console.log(`[WS-Server] Listening on port ${CONSTANTS.WS_PORT}`);
        resolve();
      });

      this.wss.on('error', (err) => {
        console.error('[WS-Server] Error:', err.message);
        if (err.code === 'EADDRINUSE') {
          console.error(`[WS-Server] Port ${CONSTANTS.WS_PORT} already in use`);
        }
        reject(err);
      });

      this.wss.on('connection', (ws, req) => {
        const remoteAddr = req.socket.remoteAddress;
        console.log(`[WS-Server] Incoming connection from ${remoteAddr}`);
        this._handleConnection(ws, remoteAddr);
      });

      // Heartbeat to detect stale connections
      this.heartbeatInterval = setInterval(() => {
        this.wss.clients.forEach((ws) => {
          if (ws.isAlive === false) {
            console.log('[WS-Server] Terminating stale connection');
            return ws.terminate();
          }
          ws.isAlive = false;
          ws.ping();
        });
      }, CONSTANTS.HEARTBEAT_INTERVAL);
    });
  }

  /**
   * Handle a new incoming connection
   */
  _handleConnection(ws, remoteAddr) {
    ws.isAlive = true;
    ws.peerFingerprint = null;
    ws.remoteAddr = remoteAddr;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this._handleMessage(ws, message);
      } catch (err) {
        console.error('[WS-Server] Invalid message:', err.message);
      }
    });

    ws.on('close', () => {
      if (ws.peerFingerprint) {
        console.log(`[WS-Server] Peer disconnected: ${ws.peerFingerprint}`);
        this.connections.delete(ws.peerFingerprint);
        this.onPeerDisconnected(ws.peerFingerprint);
      }
    });

    ws.on('error', (err) => {
      console.error(`[WS-Server] Connection error:`, err.message);
    });

    // Send HELLO
    const hello = createMessage(MessageType.HELLO, this.identity.fingerprint, null, {
      displayName: this.deviceName,
      publicKey: this.identity.signing.publicKey,
      encryptionKey: this.identity.encryption.publicKey,
    });
    ws.send(JSON.stringify(hello));
  }

  /**
   * Handle incoming message from client
   */
  _handleMessage(ws, message) {
    switch (message.type) {
      case MessageType.HELLO:
        ws.peerFingerprint = message.from;
        this.connections.set(message.from, ws);
        console.log(`[WS-Server] Peer identified: ${message.payload.displayName} (${message.from})`);
        this.onPeerConnected(message.from, {
          fingerprint: message.from,
          displayName: message.payload.displayName,
          publicKey: message.payload.publicKey,
          encryptionKey: message.payload.encryptionKey,
          address: ws.remoteAddr,
          connectedAt: Date.now(),
        });
        break;

      case MessageType.TEXT:
      case MessageType.FILE_META:
      case MessageType.FILE_CHUNK:
      case MessageType.PRESENCE:
      case MessageType.ACK:
        this.onMessage(message);
        break;

      default:
        console.log(`[WS-Server] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Send a message to a specific peer
   */
  sendTo(fingerprint, message) {
    const ws = this.connections.get(fingerprint);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Broadcast a message to all connected peers
   */
  broadcast(message, excludeFingerprint = null) {
    for (const [fp, ws] of this.connections) {
      if (fp !== excludeFingerprint && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }
  }

  /**
   * Check if a peer is connected
   */
  isConnected(fingerprint) {
    const ws = this.connections.get(fingerprint);
    return ws && ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get count of active connections
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Stop the server
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const ws of this.connections.values()) {
      ws.close(1000, 'Server shutting down');
    }
    this.connections.clear();

    if (this.wss) {
      this.wss.close(() => {
        console.log('[WS-Server] Server stopped.');
      });
    }
  }
}

module.exports = { WsServer };
