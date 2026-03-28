// GhostWire — Messages Screen (3-pane: Sessions + Chat) with Live Networking
import { bus, Events } from '../utils/events.js';
import { getInitials, formatTime, formatMessageTime, truncate, escapeHtml } from '../utils/helpers.js';

let chatState = {
  activeSession: null,
  messages: [],
};
let removeMessageListener = null;

export function renderMessages() {
  return `
    <div class="messages-layout screen-enter" id="messages-screen">
      <!-- Sessions Panel -->
      <div class="sessions-panel">
        <div class="sessions-header">SESSIONS</div>
        <div class="sessions-search">
          <input type="text" class="input" placeholder="FILTER_SESSIONS..." id="session-search" />
        </div>
        <div class="sessions-list" id="sessions-list"></div>
        <div class="sessions-footer">
          <span id="sessions-protocol">PKI_PROTOCOL_V4.2</span>
          <span class="text-primary" id="sessions-status">STABLE</span>
        </div>
      </div>

      <!-- Chat Area -->
      <div class="chat-area" id="chat-area">
        <div class="empty-state" id="chat-empty-state">
          <div class="empty-state-icon">🔐</div>
          <div class="empty-state-title">SELECT_SESSION</div>
          <div class="empty-state-desc">
            Choose a session from the panel or discover new nodes on the network to begin encrypted communication.
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function mountMessages() {
  const sessionsList = document.getElementById('sessions-list');
  const chatArea = document.getElementById('chat-area');

  await loadSessions(sessionsList, chatArea);

  // Listen for new incoming messages
  removeMessageListener = bus.on(Events.MESSAGE_RECEIVED, async (data) => {
    // Refresh sessions list
    await loadSessions(sessionsList, chatArea);

    // If the active chat is the one that got a new message, append it
    if (chatState.activeSession && data.conversationId === chatState.activeSession) {
      const messagesEl = document.getElementById('chat-messages');
      if (messagesEl && data.message) {
        const peerName = getPeerNameFromSession(sessionsList, data.conversationId);
        appendMessage(messagesEl, data.message, peerName || 'PEER', false);
      }
    }
  });

  // Session search filter
  const searchInput = document.getElementById('session-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      sessionsList.querySelectorAll('.session-item').forEach((item) => {
        const name = item.querySelector('.session-name')?.textContent.toLowerCase() || '';
        item.style.display = name.includes(query) ? 'flex' : 'none';
      });
    });
  }
}

async function loadSessions(sessionsList, chatArea) {
  let conversations = [];
  let peers = {};

  try {
    if (window.ghostwire) {
      conversations = await window.ghostwire.getConversations();
      peers = await window.ghostwire.getPeers();
    }
  } catch (err) {
    console.error('[Messages] Failed to load:', err);
  }

  if (!sessionsList) return;

  if (conversations.length > 0) {
    sessionsList.innerHTML = conversations.map((conv, i) => {
      // Look up peer name from contacts/peers
      const peer = peers[conv.id];
      const name = conv.peerName || peer?.displayName || conv.id.substring(0, 12);
      const preview = conv.lastMessage?.text || 'NO_MESSAGES';
      const time = conv.lastMessage ? formatTime(conv.lastMessage.timestamp) : '';
      const initials = getInitials(name);
      const unread = conv.unread || 0;
      const isActive = chatState.activeSession === conv.id;

      return `
        <div class="session-item ${isActive ? 'active' : ''}" data-id="${escapeHtml(conv.id)}" data-name="${escapeHtml(name)}" style="animation: fadeInUp var(--duration-normal) var(--ease-out) ${i * 60}ms both;">
          <div class="session-avatar">${initials}</div>
          <div class="session-info">
            <div class="session-name">${escapeHtml(name)}</div>
            <div class="session-preview">${escapeHtml(truncate(preview, 30))}</div>
          </div>
          <div class="session-meta">
            ${unread > 0 ? `<span class="session-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
            <span class="session-time">${time}</span>
          </div>
        </div>
      `;
    }).join('');

    bindSessionClicks(sessionsList, chatArea);
  }
}

function bindSessionClicks(sessionsList, chatArea) {
  sessionsList.querySelectorAll('.session-item').forEach((item) => {
    item.addEventListener('click', () => {
      const convId = item.dataset.id;
      const name = item.dataset.name || item.querySelector('.session-name')?.textContent || 'UNKNOWN';

      sessionsList.querySelectorAll('.session-item').forEach((s) => s.classList.remove('active'));
      item.classList.add('active');

      chatState.activeSession = convId;
      openChatInArea(chatArea, convId, name);
    });
  });
}

function getPeerNameFromSession(sessionsList, convId) {
  if (!sessionsList) return null;
  const item = sessionsList.querySelector(`[data-id="${convId}"]`);
  return item?.dataset.name || null;
}

async function openChatInArea(chatArea, convId, peerName) {
  chatArea.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-left">
        <span class="status-dot online"></span>
        <div>
          <div class="chat-peer-name">${escapeHtml(peerName)}</div>
          <div class="chat-peer-id">ID: ${escapeHtml(convId.substring(0, 16))}... // ASYMMETRIC_TUNNEL</div>
        </div>
      </div>
      <div class="chat-header-right">
        <div class="chat-header-tag">
          <span class="status-dot online"></span>
          WIRE_ACTIVE
        </div>
        <button class="header-icon-btn"><span class="material-icons">more_vert</span></button>
      </div>
    </div>

    <div class="chat-session-label">SESSION_START: ${new Date().toISOString().split('T')[0]}</div>

    <div class="chat-messages" id="chat-messages"></div>

    <div class="chat-input-bar">
      <span class="chat-prompt-prefix">$</span>
      <span class="chat-prompt-prefix">></span>
      <input
        type="text"
        class="chat-input"
        id="chat-input"
        placeholder="TERMINAL_PROMPT: EXECUTE_COMMAND..."
        autocomplete="off"
        spellcheck="true"
      />
      <span class="chat-encrypt-icon material-icons" style="font-size:16px; color:var(--text-ghost)">lock</span>
      <button class="terminal-send-btn" id="chat-send" disabled>SEND</button>
    </div>

    <div class="chat-footer-status">
      <span>ENCRYPTION: XSalsa20-Poly1305</span>
      <span>SYSTEM_LISTENING...</span>
    </div>
  `;

  // Load messages
  const messagesEl = document.getElementById('chat-messages');
  try {
    if (window.ghostwire) {
      chatState.messages = await window.ghostwire.getMessages(convId);
      if (chatState.messages.length > 0) {
        renderChatMessages(messagesEl, chatState.messages, peerName);
      }
    }
  } catch (err) {
    console.error('[Chat] Failed to load messages:', err);
  }

  // Input handling
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  if (input) {
    input.addEventListener('input', () => {
      sendBtn.disabled = input.value.trim().length === 0;
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && input.value.trim()) {
        e.preventDefault();
        sendMessage(input, messagesEl, peerName);
      }
    });

    setTimeout(() => input.focus(), 200);
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (input.value.trim()) {
        sendMessage(input, messagesEl, peerName);
      }
    });
  }
}

async function sendMessage(input, messagesEl, peerName) {
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  document.getElementById('chat-send').disabled = true;

  const message = {
    id: Date.now().toString(),
    text,
    from: 'self',
    timestamp: Date.now(),
    status: 'sent',
  };

  chatState.messages.push(message);
  appendMessage(messagesEl, message, 'NODE_ADMIN', true);

  try {
    if (window.ghostwire && chatState.activeSession) {
      await window.ghostwire.sendMessage({
        conversationId: chatState.activeSession,
        text,
      });
    }
  } catch (err) {
    console.error('[Chat] Send failed:', err);
  }

  input.focus();
}

function renderChatMessages(container, messages, peerName) {
  container.innerHTML = messages.map((msg) => {
    const isSent = msg.from === 'self' || msg.from === 'me';
    return createMessageHTML(msg, isSent ? 'NODE_ADMIN' : peerName, isSent);
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function appendMessage(container, msg, senderName, isSent) {
  container.insertAdjacentHTML('beforeend', createMessageHTML(msg, senderName, isSent));
  container.scrollTop = container.scrollHeight;
}

function createMessageHTML(msg, senderName, isSent) {
  const time = formatMessageTime(msg.timestamp);
  const dir = isSent ? 'sent' : 'received';

  return `
    <div class="message-group">
      <div class="message-sender ${dir}" style="text-align:${isSent ? 'right' : 'left'}">
        ${escapeHtml(senderName)}
        <span class="message-sender-time">${time}</span>
      </div>
      <div class="message-bubble ${dir}" style="align-self:${isSent ? 'flex-end' : 'flex-start'}">
        ${isSent ? '> ' : '$ '}${escapeHtml(msg.text)}
      </div>
    </div>
  `;
}

export function unmountMessages() {
  chatState.messages = [];
  chatState.activeSession = null;
  if (removeMessageListener) removeMessageListener();
}
