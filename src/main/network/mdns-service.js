// GhostWire — mDNS Discovery Service
// Advertises this node and browses for peers on the local network
const Bonjour = require('bonjour-service');
const os = require('os');
const CONSTANTS = require('../../shared/constants');

class MdnsService {
  constructor(identity, deviceName, onPeerFound, onPeerLost) {
    this.identity = identity;
    this.deviceName = deviceName;
    this.onPeerFound = onPeerFound;
    this.onPeerLost = onPeerLost;

    this.bonjour = null;
    this.service = null;
    this.browser = null;
    this.knownPeers = new Map(); // fingerprint -> peer info
    this.timeoutTimers = new Map();
  }

  /**
   * Start advertising this node & browsing for peers
   */
  start() {
    console.log('[mDNS] Starting discovery service...');

    this.bonjour = new Bonjour.default();

    // Publish our service
    this.service = this.bonjour.publish({
      name: `gw-${this.identity.fingerprint}`,
      type: CONSTANTS.MDNS_SERVICE_TYPE,
      protocol: CONSTANTS.MDNS_SERVICE_PROTOCOL,
      port: CONSTANTS.WS_PORT,
      txt: {
        fp: this.identity.fingerprint,
        name: this.deviceName || os.hostname(),
        pk: this.identity.signing.publicKey.substring(0, 32),
        ver: String(CONSTANTS.PROTOCOL_VERSION),
      },
    });

    console.log(`[mDNS] Publishing service: gw-${this.identity.fingerprint} on port ${CONSTANTS.WS_PORT}`);

    // Browse for other GhostWire nodes
    this.browser = this.bonjour.find({
      type: CONSTANTS.MDNS_SERVICE_TYPE,
      protocol: CONSTANTS.MDNS_SERVICE_PROTOCOL,
    });

    this.browser.on('up', (service) => {
      this._handleServiceUp(service);
    });

    this.browser.on('down', (service) => {
      this._handleServiceDown(service);
    });

    console.log('[mDNS] Browsing for GhostWire peers...');
  }

  /**
   * Handle a new service appearing on the network
   */
  _handleServiceUp(service) {
    const txt = service.txt || {};
    const fingerprint = txt.fp;
    const displayName = txt.name || service.name;

    // Skip our own service
    if (fingerprint === this.identity.fingerprint) return;

    // Get IP addresses
    const addresses = [
      ...(service.addresses || []),
      ...(service.referer?.address ? [service.referer.address] : []),
    ].filter((addr) => addr && !addr.startsWith('127.') && !addr.includes('::'));

    if (addresses.length === 0) {
      console.log(`[mDNS] Service ${displayName} has no usable addresses, skipping`);
      return;
    }

    const peer = {
      fingerprint,
      displayName,
      hostname: service.host || 'unknown',
      addresses,
      port: service.port,
      publicKey: txt.pk || null,
      protocolVersion: parseInt(txt.ver) || 1,
      discoveredAt: Date.now(),
      lastSeen: Date.now(),
      status: 'online',
    };

    const isNew = !this.knownPeers.has(fingerprint);
    this.knownPeers.set(fingerprint, peer);

    // Reset timeout timer
    this._resetPeerTimeout(fingerprint);

    if (isNew) {
      console.log(`[mDNS] ✅ Peer discovered: ${displayName} (${fingerprint}) at ${addresses[0]}:${service.port}`);
    } else {
      console.log(`[mDNS] 🔄 Peer refreshed: ${displayName} (${fingerprint})`);
    }

    this.onPeerFound(peer, isNew);
  }

  /**
   * Handle a service going down
   */
  _handleServiceDown(service) {
    const txt = service.txt || {};
    const fingerprint = txt.fp;
    if (!fingerprint || fingerprint === this.identity.fingerprint) return;

    this._removePeer(fingerprint);
  }

  /**
   * Reset the timeout timer for a peer
   */
  _resetPeerTimeout(fingerprint) {
    if (this.timeoutTimers.has(fingerprint)) {
      clearTimeout(this.timeoutTimers.get(fingerprint));
    }

    const timer = setTimeout(() => {
      console.log(`[mDNS] ⏱️ Peer timeout: ${fingerprint}`);
      this._removePeer(fingerprint);
    }, CONSTANTS.PEER_TIMEOUT);

    this.timeoutTimers.set(fingerprint, timer);
  }

  /**
   * Remove a peer
   */
  _removePeer(fingerprint) {
    const peer = this.knownPeers.get(fingerprint);
    if (peer) {
      console.log(`[mDNS] ❌ Peer lost: ${peer.displayName} (${fingerprint})`);
      this.knownPeers.delete(fingerprint);
      this.onPeerLost(fingerprint);
    }

    if (this.timeoutTimers.has(fingerprint)) {
      clearTimeout(this.timeoutTimers.get(fingerprint));
      this.timeoutTimers.delete(fingerprint);
    }
  }

  /**
   * Update our advertised name
   */
  updateDisplayName(newName) {
    this.deviceName = newName;
    // Re-publish with updated name
    if (this.service) {
      try {
        this.service.stop(() => {
          this.service = this.bonjour.publish({
            name: `gw-${this.identity.fingerprint}`,
            type: CONSTANTS.MDNS_SERVICE_TYPE,
            protocol: CONSTANTS.MDNS_SERVICE_PROTOCOL,
            port: CONSTANTS.WS_PORT,
            txt: {
              fp: this.identity.fingerprint,
              name: newName,
              pk: this.identity.signing.publicKey.substring(0, 32),
              ver: String(CONSTANTS.PROTOCOL_VERSION),
            },
          });
        });
      } catch (err) {
        console.error('[mDNS] Failed to update service:', err.message);
      }
    }
  }

  /**
   * Get all known peers
   */
  getPeers() {
    const peers = {};
    for (const [fp, peer] of this.knownPeers) {
      peers[fp] = { ...peer };
    }
    return peers;
  }

  /**
   * Get a specific peer
   */
  getPeer(fingerprint) {
    return this.knownPeers.get(fingerprint) || null;
  }

  /**
   * Stop the service
   */
  stop() {
    console.log('[mDNS] Stopping discovery service...');

    for (const timer of this.timeoutTimers.values()) {
      clearTimeout(timer);
    }
    this.timeoutTimers.clear();

    if (this.browser) {
      try { this.browser.stop(); } catch (e) { /* ignore */ }
    }

    if (this.service) {
      try { this.service.stop(); } catch (e) { /* ignore */ }
    }

    if (this.bonjour) {
      try { this.bonjour.destroy(); } catch (e) { /* ignore */ }
    }

    this.knownPeers.clear();
    console.log('[mDNS] Discovery stopped.');
  }
}

module.exports = { MdnsService };
