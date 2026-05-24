require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

const PORT = process.env.PORT || 3000;

// Serve frontend files
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    ssl: {
        rejectUnauthorized: false
    }
});

// Test DB connection
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to MySQL database');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed');
        console.error(err);
    }
})();

// Homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io
io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);

    // Load old messages
    try {
        const [rows] = await pool.query(
            'SELECT username, message, created_at FROM messages ORDER BY id ASC LIMIT 50'
        );

        socket.emit('load history', rows);

    } catch (err) {
        console.error('Error loading history:', err);
    }

    // Receive chat message
    socket.on('chat message', async (data) => {

        const username = data.username;
        const message = data.message;

        if (!username || !message) return;

        try {

            // Save to database
            await pool.query(
                'INSERT INTO messages (username, message) VALUES (?, ?)',
                [username, message]
            );

            // Broadcast to all users
            io.emit('chat message', {
                username,
                message
            });

        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
