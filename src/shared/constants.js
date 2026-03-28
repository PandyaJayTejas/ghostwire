// GhostWire — Shared Constants (CJS — compatible with Main + Renderer via Vite)

const CONSTANTS = {
  APP_NAME: 'GhostWire',
  APP_VERSION: '0.1.0',
  APP_TAGLINE: 'Communication beyond the grid',

  // mDNS
  MDNS_SERVICE_TYPE: 'ghostwire',
  MDNS_SERVICE_PROTOCOL: 'tcp',
  MDNS_SERVICE_PORT: 3847,

  // WebSocket
  WS_PORT: 3848,
  WS_PATH: '/ghostwire',

  // PWA Web Server
  WEB_PORT: 3849,

  // Protocol
  PROTOCOL_VERSION: 1,

  // Crypto
  FINGERPRINT_LENGTH: 8, // bytes of pubkey to display

  // Network
  HEARTBEAT_INTERVAL: 5000,  // ms
  PEER_TIMEOUT: 15000,       // ms before marking peer offline
  DISCOVERY_INTERVAL: 10000, // ms between mDNS queries

  // Messages
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB
  MAX_DISPLAY_NAME_LENGTH: 32,

  // IPC Channels
  IPC: {
    GET_IDENTITY: 'get-identity',
    SET_DEVICE_NAME: 'set-device-name',
    GET_DEVICE_NAME: 'get-device-name',
    GET_PEERS: 'get-peers',
    SEND_MESSAGE: 'send-message',
    GET_CONVERSATIONS: 'get-conversations',
    GET_MESSAGES: 'get-messages',
    ON_PEER_DISCOVERED: 'on-peer-discovered',
    ON_PEER_LOST: 'on-peer-lost',
    ON_MESSAGE_RECEIVED: 'on-message-received',
    ON_CONNECTION_STATUS: 'on-connection-status',
    IS_ONBOARDED: 'is-onboarded',
    COMPLETE_ONBOARDING: 'complete-onboarding',
    GET_NETWORK_INFO: 'get-network-info',
  },
};

module.exports = CONSTANTS;
