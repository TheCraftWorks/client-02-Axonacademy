import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '../store/slices/authSlice';
import api from '../services/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError('Please enter username and password'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username: username.trim(), password: password.trim() });
      dispatch(loginSuccess(res.data));
      navigate('/lobby');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', overflow: 'auto' }}>
      {/* Background decorations */}
      <div style={{ position: 'fixed', top: '-20%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(192,132,252,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="animate-in" style={{ width: '100%', maxWidth: '440px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', borderRadius: '20px', background: 'linear-gradient(135deg, #7C3AED, #A855F7)', marginBottom: '20px', boxShadow: '0 8px 32px rgba(124,58,237,0.5)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0 0 8px', color: '#fff', letterSpacing: '-0.5px' }}>EduMeet</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', margin: 0 }}>Live Classroom Platform</p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: '36px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', marginBottom: '6px' }}>Welcome back</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px' }}>Sign in to your account to continue</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label className="input-label">Username</label>
              <input
                className="input-field"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="input-label">Password</label>
              <input
                className="input-field"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(255,74,106,0.12)', border: '1px solid rgba(255,74,106,0.3)', borderRadius: '10px', padding: '12px 16px', color: 'var(--red)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                {error}
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '4px', padding: '14px', fontSize: '15px' }}>
              {loading ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Credentials hint */}
          <div style={{ marginTop: '24px', padding: '14px 16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: '10px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Demo Accounts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[['Staff', 'axon', 'admin'],['Student 1','Ajay','1111'],['Student 2','navin','2222']].map(([role, u, p]) => (
                <button key={u} onClick={() => { setUsername(u); setPassword(p); }} style={{ background: 'none', border: 'none', textAlign: 'left', color: 'var(--secondary)', fontSize: '13px', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>{role}:</span>{u} / {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', marginTop: '16px' }}>
          Joining via link?{' '}
          <span style={{ color: 'var(--secondary)', cursor: 'pointer' }} onClick={() => navigate('/')}>
            Enter room code
          </span>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
