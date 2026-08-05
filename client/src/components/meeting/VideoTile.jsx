import { useRef } from 'react';
import { VideoTrack, AudioTrack } from '@livekit/components-react';

export default function VideoTile({
  trackRef,        // camera (or screen) TrackReference
  audioTrackRef,   // microphone TrackReference (separate from camera)
  name,
  isLocal,
  audioEnabled = true,
  videoEnabled = true,
  isScreenShare = false,
}) {
  const videoHolderRef = useRef(null);
  const letter = name?.charAt(0)?.toUpperCase() || '?';
  const showVideo = trackRef && videoEnabled;

  return (
    <div
      className="video-tile"
      ref={videoHolderRef}
      style={{
        position: 'relative', background: '#0F0820', 
        overflow: 'hidden', display: 'flex', alignItems: 'center',
        justifyContent: 'center', height: '100%',
      }}
    >
      {/* Video stream */}
      {showVideo && trackRef && (!isLocal || !isScreenShare) && (
        <VideoTrack
          trackRef={trackRef}
          style={{
            width: '100%', height: '100%',
            objectFit: isScreenShare ? 'contain' : 'cover',
            transform: isLocal && !isScreenShare ? 'scaleX(-1)' : 'none',
          }}
        />
      )}

      {/* Local Screen Share Placeholder */}
      {showVideo && trackRef && isLocal && isScreenShare && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
          width: '100%', height: '100%', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0F0820 0%, #1A0D3A 100%)',
          position: 'absolute', inset: 0,
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(124,58,237,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#A855F7',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ color: 'white', margin: '0 0 8px 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '18px' }}>You are presenting</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px' }}>Everyone can see your screen</p>
          </div>
        </div>
      )}

      {/* Audio — use dedicated mic trackRef; never play local audio back to avoid echo */}
      {!isLocal && audioEnabled && audioTrackRef && (
        <AudioTrack trackRef={audioTrackRef} />
      )}

      {/* Avatar — camera off or no video */}
      {!showVideo && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          width: '100%', height: '100%', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0F0820 0%, #1A0D3A 100%)',
          position: 'absolute', inset: 0,
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #E879F9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: '700', color: 'white',
            boxShadow: '0 0 20px rgba(124,58,237,0.5)',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>
            {letter}
          </div>
         
        </div>
      )}

      {/* Name + mute badge */}
      <div style={{
        position: 'absolute', bottom: '3px', left: '8px', right: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2,
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', color: '#fff',
          fontSize: '10px', fontWeight: '600', padding: '2px 6px 2px 2px', borderRadius: '99px',
          maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <div style={{
            width: '16px', height: '16px', borderRadius: '50%',
            background: 'linear-gradient(135deg,#7C3AED,#E879F9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '8px', fontWeight: '700', color: '#fff', flexShrink: 0,
          }}>
            {letter}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}{isLocal ? ' (You)' : ''}
          </span>
        </div>
        {!audioEnabled && (
          <div style={{
            background: 'rgba(255,74,106,0.85)', borderRadius: '50%',
            width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
        )}
      </div>

      {/* Screen share overlay: fullscreen button */}
      {showVideo && isScreenShare && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', opacity: 0, transition: 'opacity 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', zIndex: 10,
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
          onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
        >
          <button
            onClick={() => {
              if (videoHolderRef.current) {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                else videoHolderRef.current.requestFullscreen().catch(() => {});
              }
            }}
            style={{
              background: 'rgba(124,58,237,0.85)', color: 'white', border: 'none',
              padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
              fontWeight: '600', fontSize: '13px', backdropFilter: 'blur(4px)',
              pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
            </svg>
            Full Screen
          </button>
        </div>
      )}

      {isScreenShare && (
        <div style={{
          position: 'absolute', top: '8px', left: '8px',
          background: 'rgba(124,58,237,0.9)', color: 'white',
          fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '5px', zIndex: 11,
        }}>
          Screen
        </div>
      )}
    </div>
  );
}
