// GhostWire — Connection Manager
// Coordinates mDNS, WebSocket Server, WebSocket Client, and IPC events
const { MdnsService } = require('./mdns-service');
const { WsServer } = require('./ws-server');
const { WsClient } = require('./ws-client');
const { MessageType, createMessage } = require('../../shared/protocol');
const store = require('../storage/store');

class ConnectionManager {
  constructor(identity, mainWindow) {
    this.identity = identity;
    this.mainWindow = mainWindow;
    this.deviceName = store.getDeviceName() || require('os').hostname();

    this.peers = new Map(); // fingerprint -> full peer state
    this.mdns = null;
    this.wsServer = null;
    this.wsClient = null;
  }

  /**
   * Start all network services
   */
  async start() {
    console.log('[ConnManager] Starting network services...');

    // 1. Start WebSocket Server
    this.wsServer = new WsServer(
      this.identity,
      this.deviceName,
      (msg) => this._handleIncomingMessage(msg),
      (fp, info) => this._handlePeerConnected(fp, info),
      (fp) => this._handlePeerDisconnected(fp),
    );

    try {
      await this.wsServer.start();
    } catch (err) {
      console.error('[ConnManager] WebSocket server failed:', err.message);
    }

    // 2. Start WebSocket Client
    this.wsClient = new WsClient(this.identity, this.deviceName);
    this.wsClient.onMessage((msg, peer) => this._handleIncomingMessage(msg));
    this.wsClient.onDisconnect((fp) => this._handlePeerDisconnected(fp));

    // 3. Start mDNS Discovery
    this.mdns = new MdnsService(
      this.identity,
      this.deviceName,
      (peer, isNew) => this._handleMdnsPeerFound(peer, isNew),
      (fp) => this._handleMdnsPeerLost(fp),
    );
    this.mdns.start();

    console.log('[ConnManager] ✅ All network services started');
  }

  /**
   * Handle mDNS peer discovery — auto-connect via WebSocket
   */
  async _handleMdnsPeerFound(peer, isNew) {
    // Update peer registry
    const existing = this.peers.get(peer.fingerprint) || {};
    this.peers.set(peer.fingerprint, {
      ...existing,
      ...peer,
      status: 'online',
      lastSeen: Date.now(),
    });

    // Save contact
    store.saveContact(peer.fingerprint, {
      displayName: peer.displayName,
      hostname: peer.hostname,
      fingerprint: peer.fingerprint,
      publicKey: peer.publicKey,
    });

    // Notify renderer
    this._sendToRenderer('on-peer-discovered', this.peers.get(peer.fingerprint));

    // Auto-connect via WebSocket if not already connected
    if (!this._isConnected(peer.fingerprint)) {
      const success = await this.wsClient.connectToPeer(peer);
      if (success) {
        this._updatePeerStatus(peer.fingerprint, 'connected');
        this._sendToRenderer('on-connection-status', {
          fingerprint: peer.fingerprint,
          status: 'connected',
        });
      }
    }
  }

  /**
   * Handle mDNS peer lost
   */
  _handleMdnsPeerLost(fingerprint) {
    this._updatePeerStatus(fingerprint, 'offline');
    this._sendToRenderer('on-peer-lost', fingerprint);
  }

  /**
   * Handle a peer connecting to our WebSocket server
   */
  _handlePeerConnected(fingerprint, info) {
    const existing = this.peers.get(fingerprint) || {};
    this.peers.set(fingerprint, {
      ...existing,
      ...info,
      status: 'connected',
      lastSeen: Date.now(),
    });

    store.saveContact(fingerprint, {
      displayName: info.displayName,
      fingerprint: info.fingerprint,
      publicKey: info.publicKey,
    });

    this._sendToRenderer('on-peer-discovered', this.peers.get(fingerprint));
    this._sendToRenderer('on-connection-status', {
      fingerprint,
      status: 'connected',
    });
  }

  /**
   * Handle a peer disconnecting
   */
  _handlePeerDisconnected(fingerprint) {
    this._updatePeerStatus(fingerprint, 'offline');
    this._sendToRenderer('on-connection-status', {
      fingerprint,
      status: 'disconnected',
    });
  }

  /**
   * Handle incoming message from any peer
   */
  _handleIncomingMessage(message) {
    console.log(`[ConnManager] Message from ${message.from}: ${message.type}`);

    switch (message.type) {
      case MessageType.TEXT:
        this._handleTextMessage(message);
        break;

      case MessageType.PRESENCE:
        this._handlePresence(message);
        break;

      case MessageType.ACK:
        // Update message status in store
        break;

      default:
        console.log(`[ConnManager] Unhandled message type: ${message.type}`);
    }
  }

  /**
   * Handle incoming text message
   */
  _handleTextMessage(message) {
    const conversationId = message.from;
    const msgData = {
      id: message.id,
      from: message.from,
      text: message.payload.text,
      timestamp: message.ts,
      status: 'received',
    };

    // Save to store
    store.saveMessage(conversationId, msgData);

    // Notify renderer
    this._sendToRenderer('on-message-received', {
      conversationId,
      message: msgData,
    });

    // Send ACK
    const ack = createMessage(MessageType.ACK, this.identity.fingerprint, message.from, {
      messageId: message.id,
      status: 'delivered',
    });
    this.sendMessage(message.from, ack);
  }

  /**
   * Handle presence update
   */
  _handlePresence(message) {
    const peer = this.peers.get(message.from);
    if (peer) {
      peer.presenceStatus = message.payload.status;
      peer.lastSeen = Date.now();
      this._sendToRenderer('on-peer-discovered', peer);
    }
  }

  /**
   * Send a text message to a peer
   */
  sendTextMessage(fingerprint, text) {
    const msg = createMessage(MessageType.TEXT, this.identity.fingerprint, fingerprint, {
      text,
    });

    const sent = this.sendMessage(fingerprint, msg);

    // Save to store (our side)
    const conversationId = fingerprint;
    store.saveMessage(conversationId, {
      id: msg.id,
      from: 'self',
      text,
      timestamp: msg.ts,
      status: sent ? 'sent' : 'failed',
    });

    return { sent, message: msg };
  }

  /**
   * Send a protocol message to a peer (try server first, then client)
   */
  sendMessage(fingerprint, message) {
    // Try server connection first
    if (this.wsServer.sendTo(fingerprint, message)) {
      return true;
    }

    // Try client connection
    if (this.wsClient.sendTo(fingerprint, message)) {
      return true;
    }

    console.warn(`[ConnManager] Cannot send to ${fingerprint}: not connected`);
    return false;
  }

  /**
   * Connect to a peer by IP address manually
   */
  async connectByIp(ip, port) {
    const peer = {
      fingerprint: `manual-${ip}:${port}`,
      displayName: `Node@${ip}`,
      addresses: [ip],
      port: port || require('../../shared/constants').WS_PORT,
      status: 'connecting',
    };

    const success = await this.wsClient.connectToPeer(peer);
    return success;
  }

  /**
   * Check if a peer is connected
   */
  _isConnected(fingerprint) {
    return (
      this.wsServer.isConnected(fingerprint) ||
      this.wsClient.isConnected(fingerprint)
    );
  }

  /**
   * Update peer status
   */
  _updatePeerStatus(fingerprint, status) {
    const peer = this.peers.get(fingerprint);
    if (peer) {
      peer.status = status;
      peer.lastSeen = Date.now();
    }
  }

  /**
   * Get all known peers (for IPC)
   */
  getAllPeers() {
    const peers = {};
    for (const [fp, peer] of this.peers) {
      peers[fp] = {
        ...peer,
        isConnected: this._isConnected(fp),
      };
    }
    return peers;
  }

  /**
   * Send event to renderer
   */
  _sendToRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Stop all services
   */
  stop() {
    console.log('[ConnManager] Stopping all network services...');
    if (this.mdns) this.mdns.stop();
    if (this.wsServer) this.wsServer.stop();
    if (this.wsClient) this.wsClient.disconnectAll();
    this.peers.clear();
    console.log('[ConnManager] All services stopped.');
  }
}

module.exports = { ConnectionManager };
