// GhostWire — Anti-Trace / Settings Screen (matching Stitch design)
import { bus, Events } from '../utils/events.js';
import { escapeHtml } from '../utils/helpers.js';

export function renderSettings() {
  return `
    <div class="settings-layout screen-enter" id="settings-screen">
      <!-- Main Settings Area -->
      <div class="settings-main">
        <h1 class="settings-title">ANTI_TRACEABILITY</h1>
        <div class="settings-subtitle">
          <div class="settings-subtitle-bar"></div>
          GHOSTWIRE NETWORK PROTOCOL v4.2.0
        </div>

        <!-- Onion Routing -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-title">ONION_ROUTING</div>
            <div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span class="toggle-label-status active">ACTIVE</span>
              <div class="toggle active" id="toggle-onion">
                <div class="toggle-knob"></div>
              </div>
            </div>
          </div>
          <div class="settings-card-desc">
            Multi-layered encryption routing through fluctuating global nodes. Latency impact: +140ms.
          </div>
          <div class="progress-bar" style="margin-top:var(--sp-4);">
            <div class="progress-fill" style="width:85%"></div>
          </div>
        </div>

        <!-- Traffic Padding -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-title">TRAFFIC_PADDING</div>
            <div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span class="toggle-label-status inactive">STBY</span>
              <div class="toggle" id="toggle-padding">
                <div class="toggle-knob"></div>
              </div>
            </div>
          </div>
          <div class="settings-card-desc">
            Injects noise packets to mask behavioral patterns and data burst timing.
          </div>
        </div>

        <!-- No IP Logging -->
        <div class="settings-card">
          <div class="settings-card-header">
            <div class="settings-card-title">NO_IP_LOGGING</div>
            <div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span class="toggle-label-status active">ENABLED</span>
              <div class="toggle active" id="toggle-nolog">
                <div class="toggle-knob"></div>
              </div>
            </div>
          </div>
          <div class="settings-card-desc">
            Force-disable all kernel-level connection history and metadata retention.
          </div>
        </div>

        <!-- Device Identity Section -->
        <div class="settings-card" style="margin-top:var(--sp-8);">
          <div class="settings-card-title" style="margin-bottom:var(--sp-4);">DEVICE_IDENTITY</div>
          <div class="stat-row">
            <span class="stat-label">OPERATOR_NAME</span>
            <span class="stat-value" id="settings-name">---</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">FINGERPRINT</span>
            <span class="stat-value" id="settings-fp">----</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">IP_ADDRESS</span>
            <span class="stat-value" id="settings-ip">---</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">HOSTNAME</span>
            <span class="stat-value" id="settings-hostname">---</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">ENCRYPTION</span>
            <span class="stat-value" style="color:var(--secondary)">XSalsa20-Poly1305</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">KEY_EXCHANGE</span>
            <span class="stat-value" style="color:var(--secondary)">X25519_ECDH</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">SIGNATURES</span>
            <span class="stat-value" style="color:var(--secondary)">Ed25519</span>
          </div>
        </div>

        <!-- System Entropy & Threat -->
        <div class="system-entropy-row">
          <div class="entropy-block">
            <div class="entropy-label">SYSTEM_ENTROPY</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:80%"></div>
            </div>
          </div>
          <div class="entropy-block">
            <div class="entropy-label">THREAT_VECTOR</div>
            <div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span class="stat-value" style="font-size:var(--text-label);">80%</span>
              <span class="badge badge-outline" style="color:var(--secondary);box-shadow:inset 0 0 0 1px var(--secondary);">
                NOMINAL / NO_LEAKS_DETECTED
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Sidebar -->
      <div class="settings-sidebar">
        <!-- Global Visibility -->
        <div class="settings-visibility-card">
          <div class="settings-visibility-label">GLOBAL_VISIBILITY</div>
          <div class="settings-visibility-status">STATUS: ZERO</div>
        </div>

        <!-- Radar Map -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-2);">
            <span class="section-title" style="margin:0;font-size:var(--text-label-sm);">NODE_SIGNAL_MAP</span>
            <span style="font-family:var(--font-mono);font-size:var(--text-micro);color:var(--text-ghost);">41225_PLX</span>
          </div>
          <div class="radar-container">
            <div class="radar-grid"></div>
            <div class="radar-sweep"></div>
            <div class="radar-center"></div>
          </div>
          <div class="hex-data" style="margin-top:var(--sp-2);">
            0x4A 0xBC 0x22 0x99 0xFF 0x01<br/>
            DECRYPTING_SEC_LAYER_07...<br/>
            TRACE_TIMEOUT_ERR_004<br/>
            RE-ROUTING_TO_NODE_04<br/>
            0x00 0x11 0xAA 0xBB 0xCC 0xDD
          </div>
        </div>

        <!-- PANIC WIPE -->
        <button class="panic-wipe-btn" id="panic-wipe-btn">
          <span class="material-icons">warning</span>
          <span class="panic-wipe-title">PANIC WIPE</span>
          <span class="panic-wipe-desc">IMMEDIATE DATA VOLATILIZATION</span>
        </button>
      </div>
    </div>
  `;
}

export async function mountSettings() {
  const nameEl = document.getElementById('settings-name');
  const fpEl = document.getElementById('settings-fp');
  const ipEl = document.getElementById('settings-ip');
  const hostnameEl = document.getElementById('settings-hostname');

  if (window.ghostwire) {
    try {
      const identity = await window.ghostwire.getIdentity();
      const deviceName = await window.ghostwire.getDeviceName();
      const networkInfo = await window.ghostwire.getNetworkInfo();

      if (nameEl) nameEl.textContent = deviceName || 'UNKNOWN';
      if (fpEl) fpEl.textContent = identity.fingerprint;
      if (ipEl && networkInfo.addresses.length > 0) {
        ipEl.textContent = networkInfo.addresses[0].address;
      }
      if (hostnameEl) hostnameEl.textContent = networkInfo.hostname;
    } catch (err) {
      console.error('[Settings] Load failed:', err);
    }
  }

  // Toggle handlers
  document.querySelectorAll('.toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      // Update label
      const parent = toggle.closest('.settings-card-header');
      if (parent) {
        const label = parent.querySelector('.toggle-label-status');
        if (label) {
          if (toggle.classList.contains('active')) {
            label.textContent = 'ACTIVE';
            label.className = 'toggle-label-status active';
          } else {
            label.textContent = 'STBY';
            label.className = 'toggle-label-status inactive';
          }
        }
      }
    });
  });

  // Panic wipe
  const panicBtn = document.getElementById('panic-wipe-btn');
  if (panicBtn) {
    panicBtn.addEventListener('click', () => {
      bus.emit(Events.TOAST, { message: 'PANIC_WIPE: NOT_IMPLEMENTED (DEMO_MODE)', type: 'danger' });
    });
  }
}

export function unmountSettings() {}
