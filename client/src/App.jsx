import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useSelector } from 'react-redux';

import Home from './pages/Home';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import JoinPage from './pages/JoinPage';
import Meeting from './pages/Meeting';

function RequireAuth({ children }) {
  const { isAuthenticated } = useSelector(s => s.auth);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1A0D3A', color: '#fff', border: '1px solid rgba(124,58,237,0.35)', borderRadius: '10px', fontFamily: 'Plus Jakarta Sans, sans-serif' } }} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Lobby for authenticated users (staff preview before creating room) */}
        <Route path="/lobby" element={<RequireAuth><Lobby /></RequireAuth>} />

        {/* Student join via classroom link (no auth required) */}
        <Route path="/join/:roomId" element={<JoinPage />} />

        {/* Staff creates room from Lobby → /meeting/new → Meeting.jsx creates and redirects to real ID */}
        <Route path="/meeting/new" element={<Meeting />} />
        {/* The actual meeting room */}
        <Route path="/meeting/:roomId" element={<Meeting />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
