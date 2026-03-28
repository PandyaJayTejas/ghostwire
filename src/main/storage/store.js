const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class JsonStore {
  constructor(filename) {
    this.filepath = path.join(app.getPath('userData'), filename);
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filepath)) {
        return JSON.parse(fs.readFileSync(this.filepath, 'utf-8'));
      }
    } catch (err) {
      console.error(`[Store] Failed to load ${this.filepath}:`, err.message);
    }
    return {};
  }

  _save() {
    try {
      const dir = path.dirname(this.filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`[Store] Failed to save ${this.filepath}:`, err.message);
    }
  }

  get(key, defaultValue = null) {
    return key in this.data ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this._save();
    return value;
  }

  delete(key) {
    delete this.data[key];
    this._save();
  }

  getAll() {
    return { ...this.data };
  }

  clear() {
    this.data = {};
    this._save();
  }
}

// Specific stores
let settingsStore = null;
let messagesStore = null;
let contactsStore = null;

function initStores() {
  settingsStore = new JsonStore('settings.json');
  messagesStore = new JsonStore('messages.json');
  contactsStore = new JsonStore('contacts.json');
}

function getSettingsStore() {
  return settingsStore;
}

function getMessagesStore() {
  return messagesStore;
}

function getContactsStore() {
  return contactsStore;
}

// ---- Settings helpers ----
function getDeviceName() {
  return settingsStore?.get('deviceName', null);
}

function setDeviceName(name) {
  return settingsStore?.set('deviceName', name);
}

function isOnboarded() {
  return settingsStore?.get('onboarded', false);
}

function completeOnboarding(deviceName) {
  settingsStore?.set('deviceName', deviceName);
  settingsStore?.set('onboarded', true);
  settingsStore?.set('onboardedAt', Date.now());
}

// ---- Message helpers ----
function saveMessage(conversationId, message) {
  const conversations = messagesStore.get('conversations', {});
  if (!conversations[conversationId]) {
    conversations[conversationId] = [];
  }
  conversations[conversationId].push(message);
  messagesStore.set('conversations', conversations);
}

function getMessages(conversationId) {
  const conversations = messagesStore.get('conversations', {});
  return conversations[conversationId] || [];
}

function getConversationList() {
  const conversations = messagesStore.get('conversations', {});
  return Object.keys(conversations).map((id) => {
    const msgs = conversations[id];
    const lastMsg = msgs[msgs.length - 1];
    return {
      id,
      lastMessage: lastMsg,
      messageCount: msgs.length,
    };
  });
}

// ---- Contact helpers ----
function saveContact(fingerprint, contact) {
  const contacts = contactsStore.get('contacts', {});
  contacts[fingerprint] = { ...contacts[fingerprint], ...contact, updatedAt: Date.now() };
  contactsStore.set('contacts', contacts);
}

function getContact(fingerprint) {
  const contacts = contactsStore.get('contacts', {});
  return contacts[fingerprint] || null;
}

function getAllContacts() {
  return contactsStore.get('contacts', {});
}

module.exports = {
  JsonStore,
  initStores,
  getSettingsStore,
  getMessagesStore,
  getContactsStore,
  getDeviceName,
  setDeviceName,
  isOnboarded,
  completeOnboarding,
  saveMessage,
  getMessages,
  getConversationList,
  saveContact,
  getContact,
  getAllContacts,
};
