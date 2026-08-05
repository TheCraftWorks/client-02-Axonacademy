import registerRoomHandlers from './handlers/roomHandlers.js';
import registerChatHandlers from './handlers/chatHandlers.js';
import registerMediaHandlers from './handlers/mediaHandlers.js';

// ── Shared in-memory state ──────────────────────────────────────────────────
// roomId → { hostSocketId, hostUserId, hostName, startedAt, waitingList, participants }
export const rooms = new Map();

// socketId → { userId, name, role, roomId }
export const socketUsers = new Map();

// ── Helpers ─────────────────────────────────────────────────────────────────
function generateRoomId() {
  const r = () => Math.floor(100 + Math.random() * 900);
  return `${r()}-${r()}-${r()}`;
}

function getRoomParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.participants.entries()).map(([socketId, u]) => ({ socketId, ...u }));
}

function makeCleanupSocket(io) {
  return function cleanupSocket(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const name = socketUsers.get(socket.id)?.name || socket.data?.user?.name;
    room.participants.delete(socket.id);
    room.waitingList = room.waitingList.filter(w => w.socketId !== socket.id);
    socket.leave(roomId);

    // Include name so client can show "X left the class"
    socket.to(roomId).emit('user-left', { socketId: socket.id, name });

    // If the host disconnected, end the meeting for everyone
    if (room.hostSocketId === socket.id) {
      io.to(roomId).emit('meeting-ended');
      rooms.delete(roomId);
    }
  };
}

// ── Socket.io initialiser ────────────────────────────────────────────────────
export default function initSocket(io) {
  const cleanupSocket = makeCleanupSocket(io);

  const shared = { rooms, socketUsers, generateRoomId, getRoomParticipants, cleanupSocket };

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[+] ${user.name} (${user.role}) connected — ${socket.id}`);

    registerRoomHandlers(io, socket, shared);
    registerChatHandlers(io, socket);
    registerMediaHandlers(io, socket, shared);

    socket.on('disconnect', () => {
      console.log(`[-] ${user.name} disconnected — ${socket.id}`);
      const su = socketUsers.get(socket.id);
      if (su?.roomId) cleanupSocket(socket, su.roomId);
      socketUsers.delete(socket.id);
    });
  });
}
