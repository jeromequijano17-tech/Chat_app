require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static frontend files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Create MySQL database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Manage Socket.io connections
io.on('connection', async (socket) => {
    console.log('A user connected:', socket.id);

    // 1. Fetch past messages from MySQL and send them to the newly connected user
    try {
        const [rows] = await pool.query('SELECT username, message, created_at FROM messages ORDER BY id ASC LIMIT 50');
        socket.emit('load history', rows);
    } catch (err) {
        console.error('Error fetching chat history:', err);
    }

    // 2. Listen for incoming chat messages from clients
    socket.on('chat message', async (data) => {
        const { username, message } = data;

        if (!username || !message) return;

        // 3. Save the message to the MySQL database
        try {
            await pool.query('INSERT INTO messages (username, message) VALUES (?, ?)', [username, message]);
            
            // 4. Broadcast the message to all connected clients (including the sender)
            io.emit('chat message', { username, message });
        } catch (err) {
            console.error('Error saving message to database:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
