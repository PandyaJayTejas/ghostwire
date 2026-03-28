// GhostWire — Terminal Nocturne Onboarding
import { bus, Events } from '../utils/events.js';

const MAX_NAME_LENGTH = 32;

const BOOT_LINES = [
  { text: '> BOOTING GHOSTWIRE_OS...', delay: 0 },
  { text: '> LOADING NETWORK_DRIVER...', delay: 200 },
  { text: '> ENCRYPTING LOCAL_STORAGE...', delay: 400 },
  { text: '> BYPASSING FIREWALL_A... DONE', delay: 600 },
  { text: '> BYPASSING FIREWALL_B... DONE', delay: 800 },
  { text: '> ROOT_ACCESS: GRANTED', delay: 1000 },
  { text: '> AWAITING OPERATOR IDENTITY_', delay: 1200 },
];

export function renderOnboarding() {
  return `
    <div class="onboarding-screen screen-enter" id="onboarding">
      <div class="onboarding-brand">
        <div class="onboarding-logo">GHOSTWIRE</div>
        <div class="onboarding-tagline">TERMINAL_NOCTURNE // SECURE_MESH_NETWORK</div>
        <div class="onboarding-version">v2.1.4 | BUILD_0x4A2F</div>
      </div>

      <div class="onboarding-boot" id="boot-sequence">
        ${BOOT_LINES.map((line, i) => `
          <div class="onboarding-boot-line" style="animation-delay: ${line.delay}ms">
            ${line.text}
          </div>
        `).join('')}
      </div>

      <form class="onboarding-form" id="onboarding-form">
        <div class="onboarding-input-group">
          <span class="onboarding-input-prefix">OPERATOR_ID&gt;</span>
          <input
            type="text"
            id="device-name-input"
            class="onboarding-input"
            placeholder="ENTER_CALLSIGN..."
            maxlength="${MAX_NAME_LENGTH}"
            autocomplete="off"
            spellcheck="false"
          />
          <div class="onboarding-cursor"></div>
        </div>
        <div class="onboarding-char-count" id="char-count">0 / ${MAX_NAME_LENGTH}</div>

        <div id="onboarding-error" class="onboarding-error" style="display:none"></div>

        <button type="submit" class="btn btn-primary btn-full onboarding-enter-btn" id="enter-btn" disabled>
          INITIALIZE_NODE →
        </button>
      </form>

      <div class="onboarding-footer">
        <div>NO_INTERNET // NO_SERVERS // ZERO_TRUST_ARCHITECTURE</div>
        <div class="onboarding-features">
          <span class="onboarding-feature">🔒 E2E_ENCRYPTED</span>
          <span class="onboarding-feature">📡 WIFI_MESH</span>
          <span class="onboarding-feature">🛡️ QUANTUM_RESISTANT</span>
        </div>
      </div>
    </div>
  `;
}

export function mountOnboarding() {
  const form = document.getElementById('onboarding-form');
  const input = document.getElementById('device-name-input');
  const charCount = document.getElementById('char-count');
  const enterBtn = document.getElementById('enter-btn');
  const errorDiv = document.getElementById('onboarding-error');

  if (!form || !input) return;

  // Focus input after boot sequence
  setTimeout(() => input.focus(), 1400);

  input.addEventListener('input', () => {
    const len = input.value.trim().length;
    charCount.textContent = `${len} / ${MAX_NAME_LENGTH}`;
    enterBtn.disabled = len < 2;
    if (len >= 2) errorDiv.style.display = 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = input.value.trim();

    if (name.length < 2) {
      errorDiv.textContent = 'ERR: CALLSIGN MUST BE >= 2 CHARS';
      errorDiv.style.display = 'block';
      return;
    }

    enterBtn.disabled = true;
    enterBtn.textContent = 'INITIALIZING_NODE...';

    try {
      if (window.ghostwire) {
        await window.ghostwire.completeOnboarding(name);
      }
      await new Promise((r) => setTimeout(r, 800));
      bus.emit(Events.NAVIGATE, { screen: 'messages', fromOnboarding: true });
    } catch (err) {
      console.error('[Onboarding] Error:', err);
      errorDiv.textContent = 'ERR: INITIALIZATION_FAILED. RETRY.';
      errorDiv.style.display = 'block';
      enterBtn.disabled = false;
      enterBtn.textContent = 'INITIALIZE_NODE →';
    }
  });
}

export function unmountOnboarding() {}
