// GhostWire — WebSocket Client
// Connects to discovered peers on the LAN
const WebSocket = require('ws');
const CONSTANTS = require('../../shared/constants');
const { MessageType, createMessage } = require('../../shared/protocol');

class WsClient {
  constructor(identity, deviceName) {
    this.identity = identity;
    this.deviceName = deviceName;
    this.connections = new Map(); // fingerprint -> { ws, peer }
    this.reconnectTimers = new Map();
  }

  /**
   * Connect to a discovered peer
   */
  connectToPeer(peer) {
    if (this.connections.has(peer.fingerprint)) {
      const existing = this.connections.get(peer.fingerprint);
      if (existing.ws && existing.ws.readyState === WebSocket.OPEN) {
        return; // Already connected
      }
    }

    const address = peer.addresses?.[0] || peer.address;
    if (!address) {
      console.error(`[WS-Client] No address for peer: ${peer.fingerprint}`);
      return null;
    }

    const url = `ws://${address}:${peer.port || CONSTANTS.WS_PORT}${CONSTANTS.WS_PATH}`;
    console.log(`[WS-Client] Connecting to ${peer.displayName} at ${url}`);

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url, {
          handshakeTimeout: 5000,
        });

        ws.on('open', () => {
          console.log(`[WS-Client] ✅ Connected to ${peer.displayName} (${peer.fingerprint})`);

          // Send our HELLO
          const hello = createMessage(MessageType.HELLO, this.identity.fingerprint, peer.fingerprint, {
            displayName: this.deviceName,
            publicKey: this.identity.signing.publicKey,
            encryptionKey: this.identity.encryption.publicKey,
          });
          ws.send(JSON.stringify(hello));

          this.connections.set(peer.fingerprint, { ws, peer });
          ws.isAlive = true;
          resolve(true);
        });

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this._onMessage?.(message, peer);
          } catch (err) {
            console.error('[WS-Client] Invalid message:', err.message);
          }
        });

        ws.on('pong', () => {
          ws.isAlive = true;
        });

        ws.on('close', () => {
          console.log(`[WS-Client] Connection closed: ${peer.displayName}`);
          this.connections.delete(peer.fingerprint);
          this._onDisconnect?.(peer.fingerprint);
        });

        ws.on('error', (err) => {
          console.error(`[WS-Client] Error connecting to ${peer.displayName}:`, err.message);
          this.connections.delete(peer.fingerprint);
          resolve(false);
        });
      } catch (err) {
        console.error(`[WS-Client] Failed to create connection:`, err.message);
        resolve(false);
      }
    });
  }

  /**
   * Send a message to a peer
   */
  sendTo(fingerprint, message) {
    const conn = this.connections.get(fingerprint);
    if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Check if connected to a peer
   */
  isConnected(fingerprint) {
    const conn = this.connections.get(fingerprint);
    return conn && conn.ws && conn.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Set message handler
   */
  onMessage(handler) {
    this._onMessage = handler;
  }

  /**
   * Set disconnect handler
   */
  onDisconnect(handler) {
    this._onDisconnect = handler;
  }

  /**
   * Close connection to a specific peer
   */
  disconnect(fingerprint) {
    const conn = this.connections.get(fingerprint);
    if (conn && conn.ws) {
      conn.ws.close(1000, 'Client disconnecting');
    }
    this.connections.delete(fingerprint);
  }

  /**
   * Close all connections
   */
  disconnectAll() {
    for (const [fp, conn] of this.connections) {
      if (conn.ws) {
        conn.ws.close(1000, 'Client shutting down');
      }
    }
    this.connections.clear();

    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }
}

module.exports = { WsClient };
