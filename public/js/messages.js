/* Messages page — real-time chat with Socket.io */
(function () {
  if (!requireAuth()) return;

  const currentUser = getUser();
  const socket = io();
  socket.emit('register', currentUser.id);

  let currentChatUserId = null;
  let onlineUsersList = [];

  // Check if a user ID was passed in the URL (e.g., from project detail)
  const urlParams = new URLSearchParams(window.location.search);
  const targetUser = urlParams.get('user');

  // Load conversations
  async function loadConversations() {
    try {
      const convos = await api('/messages/conversations');
      renderConversations(convos);
    } catch (err) { /* ignore */ }
  }

  function renderConversations(convos) {
    const list = document.getElementById('conversations-list');
    if (!convos.length) {
      list.innerHTML = '<div style="padding:20px;color:var(--gray);text-align:center;font-size:0.9rem">No conversations yet.<br>Search for a user above to start!</div>';
      return;
    }
    list.innerHTML = convos.map(c => {
      const isOnline = onlineUsersList.includes(c.user._id);
      return '<div class="conversation-item' + (currentChatUserId === c.user._id ? ' active' : '') + '" data-id="' + c.user._id + '" data-name="' + escHtml(c.user.name) + '">'
        + '<div class="avatar-md" style="position:relative">' + avatarInitial(c.user.name)
        + (isOnline ? '<div style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:#4CAF50;border:2px solid #fff;border-radius:50%"></div>' : '')
        + '</div>'
        + '<div class="conversation-info"><h4>' + escHtml(c.user.name) + '</h4><p>' + escHtml(c.lastMessage) + '</p></div>'
        + '<div style="text-align:right"><div class="conversation-time">' + formatDate(c.lastDate) + '</div>'
        + (c.unread ? '<div class="unread-badge">' + c.unread + '</div>' : '')
        + '</div></div>';
    }).join('');

    list.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => openChat(item.dataset.id, item.dataset.name));
    });
  }

  // Open a chat with a user
  async function openChat(userId, userName) {
    currentChatUserId = userId;
    document.getElementById('chat-empty').style.display = 'none';
    document.getElementById('chat-header').style.display = 'flex';
    document.getElementById('chat-messages').style.display = 'flex';
    document.getElementById('chat-input-area').style.display = 'flex';
    document.getElementById('chat-name').textContent = userName;
    document.getElementById('chat-avatar').textContent = avatarInitial(userName);

    // Mark active conversation
    document.querySelectorAll('.conversation-item').forEach(c => c.classList.remove('active'));
    const active = document.querySelector('.conversation-item[data-id="' + userId + '"]');
    if (active) active.classList.add('active');

    // Load messages
    const msgsContainer = document.getElementById('chat-messages');
    msgsContainer.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
    try {
      const messages = await api('/messages/' + userId);
      msgsContainer.innerHTML = messages.map(renderMessage).join('');
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
    } catch (err) {
      msgsContainer.innerHTML = '<p style="color:var(--gray)">Failed to load messages.</p>';
    }

    document.getElementById('msg-input').focus();
    loadConversations(); // refresh unread counts
  }

  function renderMessage(msg) {
    const isSent = msg.sender._id === currentUser.id || msg.sender === currentUser.id;
    return '<div class="message-bubble ' + (isSent ? 'sent' : 'received') + '">'
      + '<div>' + escHtml(msg.content) + '</div>'
      + '<div class="message-time">' + formatDate(msg.createdAt) + '</div>'
      + '</div>';
  }

  // Send message
  function sendMessage() {
    const input = document.getElementById('msg-input');
    const content = input.value.trim();
    if (!content || !currentChatUserId) return;
    socket.emit('sendMessage', { senderId: currentUser.id, receiverId: currentChatUserId, content });
    input.value = '';
  }

  document.getElementById('send-btn').addEventListener('click', sendMessage);
  document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
    // Send typing indicator
    if (currentChatUserId) socket.emit('typing', { senderId: currentUser.id, receiverId: currentChatUserId });
  });

  // Receive messages
  socket.on('newMessage', (msg) => {
    const senderId = msg.sender._id || msg.sender;
    if (senderId === currentChatUserId || senderId === currentUser.id) {
      const msgsContainer = document.getElementById('chat-messages');
      msgsContainer.insertAdjacentHTML('beforeend', renderMessage(msg));
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
    }
    loadConversations();
  });

  // Typing indicator
  let typingTimeout;
  socket.on('userTyping', (data) => {
    if (data.userId === currentChatUserId) {
      const indicator = document.getElementById('typing');
      indicator.style.display = 'inline';
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => indicator.style.display = 'none', 2000);
    }
  });

  // Online users
  socket.on('onlineUsers', (users) => {
    onlineUsersList = users;
    loadConversations();
  });

  // User search
  let searchTimer;
  document.getElementById('user-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    if (!q) { document.getElementById('search-results').innerHTML = ''; return; }
    searchTimer = setTimeout(async () => {
      try {
        const users = await api('/users?search=' + encodeURIComponent(q));
        const results = document.getElementById('search-results');
        results.innerHTML = users
          .filter(u => u._id !== currentUser.id)
          .slice(0, 5)
          .map(u => '<div class="conversation-item" style="padding:10px 14px;cursor:pointer" data-id="' + u._id + '" data-name="' + escHtml(u.name) + '">'
            + '<div class="avatar-md" style="width:32px;height:32px;font-size:0.8rem">' + avatarInitial(u.name) + '</div>'
            + '<div class="conversation-info"><h4 style="font-size:0.9rem">' + escHtml(u.name) + '</h4><p>' + (u.skills || []).slice(0, 3).join(', ') + '</p></div></div>'
          ).join('');
        results.querySelectorAll('.conversation-item').forEach(item => {
          item.addEventListener('click', () => {
            openChat(item.dataset.id, item.dataset.name);
            document.getElementById('user-search').value = '';
            results.innerHTML = '';
          });
        });
      } catch (err) { /* ignore */ }
    }, 300);
  });

  // Auto-open chat if user ID passed in URL
  if (targetUser) {
    (async () => {
      try {
        const user = await api('/users/' + targetUser);
        openChat(user._id, user.name);
      } catch (err) { /* ignore */ }
    })();
  }

  loadConversations();
})();
