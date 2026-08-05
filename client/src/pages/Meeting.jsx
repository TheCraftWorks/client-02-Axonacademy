import { useEffect, useRef, useState, useCallback } from 'react';
import { playJoinSound, playHandSound } from '../utils/sounds';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { connectSocket, getSocket, disconnectSocket } from '../services/socket';
import { setStatus, addParticipant, removeParticipant,
  addToWaiting, removeFromWaiting, addMessage,
  resetMeeting, setRoomId, setScreenSharing,
  addRaisedHand, removeRaisedHand,
} from '../store/slices/meetingSlice';
import { isMobileDevice } from '../utils/deviceDetect';
import { LiveKitRoom } from '@livekit/components-react';
import { isNativeAppInstalled, openNativeApp } from '../utils/nativeApp';
import VideoGrid from '../components/meeting/VideoGrid';
import ControlBar from '../components/meeting/ControlBar';
import ChatPanel from '../components/meeting/ChatPanel';
import ParticipantsPanel from '../components/meeting/ParticipantsPanel';
import WaitingPanel from '../components/meeting/WaitingPanel';

// Default connection details
const LK_SERVER_URL = import.meta.env.VITE_LIVEKIT_URL || "wss://your-livekit-server-url";

export default function Meeting() {
  const { roomId: routeRoomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user, token } = useSelector(s => s.auth);
  const { status, activePanel, raisedHands } = useSelector(s => s.meeting);

  const isStaff = user?.role === 'staff';
  const isNewRoom = routeRoomId === 'new';
  const stateData = location.state || {};

  const [liveRoomId, setLiveRoomId] = useState(isNewRoom ? null : routeRoomId);
  const roomIdRef = useRef(isNewRoom ? null : routeRoomId);
  const [lkToken, setLkToken] = useState(null);

  // Maintain UI toggles
  const [audioEnabled, setAudioEnabled] = useState(stateData.micOn !== false);
  const [videoEnabled, setVideoEnabled] = useState(stateData.camOn !== false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  useEffect(() => { roomIdRef.current = liveRoomId; }, [liveRoomId]);

  // Check and open native app for screen sharing on mobile
  useEffect(() => {
    const checkNativeApp = async () => {
      if (!isMobileDevice() || status !== 'live' || !liveRoomId || !lkToken) return;
      const installed = await isNativeAppInstalled();
      if (installed) {
        openNativeApp(liveRoomId, lkToken);
      }
    };
    checkNativeApp();
  }, [status, liveRoomId, lkToken]);

  // Fetch LiveKit Token
  const fetchLiveKitToken = async (roomIdentifier, uName) => {
    try {
      // Typically URL should match process.env or just relative URL from backend
      const res = await fetch(`/api/livekit/get-token?room=${roomIdentifier}&participantName=${encodeURIComponent(uName)}`);
      if (!res.ok) throw new Error('Could not fetch Token');
      const data = await res.json();
      setLkToken(data.token);
    } catch (err) {
      console.error('LK Token fetch error:', err);
      dispatch(setStatus('error'));
    }
  };

  useEffect(() => {
    let mounted = true;
    let socket;

    const run = async () => {
      socket = connectSocket({
        token,
        guestName: !token ? (stateData.guestName || user?.name || 'Guest') : undefined,
      });

      socket.on('connect_error', (err) => {
        if (mounted) dispatch(setStatus('error'));
      });

      socket.on('admitted', ({ roomId: admittedRoomId, existingParticipants }) => {
        if (!mounted) return;
        socket.emit('join-room', { roomId: admittedRoomId }, (res) => {
          if (!mounted) return;
          dispatch(setStatus('live'));
          startTimer();
          fetchLiveKitToken(admittedRoomId, user?.name || stateData.guestName);
        });
      });

      socket.on('rejected', () => { if (mounted) dispatch(setStatus('rejected')); });

      socket.on('user-joined', ({ socketId, name, role }) => {
        if (!mounted) return;
        dispatch(addParticipant({ socketId, name, role }));
        dispatch(addMessage({ senderId: '__system__', senderName: 'System', message: `${name} joined the class`, timestamp: Date.now(), _system: true }));
      });

      socket.on('join-request', ({ socketId, name }) => {
        if (!mounted) return;
        dispatch(addToWaiting({ socketId, name }));
        setJoinRequests(prev => [...prev, { socketId, name, id: Date.now() }]);
        if (isStaff) playJoinSound();
      });

      socket.on('user-left', ({ socketId, name }) => {
        if (!mounted) return;
        dispatch(removeParticipant(socketId));
        dispatch(removeFromWaiting(socketId));
        if (name) {
          dispatch(addMessage({ senderId: '__system__', senderName: 'System', message: `${name} left the class`, timestamp: Date.now(), _system: true }));
        }
      });

      socket.on('meeting-ended', () => { if (mounted) dispatch(setStatus('ended')); });

      socket.on('kicked', () => {
        if (!mounted) return;
        dispatch(resetMeeting());
        navigate('/', { replace: true });
      });

      socket.on('new-message', (msg) => { if (mounted) dispatch(addMessage(msg)); });
      socket.on('hand-raised', (data) => { if (mounted) { dispatch(addRaisedHand(data)); if (isStaff) playHandSound(); } });
      socket.on('hand-lowered', ({ socketId }) => { if (mounted) dispatch(removeRaisedHand(socketId)); });

      const onConnect = () => {
        if (!mounted) return;
        if (isStaff) {
          socket.emit('staff-create-room', (res) => {
            if (!mounted) return;
            if (res?.error) {
              dispatch(setStatus('error'));
              return;
            }
            const resolvedRoomId = res.roomId;
            setLiveRoomId(resolvedRoomId);
            roomIdRef.current = resolvedRoomId;
            dispatch(setRoomId(resolvedRoomId));
            dispatch(setStatus('live'));
            startTimer();

            if (isNewRoom) {
              navigate(`/meeting/${resolvedRoomId}`, { replace: true, state: stateData });
            }
            
            fetchLiveKitToken(resolvedRoomId, user?.name);
          });
        } else {
          dispatch(setStatus('waiting'));
          socket.emit('student-request-join', { roomId: routeRoomId }, (res) => {
            if (res?.error) dispatch(setStatus('error'));
          });
        }
      };

      if (socket.connected) { onConnect(); } else { socket.once('connect', onConnect); }
    };

    run();

    return () => {
      mounted = false;
      clearInterval(timerRef.current);
      const s = getSocket();
      if (s) {
        const r = roomIdRef.current;
        if (r) s.emit('leave-room', { roomId: r });
        disconnectSocket();
      }
      dispatch(resetMeeting());
    };
  }, []);

  const getRoomId = () => liveRoomId || routeRoomId;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const displayRoomId = liveRoomId && liveRoomId !== 'new' ? liveRoomId : routeRoomId;

  const handleEnd = () => {
    const roomId = getRoomId();
    const socket = getSocket();
    if (isStaff) socket?.emit('end-meeting', { roomId });
    else socket?.emit('leave-room', { roomId });
    disconnectSocket();
    dispatch(resetMeeting());
    navigate('/');
  };

  const copyLink = () => {
    const roomId = getRoomId();
    if (!roomId || roomId === 'new') return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${roomId}`).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  const dismissRequest = (id) => setJoinRequests(prev => prev.filter(r => r.id !== id));
  const admitFromToast = (req) => { getSocket()?.emit('admit-student', { roomId: getRoomId(), targetSocketId: req.socketId }); dispatch(removeFromWaiting(req.socketId)); dismissRequest(req.id); };
  const rejectFromToast = (req) => { getSocket()?.emit('reject-student', { roomId: getRoomId(), targetSocketId: req.socketId }); dispatch(removeFromWaiting(req.socketId)); dismissRequest(req.id); };

  if (status === 'waiting') return (<div style={{ height: '100vh', background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.3), transparent), #070412', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}><h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>Waiting for the host</h2><button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', borderRadius: '8px', padding: '8px 20px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px' }}>Cancel</button></div>);
  if (status === 'rejected') return (<div style={{ height: '100vh', background: '#070412', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}><div style={{ fontSize: '56px' }}>🚫</div><h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700' }}>Entry Declined</h2><button className="btn-primary" onClick={() => navigate('/')}>Return to Home</button></div>);
  if (status === 'ended') return (<div style={{ height: '100vh', background: '#070412', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}><div style={{ fontSize: '56px' }}>🎓</div><h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700' }}>Class Ended</h2><button className="btn-primary" onClick={() => navigate('/')}>Return to Home</button></div>);
  if (status === 'error') return (<div style={{ height: '100vh', background: '#070412', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}><div style={{ fontSize: '56px' }}>⚠️</div><h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '700' }}>Connection Error</h2><button className="btn-primary" onClick={() => navigate('/')}>Return to Home</button></div>);

  // Render Meeting Layout. If LiveKit token is ready, we connect it.
  return (
    <div className="meeting-layout">
      {/* ── Header ── */}
      <div className="meeting-header">
        <div className="meeting-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', flexShrink: 0 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #7C3AED, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg></div>
            <span className="logo-text" style={{ fontWeight: '800', fontSize: '14px' }}>EduMeet</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: 'var(--border)', flexShrink: 0 }} />
          {displayRoomId && displayRoomId !== 'new' && <div className="room-code-badge">{displayRoomId}</div>}
          {status === 'live' && <div className="live-badge"><div className="live-dot" /><span className="live-label">Live</span></div>}
        </div>
        <div className="meeting-header-right">
          <div className="timer-badge">{fmt(elapsed)}</div>
          {isStaff && displayRoomId && displayRoomId !== 'new' && (
            <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: linkCopied ? 'rgba(0,214,143,0.15)' : 'rgba(124,58,237,0.15)', border: `1px solid ${linkCopied ? 'rgba(0,214,143,0.3)' : 'var(--border)'}`, borderRadius: '8px', padding: '6px 12px', color: linkCopied ? 'var(--green)' : 'var(--secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: '600', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              <span className="share-btn-text">{linkCopied ? 'Copied!' : 'Share'}</span>
            </button>
          )}
          <div className="user-avatar-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-light)', borderRadius: '99px', padding: '4px 10px 4px 4px', flexShrink: 0 }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#E879F9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#fff' }}>{user?.name?.charAt(0)?.toUpperCase()}</div>
            <span className="user-name-text" style={{ fontSize: '12px', fontWeight: '600', color: '#fff', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</span>
          </div>
        </div>
      </div>

      {lkToken ? (
        <LiveKitRoom
          serverUrl={LK_SERVER_URL}
          token={lkToken}
          connect={true}
          audio={audioEnabled}
          video={videoEnabled}
          screen={isScreenSharing}
          onDisconnected={handleEnd}
          style={{ display: 'flex', minHeight: 0, overflow: 'hidden' }}
        >
          <div className="meeting-main" style={{ flex: 1, minHeight: 0 }}>
            <VideoGrid />
            {activePanel === 'chat' && <ChatPanel roomId={getRoomId()} />}
            {activePanel === 'participants' && <ParticipantsPanel localUser={user} roomId={getRoomId()} />}
            {activePanel === 'waiting' && isStaff && <WaitingPanel roomId={getRoomId()} />}
          </div>
        </LiveKitRoom>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Connecting Media...</div>
      )}

      <ControlBar
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isScreenSharing={isScreenSharing}
        onToggleAudio={() => setAudioEnabled(p => !p)}
        onToggleVideo={() => setVideoEnabled(p => !p)}
        onScreenShare={() => {
          if (!isScreenSharing && !isStaff) {
            alert("Only instructors and administrators have permission to share screen.");
            return;
          }
          setIsScreenSharing(p => !p);
        }}
        onRaiseHand={() => {
          const socket = getSocket();
          const localHandRaised = raisedHands.some(h => h.socketId === socket?.id);
          if (localHandRaised) {
            socket?.emit('lower-hand', { roomId: getRoomId(), targetSocketId: socket?.id });
          } else {
            socket?.emit('raise-hand', { roomId: getRoomId() });
          }
        }}
        onEnd={handleEnd}
        isStaff={isStaff}
      />

      {/* ── Join Request Toasts (staff) ── */}
      <div style={{ position: 'fixed', top: '72px', right: '20px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 9999 }}>
        {joinRequests.map(req => (
          <div key={req.id} className="request-popup animate-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#E879F9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#fff' }}>
                {req.name.charAt(0).toUpperCase()}
              </div>
              <div><p style={{ color: '#fff', fontWeight: '700', fontSize: '14px', margin: 0 }}>{req.name}</p></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => admitFromToast(req)} style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: '8px', padding: '9px', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>✓ Admit</button>
              <button onClick={() => rejectFromToast(req)} style={{ flex: 1, background: 'rgba(255,74,106,0.15)', border: '1px solid rgba(255,74,106,0.35)', borderRadius: '8px', padding: '9px', color: 'var(--red)', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>✗ Deny</button>
              <button onClick={() => dismissRequest(req.id)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-light)', borderRadius: '8px', width: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}>X</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
