import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { socket, connectSocket, disconnectSocket } from '../services/socket';
import { 
  addParticipant, removeParticipant, addWaitingUser, 
  removeWaitingUser, setMeetingStatus 
} from '../store/slices/meetingSlice';

export const useSocket = (roomId) => {
  const dispatch = useDispatch();
  const { token, user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!roomId) return;

    connectSocket(token);

    socket.on('connect', () => {
      // Differentiate joining as teacher (host) vs student/guest
      const joinData = {
        roomId,
        userName: user?.name || 'Guest User',
        userId: user?.id || `guest_${Math.random().toString(36).substring(7)}`,
        role: user?.role || 'student'
      };

      if (user?.role === 'teacher') {
         socket.emit('join-meeting', joinData);
      } else {
         // Student requests to join
         socket.emit('request-join', joinData);
         dispatch(setMeetingStatus('waiting'));
      }
    });

    socket.on('join-request', (data) => {
      // Triggered only for teacher
      toast((t) => (
        <div className="flex flex-col space-y-2">
          <span><b>{data.user.name}</b> wants to join.</span>
          <div className="flex space-x-2 mt-2">
            <button 
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
              onClick={() => {
                 socket.emit('admit-student', { roomId, targetUserId: data.user.userId, targetUser: data.user });
                 toast.dismiss(t.id);
                 dispatch(removeWaitingUser(data.user.userId));
              }}
            >
              Admit
            </button>
            <button 
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              onClick={() => {
                 socket.emit('reject-student', { roomId, targetUserId: data.user.userId });
                 toast.dismiss(t.id);
                 dispatch(removeWaitingUser(data.user.userId));
              }}
            >
              Deny
            </button>
          </div>
        </div>
      ), { duration: 15000 });
      
      dispatch(addWaitingUser(data.user));
    });

    socket.on('admitted', (data) => {
      dispatch(setMeetingStatus('live'));
      toast.success('The host has admitted you to the meeting.');
      socket.emit('join-meeting', { ...data, roomId });
    });

    socket.on('rejected', () => {
      dispatch(setMeetingStatus('rejected'));
      toast.error('Your request to join was declined.');
      disconnectSocket();
    });

    socket.on('user-joined', (data) => {
      dispatch(addParticipant(data.user));
      toast(`${data.user.name} joined`, { icon: '👋', duration: 2000 });
    });

    socket.on('user-left', (data) => {
      dispatch(removeParticipant(data.userId));
    });

    socket.on('meeting-ended', () => {
      toast('The host ended the meeting');
      dispatch(setMeetingStatus('ended'));
      disconnectSocket();
    });

    return () => {
      socket.off('connect');
      socket.off('join-request');
      socket.off('admitted');
      socket.off('rejected');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('meeting-ended');
      disconnectSocket();
    };
  }, [roomId, token, user, dispatch]);

  return { socket };
};
