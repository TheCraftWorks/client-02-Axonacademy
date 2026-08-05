export default function registerRoomHandlers(io, socket, { rooms, socketUsers, generateRoomId, getRoomParticipants, cleanupSocket }) {
  const user = socket.data.user;

  // ── STAFF: Create or re-join own room ──────────────────────────────────────
  socket.on('staff-create-room', (cb) => {
    if (user.role !== 'staff') return cb?.({ error: 'Not authorized' });

    // Reuse existing room if staff reconnects
    let roomId = null;
    for (const [id, room] of rooms) {
      if (room.hostUserId === user.userId) { roomId = id; break; }
    }

    if (!roomId) {
      roomId = generateRoomId();
      rooms.set(roomId, {
        hostSocketId: socket.id,
        hostUserId: user.userId,
        hostName: user.name,
        startedAt: new Date(),
        waitingList: [],
        participants: new Map(),
      });
    } else {
      rooms.get(roomId).hostSocketId = socket.id;
    }

    const room = rooms.get(roomId);
    socket.join(roomId);
    room.participants.set(socket.id, { userId: user.userId, name: user.name, role: 'staff' });
    socketUsers.set(socket.id, { ...user, roomId });

    cb?.({ roomId, participants: getRoomParticipants(roomId) });
  });

  // ── STUDENT: Request to join (enters waiting room) ─────────────────────────
  socket.on('student-request-join', ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found. The class may not have started yet.' });

    const alreadyWaiting = room.waitingList.some(w => w.socketId === socket.id);
    if (!alreadyWaiting) {
      room.waitingList.push({ socketId: socket.id, userId: user.userId, name: user.name });
    }
    socketUsers.set(socket.id, { ...user, roomId, waiting: true });

    // Notify staff
    io.to(room.hostSocketId).emit('join-request', {
      socketId: socket.id,
      userId: user.userId,
      name: user.name,
    });

    cb?.({ status: 'waiting' });
  });

  // ── STAFF: Admit student ───────────────────────────────────────────────────
  socket.on('admit-student', ({ roomId, targetSocketId }) => {
    if (user.role !== 'staff') return;
    const room = rooms.get(roomId);
    if (!room) return;

    room.waitingList = room.waitingList.filter(w => w.socketId !== targetSocketId);
    const existing = getRoomParticipants(roomId);
    io.to(targetSocketId).emit('admitted', { roomId, existingParticipants: existing });
  });

  // ── STAFF: Reject student ──────────────────────────────────────────────────
  socket.on('reject-student', ({ roomId, targetSocketId }) => {
    if (user.role !== 'staff') return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.waitingList = room.waitingList.filter(w => w.socketId !== targetSocketId);
    io.to(targetSocketId).emit('rejected');
  });

  // ── STUDENT: Join room after admission ─────────────────────────────────────
  socket.on('join-room', ({ roomId }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: 'Room not found' });

    const existingParticipants = getRoomParticipants(roomId);
    socket.join(roomId);
    room.participants.set(socket.id, { userId: user.userId, name: user.name, role: user.role });

    const su = socketUsers.get(socket.id);
    if (su) su.roomId = roomId;
    else socketUsers.set(socket.id, { ...user, roomId });

    // Notify everyone already in the room
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId: user.userId,
      name: user.name,
      role: user.role,
    });

    cb?.({ existingParticipants });
  });

  // ── STAFF: Kick a participant ──────────────────────────────────────────────
  socket.on('kick-participant', ({ roomId, targetSocketId }) => {
    if (user.role !== 'staff') return;
    const room = rooms.get(roomId);
    if (!room) return;

    io.to(targetSocketId).emit('kicked');

    // Clean up on server side
    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) cleanupSocket(targetSocket, roomId);
  });

  // ── Leave room ─────────────────────────────────────────────────────────────
  socket.on('leave-room', ({ roomId }) => cleanupSocket(socket, roomId));

  // ── Staff ends meeting ─────────────────────────────────────────────────────
  socket.on('end-meeting', ({ roomId }) => {
    if (user.role !== 'staff') return;
    io.to(roomId).emit('meeting-ended');
    rooms.delete(roomId);
  });
}
