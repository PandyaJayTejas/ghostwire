// GhostWire — Simple Event Bus
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const cbs = this.listeners.get(event);
    if (cbs) cbs.delete(callback);
  }

  emit(event, data) {
    const cbs = this.listeners.get(event);
    if (cbs) {
      cbs.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[EventBus] Error in "${event}" handler:`, err);
        }
      });
    }
  }

  once(event, callback) {
    const wrapped = (data) => {
      this.off(event, wrapped);
      callback(data);
    };
    return this.on(event, wrapped);
  }

  clear() {
    this.listeners.clear();
  }
}

export const bus = new EventBus();

// Events
export const Events = {
  NAVIGATE: 'navigate',
  IDENTITY_READY: 'identity:ready',
  PEER_DISCOVERED: 'peer:discovered',
  PEER_LOST: 'peer:lost',
  MESSAGE_RECEIVED: 'message:received',
  MESSAGE_SENT: 'message:sent',
  CONNECTION_STATUS: 'connection:status',
  TOAST: 'toast',
};
