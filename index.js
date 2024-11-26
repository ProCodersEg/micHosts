const WebSocket = require('ws');

let channels = {}; // channelId -> { broadcasters: Map<userId, ws>, listeners: [] }

module.exports = (req, res) => {
  // Create a WebSocket server in the serverless function handler
  const wss = new WebSocket.Server({ noServer: true });

  // Handle WebSocket connection
  wss.on('connection', (ws) => {
    console.log('New connection');

    let userId = null;
    let channelId = null;
    let role = null;

    ws.on('message', (message) => {
      const msg = message.toString().trim();

      if (msg.startsWith("userId:")) {
        const parts = msg.split(':');
        userId = parts[1];
        channelId = parts[2];
        role = parts[3]; // broadcaster or listener

        console.log(`[INFO] User ID: ${userId}, Channel: ${channelId}, Role: ${role}`);

        if (!channels[channelId]) {
          channels[channelId] = { broadcasters: new Map(), listeners: [] };
          console.log(`[INFO] Channel ${channelId} initialized`);
        }

        const channel = channels[channelId];

        if (role === 'broadcaster') {
          if (!channel.broadcasters.has(userId)) {
            console.log(`[INFO] Broadcaster ${userId} connected to channel ${channelId}`);
            channel.broadcasters.set(userId, ws);

            ws.on('close', () => {
              console.log(`[INFO] Broadcaster ${userId} disconnected`);
              channel.broadcasters.delete(userId);
              cleanUpEmptyChannel(channelId);
            });

            ws.on('message', (audioData) => {
              channel.listeners.forEach((listener) => {
                if (listener.userId !== userId) {
                  listener.send(audioData);
                }
              });
            });
          } else {
            console.log(`[INFO] Broadcaster ${userId} already connected`);
          }
        } else if (role === 'listener') {
          console.log(`[INFO] Listener ${userId} connected to channel ${channelId}`);
          ws.userId = userId;
          channel.listeners.push(ws);

          ws.on('close', () => {
            console.log(`[INFO] Listener ${userId} disconnected`);
            channel.listeners = channel.listeners.filter((listener) => listener !== ws);
            cleanUpEmptyChannel(channelId);
          });
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[ERROR] WebSocket error: ${err.message}`);
      ws.close();
    });
  });

  // Handle the HTTP request
  req.socket.server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  res.status(200).send('WebSocket server is running');
};

// Helper function to clean up empty channels
const cleanUpEmptyChannel = (channelId) => {
  const channel = channels[channelId];
  if (channel && channel.broadcasters.size === 0 && channel.listeners.length === 0) {
    console.log(`[INFO] Channel ${channelId} is empty, removing it`);
    delete channels[channelId];
  }
};
