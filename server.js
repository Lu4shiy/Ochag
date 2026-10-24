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

// Инициализация базы данных (в виде JSON файла для простоты работы на MVP)
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

// Получение списка чатов и сообщений
app.get('/api/data', (req, res) => {
    const db = loadDB();
    res.json({ chats: db.chats, messages: db.messages });
});

// WebSocket логика реального времени
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