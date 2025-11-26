(function () {
  const vscode = acquireVsCodeApi();

  // DOM refs
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('sendBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const streamingIndicator = document.getElementById('streamingIndicator');
  const settingsBtn = document.getElementById('openSettings');

  // State
  let isStreaming = false;
  let pendingAssistantId = null;
  let config = {};
  let context = {};

  // Utils
  function setStatus(mode, label) {
    statusDot.className = `status-dot ${mode}`;
    statusText.textContent = label;
  }

  function toggleStreaming(on) {
    isStreaming = on;
    streamingIndicator.classList.toggle('hidden', !on);
    stopBtn.disabled = !on;
    if (on) setStatus('thinking', 'Thinking…');
    else setStatus('idle', 'Idle');
  }

  function autoResizeTextarea() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  }

  function scrollToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function createMessageElement(role, text, id) {
    const item = document.createElement('div');
    item.className = `message ${role}`;
    item.dataset.id = id || '';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'assistant' ? 'AI' : 'You';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text || '';

    const actions = document.createElement('div');
    actions.className = 'bubble-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.title = 'Copy to clipboard';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(bubble.textContent || '');
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy'), 1000);
      } catch (e) {
        vscode.postMessage({ type: 'chat:error', error: 'Clipboard copy failed' });
      }
    });

    actions.appendChild(copyBtn);
    bubble.appendChild(actions);

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = role === 'assistant' ? 'Assistant' : 'User';

    const contentWrap = document.createElement('div');
    contentWrap.appendChild(bubble);
    contentWrap.appendChild(meta);

    item.appendChild(avatar);
    item.appendChild(contentWrap);

    return item;
  }

  function appendMessage(role, text, id) {
    const el = createMessageElement(role, text, id);
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function updateAssistantMessage(id, deltaText) {
    const el = messagesEl.querySelector(`.message.assistant[data-id="${id}"] .bubble`);
    if (el) {
      el.textContent = (el.textContent || '') + (deltaText || '');
      // Re-attach actions
      const actions = document.createElement('div');
      actions.className = 'bubble-actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.title = 'Copy to clipboard';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(el.textContent || '');
      });
      actions.appendChild(copyBtn);
      el.appendChild(actions);
      scrollToBottom();
    }
  }

  function setAssistantMessage(id, text) {
    const el = messagesEl.querySelector(`.message.assistant[data-id="${id}"] .bubble`);
    if (el) {
      el.textContent = text || '';
      const actions = document.createElement('div');
      actions.className = 'bubble-actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.title = 'Copy to clipboard';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(el.textContent || '');
      });
      actions.appendChild(copyBtn);
      el.appendChild(actions);
    }
    scrollToBottom();
  }

  // Sending
  async function sendMessage() {
    const text = (inputEl.value || '').trim();
    if (!text) return;

    // Append user message
    appendMessage('user', text);

    // Prepare assistant placeholder
    pendingAssistantId = String(Date.now());
    appendMessage('assistant', '', pendingAssistantId);

    // UI states
    inputEl.value = '';
    autoResizeTextarea();
    toggleStreaming(true);

    // Post to extension
    vscode.postMessage({
      type: 'chat:send',
      payload: {
        text,
        config,
        context,
        clientTs: Date.now(),
      },
    });
  }

  function stopStreaming() {
    if (!isStreaming) return;
    toggleStreaming(false);
    vscode.postMessage({ type: 'chat:stop' });
  }

  // Keyboard shortcuts
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const submitCombo = (isMac && e.metaKey) || (!isMac && e.ctrlKey);
      if (submitCombo) {
        e.preventDefault();
        sendMessage();
      } else if (!e.shiftKey) {
        // single Enter submits too
        e.preventDefault();
        sendMessage();
      }
    } else if (e.key === 'Escape') {
      stopStreaming();
    }
  });

  inputEl?.addEventListener('input', autoResizeTextarea);
  sendBtn?.addEventListener('click', sendMessage);
  stopBtn?.addEventListener('click', stopStreaming);
  settingsBtn?.addEventListener('click', () => vscode.postMessage({ type: 'chat:openSettings' }));

  // Incoming messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message || !message.type) return;

    switch (message.type) {
      case 'chat:response': {
        // Expected payloads:
        // - { delta: string, id?: string, done?: boolean }
        // - or { text: string, id?: string, done: true }
        const id = message.id || pendingAssistantId;
        if (typeof message.delta === 'string') {
          updateAssistantMessage(id, message.delta);
        }
        if (typeof message.text === 'string') {
          setAssistantMessage(id, message.text);
        }
        if (message.done) {
          toggleStreaming(false);
          pendingAssistantId = null;
          setStatus('online', 'Ready');
        }
        break;
      }
      case 'chat:error': {
        toggleStreaming(false);
        setStatus('error', 'Error');
        const details = typeof message.error === 'string' ? message.error : 'An error occurred';
        appendMessage('assistant', `⚠️ ${details}`);
        break;
      }
      case 'config:update': {
        config = { ...config, ...(message.config || {}) };
        break;
      }
      case 'context:update': {
        context = { ...context, ...(message.context || {}) };
        break;
      }
      default: {
        // Unknown message types can be logged for development
        // console.log('Unknown message from extension:', message);
      }
    }
  });

  // Initial state
  setStatus('idle', 'Idle');
  autoResizeTextarea();

  // Notify extension that the webview has loaded
  vscode.postMessage({ type: 'chat:loaded' });
})();
