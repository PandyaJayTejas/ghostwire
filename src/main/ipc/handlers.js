const { ipcMain } = require('electron');
const crypto = require('crypto');
const { getPublicIdentity } = require('../crypto/identity');
const store = require('../storage/store');
const { MessageType, createMessage } = require('../../shared/protocol');
const os = require('os');

function setupIpcHandlers(identity, getConnectionManager) {
  // ---- Identity ----
  ipcMain.handle('get-identity', () => {
    return getPublicIdentity(identity);
  });

  // ---- Device Name ----
  ipcMain.handle('get-device-name', () => {
    return store.getDeviceName();
  });

  ipcMain.handle('set-device-name', (_event, name) => {
    store.setDeviceName(name);
    return name;
  });

  // ---- Onboarding ----
  ipcMain.handle('is-onboarded', () => {
    return store.isOnboarded();
  });

  ipcMain.handle('complete-onboarding', (_event, deviceName) => {
    store.completeOnboarding(deviceName);
    return true;
  });

  // ---- Messages ----
  ipcMain.handle('get-conversations', () => {
    return store.getConversationList();
  });

  ipcMain.handle('get-messages', (_event, conversationId) => {
    return store.getMessages(conversationId);
  });

  ipcMain.handle('send-message', (_event, { conversationId, text }) => {
    const cm = getConnectionManager();

    if (cm) {
      // Send via network
      const result = cm.sendTextMessage(conversationId, text);
      return result.message;
    } else {
      // Fallback: save locally only
      const message = {
        id: crypto.randomUUID(),
        from: identity.fingerprint,
        text,
        timestamp: Date.now(),
        status: 'pending',
      };
      store.saveMessage(conversationId, message);
      return message;
    }
  });

  // ---- Peers / Discovery ----
  ipcMain.handle('get-peers', () => {
    const cm = getConnectionManager();
    if (cm) {
      return cm.getAllPeers();
    }
    return store.getAllContacts();
  });

  // ---- Manual Connection ----
  ipcMain.handle('connect-by-ip', async (_event, { ip, port }) => {
    const cm = getConnectionManager();
    if (cm) {
      const success = await cm.connectByIp(ip, port);
      return { success, ip, port };
    }
    return { success: false, error: 'Network not ready' };
  });

  // ---- Network Info ----
  ipcMain.handle('get-network-info', () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const [name, nets] of Object.entries(interfaces)) {
      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push({
            interface: name,
            address: net.address,
            netmask: net.netmask,
          });
        }
      }
    }

    const cm = getConnectionManager();

    return {
      hostname: os.hostname(),
      addresses,
      platform: os.platform(),
      peerCount: cm ? Object.keys(cm.getAllPeers()).length : 0,
      wsConnections: cm?.wsServer?.getConnectionCount() || 0,
    };
  });

  // ---- Network Status ----
  ipcMain.handle('get-network-status', () => {
    const cm = getConnectionManager();
    if (!cm) return { active: false };

    return {
      active: true,
      peerCount: cm.peers.size,
      connectedPeers: Object.values(cm.getAllPeers()).filter(p => p.isConnected).length,
    };
  });
}

module.exports = { setupIpcHandlers };
