export default function (io, socket) {
  socket.on('request-join', (data) => {
    const { roomId, userName, userId, role } = data;
    
    // In a real app, you'd find the explicit socket of the host of this room
    // For now, we broadcast to the room so any host in it will see the request
    // Typically, the teacher joins the room `roomId`
    socket.join(`waiting-${roomId}`);
    
    io.to(roomId).emit('join-request', {
      user: { userId, name: userName, role, socketId: socket.id }
    });
  });

  socket.on('admit-student', ({ roomId, targetUserId, targetUser }) => {
    // We emit back to the specific socket that requested
    if (targetUser && targetUser.socketId) {
      io.to(targetUser.socketId).emit('admitted', { user: targetUser });
    }
  });

  socket.on('reject-student', ({ roomId, targetUserId, targetUser }) => {
    if (targetUser && targetUser.socketId) {
      io.to(targetUser.socketId).emit('rejected', { reason: 'Host declined your request.' });
    }
  });

  socket.on('join-meeting', (data) => {
    const { roomId, user } = data;
    socket.join(roomId);

    // Notify others
    socket.to(roomId).emit('user-joined', { user });
    
    // You'd also handle sending current participants to the newly joined user here
  });
}
