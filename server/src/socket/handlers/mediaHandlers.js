export default function registerMediaHandlers(io, socket, { rooms }) {
  // Broadcast media state changes (mic/camera) to all peers in the room
  socket.on('media-state', ({ roomId, audio, video }) => {
    socket.to(roomId).emit('peer-media-state', { socketId: socket.id, audio, video });
  });

  // Raised hand — notify everyone in room
  socket.on('raise-hand', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      if (!room.raisedHands) room.raisedHands = [];
      if (!room.raisedHands.some(h => h.socketId === socket.id)) {
        room.raisedHands.push({ socketId: socket.id, name: socket.data.user.name });
      }
      io.to(roomId).emit('hand-raised', {
        socketId: socket.id,
        name: socket.data.user.name,
      });
    }
  });

  // Lowered hand — notify everyone in room
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

  // Screen share state — broadcast to all peers in room
  socket.on('screen-share-start', ({ roomId }) => {
    socket.to(roomId).emit('screen-share-started', { socketId: socket.id });
  });

  socket.on('screen-share-stop', ({ roomId }) => {
    socket.to(roomId).emit('screen-share-stopped', { socketId: socket.id });
  });
}
