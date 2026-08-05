import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setGuestUser } from '../store/slices/authSlice';
import api from '../services/api';

export default function JoinPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(s => s.auth);

  const [step, setStep] = useState('validate'); // validate | name | preview | login
  const [guestName, setGuestName] = useState('');
  const [roomInfo, setRoomInfo] = useState(null);
  const [error, setError] = useState('');
  const [previewStream, setPreviewStream] = useState(null);
  const videoRef = useRef(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Validate room
  useEffect(() => {
    api.get(`/rooms/${roomId}/validate`)
      .then(res => { setRoomInfo(res.data); setStep(isAuthenticated ? 'preview' : 'name'); })
      .catch(() => setError('This room does not exist or the class has not started yet.'));
  }, [roomId, isAuthenticated]);

  // Camera preview
  useEffect(() => {
    if (step !== 'preview') return;
    let stream;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => { stream = s; setPreviewStream(s); if (videoRef.current) videoRef.current.srcObject = s; })
      .catch(() => setError('Could not access camera/mic. Please allow permissions.'));
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [step]);

  const toggleMic = () => {
    if (previewStream) { previewStream.getAudioTracks().forEach(t => t.enabled = !micOn); setMicOn(v => !v); }
  };
  const toggleCam = () => {
    if (previewStream) { previewStream.getVideoTracks().forEach(t => t.enabled = !camOn); setCamOn(v => !v); }
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    if (!guestName.trim()) { setError('Please enter your name'); return; }
    dispatch(setGuestUser({ userId: `guest_${Date.now()}`, name: guestName.trim(), role: 'student' }));
    setStep('preview');
  };

  const handleJoin = () => {
    if (previewStream) previewStream.getTracks().forEach(t => t.stop());
    navigate(`/meeting/${roomId}`, { state: { guestName: isAuthenticated ? null : guestName, micOn, camOn } });
  };

  if (error) return (
    <div className="app-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card" style={{ padding: '40px', maxWidth: '420px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ color: '#fff', marginBottom: '12px' }}>Room Not Found</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>{error}</p>
        <button className="btn-primary" onClick={() => navigate('/')}>Go Back</button>
      </div>
    </div>
  );

  if (step === 'validate') return (
    <div className="app-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p>Validating room...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="app-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflow: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '480px' }} className="animate-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #7C3AED, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
            </div>
            <span style={{ fontWeight: '800', fontSize: '18px' }}>EduMeet</span>
          </div>
        </div>

        {roomInfo && (
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{roomInfo.hostName}'s Classroom</p>
            <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', marginTop: '4px' }}>Room {roomId}</h2>
          </div>
        )}

        <div className="glass-card" style={{ padding: '32px' }}>
          {step === 'name' && (
            <>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>Enter your name</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>This will be shown to others in the class</p>
              <form onSubmit={handleNameSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="input-label">Your Name</label>
                  <input className="input-field" autoFocus placeholder="e.g. John Smith" value={guestName} onChange={e => setGuestName(e.target.value)} />
                </div>
                {error && <p style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</p>}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn-secondary" type="button" onClick={() => navigate('/login')} style={{ flex: 1 }}>Log In Instead</button>
                  <button className="btn-primary" type="submit" style={{ flex: 1 }}>Continue</button>
                </div>
              </form>
            </>
          )}

          {step === 'preview' && (
            <>
              <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>
                Ready to join, {isAuthenticated ? user?.name : guestName}?
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>Check your camera and mic before entering</p>

              {/* Video preview */}
              <div className="lobby-video" style={{ marginBottom: '16px' }}>
                {camOn ? (
                  <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                ) : (
                  <div className="tile-avatar" style={{ aspectRatio: '16/9' }}>
                    <div className="avatar-circle">{(isAuthenticated ? user?.name : guestName)?.charAt(0)?.toUpperCase()}</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Camera is off</p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
                <button onClick={toggleMic} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: micOn ? 'rgba(255,255,255,0.06)' : 'rgba(255,74,106,0.15)', border: `1px solid ${micOn ? 'var(--border)' : 'rgba(255,74,106,0.4)'}`, borderRadius: '12px', padding: '12px 18px', cursor: 'pointer', color: micOn ? 'var(--text)' : 'var(--red)' }}>
                  {micOn ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
                  <span style={{ fontSize: '11px', fontWeight: '600' }}>{micOn ? 'Mic On' : 'Mic Off'}</span>
                </button>
                <button onClick={toggleCam} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: camOn ? 'rgba(255,255,255,0.06)' : 'rgba(255,74,106,0.15)', border: `1px solid ${camOn ? 'var(--border)' : 'rgba(255,74,106,0.4)'}`, borderRadius: '12px', padding: '12px 18px', cursor: 'pointer', color: camOn ? 'var(--text)' : 'var(--red)' }}>
                  {camOn ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  <span style={{ fontSize: '11px', fontWeight: '600' }}>{camOn ? 'Cam On' : 'Cam Off'}</span>
                </button>
              </div>

              <button className="btn-primary" onClick={handleJoin} style={{ width: '100%', padding: '14px', fontSize: '15px' }}>
                Join Meeting →
              </button>

              <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', marginTop: '12px' }}>
                You'll enter the waiting room until the host admits you.
              </p>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
