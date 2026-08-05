import { useSelector, useDispatch } from 'react-redux';
import { closePanel, removeRaisedHand } from '../../store/slices/meetingSlice';
import { getSocket } from '../../services/socket';

export default function ParticipantsPanel({ localUser, roomId }) {
  const dispatch = useDispatch();
  const { participants, raisedHands } = useSelector(s => s.meeting);

  const all = [
    { socketId: 'local', name: localUser?.name || 'You', role: localUser?.role, isLocal: true, audio: true, video: true },
    ...participants,
  ];
  const isStaff = localUser?.role === 'staff';

  const kickParticipant = (socketId) => {
    getSocket()?.emit('kick-participant', { roomId, targetSocketId: socketId });
  };

  const lowerHand = (socketId) => {
    dispatch(removeRaisedHand(socketId));
    getSocket()?.emit('lower-hand', { roomId, targetSocketId: socketId });
  };

  return (
    <div className="side-panel">
      <div className="panel-header" style={{ color: '#fff' }}>
        <span>👥 Participants ({all.length})</span>
        <button onClick={() => dispatch(closePanel())}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* ── Raised Hands section (staff only) ────────────────────────────── */}
        {isStaff && raisedHands.length > 0 && (
          <div style={{ marginBottom: '8px' }}>
            <p style={{ color: 'var(--yellow)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>✋</span> Raised Hands ({raisedHands.length})
            </p>
            {raisedHands.map(h => (
              <div key={h.socketId} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', marginBottom: '6px',
                background: 'rgba(255,181,71,0.1)',
                border: '1px solid rgba(255,181,71,0.35)',
                borderRadius: '10px',
              }}>
                <div style={{ fontSize: '20px' }}>✋</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'var(--yellow)', fontWeight: '700', fontSize: '14px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</p>
                  <p style={{ color: 'rgba(255,181,71,0.6)', fontSize: '11px', margin: '2px 0 0' }}>Raised their hand</p>
                </div>
                {/* Staff can lower a student's hand */}
                <button onClick={() => lowerHand(h.socketId)} title="Lower hand"
                  style={{ background: 'rgba(255,181,71,0.15)', border: '1px solid rgba(255,181,71,0.3)', borderRadius: '6px', padding: '4px 8px', color: 'var(--yellow)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}>
                  Lower
                </button>
              </div>
            ))}
            <div style={{ height: '1px', background: 'var(--border-light)', margin: '8px 0 4px' }} />
          </div>
        )}

        {/* ── Participant list ─────────────────────────────────────────────── */}
        {all.map(p => {
          const hasRaisedHand = raisedHands.some(h => h.socketId === p.socketId);
          return (
            <div key={p.socketId} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px',
              background: hasRaisedHand ? 'rgba(255,181,71,0.06)' : 'rgba(255,255,255,0.04)',
              borderRadius: '10px',
              border: hasRaisedHand ? '1px solid rgba(255,181,71,0.25)' : '1px solid var(--border-light)',
            }}>
              {/* Avatar */}
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${p.role === 'staff' ? '#7C3AED, #A855F7' : '#C084FC, #E879F9'})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '700', color: '#fff', fontSize: '15px',
              }}>
                {p.name?.charAt(0)?.toUpperCase()}
              </div>

              {/* Name + role */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontWeight: '600', fontSize: '14px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {p.name}{p.isLocal && <span style={{ color: 'var(--text-dim)', fontWeight: '400' }}> (You)</span>}
                  {hasRaisedHand && <span style={{ fontSize: '14px' }}>✋</span>}
                </p>
                <p style={{ color: p.role === 'staff' ? 'var(--primary-light)' : 'var(--text-muted)', fontSize: '11px', margin: '2px 0 0', fontWeight: '600', textTransform: 'capitalize' }}>
                  {p.role === 'staff' ? '⭐ Staff' : '🎓 Student'}
                </p>
              </div>

              {/* Media state indicators */}
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <div title={p.audio === false ? 'Muted' : 'Mic on'}
                  style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: p.audio === false ? 'rgba(255,74,106,0.2)' : 'rgba(0,214,143,0.12)',
                    color: p.audio === false ? 'var(--red)' : 'var(--green)' }}>
                  {p.audio === false
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                  }
                </div>
                <div title={p.video === false ? 'Camera off' : 'Camera on'}
                  style={{ width: '24px', height: '24px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: p.video === false ? 'rgba(255,74,106,0.2)' : 'rgba(0,214,143,0.12)',
                    color: p.video === false ? 'var(--red)' : 'var(--green)' }}>
                  {p.video === false
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
                  }
                </div>
              </div>

              {/* Kick (staff only) */}
              {isStaff && !p.isLocal && p.role !== 'staff' && (
                <button onClick={() => kickParticipant(p.socketId)} title="Remove from class"
                  style={{ background: 'none', border: '1px solid rgba(255,74,106,0.3)', borderRadius: '6px', width: '26px', height: '26px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--red)', flexShrink: 0, transition: 'all 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,74,106,0.15)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
