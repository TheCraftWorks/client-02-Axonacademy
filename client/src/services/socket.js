import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket({ token, guestName } = {}) {
  if (socket && socket.connected) return socket;

  const auth = {};
  if (token) auth.token = token;
  if (guestName) auth.guestName = guestName;

  socket = io(SOCKET_URL, {
    auth,
    // Start with polling so mobile carrier proxies don't block the connection.
    // Socket.IO will automatically upgrade to WebSocket once polling is stable.
    transports: ['polling', 'websocket'],
    upgrade: true,
    // Longer timeouts for Render cold-starts and slow mobile networks
    timeout: 20000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default { getSocket, connectSocket, disconnectSocket };
