export default function (io, socket) {
  socket.on('webrtc-offer', ({ targetUserId, fromUserId, offer }) => {
    // In a map of userId -> socketId, we'd lookup targetUserId's socket.
    // For MVP broadcasting to a specific user by assuming we have their socket or broadcasting to room
    // Here we assume targetUserId is the socket.id or we can emit to the room and let the client filter
    io.emit('webrtc-offer', { targetUserId, fromUserId, offer });
  });

  socket.on('webrtc-answer', ({ targetUserId, fromUserId, answer }) => {
    io.emit('webrtc-answer', { targetUserId, fromUserId, answer });
  });
}
