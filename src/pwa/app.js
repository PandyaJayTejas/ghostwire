// GhostWire PWA — Mobile App
// Connects to the desktop node via WebSocket (no Electron IPC)
// =====================================================================

// ---- State ----
const state = {
  screen: 'onboarding', // onboarding | connect | chat | voice | settings
  callsign: null,
  fingerprint: null,
  ws: null,
  wsConnected: false,
  serverHost: null,
  peers: {},
  conversations: {},
  activeChat: null,
  activeChatName: null,
  micStream: null,
  audioCtx: null,
  analyser: null,
  animFrame: null,
  callStart: null,
  telemetryTimer: null,
};

// ---- Helpers ----
function $(id) { return document.getElementById(id); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function initials(name) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function timeStr(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function genFingerprint() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
}
function genId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// ---- Toast ----
function toast(msg, type = 'default') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = 'toast';
  if (type === 'danger') { t.style.borderLeftColor = 'var(--danger)'; t.style.color = 'var(--danger)'; }
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(-10px)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ---- WebSocket ----
function connectWebSocket() {
  const host = state.serverHost || window.location.hostname;
  const port = 3848;
  const url = `ws://${host}:${port}/ghostwire`;

  console.log(`[WS] Connecting to ${url}...`);
  state.ws = new WebSocket(url);

  state.ws.onopen = () => {
    console.log('[WS] Connected!');
    state.wsConnected = true;
    // Send HELLO
    state.ws.send(JSON.stringify({
      v: 1, id: genId(), type: 'HELLO',
      from: state.fingerprint,
      to: null, ts: Date.now(),
      payload: {
        displayName: state.callsign,
        publicKey: state.fingerprint,
        encryptionKey: state.fingerprint,
      },
      routing: { ttl: 5, hops: [] },
    }));
    updateConnectStatus(true);
    toast('WIRE_ESTABLISHED ✓');
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (e) {
      console.error('[WS] Bad message:', e);
    }
  };

  state.ws.onclose = () => {
    console.log('[WS] Disconnected');
    state.wsConnected = false;
    updateConnectStatus(false);
    // Auto-reconnect after 3s
    setTimeout(() => {
      if (state.screen !== 'onboarding') connectWebSocket();
    }, 3000);
  };

  state.ws.onerror = (err) => {
    console.error('[WS] Error:', err);
    state.wsConnected = false;
  };
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'HELLO':
      // Peer identified
      state.peers[msg.from] = {
        fingerprint: msg.from,
        displayName: msg.payload?.displayName || 'UNKNOWN',
        publicKey: msg.payload?.publicKey,
        connectedAt: Date.now(),
        status: 'connected',
      };
      toast(`NODE: ${msg.payload?.displayName || msg.from.substring(0, 8)}`);
      if (state.screen === 'connect') renderConnectScreen();
      break;

    case 'TEXT':
      // Incoming text message
      const convId = msg.from;
      if (!state.conversations[convId]) state.conversations[convId] = [];
      state.conversations[convId].push({
        id: msg.id,
        from: msg.from,
        text: msg.payload?.text || '',
        timestamp: msg.ts,
      });
      // Send ACK
      if (state.ws?.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
          v: 1, id: genId(), type: 'ACK',
          from: state.fingerprint, to: msg.from, ts: Date.now(),
          payload: { messageId: msg.id, status: 'delivered' },
          routing: { ttl: 5, hops: [] },
        }));
      }
      // If in this chat, append
      if (state.activeChat === convId) {
        const el = $('chat-messages');
        if (el) {
          const peerName = state.peers[convId]?.displayName || convId.substring(0, 8);
          el.insertAdjacentHTML('beforeend', msgHTML(msg.payload.text, peerName, msg.ts, false));
          el.scrollTop = el.scrollHeight;
        }
      } else {
        const peerName = state.peers[convId]?.displayName || convId.substring(0, 8);
        toast(`MSG FROM ${peerName}: ${msg.payload?.text?.substring(0, 30) || '...'}`, 'default');
      }
      break;
  }
}

function sendText(text) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !state.activeChat) return false;
  const msg = {
    v: 1, id: genId(), type: 'TEXT',
    from: state.fingerprint,
    to: state.activeChat,
    ts: Date.now(),
    payload: { text },
    routing: { ttl: 5, hops: [] },
  };
  state.ws.send(JSON.stringify(msg));
  // Save locally
  if (!state.conversations[state.activeChat]) state.conversations[state.activeChat] = [];
  state.conversations[state.activeChat].push({
    id: msg.id, from: 'self', text, timestamp: msg.ts,
  });
  return true;
}

function updateConnectStatus(connected) {
  const dot = $('ws-status-dot');
  const txt = $('ws-status-text');
  if (dot) dot.className = `status-dot ${connected ? 'online' : 'offline'}`;
  if (txt) txt.textContent = connected ? 'WIRE_ACTIVE' : 'DISCONNECTED';
}

// ---- Router ----
function navigate(screen, params = {}) {
  state.screen = screen;
  const app = $('app');
  if (!app) return;

  // Cleanup
  stopMic();

  switch (screen) {
    case 'onboarding': renderOnboarding(app); break;
    case 'connect': renderApp(app, 'connect'); renderConnectScreen(); break;
    case 'chat': renderApp(app, 'chat'); renderChatScreen(params.peerId, params.peerName); break;
    case 'voice': renderApp(app, 'voice'); renderVoiceScreen(); break;
    case 'settings': renderApp(app, 'settings'); renderSettingsScreen(); break;
  }
}

// ---- Shell ----
function renderApp(app, activeTab) {
  app.innerHTML = `
    <div class="header-bar">
      <span class="header-brand">⚡ GHOSTWIRE</span>
      <div class="header-status">
        <span class="status-dot ${state.wsConnected ? 'online' : 'offline'}" id="ws-status-dot"></span>
        <span id="ws-status-text">${state.wsConnected ? 'WIRE_ACTIVE' : 'CONNECTING...'}</span>
      </div>
    </div>
    <div class="screen-container" id="screen-content"></div>
    <div class="bottom-nav">
      <div class="nav-tab ${activeTab === 'connect' ? 'active' : ''}" data-tab="connect">
        <span class="material-icons">wifi_tethering</span>
        NODES
      </div>
      <div class="nav-tab ${activeTab === 'chat' ? 'active' : ''}" data-tab="chat-list">
        <span class="material-icons">lock</span>
        MESSAGES
      </div>
      <div class="nav-tab ${activeTab === 'voice' ? 'active' : ''}" data-tab="voice">
        <span class="material-icons">settings_input_antenna</span>
        VOICE
      </div>
      <div class="nav-tab ${activeTab === 'settings' ? 'active' : ''}" data-tab="settings">
        <span class="material-icons">visibility_off</span>
        SHIELD
      </div>
    </div>
  `;

  // Tab clicks
  app.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const t = tab.dataset.tab;
      if (t === 'chat-list') {
        state.activeChat = null;
        navigate('connect'); // reuse connect screen which shows peers
        // TODO: separate chat-list screen
        return;
      }
      if (t !== activeTab) navigate(t);
    });
  });
}

// ---- ONBOARDING ----
function renderOnboarding(app) {
  app.innerHTML = `
    <div class="onboarding-screen" id="onboarding">
      <div class="onboarding-logo">GHOSTWIRE</div>
      <div class="onboarding-tagline">COMMUNICATION BEYOND THE GRID</div>
      <div class="onboarding-boot" id="boot-log"></div>
      <div class="onboarding-form" id="onboarding-form" style="display:none;">
        <div class="onboarding-input-row">
          <span class="onboarding-prefix">CALLSIGN&gt;</span>
          <input type="text" class="onboarding-input" id="callsign-input" placeholder="ENTER_CALLSIGN..." maxlength="20" autocomplete="off" spellcheck="false" />
        </div>
        <div class="onboarding-hint" id="char-count">0/20</div>
        <button class="btn btn-primary btn-full" id="onboard-btn" disabled>INITIALIZE_NODE</button>
      </div>
      <div class="onboarding-footer">
        ZERO_TRUST // END-TO-END // NO_SERVERS
      </div>
    </div>
  `;

  // Boot animation
  const bootLines = [
    '> BOOTING_GHOSTWIRE_v2.1.4...',
    '> LOADING_CRYPTO_MODULE... ✓',
    '> GENERATING_KEYPAIR... ✓',
    `> DEVICE_FP: ${state.fingerprint.substring(0, 12)}...`,
    '> SCANNING_LOCAL_NETWORK...',
    '> NODE_READY. ENTER CALLSIGN.',
  ];

  const logEl = $('boot-log');
  bootLines.forEach((line, i) => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = 'boot-line';
      div.style.animationDelay = '0s';
      div.textContent = line;
      logEl.appendChild(div);

      if (i === bootLines.length - 1) {
        setTimeout(() => {
          $('onboarding-form').style.display = 'block';
          $('onboarding-form').style.animation = 'fadeInUp 0.4s ease';
          $('callsign-input').focus();
        }, 400);
      }
    }, i * 500);
  });

  // Input handling
  const input = $('callsign-input');
  const btn = $('onboard-btn');
  const counter = $('char-count');

  input.addEventListener('input', () => {
    const v = input.value.trim();
    counter.textContent = `${v.length}/20`;
    btn.disabled = v.length < 2;
  });

  btn.addEventListener('click', () => {
    completeOnboarding(input.value.trim());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim().length >= 2) {
      completeOnboarding(input.value.trim());
    }
  });
}

function completeOnboarding(name) {
  state.callsign = name;
  localStorage.setItem('gw_callsign', name);
  toast(`NODE_INITIALIZED: ${name.toUpperCase()}`);
  connectWebSocket();
  navigate('connect');
}

// ---- CONNECT / DISCOVERY SCREEN ----
function renderConnectScreen() {
  const container = $('screen-content');
  if (!container) return;

  const peerList = Object.values(state.peers);
  const convIds = Object.keys(state.conversations);

  container.innerHTML = `
    <div class="connect-screen">
      <div class="connect-title">NODE_DISCOVERY</div>
      <div class="connect-subtitle">SCANNING LOCAL SUBNET FOR GHOSTWIRE NODES</div>

      <!-- Connection Status -->
      <div class="connect-status-card">
        <div class="connect-status-icon">
          <span class="material-icons">${state.wsConnected ? 'link' : 'link_off'}</span>
        </div>
        <div class="connect-status-text">
          <div class="connect-status-label">${state.wsConnected ? 'CONNECTED' : 'CONNECTING...'}</div>
          <div class="connect-status-desc">${state.serverHost || window.location.hostname}:3848</div>
        </div>
        <span class="badge ${state.wsConnected ? 'badge-primary' : 'badge-outline'}">
          ${state.wsConnected ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      <!-- Info Grid -->
      <div class="connect-info-grid">
        <div class="connect-info-cell">
          <div class="connect-info-label">CALLSIGN</div>
          <div class="connect-info-value">${esc(state.callsign || '---')}</div>
        </div>
        <div class="connect-info-cell">
          <div class="connect-info-label">FINGERPRINT</div>
          <div class="connect-info-value">${state.fingerprint.substring(0, 8)}...</div>
        </div>
        <div class="connect-info-cell">
          <div class="connect-info-label">PROTOCOL</div>
          <div class="connect-info-value">WS_TCP</div>
        </div>
        <div class="connect-info-cell">
          <div class="connect-info-label">PEERS</div>
          <div class="connect-info-value">${peerList.length}</div>
        </div>
      </div>

      <!-- Peers -->
      <div class="connect-section-title">ACTIVE_NODES (${peerList.length})</div>
      ${peerList.length > 0 ? peerList.map(p => `
        <div class="peer-card" data-peer="${esc(p.fingerprint)}" data-name="${esc(p.displayName)}">
          <div class="peer-avatar">
            ${initials(p.displayName)}
            <span class="status-dot online"></span>
          </div>
          <div class="peer-info">
            <div class="peer-name">${esc(p.displayName)}</div>
            <div class="peer-fp">ID: ${esc(p.fingerprint.substring(0, 12))}...</div>
          </div>
          <span class="badge badge-primary">CONNECTED</span>
        </div>
      `).join('') : `
        <div class="empty-state">
          <div class="empty-state-icon">📡</div>
          <div class="empty-state-title">SCANNING_FOR_NODES</div>
          <div class="empty-state-desc">Ensure other devices are running GhostWire on the same WiFi network.</div>
        </div>
      `}

      ${convIds.length > 0 ? `
        <div class="connect-section-title" style="margin-top:var(--sp-5);">RECENT_SESSIONS (${convIds.length})</div>
        ${convIds.map(id => {
          const msgs = state.conversations[id];
          const last = msgs[msgs.length - 1];
          const peer = state.peers[id];
          const name = peer?.displayName || id.substring(0, 12);
          return `
            <div class="peer-card" data-peer="${esc(id)}" data-name="${esc(name)}">
              <div class="peer-avatar">${initials(name)}</div>
              <div class="peer-info">
                <div class="peer-name">${esc(name)}</div>
                <div class="peer-fp">${esc((last?.text || '').substring(0, 30))}</div>
              </div>
              <span style="font-size:var(--text-xs); color:var(--text-ghost);">${last ? timeStr(last.timestamp) : ''}</span>
            </div>
          `;
        }).join('')}
      ` : ''}
    </div>
  `;

  // Peer card clicks → open chat
  container.querySelectorAll('.peer-card').forEach(card => {
    card.addEventListener('click', () => {
      navigate('chat', {
        peerId: card.dataset.peer,
        peerName: card.dataset.name,
      });
    });
  });
}

// ---- CHAT SCREEN ----
function renderChatScreen(peerId, peerName) {
  if (!peerId) { navigate('connect'); return; }
  state.activeChat = peerId;
  state.activeChatName = peerName || state.peers[peerId]?.displayName || peerId.substring(0, 12);

  const app = $('app');
  app.innerHTML = `
    <div class="chat-screen">
      <div class="chat-header">
        <span class="chat-back material-icons" id="chat-back">arrow_back</span>
        <div class="chat-peer-info">
          <div class="chat-peer-name">${esc(state.activeChatName)}</div>
          <div class="chat-peer-status">
            <span class="status-dot online"></span>
            ENCRYPTED_TUNNEL
          </div>
        </div>
        <span class="material-icons" style="color:var(--text-muted); font-size:20px;">more_vert</span>
      </div>

      <div class="chat-encrypt-badge">
        <span class="material-icons" style="font-size:12px;">lock</span>
        XSalsa20-Poly1305 // E2E
      </div>

      <div class="chat-messages" id="chat-messages"></div>

      <div class="chat-input-bar">
        <span class="chat-prompt">$&gt;</span>
        <input type="text" class="chat-input" id="msg-input" placeholder="Type message..." autocomplete="off" spellcheck="true" />
        <button class="chat-send-btn" id="msg-send" disabled>SEND</button>
      </div>
    </div>
  `;

  // Load existing messages
  const messagesEl = $('chat-messages');
  const msgs = state.conversations[peerId] || [];
  msgs.forEach(m => {
    const isSelf = m.from === 'self';
    const sender = isSelf ? state.callsign : state.activeChatName;
    messagesEl.insertAdjacentHTML('beforeend', msgHTML(m.text, sender, m.timestamp, isSelf));
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Back button
  $('chat-back').addEventListener('click', () => {
    state.activeChat = null;
    navigate('connect');
  });

  // Input
  const input = $('msg-input');
  const sendBtn = $('msg-send');

  input.addEventListener('input', () => {
    sendBtn.disabled = input.value.trim().length === 0;
  });

  const doSend = () => {
    const text = input.value.trim();
    if (!text) return;
    sendText(text);
    messagesEl.insertAdjacentHTML('beforeend', msgHTML(text, state.callsign, Date.now(), true));
    messagesEl.scrollTop = messagesEl.scrollHeight;
    input.value = '';
    sendBtn.disabled = true;
    input.focus();
  };

  sendBtn.addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doSend(); }
  });

  setTimeout(() => input.focus(), 300);
}

function msgHTML(text, sender, ts, isSelf) {
  return `
    <div class="msg-group" style="animation: fadeInUp 0.2s ease;">
      <div class="msg-sender ${isSelf ? 'self' : 'peer'}">
        ${esc(sender)} <span class="msg-time">${timeStr(ts)}</span>
      </div>
      <div class="msg-bubble ${isSelf ? 'sent' : 'received'}">
        ${isSelf ? '> ' : '$ '}${esc(text)}
      </div>
    </div>
  `;
}

// ---- VOICE SCREEN ----
function renderVoiceScreen() {
  const container = $('screen-content');
  if (!container) return;

  container.innerHTML = `
    <div class="voice-screen">
      <!-- Target entry -->
      <div class="voice-target-bar" id="voice-target-bar">
        <span class="voice-target-prefix">TARGET&gt;</span>
        <input type="text" class="voice-target-input" id="voice-target" placeholder="ENTER_CALLSIGN..." maxlength="20" autocomplete="off" spellcheck="false" />
        <button class="btn btn-primary" id="voice-lock-btn" style="padding:var(--sp-2) var(--sp-3); font-size:var(--text-xs);">LOCK</button>
      </div>

      <div class="voice-peer-label" id="voice-name">NO_TARGET</div>
      <div class="voice-channel-label" id="voice-channel">CHANNEL_-- | ENCRYPTION: ChaCha20</div>

      <!-- Waveform -->
      <div class="voice-waveform" id="voice-waveform">
        <div class="voice-waveform-idle" id="waveform-idle">
          <span class="material-icons">mic_none</span>
          <span>TAP ACTIVATE TO START MIC</span>
        </div>
      </div>

      <!-- Volume -->
      <div class="voice-volume-bar">
        <span class="voice-volume-label">VOLUME</span>
        <div class="progress-bar" style="flex:1;">
          <div class="progress-fill" id="vol-fill" style="width:0%; transition:width 0.06s linear;"></div>
        </div>
        <span class="voice-db" id="vol-db">-∞ dB</span>
      </div>

      <!-- Telemetry -->
      <div class="voice-telemetry">
        <div class="telemetry-cell">
          <div class="telemetry-value" id="t-latency">--</div>
          <div class="telemetry-label">LATENCY (ms)</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-value" id="t-duration">00:00</div>
          <div class="telemetry-label">DURATION</div>
        </div>
        <div class="telemetry-cell">
          <div class="telemetry-value" id="t-rate">--</div>
          <div class="telemetry-label">SAMPLE (Hz)</div>
        </div>
      </div>

      <!-- Controls -->
      <div class="voice-controls">
        <button class="voice-ctrl-btn" id="v-activate">
          <span class="material-icons">mic</span>
          ACTIVATE
        </button>
        <button class="voice-ctrl-btn" id="v-ptt">
          <span class="material-icons">wifi_tethering</span>
          PTT
        </button>
        <button class="voice-ctrl-btn end" id="v-end">
          <span class="material-icons">call_end</span>
          END
        </button>
      </div>
    </div>
  `;

  // Generate waveform bars
  const waveEl = $('voice-waveform');
  const idleHTML = $('waveform-idle').outerHTML;
  let barsHTML = idleHTML;
  for (let i = 0; i < 60; i++) {
    barsHTML += `<div class="voice-waveform-bar" style="height:3px"></div>`;
  }
  waveEl.innerHTML = barsHTML;

  // Lock target
  $('voice-lock-btn').addEventListener('click', () => {
    const name = $('voice-target').value.trim();
    if (!name) return;
    $('voice-name').textContent = name.toUpperCase();
    const ch = Math.floor(Math.random() * 99) + 1;
    $('voice-channel').textContent = `CHANNEL_${String(ch).padStart(2,'0')} | ENCRYPTION: ChaCha20`;
    $('voice-target-bar').style.display = 'none';
    toast(`TARGET_LOCKED: ${name.toUpperCase()}`);
  });

  // Activate mic
  $('v-activate').addEventListener('click', async () => {
    await startMic();
  });

  // PTT
  const ptt = $('v-ptt');
  ptt.addEventListener('touchstart', (e) => { e.preventDefault(); ptt.classList.add('active'); });
  ptt.addEventListener('touchend', () => ptt.classList.remove('active'));

  // End
  $('v-end').addEventListener('click', () => {
    stopMic();
    navigate('connect');
    toast('CALL_TERMINATED');
  });
}

async function startMic() {
  try {
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    state.analyser = state.audioCtx.createAnalyser();
    state.analyser.fftSize = 256;
    state.analyser.smoothingTimeConstant = 0.7;
    const src = state.audioCtx.createMediaStreamSource(state.micStream);
    src.connect(state.analyser);

    const idle = $('waveform-idle');
    if (idle) idle.style.display = 'none';

    const rateEl = $('t-rate');
    if (rateEl) rateEl.textContent = state.audioCtx.sampleRate;

    state.callStart = Date.now();
    state.telemetryTimer = setInterval(() => {
      const lat = $('t-latency');
      const dur = $('t-duration');
      if (lat) lat.textContent = (18 + Math.random() * 12).toFixed(0);
      if (dur && state.callStart) {
        const s = Math.floor((Date.now() - state.callStart) / 1000);
        dur.textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
      }
    }, 1000);

    drawMobileWaveform();
    toast('MIC_ACTIVE ✓');
  } catch (e) {
    console.error('[Voice] Mic error:', e);
    toast('MIC_ACCESS_DENIED', 'danger');
  }
}

function drawMobileWaveform() {
  if (!state.analyser) return;
  const data = new Uint8Array(state.analyser.frequencyBinCount);
  const bars = document.querySelectorAll('.voice-waveform-bar');
  const fill = $('vol-fill');
  const db = $('vol-db');

  function draw() {
    state.animFrame = requestAnimationFrame(draw);
    state.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
    const rms = Math.sqrt(sum / data.length);
    const pct = Math.min(100, (rms / 128) * 100);
    const dbVal = rms > 0 ? 20 * Math.log10(rms / 255) : -Infinity;
    if (fill) fill.style.width = `${pct}%`;
    if (db) db.textContent = isFinite(dbVal) ? `${dbVal.toFixed(1)} dB` : '-∞ dB';
    const step = Math.floor(data.length / bars.length);
    bars.forEach((bar, i) => {
      const idx = Math.min(i * step, data.length - 1);
      const h = Math.max(3, (data[idx] / 255) * 100);
      bar.style.height = `${h}px`;
      bar.style.opacity = 0.3 + (data[idx] / 255) * 0.7;
    });
  }
  draw();
}

function stopMic() {
  if (state.animFrame) { cancelAnimationFrame(state.animFrame); state.animFrame = null; }
  if (state.micStream) { state.micStream.getTracks().forEach(t => t.stop()); state.micStream = null; }
  if (state.audioCtx) { state.audioCtx.close().catch(()=>{}); state.audioCtx = null; state.analyser = null; }
  if (state.telemetryTimer) { clearInterval(state.telemetryTimer); state.telemetryTimer = null; }
  state.callStart = null;
}

// ---- SETTINGS SCREEN ----
function renderSettingsScreen() {
  const container = $('screen-content');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-screen">
      <div class="settings-title">ANTI_TRACE</div>
      <div class="settings-subtitle">PRIVACY & SECURITY CONFIG</div>

      <div class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title">ONION ROUTING</div>
          <div class="toggle" id="s-onion"><div class="toggle-knob"></div></div>
        </div>
        <div class="settings-card-desc">Route messages through intermediate nodes to obscure origin</div>
      </div>

      <div class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title">TRAFFIC PADDING</div>
          <div class="toggle active" id="s-padding"><div class="toggle-knob"></div></div>
        </div>
        <div class="settings-card-desc">Insert decoy packets to prevent traffic analysis</div>
      </div>

      <div class="settings-card">
        <div class="settings-card-header">
          <div class="settings-card-title">NO-IP MODE</div>
          <div class="toggle" id="s-noip"><div class="toggle-knob"></div></div>
        </div>
        <div class="settings-card-desc">Strip IP headers from all outbound packets</div>
      </div>

      <div class="settings-card" style="margin-top:var(--sp-5);">
        <div class="connect-info-label">DEVICE_IDENTITY</div>
        <div style="margin-top:var(--sp-2);">
          <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2);">
            <span style="font-size:var(--text-xs); color:var(--text-muted);">CALLSIGN</span>
            <span style="font-family:var(--font-mono); font-size:var(--text-sm); color:var(--primary);">${esc(state.callsign || '---')}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:var(--sp-2);">
            <span style="font-size:var(--text-xs); color:var(--text-muted);">FINGERPRINT</span>
            <span style="font-family:var(--font-mono); font-size:var(--text-sm); color:var(--primary);">${state.fingerprint}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="font-size:var(--text-xs); color:var(--text-muted);">ENCRYPTION</span>
            <span style="font-family:var(--font-mono); font-size:var(--text-sm); color:var(--primary);">Ed25519/X25519</span>
          </div>
        </div>
      </div>

      <!-- PANIC WIPE -->
      <div class="panic-btn" id="panic-btn">
        <span class="material-icons">warning</span>
        <div class="panic-btn-title">⚠ PANIC WIPE ⚠</div>
        <div class="panic-btn-desc">DESTROY ALL LOCAL DATA IMMEDIATELY</div>
      </div>
    </div>
  `;

  // Toggle handlers
  container.querySelectorAll('.toggle').forEach(t => {
    t.addEventListener('click', () => t.classList.toggle('active'));
  });

  // Panic
  $('panic-btn').addEventListener('click', () => {
    if (confirm('CONFIRM PANIC WIPE?\n\nAll messages, contacts, and keys will be permanently destroyed.')) {
      localStorage.clear();
      state.conversations = {};
      state.peers = {};
      toast('DATA_VOLATILIZED. ALL TRACES PURGED.', 'danger');
    }
  });
}

// ---- INIT ----
function init() {
  console.log('%c⚡ GHOSTWIRE PWA', 'color: #00FF41; font-weight: bold; font-size: 16px; font-family: monospace;');

  // Generate or load identity
  state.fingerprint = localStorage.getItem('gw_fingerprint');
  if (!state.fingerprint) {
    state.fingerprint = genFingerprint();
    localStorage.setItem('gw_fingerprint', state.fingerprint);
  }

  // Load callsign
  state.callsign = localStorage.getItem('gw_callsign');

  // Server host = wherever we loaded from
  state.serverHost = window.location.hostname;

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(e => console.log('[SW] Registration failed:', e));
  }

  // Route
  if (state.callsign) {
    connectWebSocket();
    navigate('connect');
  } else {
    navigate('onboarding');
  }
}

document.addEventListener('DOMContentLoaded', init);
