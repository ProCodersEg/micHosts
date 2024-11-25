const net = require('net');

let listeners = [];

const server = net.createServer((socket) => {
    console.log('New connection');

    // If it's the broadcaster
    if (!listeners.length) {
        console.log('Broadcaster connected');
        socket.on('data', (data) => {
            // Relay data to all listeners
            listeners.forEach((listener) => listener.write(data));
        });

        socket.on('end', () => {
            console.log('Broadcaster disconnected');
            listeners = [];
        });

    } else {
        // Add new listener
        console.log('New listener connected');
        listeners.push(socket);

        socket.on('end', () => {
            console.log('Listener disconnected');
            listeners = listeners.filter((s) => s !== socket);
        });
    }
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});
