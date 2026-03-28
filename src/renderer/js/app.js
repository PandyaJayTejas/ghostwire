// GhostWire — Terminal Nocturne App Router
import { bus, Events } from './utils/events.js';

// Screen modules
import { renderOnboarding, mountOnboarding, unmountOnboarding } from './screens/onboarding.js';
import { renderMessages, mountMessages, unmountMessages } from './screens/conversations.js';
import { renderVoiceComms, mountVoiceComms, unmountVoiceComms } from './screens/chat.js';
import { renderDiscovery, mountDiscovery, unmountDiscovery } from './screens/discovery.js';
import { renderSettings, mountSettings, unmountSettings } from './screens/settings.js';

// ---- State ----
const appState = {
  currentScreen: null,
  identity: null,
  deviceName: null,
  isOnboarded: false,
};

// ---- Screen Registry ----
const screens = {
  onboarding:  { render: renderOnboarding, mount: mountOnboarding, unmount: unmountOnboarding, isFullscreen: true },
  messages:    { render: renderMessages, mount: mountMessages, unmount: unmountMessages, navId: 'messages' },
  voice_comms: { render: renderVoiceComms, mount: mountVoiceComms, unmount: unmountVoiceComms, navId: 'voice_comms' },
  discovery:   { render: renderDiscovery, mount: mountDiscovery, unmount: unmountDiscovery, navId: 'discovery' },
  settings:    { render: renderSettings, mount: mountSettings, unmount: unmountSettings, navId: 'settings' },
};

// ---- Navigation ----
async function navigateTo(screenName, params = {}) {
  const screen = screens[screenName];
  if (!screen) {
    console.error(`[Router] Unknown screen: ${screenName}`);
    return;
  }

  // Unmount current
  if (appState.currentScreen && screens[appState.currentScreen]) {
    screens[appState.currentScreen].unmount();
  }

  appState.currentScreen = screenName;

  const appLayout = document.getElementById('app-layout');
  const onboardingContainer = document.getElementById('onboarding-container');
  const screenContainer = document.getElementById('screen-container');

  if (screen.isFullscreen) {
    // Onboarding — hide app layout, show onboarding container
    if (appLayout) appLayout.style.display = 'none';
    if (onboardingContainer) {
      onboardingContainer.style.display = 'block';
      onboardingContainer.innerHTML = screen.render(params);
      await screen.mount(params);
    }
  } else {
    // Normal screen — show app layout, render sidebar + content
    if (onboardingContainer) onboardingContainer.style.display = 'none';
    if (appLayout) appLayout.style.display = 'flex';
    if (screenContainer) {
      screenContainer.innerHTML = screen.render(params);
      await screen.mount(params);
    }
    updateNavActive(screen.navId);
  }
}

// ---- Sidebar ----
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const name = appState.deviceName || 'NODE_ADMIN';
  const fp = appState.identity?.fingerprint || '----';

  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <span class="sidebar-logo">GHOSTWIRE</span>
    </div>

    <div class="sidebar-profile">
      <div class="sidebar-avatar">
        <span class="material-icons" style="font-size:18px">person</span>
      </div>
      <div class="sidebar-profile-info">
        <div class="sidebar-username">${name}</div>
        <div class="sidebar-role">ENCRYPTION_ACTIVE</div>
      </div>
    </div>

    <div class="sidebar-nav">
      <div class="nav-item" data-screen="discovery" id="nav-discovery">
        <span class="material-icons">wifi_tethering</span>
        DISCOVERY
      </div>
      <div class="nav-item" data-screen="messages" id="nav-messages">
        <span class="material-icons">lock</span>
        MESSAGES
      </div>
      <div class="nav-item" data-screen="voice_comms" id="nav-voice_comms">
        <span class="material-icons">settings_input_antenna</span>
        VOICE_COMMS
      </div>
      <div class="nav-item" data-screen="settings" id="nav-settings">
        <span class="material-icons">visibility_off</span>
        ANTI_TRACE
      </div>
    </div>

    <div class="sidebar-footer">
      <button class="sidebar-purge-btn" id="purge-logs-btn">PURGE_LOGS</button>
      <div class="sidebar-footer-link" id="nav-syslog">
        <span class="material-icons">database</span>
        SYSTEM_LOG
      </div>
      <div class="sidebar-footer-link" id="nav-exit">
        <span class="material-icons">power_settings_new</span>
        EXIT
      </div>
    </div>
  `;

  // Nav click handlers
  sidebar.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const screen = item.dataset.screen;
      if (screen && screen !== appState.currentScreen) {
        bus.emit(Events.NAVIGATE, { screen });
      }
    });
  });

  // Purge logs
  const purgeBtn = document.getElementById('purge-logs-btn');
  if (purgeBtn) {
    purgeBtn.addEventListener('click', () => {
      bus.emit(Events.TOAST, { message: 'LOGS_PURGED: 0 ENTRIES REMAIN', type: 'default' });
    });
  }
}

function updateNavActive(navId) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.screen === navId);
  });
}

// ---- Data Stream (Matrix rain) ----
function initDataStream() {
  const streamEl = document.getElementById('data-stream-text');
  if (!streamEl) return;

  const chars = '0123456789ABCDEF';
  let text = '';
  for (let i = 0; i < 2000; i++) {
    text += chars[Math.floor(Math.random() * chars.length)];
    if (Math.random() < 0.05) text += '\n';
    else if (Math.random() < 0.1) text += ' ';
  }
  streamEl.textContent = text;
}

// ---- Toast System ----
function showToast(message, type = 'default') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast`;
  if (type === 'danger') {
    toast.style.borderLeft = '3px solid var(--danger)';
    toast.style.color = 'var(--danger)';
  }
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- Event Listeners ----
function setupEventListeners() {
  bus.on(Events.NAVIGATE, ({ screen, ...params }) => {
    navigateTo(screen, params);
  });

  bus.on(Events.TOAST, ({ message, type }) => {
    showToast(message, type);
  });

  if (window.ghostwire) {
    window.ghostwire.onPeerDiscovered?.((peer) => {
      bus.emit(Events.PEER_DISCOVERED, peer);
      showToast(`NODE_DISCOVERED: ${peer.displayName || 'UNKNOWN'}`, 'default');
    });

    window.ghostwire.onPeerLost?.((peerId) => {
      bus.emit(Events.PEER_LOST, peerId);
    });

    window.ghostwire.onMessageReceived?.((message) => {
      bus.emit(Events.MESSAGE_RECEIVED, message);
    });
  }
}

// ---- App Init ----
async function initApp() {
  console.log('%c⚡ GHOSTWIRE TERMINAL_NOCTURNE v2.1.4', 'color: #00FF41; font-weight: bold; font-size: 14px; font-family: monospace;');

  setupEventListeners();
  initDataStream();

  // Load identity from Electron
  if (window.ghostwire) {
    try {
      appState.identity = await window.ghostwire.getIdentity();
      appState.deviceName = await window.ghostwire.getDeviceName();
      appState.isOnboarded = await window.ghostwire.isOnboarded();
    } catch (err) {
      console.error('[App] Identity load failed:', err);
    }
  }

  // Render sidebar (even if hidden initially)
  renderSidebar();

  // Route
  if (appState.isOnboarded) {
    await navigateTo('messages');
  } else {
    await navigateTo('onboarding');
  }

  console.log('%c⚡ SYSTEM_READY // GHOSTWIRE_OPERATIONAL', 'color: #00FF41; font-weight: bold;');
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', initApp);
