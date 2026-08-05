export default function registerChatHandlers(io, socket) {
  const user = socket.data.user;

  socket.on('send-message', ({ roomId, message }) => {
    if (!message?.trim()) return;
    io.to(roomId).emit('new-message', {
      senderId: socket.id,
      senderName: user.name,
      message: message.trim(),
      timestamp: Date.now(),
    });
  });
}
