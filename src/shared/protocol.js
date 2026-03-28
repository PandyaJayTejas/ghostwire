// GhostWire — Message Protocol (CJS — compatible with Main + Renderer via Vite)

const MessageType = {
  HELLO: 'HELLO',
  KEY_EXCHANGE: 'KEY_EXCHANGE',
  TEXT: 'TEXT',
  FILE_META: 'FILE_META',
  FILE_CHUNK: 'FILE_CHUNK',
  ACK: 'ACK',
  PRESENCE: 'PRESENCE',
  DISCOVER: 'DISCOVER',
  RELAY: 'RELAY',
};

const PresenceStatus = {
  ONLINE: 'online',
  TYPING: 'typing',
  IDLE: 'idle',
  OFFLINE: 'offline',
};

const AckStatus = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

function createMessage(type, from, to, payload, routing) {
  routing = routing || {};
  return {
    v: 1,
    id: generateId(),
    type,
    from,
    to: to || null,
    ts: Date.now(),
    payload: payload || {},
    routing: {
      ttl: routing.ttl || 5,
      hops: routing.hops || [],
    },
  };
}

function generateId() {
  // Works in both Node.js (main process) and browser (renderer via Vite)
  try {
    if (typeof require === 'function') {
      return require('crypto').randomUUID();
    }
  } catch (_) {}
  // Browser fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

module.exports = { MessageType, PresenceStatus, AckStatus, createMessage, generateId };
