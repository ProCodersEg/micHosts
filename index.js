const net = require('net');

// To track broadcasters and listeners grouped by channelId
let channels = {}; // channelId -> { broadcasters: Map<userId, socket>, listeners: [] }

const server = net.createServer((socket) => {
    console.log(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);

    let userId = null;   // To store the user's ID
    let channelId = null; // To store the channel ID of the user
    let role = null;      // To store whether the user is a broadcaster or a listener

    // Handle incoming data
    socket.on('data', (data) => {
        const message = data.toString().trim();

        if (message.startsWith("userId:")) {
            // Extract userId, channelId, and role from the message
            const parts = message.split(':');
            userId = parts[1];
            channelId = parts[2];
            role = parts[3]; // Either 'broadcaster' or 'listener'

            console.log(`[INFO] User ID: ${userId}, Channel: ${channelId}, Role: ${role}`);

            // Initialize the channel if it doesn't exist
            if (!channels[channelId]) {
                channels[channelId] = { broadcasters: new Map(), listeners: [] };
                console.log(`[INFO] Channel ${channelId} initialized`);
            }

            const channel = channels[channelId];

            if (role === 'broadcaster') {
                // Add the broadcaster to the channel
                if (!channel.broadcasters.has(userId)) {
                    console.log(`[INFO] Broadcaster ${userId} connected to channel ${channelId}`);
                    channel.broadcasters.set(userId, socket);

                    // When the broadcaster disconnects, remove them from the channel
                    socket.on('end', () => {
                        console.log(`[INFO] Broadcaster ${userId} disconnected from channel ${channelId}`);
                        channel.broadcasters.delete(userId);
                        cleanUpEmptyChannel(channelId);
                    });

                    // Relay audio to all listeners in the same channel (except this broadcaster)
                    socket.on('data', (audioData) => {
                        // Throttle data to avoid flooding listeners
                        channel.listeners.forEach((listener) => {
                            if (listener.userId !== userId) {
                                listener.write(audioData);
                            }
                        });
                    });
                } else {
                    console.log(`[INFO] Broadcaster ${userId} already connected to channel ${channelId}`);
                }
            } else if (role === 'listener') {
                // Add the listener to the channel
                console.log(`[INFO] Listener ${userId} connected to channel ${channelId}`);
                socket.userId = userId; // Store the listener's userId
                channel.listeners.push(socket);

                // When the listener disconnects, remove them from the channel
                socket.on('end', () => {
                    console.log(`[INFO] Listener ${userId} disconnected from channel ${channelId}`);
                    channel.listeners = channel.listeners.filter((s) => s !== socket);
                    cleanUpEmptyChannel(channelId);
                });
            }
        }
    });

    // Handle socket error
    socket.on('error', (err) => {
        console.error(`[ERROR] Socket error for ${userId || 'unknown user'}: ${err.message}`);
        // Close the socket to prevent further issues
        socket.end();
    });

    // Helper function to clean up empty channels
    const cleanUpEmptyChannel = (channelId) => {
        const channel = channels[channelId];
        if (channel && channel.broadcasters.size === 0 && channel.listeners.length === 0) {
            console.log(`[INFO] Channel ${channelId} is empty, removing it`);
            delete channels[channelId];
        }
    };

    // Helper function to limit the number of listeners per channel to prevent overload
    const limitListenersPerChannel = (channelId) => {
        const channel = channels[channelId];
        const MAX_LISTENERS = 40; // Limit listeners to 40 per channel
        if (channel.listeners.length > MAX_LISTENERS) {
            console.log(`[WARN] Channel ${channelId} exceeded max listeners limit. Dropping connection.`);
            socket.end(); // Close the connection if there are too many listeners
        }
    };

    // Check if the listener count exceeds the maximum allowed
    socket.on('data', () => {
        limitListenersPerChannel(channelId);
    });

});

// Gracefully shut down the server when all connections close
const gracefulShutdown = () => {
    console.log("[INFO] Server is shutting down gracefully.");
    Object.values(channels).forEach(({ broadcasters, listeners }) => {
        broadcasters.forEach((socket) => socket.end());
        listeners.forEach((socket) => socket.end());
    });
    server.close(() => {
        console.log("[INFO] Server closed successfully.");
    });
};

// Listen on port 3000
server.listen(3000, () => {
    console.log('[INFO] Server is running on port 3000');
});

// Handle termination signal to gracefully shut down the server
process.on('SIGINT', gracefulShutdown); // Listen for Ctrl+C or termination signal
process.on('SIGTERM', gracefulShutdown); // Listen for termination signal
//aaaa