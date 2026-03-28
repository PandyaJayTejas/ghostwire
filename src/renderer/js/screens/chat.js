// GhostWire — Voice Comms Screen
// Reactive waveform from real microphone + manual peer name entry
import { bus, Events } from '../utils/events.js';
import { escapeHtml } from '../utils/helpers.js';

let audioCtx = null;
let analyser = null;
let micStream = null;
let animFrameId = null;
let telemetryInterval = null;
let callStartTime = null;

export function renderVoiceComms() {
  return `
    <div class="voice-screen screen-enter" id="voice-screen">
      <!-- Header -->
      <div class="voice-header">
        <div>
          <div class="voice-status-label" id="voice-connection-status">
            <span class="status-dot offline" id="voice-status-dot"></span>
            AWAITING CONNECTION
          </div>
          <div class="voice-peer-name" id="voice-peer-name">NO_TARGET</div>
        </div>
        <div class="voice-channel-info">
          <span id="voice-channel-id">CHANNEL_-- | ---</span><br/>
          ENCRYPTION: ChaCha20-Poly1305
        </div>
      </div>

      <!-- Manual Name Entry Banner -->
      <div class="voice-connect-bar" id="voice-connect-bar">
        <div class="voice-connect-form">
          <span class="voice-connect-prefix">TARGET_NODE&gt;</span>
          <input
            type="text"
            class="voice-connect-input"
            id="voice-peer-input"
            placeholder="ENTER_PEER_NAME..."
            autocomplete="off"
            spellcheck="false"
            maxlength="32"
          />
          <button class="btn btn-primary btn-sm" id="voice-connect-btn">LOCK_TARGET</button>
        </div>
        <div class="voice-connect-hint">
          TYPE CALLSIGN OR IP ADDRESS OF TARGET NODE TO ESTABLISH VOICE_LINK
        </div>
      </div>

      <!-- Main: Waveform + Telemetry -->
      <div class="voice-main">
        <div class="voice-visualizer">
          <div style="display:flex; justify-content:space-between; padding:var(--sp-1) 0;">
            <span style="font-family:var(--font-mono); font-size:var(--text-micro); color:var(--text-ghost);" id="voice-mic-status">MIC: INACTIVE</span>
            <span style="font-family:var(--font-mono); font-size:var(--text-micro); color:var(--text-ghost);" id="voice-freq-label">FREQ_BAND: --</span>
          </div>
          <div class="voice-waveform" id="voice-waveform">
            <div class="voice-waveform-idle" id="waveform-idle">
              <span class="material-icons" style="font-size:48px; color:var(--text-ghost); margin-bottom:var(--sp-3);">mic_none</span>
              <span style="color:var(--text-ghost); font-size:var(--text-label-sm);">CLICK ACTIVATE TO START MIC</span>
            </div>
          </div>
          <div class="voice-waveform-label" id="waveform-status">RX_INPUT_STREAM_OFFLINE</div>
          <!-- Volume meter -->
          <div class="voice-volume-meter">
            <span style="font-size:var(--text-micro); color:var(--text-ghost); min-width:50px;">VOLUME</span>
            <div class="progress-bar" style="flex:1;">
              <div class="progress-fill" id="voice-volume-fill" style="width:0%; transition:width 0.06s linear;"></div>
            </div>
            <span style="font-family:var(--font-mono); font-size:var(--text-micro); color:var(--text-muted); min-width:40px; text-align:right;" id="voice-db-display">-∞ dB</span>
          </div>
        </div>

        <div class="voice-sidebar">
          <!-- Telemetry -->
          <div class="voice-telemetry">
            <div class="voice-telemetry-title">TELEMETRY_DATA</div>
            <div class="telemetry-table">
              <div class="telemetry-row">
                <span class="telemetry-label">BITRATE</span>
                <span><span class="telemetry-value" id="tel-bitrate">128</span><span class="telemetry-unit">kbps</span></span>
              </div>
              <div class="telemetry-row">
                <span class="telemetry-label">LATENCY</span>
                <span><span class="telemetry-value" id="tel-latency">--</span><span class="telemetry-unit">ms</span></span>
              </div>
              <div class="telemetry-row">
                <span class="telemetry-label">JITTER</span>
                <span><span class="telemetry-value" id="tel-jitter">--</span><span class="telemetry-unit">ms</span></span>
              </div>
              <div class="telemetry-row">
                <span class="telemetry-label">PACKET LOSS</span>
                <span><span class="telemetry-value" id="tel-loss">0.00</span><span class="telemetry-unit">%</span></span>
              </div>
              <div class="telemetry-row">
                <span class="telemetry-label">DURATION</span>
                <span><span class="telemetry-value" id="tel-duration">00:00</span></span>
              </div>
              <div class="telemetry-row">
                <span class="telemetry-label">SAMPLE RATE</span>
                <span><span class="telemetry-value" id="tel-samplerate">--</span><span class="telemetry-unit">Hz</span></span>
              </div>
            </div>
          </div>

          <!-- Settings toggles -->
          <div style="margin-top:var(--sp-4); display:flex; flex-direction:column; gap:var(--sp-3); padding:0 var(--sp-1);">
            <div class="voice-setting-item">
              <div>
                <div class="voice-setting-label">NOISE SUPPRESSION</div>
                <div class="voice-setting-desc">DEEP_LEARNING_MODEL</div>
              </div>
              <div class="toggle active" id="toggle-noise">
                <div class="toggle-knob"></div>
              </div>
            </div>
            <div class="voice-setting-item">
              <div>
                <div class="voice-setting-label">ECHO CANCELLATION</div>
                <div class="voice-setting-desc">HARDWARE_ACCELERATED</div>
              </div>
              <div class="toggle active" id="toggle-echo">
                <div class="toggle-knob"></div>
              </div>
            </div>
            <div class="voice-setting-item">
              <div>
                <div class="voice-setting-label">VOICE MORPHING</div>
                <div class="voice-setting-desc">OFF_BY_DEFAULT</div>
              </div>
              <div class="toggle" id="toggle-morph">
                <div class="toggle-knob"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="voice-controls">
        <button class="voice-control-btn" id="btn-activate">
          <span class="material-icons">mic</span>
          ACTIVATE
        </button>
        <button class="voice-control-btn" id="btn-mute" style="display:none">
          <span class="material-icons">mic_off</span>
          MUTE
        </button>
        <button class="voice-control-btn" id="btn-ptt">
          <span class="material-icons">wifi_tethering</span>
          PUSH-TO-TALK
        </button>
        <button class="voice-control-btn end-call" id="btn-end">
          <span class="material-icons">call_end</span>
          END CALL
        </button>
      </div>

      <!-- Encryption Handshake Log -->
      <div class="voice-handshake-log" id="voice-log">
        <div>> VOICE_COMMS_MODULE_LOADED</div>
        <div>> AWAITING_TARGET_SELECTION...</div>
      </div>

      <!-- System Log Footer -->
      <div class="log-footer">
        <span class="log-entry"><span class="log-timestamp">[${getTimestamp()}]</span> SYSTEM_BOOT_SUCCESS</span>
        <span class="log-entry"><span class="log-timestamp">[${getTimestamp()}]</span> VOICE_ENGINE_READY</span>
        <span class="log-entry"><span class="log-timestamp">[${getTimestamp()}]</span> AWAITING_OPERATOR_INPUT</span>
      </div>
    </div>
  `;
}

export function mountVoiceComms() {
  const peerInput = document.getElementById('voice-peer-input');
  const connectBtn = document.getElementById('voice-connect-btn');
  const connectBar = document.getElementById('voice-connect-bar');
  const peerNameEl = document.getElementById('voice-peer-name');
  const statusLabel = document.getElementById('voice-connection-status');
  const statusDot = document.getElementById('voice-status-dot');
  const channelId = document.getElementById('voice-channel-id');
  const voiceLog = document.getElementById('voice-log');
  const waveformEl = document.getElementById('voice-waveform');

  // Generate waveform bars
  const barCount = 80;
  const idleEl = document.getElementById('waveform-idle');
  let barsHTML = idleEl ? idleEl.outerHTML : '';
  for (let i = 0; i < barCount; i++) {
    barsHTML += `<div class="voice-waveform-bar" style="height:3px" data-idx="${i}"></div>`;
  }
  if (waveformEl) waveformEl.innerHTML = barsHTML;

  // ===== MANUAL NAME ENTRY =====
  if (connectBtn && peerInput) {
    const lockTarget = () => {
      const name = peerInput.value.trim();
      if (name.length < 1) return;

      // Set peer name
      if (peerNameEl) peerNameEl.textContent = escapeHtml(name);
      if (statusLabel) {
        statusLabel.innerHTML = `<span class="status-dot online" id="voice-status-dot"></span> TARGET_LOCKED`;
      }

      // Generate random channel
      const ch = Math.floor(Math.random() * 99) + 1;
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      if (channelId) channelId.textContent = `CHANNEL_${String(ch).padStart(2, '0')} | ${code}-GHOST`;

      // Update log
      appendLog(voiceLog, `> TARGET_ACQUIRED: ${name.toUpperCase()}`);
      appendLog(voiceLog, `> ENCRYPTING_IDENTITY: ${name.toUpperCase()}...`);
      appendLog(voiceLog, `> HANDSHAKE_COMPLETE: X25519`);
      appendLog(voiceLog, `> CODEC: Opus_48kHz_Stereo`);
      appendLog(voiceLog, `> STATUS: CHANNEL_ESTABLISHED ✓`);

      // Collapse the connect bar
      if (connectBar) connectBar.classList.add('collapsed');

      bus.emit(Events.TOAST, { message: `TARGET_LOCKED: ${name.toUpperCase()}`, type: 'default' });
    };

    connectBtn.addEventListener('click', lockTarget);
    peerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') lockTarget();
    });

    setTimeout(() => peerInput.focus(), 300);
  }

  // ===== MIC ACTIVATION (REAL AUDIO) =====
  const activateBtn = document.getElementById('btn-activate');
  const muteBtn = document.getElementById('btn-mute');

  if (activateBtn) {
    activateBtn.addEventListener('click', async () => {
      await startMicrophone();
      activateBtn.style.display = 'none';
      if (muteBtn) muteBtn.style.display = 'flex';
    });
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const isMuted = muteBtn.classList.toggle('active');
      if (micStream) {
        micStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      }
      const micStatus = document.getElementById('voice-mic-status');
      if (micStatus) micStatus.textContent = isMuted ? 'MIC: MUTED' : 'MIC: ACTIVE';
      muteBtn.querySelector('.material-icons').textContent = isMuted ? 'mic_off' : 'mic';
      muteBtn.querySelector('.material-icons').nextSibling.textContent = isMuted ? ' UNMUTE' : ' MUTE';
    });
  }

  // Toggle handlers
  document.querySelectorAll('.toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
    });
  });

  // PTT handler
  const pttBtn = document.getElementById('btn-ptt');
  if (pttBtn) {
    pttBtn.addEventListener('mousedown', () => {
      pttBtn.classList.add('active');
      if (micStream) micStream.getAudioTracks().forEach(t => t.enabled = true);
    });
    pttBtn.addEventListener('mouseup', () => {
      pttBtn.classList.remove('active');
    });
  }

  // End call
  const endBtn = document.getElementById('btn-end');
  if (endBtn) {
    endBtn.addEventListener('click', () => {
      stopMicrophone();
      bus.emit(Events.NAVIGATE, { screen: 'messages' });
      bus.emit(Events.TOAST, { message: 'CALL_TERMINATED', type: 'default' });
    });
  }
}

// ===== REAL MICROPHONE AUDIO WAVEFORM =====
async function startMicrophone() {
  const voiceLog = document.getElementById('voice-log');
  const micStatus = document.getElementById('voice-mic-status');
  const freqLabel = document.getElementById('voice-freq-label');
  const waveformStatus = document.getElementById('waveform-status');
  const idleEl = document.getElementById('waveform-idle');
  const srEl = document.getElementById('tel-samplerate');

  try {
    appendLog(voiceLog, `> REQUESTING_MIC_ACCESS...`);

    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
      },
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;

    const source = audioCtx.createMediaStreamSource(micStream);
    source.connect(analyser);

    // Hide idle state
    if (idleEl) idleEl.style.display = 'none';
    if (micStatus) micStatus.textContent = 'MIC: ACTIVE';
    if (micStatus) micStatus.style.color = 'var(--primary)';
    if (freqLabel) freqLabel.textContent = `FREQ_BAND: ${(audioCtx.sampleRate / 1000).toFixed(1)}KHZ`;
    if (waveformStatus) waveformStatus.textContent = 'RX_INPUT_STREAM_ACTIVE';
    if (waveformStatus) waveformStatus.style.color = 'var(--primary)';
    if (srEl) srEl.textContent = audioCtx.sampleRate;

    appendLog(voiceLog, `> MIC_ACCESS_GRANTED`);
    appendLog(voiceLog, `> SAMPLE_RATE: ${audioCtx.sampleRate}Hz`);
    appendLog(voiceLog, `> VOICE_STREAM_ACTIVE ✓`);

    // Start call timer
    callStartTime = Date.now();
    startTelemetry();

    // Start waveform animation
    drawWaveform();
  } catch (err) {
    console.error('[Voice] Mic access failed:', err);
    appendLog(voiceLog, `> ERR: MIC_ACCESS_DENIED`);
    if (micStatus) { micStatus.textContent = 'MIC: ERROR'; micStatus.style.color = 'var(--danger)'; }
    bus.emit(Events.TOAST, { message: 'MIC_ACCESS_DENIED. CHECK PERMISSIONS.', type: 'danger' });
  }
}

function drawWaveform() {
  if (!analyser) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const bars = document.querySelectorAll('.voice-waveform-bar');
  const volumeFill = document.getElementById('voice-volume-fill');
  const dbDisplay = document.getElementById('voice-db-display');

  function draw() {
    animFrameId = requestAnimationFrame(draw);

    analyser.getByteFrequencyData(dataArray);

    // Calculate RMS volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    const volumePct = Math.min(100, (rms / 128) * 100);
    const db = rms > 0 ? 20 * Math.log10(rms / 255) : -Infinity;

    if (volumeFill) volumeFill.style.width = `${volumePct}%`;
    if (dbDisplay) dbDisplay.textContent = isFinite(db) ? `${db.toFixed(1)} dB` : '-∞ dB';

    // Map frequency data to bars
    const step = Math.floor(dataArray.length / bars.length);
    bars.forEach((bar, i) => {
      const idx = Math.min(i * step, dataArray.length - 1);
      const value = dataArray[idx];
      // Scale: 0-255 -> 3px-140px
      const height = Math.max(3, (value / 255) * 140);
      bar.style.height = `${height}px`;

      // Color intensity based on amplitude
      const opacity = 0.3 + (value / 255) * 0.7;
      bar.style.opacity = opacity;
    });
  }

  draw();
}

function startTelemetry() {
  telemetryInterval = setInterval(() => {
    const latencyEl = document.getElementById('tel-latency');
    const jitterEl = document.getElementById('tel-jitter');
    const durationEl = document.getElementById('tel-duration');

    if (latencyEl) latencyEl.textContent = (18 + Math.random() * 12).toFixed(0);
    if (jitterEl) jitterEl.textContent = (0.5 + Math.random() * 2).toFixed(1);

    if (durationEl && callStartTime) {
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      durationEl.textContent = `${mins}:${secs}`;
    }
  }, 1000);
}

function stopMicrophone() {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
    analyser = null;
  }

  if (telemetryInterval) {
    clearInterval(telemetryInterval);
    telemetryInterval = null;
  }

  callStartTime = null;
}

function appendLog(logEl, text) {
  if (!logEl) return;
  const div = document.createElement('div');
  div.textContent = text;
  div.style.animation = 'fadeInUp 0.2s var(--ease-out)';
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function getTimestamp() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function unmountVoiceComms() {
  stopMicrophone();
}
