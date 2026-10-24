const socket = io();

let currentUser = null;
let currentChatId = null;
let allChats = [];
let allMessages = [];
let allUsers = [];

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');
const registerBtn = document.getElementById('register-btn');

const currentUsernameSpan = document.getElementById('current-username');
const myAvatar = document.getElementById('my-avatar');
const userProfileBtn = document.getElementById('user-profile-btn');
const userDropdown = document.getElementById('user-dropdown');
const menuProfile = document.getElementById('menu-profile');
const menuCreate = document.getElementById('menu-create');
const menuLogout = document.getElementById('menu-logout');

const chatsListDiv = document.getElementById('chats-list');

const activeChatHeaderInfo = document.getElementById('active-chat-header-info');
const activeChatTitle = document.getElementById('active-chat-title');
const activeChatStatus = document.getElementById('active-chat-status');
const activeAvatar = document.getElementById('active-avatar');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

// Модалка создания
const createModal = document.getElementById('create-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const createChatForm = document.getElementById('create-chat-form');
const newChatNameInput = document.getElementById('new-chat-name');
const newChatTypeInput = document.getElementById('new-chat-type');
const modalTitle = document.getElementById('modal-title');
const modalLabel = document.getElementById('modal-label');
const modalError = document.getElementById('modal-error');
const typeButtons = document.querySelectorAll('.type-btn');

// Модалка профиля
const profileModal = document.getElementById('profile-modal');
const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
const profileForm = document.getElementById('profile-form');
const profileUsernameInput = document.getElementById('profile-username-input');
const profilePreviewAvatar = document.getElementById('profile-preview-avatar');
const customAvatarInput = document.getElementById('custom-avatar-input');
const presetItems = document.querySelectorAll('.preset-item');
const profileError = document.getElementById('profile-error');

// Селекторы даты рождения
const dobDaySelect = document.getElementById('dob-day');
const dobMonthSelect = document.getElementById('dob-month');
const dobYearSelect = document.getElementById('dob-year');

// Инициализация выпадающих списков даты рождения
function initDobSelectors() {
    // Заполняем дни (1-31)
    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        dobDaySelect.appendChild(opt);
    }
    // Заполняем годы (от текущего до 100 лет назад)
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= currentYear - 100; i--) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        dobYearSelect.appendChild(opt);
    }
}
initDobSelectors();

// Модалка просмотра чужого профиля
const userInfoModal = document.getElementById('user-info-modal');
const closeUserInfoBtn = document.getElementById('close-user-info-btn');
const viewUserAvatar = document.getElementById('view-user-avatar');
const viewUserName = document.getElementById('view-user-name');
const viewUserCreated = document.getElementById('view-user-created');
const viewUserBirth = document.getElementById('view-user-birth');

const appToast = document.getElementById('app-toast');
const toastText = document.getElementById('toast-text');

let editingAvatarValue = null;

window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('messenger_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            socket.emit('set_user', currentUser.username);
            initMessenger();
        } catch (e) {
            localStorage.removeItem('messenger_user');
        }
    }
});

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
            localStorage.setItem('messenger_user', JSON.stringify(currentUser));
            socket.emit('set_user', currentUser.username);
            initMessenger();
        } else {
            authError.textContent = data.error;
        }
    } catch (err) {
        authError.textContent = 'Ошибка соединения с сервером';
    }
}

setInterval(() => {
    if (currentUser) {
        fetch('/api/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username })
        }).catch(() => {});
    }
}, 20000);

userProfileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('hidden');
});

document.addEventListener('click', () => {
    userDropdown.classList.add('hidden');
});

menuProfile.addEventListener('click', () => {
    userDropdown.classList.add('hidden');
    profileError.style.display = 'none';
    profileUsernameInput.value = currentUser.username;
    editingAvatarValue = currentUser.avatar || null;

    // Парсим сохраненную дату рождения обратно в селекторы (формат: "25 октября 1995" или "25 октября")
    dobDaySelect.value = '';
    dobMonthSelect.value = '';
    dobYearSelect.value = '';

    if (currentUser.birthdate) {
        const parts = currentUser.birthdate.split(' ');
        if (parts.length >= 2) {
            dobDaySelect.value = parts[0];
            const monthsMap = { 'Январь': '1', 'Февраль': '2', 'Март': '3', 'Апрель': '4', 'Май': '5', 'Июнь': '6', 'Июль': '7', 'Август': '8', 'Сентябрь': '9', 'Октябрь': '10', 'Ноябрь': '11', 'Декабрь': '12' };
            dobMonthSelect.value = monthsMap[parts[1]] || '';
            if (parts.length === 3) {
                dobYearSelect.value = parts[2];
            }
        }
    }

    renderProfilePreview();
    profileModal.classList.remove('hidden');
});

closeProfileModalBtn.addEventListener('click', () => {
    profileModal.classList.add('hidden');
});

presetItems.forEach(item => {
    item.addEventListener('click', () => {
        presetItems.forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        editingAvatarValue = item.getAttribute('data-val');
        renderProfilePreview();
    });
});

customAvatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(uploadEvent) {
        editingAvatarValue = uploadEvent.target.result;
        presetItems.forEach(i => i.classList.remove('selected'));
        renderProfilePreview();
    };
    reader.readAsDataURL(file);
});

function renderProfilePreview() {
    profilePreviewAvatar.innerHTML = '';
    if (!editingAvatarValue) {
        profilePreviewAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
    } else if (editingAvatarValue.startsWith('data:') || editingAvatarValue.startsWith('http')) {
        const img = document.createElement('img');
        img.src = editingAvatarValue;
        profilePreviewAvatar.appendChild(img);
    } else {
        profilePreviewAvatar.textContent = editingAvatarValue;
    }
}

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    profileError.style.display = 'none';

    const newUsername = profileUsernameInput.value.trim();
    
    // Собираем дату рождения из селекторов
    let formattedBirthdate = '';
    const day = dobDaySelect.value;
    const monthVal = dobMonthSelect.value;
    const year = dobYearSelect.value;

    if (day && monthVal) {
        const monthsArr = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        const monthName = monthsArr[parseInt(monthVal)];
        formattedBirthdate = `${day} ${monthName}`;
        if (year) {
            formattedBirthdate += ` ${year}`;
        }
    }

    try {
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentUsername: currentUser.username,
                username: newUsername,
                avatar: editingAvatarValue,
                birthdate: formattedBirthdate
            })
        });
        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('messenger_user', JSON.stringify(currentUser));
            socket.emit('set_user', currentUser.username);
            profileModal.classList.add('hidden');
            showToast('Профиль успешно обновлен');
            await loadData();
        } else {
            profileError.textContent = data.error;
            profileError.style.display = 'block';
        }
    } catch (err) {
        profileError.textContent = 'Ошибка соединения с сервером';
        profileError.style.display = 'block';
    }
});

menuLogout.addEventListener('click', () => {
    currentUser = null;
    currentChatId = null;
    localStorage.removeItem('messenger_user');
    userDropdown.classList.add('hidden');
    appScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
});

menuCreate.addEventListener('click', () => {
    userDropdown.classList.add('hidden');
    modalError.style.display = 'none';
    modalError.textContent = '';
    newChatNameInput.value = '';
    createModal.classList.remove('hidden');
});

function showToast(text) {
    toastText.textContent = text;
    appToast.classList.remove('hidden');
    setTimeout(() => {
        appToast.classList.add('hidden');
    }, 3000);
}

typeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const type = btn.getAttribute('data-type');
        newChatTypeInput.value = type;

        modalError.style.display = 'none';
        modalError.textContent = '';

        if (type === 'dm') {
            modalTitle.textContent = 'Создать личный чат';
            modalLabel.textContent = 'Имя пользователя собеседника';
            newChatNameInput.placeholder = 'Введите имя пользователя...';
        } else if (type === 'channel') {
            modalTitle.textContent = 'Создать канал';
            modalLabel.textContent = 'Название канала';
            newChatNameInput.placeholder = 'Введите название канала...';
        } else if (type === 'community') {
            modalTitle.textContent = 'Создать сообщество';
            modalLabel.textContent = 'Название сообщества';
            newChatNameInput.placeholder = 'Введите название сообщества...';
        }
    });
});

async function initMessenger() {
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    currentUsernameSpan.textContent = currentUser.username;
    renderUserAvatar(myAvatar, currentUser);

    await loadData();
    if (allChats.length > 0 && !currentChatId) {
        selectChat(allChats[0].id);
    }
}

function renderUserAvatar(container, userObj) {
    container.innerHTML = '';
    if (!userObj || !userObj.avatar) {
        container.textContent = (userObj && userObj.username ? userObj.username.charAt(0) : 'U').toUpperCase();
    } else if (userObj.avatar.startsWith('data:') || userObj.avatar.startsWith('http')) {
        const img = document.createElement('img');
        img.src = userObj.avatar;
        container.appendChild(img);
    } else {
        container.textContent = userObj.avatar;
    }
}

async function loadData() {
    try {
        const response = await fetch(`/api/data?username=${encodeURIComponent(currentUser.username)}`);
        const data = await response.json();
        allChats = data.chats;
        allMessages = data.messages;
        allUsers = data.users || [];
        renderChats();
        if (currentChatId) {
            updateChatHeader();
        }
        renderUserAvatar(myAvatar, currentUser);
    } catch (err) {
        console.error('Ошибка загрузки данных');
    }
}

function getLastMessage(chatId) {
    const chatMsgs = allMessages.filter(m => m.chatId === chatId);
    if (chatMsgs.length === 0) return null;
    return chatMsgs[chatMsgs.length - 1];
}

function formatMessageTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (date.toDateString() === now.toDateString()) {
        return `${hours}:${minutes}`;
    } else {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}`;
    }
}

function renderChats() {
    chatsListDiv.innerHTML = '';

    const sortedChats = [...allChats].sort((a, b) => {
        const lastA = getLastMessage(a.id);
        const lastB = getLastMessage(b.id);
        const timeA = lastA ? new Date(lastA.timestamp).getTime() : 0;
        const timeB = lastB ? new Date(lastB.timestamp).getTime() : 0;
        return timeB - timeA;
    });

    sortedChats.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item ${chat.id === currentChatId ? 'active' : ''}`;
        
        const displayName = chat.name;
        let chatUser = null;
        if (chat.type === 'dm') {
            chatUser = allUsers.find(u => u.username === displayName);
        }

        const lastMsg = getLastMessage(chat.id);
        const lastMsgText = lastMsg ? `${lastMsg.sender}: ${lastMsg.text}` : '';
        const lastMsgTime = lastMsg ? formatMessageTime(lastMsg.timestamp) : '';

        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'chat-item-avatar';
        renderUserAvatar(avatarDiv, chatUser || { username: displayName });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-item-content';
        contentDiv.innerHTML = `
            <div class="chat-item-header">
                <span class="chat-item-name">${displayName}</span>
                <span class="chat-item-time">${lastMsgTime}</span>
            </div>
            <div class="chat-item-last-msg">${lastMsgText}</div>
        `;

        div.appendChild(avatarDiv);
        div.appendChild(contentDiv);
        
        div.onclick = () => selectChat(chat.id);
        chatsListDiv.appendChild(div);
    });
}

function formatLastSeen(isoString) {
    if (!isoString) return 'был(-а) недавно';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);

    if (diffSec < 25) {
        return 'в сети';
    } else if (diffMin >= 1 && diffMin < 60) {
        return `был(-а) ${diffMin} минут(-у) назад`;
    } else if (diffHours >= 1 && diffHours < 24 && date.getDate() === now.getDate()) {
        return `был(-а) ${diffHours} час(-а) назад`;
    } else {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `был(-а) ${day}.${month}.${year} ${hours}:${minutes}`;
    }
}

function updateChatHeader() {
    const chat = allChats.find(c => c.id === currentChatId);
    if (!chat) return;

    if (chat.type === 'dm') {
        activeChatTitle.textContent = chat.name;
        const targetUser = allUsers.find(u => u.username === chat.name);
        renderUserAvatar(activeAvatar, targetUser || { username: chat.name });

        if (targetUser && targetUser.lastSeen) {
            activeChatStatus.textContent = formatLastSeen(targetUser.lastSeen);
            activeChatStatus.classList.remove('hidden');
        } else {
            activeChatStatus.textContent = 'не в сети';
            activeChatStatus.classList.remove('hidden');
        }
    } else {
        activeChatTitle.textContent = chat.name;
        renderUserAvatar(activeAvatar, { username: chat.name });
        activeChatStatus.classList.add('hidden');
    }
}

activeChatHeaderInfo.onclick = async () => {
    const chat = allChats.find(c => c.id === currentChatId);
    if (!chat || chat.type !== 'dm') return;

    try {
        const response = await fetch(`/api/user/${encodeURIComponent(chat.name)}`);
        const data = await response.json();
        if (data.success) {
            const p = data.profile;
            renderUserAvatar(viewUserAvatar, p);
            viewUserName.textContent = p.username;
            
            const regDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Не указана';
            viewUserCreated.textContent = regDate;
            viewUserBirth.textContent = p.birthdate ? p.birthdate : 'Не указана';

            userInfoModal.classList.remove('hidden');
        }
    } catch (err) {
        showToast('Не удалось загрузить профиль пользователя');
    }
};

closeUserInfoBtn.onclick = () => {
    userInfoModal.classList.add('hidden');
};

function selectChat(chatId) {
    currentChatId = chatId;
    updateChatHeader();
    
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

closeModalBtn.addEventListener('click', () => {
    createModal.classList.add('hidden');
});

createChatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    modalError.style.display = 'none';
    modalError.textContent = '';

    const name = newChatNameInput.value.trim();
    const type = newChatTypeInput.value;

    if (!name) return;

    try {
        const response = await fetch('/api/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, creator: currentUser.username })
        });
        const data = await response.json();

        if (data.success) {
            newChatNameInput.value = '';
            createModal.classList.add('hidden');
            await loadData();
            selectChat(data.chat.id);
        } else {
            modalError.textContent = data.error;
            modalError.style.display = 'block';
        }
    } catch (err) {
        modalError.textContent = 'Ошибка соединения с сервером';
        modalError.style.display = 'block';
    }
});

socket.on('new_chat', (chat) => {
    if (chat.type === 'dm') {
        if (chat.participants && chat.participants.includes(currentUser.username)) {
            if (!allChats.some(c => c.id === chat.id)) {
                allChats.push(chat);
                renderChats();
            }
        }
    } else {
        if (!allChats.some(c => c.id === chat.id)) {
            allChats.push(chat);
            renderChats();
        }
    }
});

socket.on('user_status_update', (data) => {
    const user = allUsers.find(u => u.username === data.username);
    if (user) {
        user.lastSeen = data.lastSeen;
    } else {
        allUsers.push(data);
    }
    if (currentChatId) {
        updateChatHeader();
    }
});

socket.on('new_message', (message) => {
    allMessages.push(message);
    renderChats();
    if (message.chatId === currentChatId) {
        renderMessages();
    }
});