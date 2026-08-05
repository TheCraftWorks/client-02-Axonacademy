import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setGuestUser } from '../store/slices/authSlice';

export default function Home() {
  const [roomCode, setRoomCode] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector(s => s.auth);

  const handleJoinAsGuest = (e) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    navigate(`/join/${roomCode.trim().replace(/\s/g, '')}`);
  };

  const handleGoToDashboard = () => {
    if (isAuthenticated) navigate('/lobby');
    else navigate('/login');
  };

  return (
    <div className="app-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', borderBottom: '1px solid var(--border-light)', background: 'rgba(7,4,18,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #7C3AED, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
          </div>
          <span style={{ fontWeight: '800', fontSize: '20px', letterSpacing: '-0.5px' }}>EduMeet</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {isAuthenticated ? (
            <button className="btn-primary" onClick={handleGoToDashboard} style={{ padding: '9px 20px', fontSize: '14px' }}>
              {user?.role === 'staff' ? '🎓 Start Class' : 'Enter Meeting'}
            </button>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => navigate('/login')} style={{ fontSize: '14px' }}>Log In</button>
              <button className="btn-primary" onClick={() => navigate('/login')} style={{ padding: '9px 20px', fontSize: '14px' }}>Sign In</button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: '800px', height: '400px', background: 'radial-gradient(ellipse, rgba(124,58,237,0.2) 0%, transparent 70%)', pointerEvents: 'none', borderRadius: '50%' }} />

        <div className="animate-in">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: '99px', padding: '6px 16px', marginBottom: '28px', fontSize: '13px', color: 'var(--secondary)', fontWeight: '600' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            Live Classroom Platform
          </div>

          <h1 style={{ fontSize: 'clamp(36px,6vw,72px)', fontWeight: '800', lineHeight: 1.1, margin: '0 0 24px', color: '#fff', letterSpacing: '-2px' }}>
            Your Classroom,<br />
            <span style={{ background: 'linear-gradient(135deg, #A855F7, #E879F9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Powered Live.
            </span>
          </h1>

          <p style={{ fontSize: '18px', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 48px', lineHeight: 1.65 }}>
            Real-time video classes with camera, mic, screen-sharing, interactive whiteboard, and live chat — built for teachers and students.
          </p>

          {/* Join box */}
          <form onSubmit={handleJoinAsGuest} style={{ display: 'flex', gap: '12px', maxWidth: '480px', margin: '0 auto 16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              className="input-field"
              placeholder="Enter room code (e.g. 123-456-789)"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value)}
              style={{ flex: 1, minWidth: '240px', fontSize: '16px' }}
            />
            <button className="btn-primary" type="submit" disabled={!roomCode.trim()} style={{ fontSize: '15px', padding: '13px 28px', whiteSpace: 'nowrap' }}>
              Join Class
            </button>
          </form>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
            No account needed to join via link
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '64px' }}>
          {['📹 HD Video', '🎤 Live Audio', '🖥️ Screen Share', '💬 Live Chat', '✋ Raise Hand', '🔒 Waiting Room'].map(f => (
            <div key={f} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-light)', borderRadius: '99px', padding: '8px 18px', fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500' }}>
              {f}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
