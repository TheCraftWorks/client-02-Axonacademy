import { useSelector, useDispatch } from 'react-redux';
import { setActivePanel } from '../../store/slices/meetingSlice';
import { getSocket } from '../../services/socket';

/* ── Icon components ───────────────────────────────────────────────────────── */
const MicIcon = ({ on }) => on
  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;

const CamIcon = ({ on }) => on
  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.362a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

/* ── Single button ─────────────────────────────────────────────────────────── */
const Btn = ({ icon, label, onClick, active = false, danger = false, off = false, badge = 0, id }) => (
  <button
    id={id}
    onClick={onClick}
    className={`ctrl-btn${active ? ' active' : ''}${off ? ' off' : ''}${danger ? ' danger' : ''}`}
    title={label}
    style={{ position: 'relative' }}
  >
    {icon}
    <span>{label}</span>
    {badge > 0 && (
      <div className="ctrl-badge">{badge > 9 ? '9+' : badge}</div>
    )}
  </button>
);

/* ── ControlBar ────────────────────────────────────────────────────────────── */
export default function ControlBar({
  audioEnabled, videoEnabled, isScreenSharing,
  onToggleAudio, onToggleVideo, onScreenShare,
  onEnd, onRaiseHand, isStaff,
}) {
  const dispatch = useDispatch();
  const { activePanel, waitingList, messages, raisedHands } = useSelector(s => s.meeting);
  const unreadCount = messages.filter(m => m._unread).length;

  return (
    <div className="control-bar">
      {/* Scrollable button strip on mobile */}
      <div className="control-bar-inner">

        {/* Mic */}
        <Btn id="btn-mic" icon={<MicIcon on={audioEnabled} />} label={audioEnabled ? 'Mute' : 'Unmute'}
          onClick={onToggleAudio} off={!audioEnabled} />

        {/* Camera */}
        <Btn id="btn-cam" icon={<CamIcon on={videoEnabled} />} label={videoEnabled ? 'Camera' : 'No Video'}
          onClick={onToggleVideo} off={!videoEnabled} />

        {/* Screen Share */}
        <Btn id="btn-share"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>}
          label={isScreenSharing ? 'Stop' : 'Share'}
          onClick={onScreenShare} active={isScreenSharing} />

        {/* Chat */}
        <Btn id="btn-chat"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
          label="Chat"
          onClick={() => dispatch(setActivePanel('chat'))}
          active={activePanel === 'chat'}
          badge={activePanel !== 'chat' ? unreadCount : 0} />

        {/* People */}
        <Btn id="btn-people"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
          label="People"
          onClick={() => dispatch(setActivePanel('participants'))}
          active={activePanel === 'participants'} />

        {/* Waiting (staff) / Raise Hand (student) */}
        {isStaff ? (
          <Btn id="btn-waiting"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/></svg>}
            label="Waiting"
            onClick={() => dispatch(setActivePanel('waiting'))}
            active={activePanel === 'waiting'}
            badge={waitingList.length} />
        ) : (
          <Btn id="btn-hand"
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0"/><path d="M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v2"/><path d="M10 10.5V6a2 2 0 00-2-2v0a2 2 0 00-2 2v8"/><path d="M18 8a2 2 0 114 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/></svg>}
            label={raisedHands.some(h => h.socketId === getSocket()?.id) ? "Lower Hand" : "Raise Hand"}
            onClick={onRaiseHand}
            active={raisedHands.some(h => h.socketId === getSocket()?.id)} />
        )}

        {/* Divider */}
        <div className="ctrl-divider" />

        {/* End / Leave */}
        <button id="btn-end" onClick={onEnd} className="ctrl-btn danger btn-end" title={isStaff ? 'End Class' : 'Leave'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.07 8.83 19.79 19.79 0 01.75 .75 2 2 0 012.75 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.68 7.93"/><line x1="23" y1="1" x2="1" y2="23"/></svg>
          <span>{isStaff ? 'End' : 'Leave'}</span>
        </button>
      </div>
    </div>
  );
}
