const express = require('express');
const net = require('net');

const app = express();

// Handle HTTP requests (needed for Vercel)
app.get('/', (req, res) => {
    res.send('Voice broadcast server is running!');
});

// Add TCP server for voice broadcasting
let listeners = [];
const tcpServer = net.createServer((socket) => {
    console.log('New connection');

    if (!listeners.length) {
        console.log('Broadcaster connected');
        socket.on('data', (data) => {
            listeners.forEach((listener) => listener.write(data));
        });

        socket.on('end', () => {
            console.log('Broadcaster disconnected');
            listeners = [];
        });

    } else {
        console.log('New listener connected');
        listeners.push(socket);

        socket.on('end', () => {
            console.log('Listener disconnected');
            listeners = listeners.filter((s) => s !== socket);
        });
    }
});

tcpServer.listen(4000, () => {
    console.log('TCP server running on port 4000');
});

// Export the app for Vercel
module.exports = app;
