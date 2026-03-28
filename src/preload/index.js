const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ghostwire', {
  // Identity
  getIdentity: () => ipcRenderer.invoke('get-identity'),

  // Device Name
  getDeviceName: () => ipcRenderer.invoke('get-device-name'),
  setDeviceName: (name) => ipcRenderer.invoke('set-device-name', name),

  // Onboarding
  isOnboarded: () => ipcRenderer.invoke('is-onboarded'),
  completeOnboarding: (deviceName) => ipcRenderer.invoke('complete-onboarding', deviceName),

  // Messages
  getConversations: () => ipcRenderer.invoke('get-conversations'),
  getMessages: (conversationId) => ipcRenderer.invoke('get-messages', conversationId),
  sendMessage: (data) => ipcRenderer.invoke('send-message', data),

  // Peers / Discovery
  getPeers: () => ipcRenderer.invoke('get-peers'),

  // Manual connection
  connectByIp: (ip, port) => ipcRenderer.invoke('connect-by-ip', { ip, port }),

  // Network
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  getNetworkStatus: () => ipcRenderer.invoke('get-network-status'),

  // Event listeners (main → renderer)
  onPeerDiscovered: (callback) => {
    const listener = (_event, peer) => callback(peer);
    ipcRenderer.on('on-peer-discovered', listener);
    return () => ipcRenderer.removeListener('on-peer-discovered', listener);
  },

  onPeerLost: (callback) => {
    const listener = (_event, peerId) => callback(peerId);
    ipcRenderer.on('on-peer-lost', listener);
    return () => ipcRenderer.removeListener('on-peer-lost', listener);
  },

  onMessageReceived: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('on-message-received', listener);
    return () => ipcRenderer.removeListener('on-message-received', listener);
  },

  onConnectionStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('on-connection-status', listener);
    return () => ipcRenderer.removeListener('on-connection-status', listener);
  },
});
