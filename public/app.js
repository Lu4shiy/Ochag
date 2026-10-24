const socket = io();

let currentUser = null;
let currentChatId = null;
let allChats = [];
let allMessages = [];

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');

const currentUsernameSpan = document.getElementById('current-username');
const chatsListDiv = document.getElementById('chats-list');
const activeChatTitle = document.getElementById('active-chat-title');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

// Авторизация
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authenticate('/api/login');
});

registerBtn.addEventListener('click', async () => {
    authenticate('/api/register');
});

async function authenticate(url) {
    authError.textContent = '';
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            initMessenger();
        } else {
            authError.textContent = data.error;
        }
    } catch (err) {
        authError.textContent = 'Ошибка соединения с сервером';
    }
}

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    currentChatId = null;
    appScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
});

async function initMessenger() {
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    currentUsernameSpan.textContent = currentUser.username;

    const response = await fetch('/api/data');
    const data = await response.json();
    allChats = data.chats;
    allMessages = data.messages;

    renderChats();
    if (allChats.length > 0) {
        selectChat(allChats[0].id);
    }
}

function renderChats() {
    chatsListDiv.innerHTML = '';
    allChats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        div.textContent = `# ${chat.name}`;
        div.onclick = () => selectChat(chat.id);
        chatsListDiv.appendChild(div);
    });
}

function selectChat(chatId) {
    currentChatId = chatId;
    const chat = allChats.find(c => c.id === chatId);
    activeChatTitle.textContent = chat ? `# ${chat.name}` : 'Чат';
    
    socket.emit('join_chat', chatId);
    renderMessages();
    messageForm.classList.remove('hidden');
    renderChats();
}

function renderMessages() {
    messagesContainer.innerHTML = '';
    const chatMessages = allMessages.filter(m => m.chatId === currentChatId);
    
    chatMessages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `<span class="message-sender">${msg.sender}:</span><span class="message-text">${msg.text}</span>`;
        messagesContainer.appendChild(div);
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !currentChatId) return;

    socket.emit('send_message', {
        chatId: currentChatId,
        sender: currentUser.username,
        text: text
    });

    messageInput.value = '';
});

socket.on('new_message', (message) => {
    allMessages.push(message);
    if (message.chatId === currentChatId) {
        renderMessages();
    }
});