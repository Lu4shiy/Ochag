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

const currentUsernameSpan = document.getElementById('current-username');
const userProfileBtn = document.getElementById('user-profile-btn');
const userDropdown = document.getElementById('user-dropdown');
const menuProfile = document.getElementById('menu-profile');
const menuCreate = document.getElementById('menu-create');
const menuLogout = document.getElementById('menu-logout');

const dmListDiv = document.getElementById('dm-list');
const channelListDiv = document.getElementById('channel-list');
const communityListDiv = document.getElementById('community-list');

const activeChatTitle = document.getElementById('active-chat-title');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

const createModal = document.getElementById('create-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const createChatForm = document.getElementById('create-chat-form');
const newChatNameInput = document.getElementById('new-chat-name');
const newChatTypeSelect = document.getElementById('new-chat-type');

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

// Логика выпадающего меню профиля
userProfileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('hidden');
});

// Закрытие меню при клике вне его
document.addEventListener('click', () => {
    userDropdown.classList.add('hidden');
});

// Пункты меню
menuProfile.addEventListener('click', () => {
    alert('Раздел профиля находится в разработке');
    userDropdown.classList.add('hidden');
});

menuLogout.addEventListener('click', () => {
    currentUser = null;
    currentChatId = null;
    userDropdown.classList.add('hidden');
    appScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
});

menuCreate.addEventListener('click', () => {
    userDropdown.classList.add('hidden');
    createModal.classList.remove('hidden');
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
    dmListDiv.innerHTML = '';
    channelListDiv.innerHTML = '';
    communityListDiv.innerHTML = '';

    allChats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        div.textContent = chat.type === 'dm' ? `@ ${chat.name}` : `# ${chat.name}`;
        div.onclick = () => selectChat(chat.id);

        if (chat.type === 'dm') {
            dmListDiv.appendChild(div);
        } else if (chat.type === 'channel') {
            channelListDiv.appendChild(div);
        } else if (chat.type === 'community') {
            communityListDiv.appendChild(div);
        }
    });
}

function selectChat(chatId) {
    currentChatId = chatId;
    const chat = allChats.find(c => c.id === chatId);
    activeChatTitle.textContent = chat ? (chat.type === 'dm' ? `@ ${chat.name}` : `# ${chat.name}`) : 'Чат';
    
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

// Закрытие модального окна
closeModalBtn.addEventListener('click', () => {
    createModal.classList.add('hidden');
});

createChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = newChatNameInput.value.trim();
    const type = newChatTypeSelect.value;

    if (!name) return;

    try {
        const response = await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type })
        });
        const data = await response.json();

        if (data.success) {
            newChatNameInput.value = '';
            createModal.classList.add('hidden');
        }
    } catch (err) {
        console.error('Ошибка создания пространства');
    }
});

socket.on('new_chat', (chat) => {
    allChats.push(chat);
    renderChats();
});

socket.on('new_message', (message) => {
    allMessages.push(message);
    if (message.chatId === currentChatId) {
        renderMessages();
    }
});