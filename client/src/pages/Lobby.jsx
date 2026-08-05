import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function Lobby() {
  const navigate = useNavigate();
  const { user } = useSelector(s => s.auth);
  const [previewStream, setPreviewStream] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    let stream;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => {
        stream = s;
        setPreviewStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError('Camera/mic access denied. You can still join without video.'));
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const toggleMic = () => {
    if (previewStream) {
      previewStream.getAudioTracks().forEach(t => { t.enabled = !micOn; });
      setMicOn(v => !v);
    }
  };

  const toggleCam = () => {
    if (previewStream) {
      previewStream.getVideoTracks().forEach(t => { t.enabled = !camOn; });
      setCamOn(v => !v);
    }
  };

  // Stop preview tracks before entering — Meeting.jsx acquires its own stream
  const handleStart = () => {
    if (previewStream) previewStream.getTracks().forEach(t => t.stop());
    if (user?.role === 'staff') {
      // Navigate to /meeting/new — Meeting.jsx creates the room and updates the URL
      navigate('/meeting/new', { state: { micOn, camOn } });
    } else {
      // Students should join via a link, send them back to home
      navigate('/');
    }
  };

  if (!user) { navigate('/login'); return null; }

  return (
    <div className="app-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflow: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '560px' }} className="animate-in">

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #7C3AED, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
            </div>
            <span style={{ fontWeight: '800', fontSize: '18px' }}>EduMeet</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
            Welcome, <strong style={{ color: 'var(--secondary)' }}>{user.name}</strong>
          </p>
        </div>

        <div className="glass-card" style={{ padding: '36px' }}>
          <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
            {user.role === 'staff' ? '🎓 Ready to Start Class?' : '📚 Preview Before Joining'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            {user.role === 'staff'
              ? 'Check your camera and mic, then start the session'
              : 'Enter a room code to join a class'}
          </p>

          {/* Camera Preview */}
          <div className="lobby-video" style={{ marginBottom: '20px' }}>
            {camOn && previewStream ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            ) : (
              <div className="tile-avatar">
                <div className="avatar-circle">{user.name?.charAt(0)?.toUpperCase()}</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                  {previewStream ? 'Camera off' : 'No camera access'}
                </p>
              </div>
            )}
          </div>

          {/* Toggle Controls */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
            <button
              onClick={toggleMic}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: micOn ? 'rgba(255,255,255,0.06)' : 'rgba(255,74,106,0.12)',
                border: `1px solid ${micOn ? 'var(--border)' : 'rgba(255,74,106,0.35)'}`,
                borderRadius: '10px', padding: '12px', cursor: 'pointer',
                color: micOn ? 'var(--text)' : 'var(--red)',
                fontFamily: 'inherit', fontWeight: '600', fontSize: '14px',
              }}
            >
              {micOn ? '🎤' : '🔇'} {micOn ? 'Mic On' : 'Mic Off'}
            </button>
            <button
              onClick={toggleCam}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: camOn ? 'rgba(255,255,255,0.06)' : 'rgba(255,74,106,0.12)',
                border: `1px solid ${camOn ? 'var(--border)' : 'rgba(255,74,106,0.35)'}`,
                borderRadius: '10px', padding: '12px', cursor: 'pointer',
                color: camOn ? 'var(--text)' : 'var(--red)',
                fontFamily: 'inherit', fontWeight: '600', fontSize: '14px',
              }}
            >
              {camOn ? '📷' : '🚫'} {camOn ? 'Cam On' : 'Cam Off'}
            </button>
          </div>

          {error && <p style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

          {user.role === 'staff' ? (
            <button className="btn-primary" onClick={handleStart} style={{ width: '100%', padding: '14px', fontSize: '15px' }}>
              🚀 Start Class Now
            </button>
          ) : (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', marginBottom: '12px' }}>
                Enter a room code from your staff member
              </p>
              <button className="btn-secondary" onClick={() => navigate('/')} style={{ width: '100%', padding: '14px', fontSize: '15px' }}>
                Enter Room Code
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            ← Switch account
          </button>
        </p>
      </div>
    </div>
  );
}
