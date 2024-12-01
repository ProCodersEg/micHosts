const WebSocket = require('ws');

// To track broadcasters and listeners grouped by channelId
let channels = {}; // channelId -> { broadcasters: Map<userId, WebSocket>, listeners: [] }

export default (req, res) => {
  if (req.method === 'GET') {
    // Create WebSocket server instance with noServer option
    const wss = new WebSocket.Server({ noServer: true });

    // Handle WebSocket connection
    wss.on('connection', (ws) => {
      console.log('[INFO] New WebSocket connection');

      let userId = null;
      let channelId = null;
      let role = null;

      ws.on('message', (message) => {
        const data = message.toString().trim();
        if (data.startsWith("userId:")) {
          const parts = data.split(':');
          userId = parts[1];
          channelId = parts[2];
          role = parts[3];

          console.log(`[INFO] User ID: ${userId}, Channel: ${channelId}, Role: ${role}`);

          if (!channels[channelId]) {
            channels[channelId] = { broadcasters: new Map(), listeners: [] };
          }
          const channel = channels[channelId];

          if (role === 'broadcaster') {
            // Check if the broadcaster is already connected
            if (!channel.broadcasters.has(userId)) {
              console.log(`[INFO] Broadcaster ${userId} connected to channel ${channelId}`);
              channel.broadcasters.set(userId, ws);

              // Handle incoming audio data from broadcaster
              ws.on('message', (audioData) => {
                if (typeof audioData !== 'string') {
                  channel.listeners.forEach(listener => {
                    if (listener.userId !== userId) {
                      listener.send(audioData);
                    }
                  });
                }
              });

              // Handle broadcaster disconnection
              ws.on('close', () => {
                console.log(`[INFO] Broadcaster ${userId} disconnected from channel ${channelId}`);
                channel.broadcasters.delete(userId);
                cleanUpEmptyChannel(channelId);
              });

            } else {
              console.log(`[INFO] Broadcaster ${userId} already connected to channel ${channelId}`);
            }
          } else if (role === 'listener') {
            console.log(`[INFO] Listener ${userId} connected to channel ${channelId}`);
            ws.userId = userId;
            channel.listeners.push(ws);

            ws.on('close', () => {
              console.log(`[INFO] Listener ${userId} disconnected from channel ${channelId}`);
              channel.listeners = channel.listeners.filter(listener => listener !== ws);
              cleanUpEmptyChannel(channelId);
            });

            limitListenersPerChannel(channelId);
          }
        }
      });

      // Error handling to ensure disconnections are captured
      ws.on('error', (err) => {
        console.error(`[ERROR] WebSocket error for ${userId || 'unknown user'}: ${err.message}`);
        ws.close();
      });

      // Ping-pong handling (if you are using a ping/pong mechanism)
      ws.on('pong', () => {
        console.log('[INFO] Pong received');
      });

      // Helper function to clean up empty channels
      const cleanUpEmptyChannel = (channelId) => {
        const channel = channels[channelId];
        if (channel && channel.broadcasters.size === 0 && channel.listeners.length === 0) {
          console.log(`[INFO] Channel ${channelId} is empty, removing it`);
          delete channels[channelId];
        }
      };

      // Helper function to limit the number of listeners per channel
      const limitListenersPerChannel = (channelId) => {
        const channel = channels[channelId];
        const MAX_LISTENERS = 100; // Limit listeners to 100 per channel
        if (channel.listeners.length > MAX_LISTENERS) {
          console.log(`[WARN] Channel ${channelId} exceeded max listeners limit. Dropping connection.`);
          ws.close(); // Close the connection if there are too many listeners
        }
      };
    });

    // Upgrade HTTP connection to WebSocket
    res.socket.server.on('upgrade', (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });

    // Send response for HTTP request
    res.status(200).send('WebSocket server is running');
  } else {
    res.status(405).send('Method Not Allowed');
  }
};
