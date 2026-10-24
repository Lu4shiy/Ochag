const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

function loadDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [],
            chats: [
                { id: 'general-channel', name: 'Общий канал', type: 'channel' },
                { id: 'community-1', name: 'Сообщество разработчиков', type: 'community' }
            ],
            messages: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5mb' })); // Увеличиваем лимит для загрузки аватарок в base64

// Регистрация
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }

    const db = loadDB();
    if (db.users.find(u => u.username === username)) {
        return res.status(400).json({ success: false, error: 'Пользователь уже существует' });
    }

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const newUser = { 
        id: Date.now().toString(), 
        username, 
        password: hashedPassword, 
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        avatar: null,
        birthdate: ''
    };
    db.users.push(newUser);
    saveDB(db);

    res.json({ success: true, user: { id: newUser.id, username: newUser.username, avatar: newUser.avatar, birthdate: newUser.birthdate, createdAt: newUser.createdAt } });
});

// Авторизация
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = loadDB();
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    
    const user = db.users.find(u => u.username === username && u.password === hashedPassword);
    if (!user) {
        return res.status(400).json({ success: false, error: 'Неверный логин или пароль' });
    }

    user.lastSeen = new Date().toISOString();
    saveDB(db);

    res.json({ success: true, user: { id: user.id, username: user.username, avatar: user.avatar || null, birthdate: user.birthdate || '', createdAt: user.createdAt || user.lastSeen } });
});

// Обновление профиля
app.post('/api/profile', (req, res) => {
    const { currentUsername, username, avatar, birthdate } = req.body;
    const db = loadDB();
    const user = db.users.find(u => u.username === currentUsername);
    if (!user) {
        return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }

    if (username && username !== currentUsername) {
        if (db.users.find(u => u.username === username)) {
            return res.status(400).json({ success: false, error: 'Это имя уже занято' });
        }
        user.username = username;
        // Обновляем имя в личных чатах и сообщениях
        db.chats.forEach(c => {
            if (c.type === 'dm' && c.participants) {
                const idx = c.participants.indexOf(currentUsername);
                if (idx !== -1) c.participants[idx] = username;
                if (c.name === currentUsername) c.name = username;
            }
        });
        db.messages.forEach(m => {
            if (m.sender === currentUsername) m.sender = username;
        });
    }

    if (avatar !== undefined) user.avatar = avatar;
    if (birthdate !== undefined) user.birthdate = birthdate;

    saveDB(db);
    res.json({ 
        success: true, 
        user: { 
            id: user.id, 
            username: user.username, 
            avatar: user.avatar, 
            birthdate: user.birthdate, 
            createdAt: user.createdAt 
        } 
    });
});

// Получение публичной информации о пользователе для модального окна профиля
app.get('/api/user/:username', (req, res) => {
    const target = req.params.username;
    const db = loadDB();
    const user = db.users.find(u => u.username === target);
    if (!user) {
        return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    res.json({
        success: true,
        profile: {
            username: user.username,
            avatar: user.avatar || null,
            birthdate: user.birthdate || null,
            createdAt: user.createdAt || user.lastSeen
        }
    });
});

// Получение данных
app.get('/api/data', (req, res) => {
    const username = req.query.username;
    const db = loadDB();

    const filteredChats = db.chats.filter(chat => {
        if (chat.type === 'channel' || chat.type === 'community') {
            return true;
        }
        if (chat.type === 'dm') {
            return chat.participants && chat.participants.includes(username);
        }
        return false;
    });

    const safeUsers = db.users.map(u => ({ username: u.username, lastSeen: u.lastSeen, avatar: u.avatar }));

    res.json({ chats: filteredChats, messages: db.messages, users: safeUsers });
});

// Обновление активности
app.post('/api/activity', (req, res) => {
    const { username } = req.body;
    if (!username) return res.sendStatus(400);

    const db = loadDB();
    const user = db.users.find(u => u.username === username);
    if (user) {
        user.lastSeen = new Date().toISOString();
        saveDB(db);
        io.emit('user_status_update', { username, lastSeen: user.lastSeen });
    }
    res.json({ success: true });
});

// Создание пространства
app.post('/api/chats', (req, res) => {
    const { name, type, creator } = req.body;
    if (!name || !type || !creator) {
        return res.status(400).json({ success: false, error: 'Заполните все поля' });
    }

    const db = loadDB();

    if (type === 'dm') {
        const targetUser = name.trim();
        if (targetUser === creator) {
            return res.status(400).json({ success: false, error: 'Нельзя создать чат с самим собой' });
        }

        const userExists = db.users.find(u => u.username === targetUser);
        if (!userExists) {
            return res.status(400).json({ success: false, error: 'Пользователь с таким именем не найден' });
        }

        const existingDm = db.chats.find(c => 
            c.type === 'dm' && 
            c.participants && 
            c.participants.includes(creator) && 
            c.participants.includes(targetUser)
        );

        if (existingDm) {
            return res.json({ success: true, chat: existingDm });
        }

        const newChat = {
            id: 'chat-' + Date.now(),
            name: targetUser,
            type: 'dm',
            participants: [creator, targetUser]
        };

        db.chats.push(newChat);
        saveDB(db);

        io.emit('new_chat', newChat);
        return res.json({ success: true, chat: newChat });
    } else {
        const newChat = {
            id: 'chat-' + Date.now(),
            name: name.trim(),
            type
        };

        db.chats.push(newChat);
        saveDB(db);

        io.emit('new_chat', newChat);
        return res.json({ success: true, chat: newChat });
    }
});

io.on('connection', (socket) => {
    let connectedUser = null;

    socket.on('set_user', (username) => {
        connectedUser = username;
    });

    socket.on('join_chat', (chatId) => {
        socket.join(chatId);
    });

    socket.on('send_message', (data) => {
        const { chatId, sender, text } = data;
        const db = loadDB();
        
        const message = {
            id: Date.now().toString(),
            chatId,
            sender,
            text,
            timestamp: new Date().toISOString()
        };

        db.messages.push(message);
        saveDB(db);

        io.to(chatId).emit('new_message', message);
    });

    socket.on('disconnect', () => {
        if (connectedUser) {
            const db = loadDB();
            const user = db.users.find(u => u.username === connectedUser);
            if (user) {
                user.lastSeen = new Date().toISOString();
                saveDB(db);
                io.emit('user_status_update', { username: connectedUser, lastSeen: user.lastSeen });
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});