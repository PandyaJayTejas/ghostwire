// GhostWire — Discovery Screen (Live mDNS + Manual IP Connect)
import { bus, Events } from '../utils/events.js';
import { getInitials, escapeHtml } from '../utils/helpers.js';

let peerRefreshInterval = null;
let removePeerDiscovered = null;
let removePeerLost = null;

export function renderDiscovery() {
  return `
    <div class="discovery-screen screen-enter" id="discovery-screen">
      <div class="discovery-header">
        <h1 class="discovery-title">NODE_DISCOVERY</h1>
        <div class="discovery-scan-status">
          <span class="discovery-scan-dot"></span>
          <span id="scan-status-text">SCANNING_SUBNET...</span>
        </div>
      </div>

      <div class="discovery-grid">
        <!-- Peers -->
        <div>
          <div class="section-title" id="peers-count-title">ACTIVE_NODES (0)</div>
          <div class="discovery-peers-section" id="peers-list"></div>
          <div class="empty-state" id="discovery-empty" style="padding-top:var(--sp-8);">
            <div class="empty-state-icon" style="font-size:var(--text-display-md);">📡</div>
            <div class="empty-state-title">SCANNING_FOR_NODES</div>
            <div class="empty-state-desc">
              Probing local network for GhostWire nodes. Ensure other devices are running GhostWire on the same subnet.
            </div>
          </div>

          <!-- Manual IP Connect -->
          <div class="manual-connect-section">
            <div class="section-title">MANUAL_CONNECT</div>
            <div class="manual-connect-form">
              <span class="manual-connect-prefix">IP&gt;</span>
              <input type="text" class="input" id="manual-ip-input" placeholder="192.168.X.X" autocomplete="off" spellcheck="false" />
              <span class="manual-connect-prefix">PORT&gt;</span>
              <input type="text" class="input" id="manual-port-input" placeholder="3848" value="3848" autocomplete="off" style="max-width:80px;" />
              <button class="btn btn-primary btn-sm" id="manual-connect-btn">CONNECT</button>
            </div>
          </div>
        </div>

        <!-- Network Info + Radar -->
        <div style="display:flex; flex-direction:column; gap:var(--sp-5);">
          <!-- Radar -->
          <div>
            <div class="section-title">SIGNAL_RADAR</div>
            <div class="radar-container" style="width:100%;height:240px;">
              <div class="radar-grid"></div>
              <div class="radar-sweep"></div>
              <div class="radar-center"></div>
              <div id="radar-dots"></div>
            </div>
          </div>

          <!-- Network Info -->
          <div>
            <div class="section-title">NETWORK_TELEMETRY</div>
            <div style="background:var(--bg-container-low); padding:var(--sp-4);">
              <div class="stat-row">
                <span class="stat-label">HOSTNAME</span>
                <span class="stat-value" id="net-hostname">---</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">PLATFORM</span>
                <span class="stat-value" id="net-platform">---</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">PRIMARY_IP</span>
                <span class="stat-value" id="net-ip">---</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">WS_PORT</span>
                <span class="stat-value">3848</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">PROTOCOL</span>
                <span class="stat-value">mDNS_TCP+WS</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">DISCOVERED_PEERS</span>
                <span class="stat-value" id="net-peer-count">0</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">NODE_STATUS</span>
                <span class="badge badge-primary" id="net-status-badge">BROADCASTING</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function mountDiscovery() {
  const peersList = document.getElementById('peers-list');
  const emptyEl = document.getElementById('discovery-empty');
  const hostnameEl = document.getElementById('net-hostname');
  const platformEl = document.getElementById('net-platform');
  const ipEl = document.getElementById('net-ip');
  const peerCountEl = document.getElementById('net-peer-count');
  const countTitle = document.getElementById('peers-count-title');
  const scanStatus = document.getElementById('scan-status-text');

  // Load network info
  if (window.ghostwire) {
    try {
      const info = await window.ghostwire.getNetworkInfo();
      if (hostnameEl) hostnameEl.textContent = info.hostname;
      if (platformEl) platformEl.textContent = info.platform;
      if (ipEl && info.addresses.length > 0) {
        ipEl.textContent = info.addresses[0].address;
      }
      if (peerCountEl) peerCountEl.textContent = info.peerCount || 0;
    } catch (err) {
      console.error('[Discovery] Network info failed:', err);
    }

    // Initial peer load
    await refreshPeers(peersList, emptyEl, countTitle, peerCountEl);

    // Listen for live peer events
    removePeerDiscovered = bus.on(Events.PEER_DISCOVERED, () => {
      refreshPeers(peersList, emptyEl, countTitle, peerCountEl);
    });

    removePeerLost = bus.on(Events.PEER_LOST, () => {
      refreshPeers(peersList, emptyEl, countTitle, peerCountEl);
    });

    // Periodic refresh
    peerRefreshInterval = setInterval(() => {
      refreshPeers(peersList, emptyEl, countTitle, peerCountEl);
    }, 5000);
  }

  // Manual IP connect
  const connectBtn = document.getElementById('manual-connect-btn');
  const ipInput = document.getElementById('manual-ip-input');
  const portInput = document.getElementById('manual-port-input');

  if (connectBtn && ipInput) {
    const doConnect = async () => {
      const ip = ipInput.value.trim();
      const port = parseInt(portInput?.value.trim()) || 3848;

      if (!ip) {
        bus.emit(Events.TOAST, { message: 'ERR: IP_ADDRESS_REQUIRED', type: 'danger' });
        return;
      }

      connectBtn.textContent = 'CONNECTING...';
      connectBtn.disabled = true;

      try {
        const result = await window.ghostwire.connectByIp(ip, port);
        if (result.success) {
          bus.emit(Events.TOAST, { message: `CONNECTED: ${ip}:${port}`, type: 'default' });
          await refreshPeers(peersList, emptyEl, countTitle, peerCountEl);
        } else {
          bus.emit(Events.TOAST, { message: `FAILED: ${result.error || 'CONNECTION_REFUSED'}`, type: 'danger' });
        }
      } catch (err) {
        bus.emit(Events.TOAST, { message: `ERR: ${err.message}`, type: 'danger' });
      }

      connectBtn.textContent = 'CONNECT';
      connectBtn.disabled = false;
    };

    connectBtn.addEventListener('click', doConnect);
    ipInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doConnect();
    });
  }
}

async function refreshPeers(peersList, emptyEl, countTitle, peerCountEl) {
  if (!window.ghostwire || !peersList) return;

  try {
    const peers = await window.ghostwire.getPeers();
    const peerList = Object.values(peers);

    if (peerCountEl) peerCountEl.textContent = peerList.length;
    if (countTitle) countTitle.textContent = `ACTIVE_NODES (${peerList.length})`;

    if (peerList.length > 0) {
      if (emptyEl) emptyEl.style.display = 'none';

      peersList.innerHTML = peerList.map((peer, i) => {
        const name = peer.displayName || peer.hostname || 'UNKNOWN_NODE';
        const fp = peer.fingerprint || '0x----';
        const initials = getInitials(name);
        const isConnected = peer.isConnected || peer.status === 'connected';
        const statusClass = isConnected ? 'online' : 'offline';
        const addr = peer.addresses?.[0] || peer.address || '---';

        return `
          <div class="peer-card" data-peer-id="${escapeHtml(fp)}" style="animation: fadeInUp var(--duration-normal) var(--ease-out) ${i * 80}ms both;">
            <div class="peer-avatar">
              ${initials}
              <span class="status-dot ${statusClass}"></span>
            </div>
            <div class="peer-info">
              <div class="peer-name">${escapeHtml(name)}</div>
              <div class="peer-fingerprint">ID: ${escapeHtml(fp.substring(0, 16))}${fp.length > 16 ? '...' : ''}</div>
              <div class="peer-fingerprint">${escapeHtml(addr)}</div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:var(--sp-1);">
              <span class="badge ${isConnected ? 'badge-primary' : 'badge-outline'}" style="font-size:var(--text-micro);">
                ${isConnected ? 'CONNECTED' : 'DISCOVERED'}
              </span>
              <div class="peer-signal">
                <span style="height:4px"></span>
                <span style="height:8px"></span>
                <span style="height:12px"></span>
                ${isConnected ? '<span style="height:16px"></span>' : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Radar dots
      const radarDots = document.getElementById('radar-dots');
      if (radarDots) {
        radarDots.innerHTML = peerList.map((_, i) => {
          const angle = (i / peerList.length) * Math.PI * 2;
          const radius = 30 + Math.random() * 50;
          const x = 50 + Math.cos(angle) * radius;
          const y = 50 + Math.sin(angle) * radius;
          return `<div style="position:absolute;left:${x}%;top:${y}%;width:6px;height:6px;background:var(--primary);box-shadow:0 0 8px var(--primary);transform:translate(-50%,-50%);animation:pulseGlow 2s ease infinite ${i * 0.5}s;"></div>`;
        }).join('');
      }

      // Click to message
      peersList.querySelectorAll('.peer-card').forEach((card) => {
        card.addEventListener('click', () => {
          const peerId = card.dataset.peerId;
          const peerName = card.querySelector('.peer-name')?.textContent;
          bus.emit(Events.NAVIGATE, { screen: 'messages', conversationId: peerId, peerName });
        });
      });
    } else {
      if (emptyEl) emptyEl.style.display = 'flex';
      peersList.innerHTML = '';
    }
  } catch (err) {
    console.error('[Discovery] Refresh failed:', err);
  }
}

export function unmountDiscovery() {
  if (peerRefreshInterval) {
    clearInterval(peerRefreshInterval);
    peerRefreshInterval = null;
  }
  if (removePeerDiscovered) removePeerDiscovered();
  if (removePeerLost) removePeerLost();
}
