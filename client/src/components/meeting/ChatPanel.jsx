import { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { closePanel } from '../../store/slices/meetingSlice';
import { getSocket } from '../../services/socket';

export default function ChatPanel({ roomId }) {
  const [input, setInput] = useState('');
  const dispatch = useDispatch();
  const { messages } = useSelector(s => s.meeting);
  const { user } = useSelector(s => s.auth);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const socket = getSocket();
    socket?.emit('send-message', { roomId, message: input.trim() });
    setInput('');
  };

  return (
    <div className="side-panel">
      <div className="panel-header" style={{ color: '#fff' }}>
        <span>💬 Live Chat</span>
        <button
          onClick={() => dispatch(closePanel())}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '40px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <p style={{ fontSize: '13px' }}>No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          // System message (join/leave announcements)
          if (msg._system) {
            return (
              <div key={i} className="system-message">
                {msg.message}
              </div>
            );
          }

          const isMe = msg.senderName === user?.name;
          return (
            <div key={i} className={`chat-bubble ${isMe ? 'mine' : 'theirs'}`}>
              {!isMe && <div className="bubble-author">{msg.senderName}</div>}
              <div className={`bubble-body ${isMe ? 'mine' : 'theirs'}`}>{msg.message}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '3px', textAlign: isMe ? 'right' : 'left' }}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="chat-input-row">
        <input
          className="chat-input"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) send(e); }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            background: 'var(--primary)', border: 'none', borderRadius: '8px',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', opacity: input.trim() ? 1 : 0.4, transition: 'opacity 0.2s', flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}
