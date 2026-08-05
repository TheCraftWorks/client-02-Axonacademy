import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { classroomStore } from '@/lib/classroomStore';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/v1$/, '')
  : import.meta.env.BACKEND_URL
    ? import.meta.env.BACKEND_URL.replace(/\/api\/v1$/, '')
    : window.location.origin;

export function useChatSocket(onMessageReceived: (msg: any) => void, currentUserId: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    const token = classroomStore.getState().accessToken;
    const socket = io(SOCKET_URL, {
      auth: {
        token: token ? `Bearer ${token}` : undefined,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[ChatSocket] Connected:', socket.id);
      socket.emit('join_user_room', currentUserId);
    });

    socket.on('receive_private_message', (data) => {
      console.log('[ChatSocket] Message received:', data);
      onMessageReceived(data);
    });

    socket.on('disconnect', () => {
      console.log('[ChatSocket] Disconnected');
    });

    socket.on('connect_error', (err) => {
      console.error('[ChatSocket] Connection error:', err);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId, onMessageReceived, SOCKET_URL]);

  const sendMessage = useCallback((receiverId: string, message: string) => {
    if (!socketRef.current || !currentUserId) return false;
    socketRef.current.emit('send_private_message', {
      senderId: currentUserId,
      receiverId,
      message,
    });
    return true;
  }, [currentUserId]);

  return { sendMessage };
}