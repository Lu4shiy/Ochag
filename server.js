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
app.use(express.json());

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
    const newUser = { id: Date.now().toString(), username, password: hashedPassword };
    db.users.push(newUser);
    saveDB(db);

    res.json({ success: true, user: { id: newUser.id, username: newUser.username } });
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

    res.json({ success: true, user: { id: user.id, username: user.username } });
});

// Получение данных с фильтрацией личных чатов для конкретного пользователя
app.get('/api/data', (req, res) => {
    const username = req.query.username;
    const db = loadDB();

    const filteredChats = db.chats.filter(chat => {
        if (chat.type === 'channel' || chat.type === 'community') {
            return true; // Каналы и сообщества видны всем
        }
        if (chat.type === 'dm') {
            return chat.participants && chat.participants.includes(username);
        }
        return false;
    });

    res.json({ chats: filteredChats, messages: db.messages });
});

// Создание нового пространства (чата, канала или сообщества)
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

        // Проверяем, существует ли уже такой личный чат
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

// WebSocket логика
io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

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
        console.log('Пользователь отключился:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});