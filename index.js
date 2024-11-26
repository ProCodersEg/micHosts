import { createServer } from 'http';
import WebSocket from 'ws';

let channels = {}; // channelId -> { broadcasters: Map<userId, socket>, listeners: [] }

const server = createServer((req, res) => {
  // HTTP request handling (e.g., serve static files or respond with a message)
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running');
});

const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connections
wss.on('connection', (socket, req) => {
  console.log(`New WebSocket connection from ${req.connection.remoteAddress}`);

  let userId = null;
  let channelId = null;
  let role = null;

  socket.on('message', (data) => {
    const message = data.toString().trim();
    
    if (message.startsWith("userId:")) {
      const parts = message.split(':');
      userId = parts[1];
      channelId = parts[2];
      role = parts[3]; // 'broadcaster' or 'listener'
      console.log(`[INFO] User ID: ${userId}, Channel: ${channelId}, Role: ${role}`);

      if (!channels[channelId]) {
        channels[channelId] = { broadcasters: new Map(), listeners: [] };
        console.log(`[INFO] Channel ${channelId} initialized`);
      }

      const channel = channels[channelId];

      if (role === 'broadcaster') {
        if (!channel.broadcasters.has(userId)) {
          console.log(`[INFO] Broadcaster ${userId} connected to channel ${channelId}`);
          channel.broadcasters.set(userId, socket);

          socket.on('close', () => {
            console.log(`[INFO] Broadcaster ${userId} disconnected from channel ${channelId}`);
            channel.broadcasters.delete(userId);
            cleanUpEmptyChannel(channelId);
          });

          socket.on('message', (audioData) => {
            channel.listeners.forEach((listener) => {
              if (listener.userId !== userId) {
                listener.send(audioData);
              }
            });
          });
        }
      } else if (role === 'listener') {
        console.log(`[INFO] Listener ${userId} connected to channel ${channelId}`);
        socket.userId = userId;
        channel.listeners.push(socket);

        socket.on('close', () => {
          console.log(`[INFO] Listener ${userId} disconnected from channel ${channelId}`);
          channel.listeners = channel.listeners.filter((s) => s !== socket);
          cleanUpEmptyChannel(channelId);
        });
      }
    }
  });

  socket.on('error', (err) => {
    console.error(`[ERROR] Socket error for ${userId || 'unknown user'}: ${err.message}`);
    socket.close();
  });
});

// Helper function to clean up empty channels
const cleanUpEmptyChannel = (channelId) => {
  const channel = channels[channelId];
  if (channel && channel.broadcasters.size === 0 && channel.listeners.length === 0) {
    console.log(`[INFO] Channel ${channelId} is empty, removing it`);
    delete channels[channelId];
  }
};

// Upgrade HTTP server to handle WebSocket connections
server.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

// Export the handler function for Vercel
export default (req, res) => {
  server.emit('request', req, res);  // Forward requests to the server
};
