const { Server } = require('socket.io');

let io = null;

// ── In-memory state for Virtual Classroom WebRTC rooms ───────────────────────
// roomId → { hostSocketId, hostUserId, hostName, startedAt, waitingList, participants }
const rooms = new Map();

// socketId → { userId, name, role, roomId }
const socketUsers = new Map();

// ── Helpers for Virtual Classroom ──────────────────────────────────────────
function getRoomParticipants(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.participants.entries()).map(([socketId, u]) => ({ socketId, ...u }));
}

function cleanupSocket(socket, roomId) {
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

    // Update MongoDB status to ended
    const LiveMeeting = require('../models/LiveMeeting');
    const Attendance = require('../models/Attendance');
    LiveMeeting.findOne({ roomId }).then(async meeting => {
      if (meeting) {
        meeting.status = 'ended';
        meeting.endedAt = new Date();
        for (const attendee of meeting.attendees) {
          if (!attendee.leftAt) {
            attendee.leftAt = meeting.endedAt;
            const diffMs = attendee.leftAt - attendee.joinedAt;
            attendee.duration = Math.max(0, Math.round(diffMs / 60000));
          }
          const scheduledDate = meeting.scheduledAt || attendee.joinedAt || new Date();
          await Attendance.findOneAndUpdate(
            { meeting: meeting._id, student: attendee.student },
            {
              $set: {
                classroom: meeting.classroom,
                date: scheduledDate,
                status: attendee.duration >= 1 ? 'present' : 'late',
                markedBy: 'auto',
                joinedAt: attendee.joinedAt,
                leftAt: attendee.leftAt,
                duration: attendee.duration
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
        return meeting.save();
      }
    }).catch(err => {
      console.error('[Socket cleanupSocket Error] Could not update meeting status to ended:', err.message);
    });
  }
}

// ── Build the same allowed-origins list that app.js uses ─────────────────────
function buildAllowedOrigins() {
  const rawOrigins = process.env.CLIENT_URL || '';
  const origins = rawOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    ['http://localhost:3000', 'http://localhost:5173',
      'http://localhost:8080', 'http://localhost:8081'].forEach(o => {
        if (!origins.includes(o)) origins.push(o);
      });
  }
  return origins;
}

function socketCorsOrigin(origin, callback) {
  // Allow server-to-server / Postman (no origin header)
  if (!origin) return callback(null, true);

  const allowed = buildAllowedOrigins();

  // Exact match
  if (allowed.includes(origin)) return callback(null, true);

  // Allow all *.vercel.app preview and production deployments
  if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin) ||
    /^https:\/\/[a-zA-Z0-9-]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+\.vercel\.app$/.test(origin)) {
    return callback(null, true);
  }

  console.error(`[Socket.io CORS] BLOCKED: ${origin}`);
  return callback(new Error(`Origin ${origin} is not allowed`));
}

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: socketCorsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    },
    pingTimeout: 60000
  });

  console.log('[Socket.io] Realtime Server initialized');

  // ── Authentication Middleware ──────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        // Fallback for guest or anonymous connections
        socket.data.user = {
          userId: `guest_${socket.id}`,
          name: socket.handshake.auth?.guestName || 'Guest User',
          role: 'student'
        };
        return next();
      }

      const jwt = require('jsonwebtoken');
      const User = require('../models/User');

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'local_access_secret_for_development_purposes_only_12345');
      const user = await User.findById(decoded.id);
      if (!user) {
        socket.data.user = {
          userId: `guest_${socket.id}`,
          name: socket.handshake.auth?.guestName || 'Guest User',
          role: 'student'
        };
        return next();
      }

      socket.data.user = {
        userId: user._id.toString(),
        name: user.fullName,
        role: user.role === 'student' ? 'student' : 'staff', // map faculty/admin to staff for host capabilities
      };
      next();
    } catch (err) {
      console.warn('[Socket Auth Warning] Failed to authenticate socket connection. Fallback to guest:', err.message);
      socket.data.user = {
        userId: `guest_${socket.id}`,
        name: socket.handshake.auth?.guestName || 'Guest User',
        role: 'student'
      };
      next();
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[Socket.io] User connected: ${user.name} (${user.role}) — ${socket.id}`);

    // ==================== EXISTENT PLATFORM EVENTS ====================
    // Join room event (notifications, chats etc)
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`[Socket.io] Socket ${socket.id} joined room ${roomId}`);
    });

    // Join active live class room
    socket.on('join_live_room', (roomId) => {
      const liveRoom = `live:${roomId}`;
      socket.join(liveRoom);
      console.log(`[Socket.io] Socket ${socket.id} joined live room ${liveRoom}`);
    });

    // Live class chat messages
    socket.on('live_chat_message', (data) => {
      if (!data?.roomId || !data?.message) return;
      const liveRoom = `live:${data.roomId}`;
      socket.to(liveRoom).emit('live_chat_message', {
        message: data.message,
        sender: data.sender,
        createdAt: new Date().toISOString()
      });
    });

    // Raise hand event for live class
    socket.on('raise_hand', (data) => {
      if (!data?.roomId || !data?.sender) return;
      const liveRoom = `live:${data.roomId}`;
      socket.to(liveRoom).emit('student_raised_hand', {
        sender: data.sender,
        reason: data.reason || 'Requesting attention',
        timestamp: new Date().toISOString()
      });
    });

    // Proctor flags/incidents real-time event
    socket.on('proctor_incident', (data) => {
      console.log(`[Socket.io] AI proctoring flag received:`, data);
      socket.to(data.roomId).emit('proctor_flag_alert', data);
    });

    // Join user personal room for private messaging
    socket.on('join_user_room', (userId) => {
      if (!userId) return;
      socket.join(userId);
      console.log(`[Socket.io] Socket ${socket.id} joined user room ${userId}`);
    });

    // Send private message via Socket.IO
    socket.on('send_private_message', async (data) => {
      try {
        if (!data?.receiverId || !data?.message || !data?.senderId) return;

        const Message = require('../models/Message');
        const newMessage = await Message.create({
          senderId: data.senderId,
          receiverId: data.receiverId,
          message: data.message
        });

        await newMessage.populate('senderId', 'fullName email role');
        await newMessage.populate('receiverId', 'fullName email role');

        const messageData = {
          _id: newMessage._id,
          senderId: newMessage.senderId,
          receiverId: newMessage.receiverId,
          message: newMessage.message,
          createdAt: newMessage.createdAt,
          updatedAt: newMessage.updatedAt
        };

        // Emit to receiver's room
        socket.to(data.receiverId).emit('receive_private_message', messageData);

        // Also emit back to sender for confirmation/UI update
        socket.emit('receive_private_message', messageData);
      } catch (error) {
        console.error('[Socket.io] Error sending private message:', error);
      }
    });

    // ==================== VIRTUAL CLASSROOM EVENTS ====================
    // ── STAFF: Create or re-join own room
    socket.on('staff-create-room', ({ roomId }, cb) => {
      if (user.role !== 'staff') return cb?.({ error: 'Not authorized' });
      if (!roomId) return cb?.({ error: 'Room ID is required' });

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          hostSocketId: socket.id,
          hostUserId: user.userId,
          hostName: user.name,
          startedAt: new Date(),
          waitingList: [],
          participants: new Map(),
        });
      } else {
        const room = rooms.get(roomId);
        room.hostSocketId = socket.id;
        room.hostUserId = user.userId;
        room.hostName = user.name;
        if (!room.startedAt) room.startedAt = new Date();
        
        // Notify host about existing students in waiting room
        room.waitingList.forEach(w => {
           socket.emit('join-request', {
             socketId: w.socketId,
             userId: w.userId,
             name: w.name
           });
        });
      }

      const room = rooms.get(roomId);
      socket.join(roomId);
      room.participants.set(socket.id, { userId: user.userId, name: user.name, role: 'staff' });
      socketUsers.set(socket.id, { ...user, roomId });

      cb?.({ roomId, participants: getRoomParticipants(roomId) });
    });

    // ── STUDENT: Request to join (enters waiting room)
    socket.on('student-request-join', async ({ roomId }, cb) => {
      let room = rooms.get(roomId);
      if (!room) {
        // Allow waiting even if host hasn't joined yet, verify meeting exists in DB
        try {
          const LiveMeeting = require('../models/LiveMeeting');
          const meeting = await LiveMeeting.findOne({ roomId });
          if (!meeting || meeting.status === 'cancelled' || meeting.status === 'ended') {
            return cb?.({ error: 'Class is not available.' });
          }
          // Initialize room structure
          rooms.set(roomId, {
            hostSocketId: null,
            hostUserId: null,
            hostName: null,
            startedAt: null,
            waitingList: [],
            participants: new Map(),
          });
          room = rooms.get(roomId);
        } catch (err) {
          return cb?.({ error: 'Failed to verify class.' });
        }
      }

      const alreadyWaiting = room.waitingList.some(w => w.socketId === socket.id);
      if (!alreadyWaiting) {
        room.waitingList.push({ socketId: socket.id, userId: user.userId, name: user.name });
      }
      socketUsers.set(socket.id, { ...user, roomId, waiting: true });

      // Notify staff/host if they are already in the room
      if (room.hostSocketId) {
        io.to(room.hostSocketId).emit('join-request', {
          socketId: socket.id,
          userId: user.userId,
          name: user.name,
        });
      }

      cb?.({ status: 'waiting' });
    });

    // ── STAFF: Admit student
    socket.on('admit-student', ({ roomId, targetSocketId }) => {
      if (user.role !== 'staff') return;
      const room = rooms.get(roomId);
      if (!room) return;

      room.waitingList = room.waitingList.filter(w => w.socketId !== targetSocketId);
      const existing = getRoomParticipants(roomId);
      io.to(targetSocketId).emit('admitted', { roomId, existingParticipants: existing });
    });

    // ── STAFF: Reject student
    socket.on('reject-student', ({ roomId, targetSocketId }) => {
      if (user.role !== 'staff') return;
      const room = rooms.get(roomId);
      if (!room) return;
      room.waitingList = room.waitingList.filter(w => w.socketId !== targetSocketId);
      io.to(targetSocketId).emit('rejected');
    });

    // ── STUDENT: Join room after admission
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

    // ── STAFF: Kick a participant
    socket.on('kick-participant', ({ roomId, targetSocketId }) => {
      if (user.role !== 'staff') return;
      const room = rooms.get(roomId);
      if (!room) return;

      io.to(targetSocketId).emit('kicked');

      // Clean up on server side
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) cleanupSocket(targetSocket, roomId);
    });

    // ── Leave room
    socket.on('leave-room', ({ roomId }) => cleanupSocket(socket, roomId));

    // ── Staff ends meeting
    socket.on('end-meeting', async ({ roomId }) => {
      if (user.role !== 'staff') return;
      io.to(roomId).emit('meeting-ended');
      rooms.delete(roomId);

      try {
        const LiveMeeting = require('../models/LiveMeeting');
        const Attendance = require('../models/Attendance');
        const meeting = await LiveMeeting.findOne({ roomId });
        if (meeting) {
          meeting.status = 'ended';
          meeting.endedAt = new Date();
          for (const attendee of meeting.attendees) {
            if (!attendee.leftAt) {
              attendee.leftAt = meeting.endedAt;
              const diffMs = attendee.leftAt - attendee.joinedAt;
              attendee.duration = Math.max(0, Math.round(diffMs / 60000));
            }
            const scheduledDate = meeting.scheduledAt || attendee.joinedAt || new Date();
            await Attendance.findOneAndUpdate(
              { meeting: meeting._id, student: attendee.student },
              {
                $set: {
                  classroom: meeting.classroom,
                  date: scheduledDate,
                  status: attendee.duration >= 1 ? 'present' : 'late',
                  markedBy: 'auto',
                  joinedAt: attendee.joinedAt,
                  leftAt: attendee.leftAt,
                  duration: attendee.duration
                }
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          }
          await meeting.save();
        }
      } catch (err) {
        console.error('[Socket end-meeting Error] Could not update meeting status to ended:', err.message);
      }
    });

    // ── Classroom Chat messages
    socket.on('send-message', ({ roomId, message }) => {
      if (!message?.trim()) return;
      io.to(roomId).emit('new-message', {
        senderId: socket.id,
        senderName: user.name,
        message: message.trim(),
        timestamp: Date.now(),
      });
    });

    // ── Broadcast media state changes (mic/camera) to all peers in the room
    socket.on('media-state', ({ roomId, audio, video }) => {
      socket.to(roomId).emit('peer-media-state', { socketId: socket.id, audio, video });
    });

    // ── Raised hand (classroom)
    socket.on('raise-hand', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room) {
        if (!room.raisedHands) room.raisedHands = [];
        if (!room.raisedHands.some(h => h.socketId === socket.id)) {
          room.raisedHands.push({ socketId: socket.id, name: user.name });
        }
        io.to(roomId).emit('hand-raised', {
          socketId: socket.id,
          name: user.name,
        });
      }
    });

    // ── Lowered hand (classroom)
    socket.on('lower-hand', ({ roomId, targetSocketId }) => {
      const room = rooms.get(roomId);
      if (room) {
        if (room.raisedHands) {
          room.raisedHands = room.raisedHands.filter(h => h.socketId !== targetSocketId);
        }
        io.to(roomId).emit('hand-lowered', {
          socketId: targetSocketId,
        });
      }
    });

    // ── Screen share state
    socket.on('screen-share-start', ({ roomId }) => {
      socket.to(roomId).emit('screen-share-started', { socketId: socket.id });
    });

    socket.on('screen-share-stop', ({ roomId }) => {
      socket.to(roomId).emit('screen-share-stopped', { socketId: socket.id });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${user.name})`);
      const su = socketUsers.get(socket.id);
      if (su?.roomId) cleanupSocket(socket, su.roomId);
      socketUsers.delete(socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('[Socket.io] Cannot retrieve socket instance before initialization!');
  }
  return io;
};

module.exports = {
  initSocket,
  getIO
};
