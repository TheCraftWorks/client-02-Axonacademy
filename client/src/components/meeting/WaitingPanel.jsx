import { useSelector, useDispatch } from 'react-redux';
import { closePanel, removeFromWaiting } from '../../store/slices/meetingSlice';
import { getSocket } from '../../services/socket';

export default function WaitingPanel({ roomId }) {
  const dispatch = useDispatch();
  const { waitingList } = useSelector(s => s.meeting);

  const admit = (socketId) => {
    getSocket()?.emit('admit-student', { roomId, targetSocketId: socketId });
    dispatch(removeFromWaiting(socketId)); // ← FIX: was missing, badge never cleared
  };

  const reject = (socketId) => {
    getSocket()?.emit('reject-student', { roomId, targetSocketId: socketId });
    dispatch(removeFromWaiting(socketId)); // ← FIX: was missing, badge never cleared
  };

  return (
    <div className="side-panel">
      <div className="panel-header" style={{ color: '#fff' }}>
        <span>🚪 Waiting Room ({waitingList.length})</span>
        <button onClick={() => dispatch(closePanel())} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {waitingList.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
            <p style={{ fontSize: '13px' }}>No students waiting</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {waitingList.length > 1 && (
              <button
                onClick={() => waitingList.forEach(w => admit(w.socketId))}
                style={{ width: '100%', background: 'rgba(0,214,143,0.12)', border: '1px solid rgba(0,214,143,0.3)', color: 'var(--green)', borderRadius: '10px', padding: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', fontFamily: 'inherit', marginBottom: '4px' }}
              >
                Admit All ({waitingList.length})
              </button>
            )}
            {waitingList.map(w => (
              <div key={w.socketId} className="animate-in" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #E879F9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#fff', fontSize: '15px', flexShrink: 0 }}>
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ color: '#fff', fontWeight: '600', fontSize: '14px', margin: 0 }}>{w.name}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: '11px', margin: '2px 0 0' }}>Wants to join</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => admit(w.socketId)}
                    style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: '8px', padding: '8px', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    ✓ Admit
                  </button>
                  <button
                    onClick={() => reject(w.socketId)}
                    style={{ flex: 1, background: 'rgba(255,74,106,0.15)', border: '1px solid rgba(255,74,106,0.3)', borderRadius: '8px', padding: '8px', color: 'var(--red)', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    ✗ Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
