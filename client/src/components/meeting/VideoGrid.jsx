import { useSelector } from 'react-redux';
import { useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import VideoTile from './VideoTile';
import { useState, useEffect, useRef } from 'react';
import { useClassroomStore } from '../../lib/classroomStore';

// ── Inline styles ──────────────────────────────────────────────────────────────
const S = {
  root: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#030108',
    overflow: 'hidden',
    minHeight: 0,
    minWidth: 0,
  },
  mainWrapper: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
  },
  strip: (visible) => ({
    position: 'relative',
    width: '100%',
    background: 'rgba(3, 1, 8, 0.92)',
    backdropFilter: 'blur(8px)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    flexShrink: 0,
    height: visible ? undefined : '0px',
    overflow: visible ? 'auto' : 'hidden',
    transition: 'height 0.22s cubic-bezier(0.4,0,0.2,1)',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(124,58,237,0.4) transparent',
    WebkitOverflowScrolling: 'touch',
  }),
  thumb: (active) => ({
    flexShrink: 0,
    width: '90px',
    height: '65px',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    border: active ? '2px solid #7C3AED' : '2px solid rgba(255,255,255,0.12)',
    boxShadow: active ? '0 0 0 2px rgba(124,58,237,0.4)' : '0 2px 8px rgba(0,0,0,0.5)',
    position: 'relative',
    transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.15s',
    transform: active ? 'scale(1.05)' : 'scale(1)',
  }),
  
  floatToggleBtn: (stripVisible) => ({
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    width: '36px',
    height: '36px',
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    zIndex: 20,
    transition: 'background 0.18s',
  }),
  thumbLabel: {
    position: 'absolute',
    bottom: '4px',
    left: '4px',
    right: '4px',
    background: 'rgba(0,0,0,0.65)',
    color: '#fff',
    fontSize: '6px',
    fontWeight: '600',
    padding: '2px 5px',
    borderRadius: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    pointerEvents: 'none',
  },
  activeIndicator: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    width: '8px',
    height: '8px',
    background: '#7C3AED',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  grid: (cols) => ({
    flex: 1,
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: '6px',
    padding: '8px',
    overflow: 'hidden',
    minHeight: 0,
  }),
};

// ── ChevronIcon ────────────────────────────────────────────────────────────────
function ChevronIcon({ up }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      {up
        ? <polyline points="18 15 12 9 6 15" />
        : <polyline points="6 9 12 15 18 9" />}
    </svg>
  );
}

// ── PeopleTileIcon ─────────────────────────────────────────────────────────────
function PeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

// ── Main VideoGrid ─────────────────────────────────────────────────────────────
export default function VideoGrid() {
  const { viewMode, speakerSocketId, participants } = useSelector(s => s.meeting);
  const { currentUser } = useClassroomStore();

  const [focusedTileId, setFocusedTileId] = useState(null);
  const [stripVisible, setStripVisible] = useState(true);
  const stripRef = useRef(null);

  // Track reference list (cameras + screens)
  const cameraTracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const screenTracks = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const micTracks    = useTracks([{ source: Track.Source.Microphone, withPlaceholder: false }]);

  const micByIdentity = Object.fromEntries(micTracks.map(t => [t.participant.identity, t]));

  // Build tile list: screen shares first, then cameras
  const allTiles = [];

  screenTracks.forEach(t => {
    allTiles.push({
      id: t.participant.identity + '_screen',
      trackRef: t,
      audioTrackRef: undefined,
      name: `${t.participant.name || t.participant.identity}'s Screen`,
      isLocal: t.participant.isLocal,
      isScreen: true,
      audio: false,
      video: true,
    });
  });

  cameraTracks.forEach(t => {
    const identity = t.participant.identity;
    allTiles.push({
      id: identity,
      trackRef: t,
      audioTrackRef: micByIdentity[identity],
      name: t.participant.name || identity,
      isLocal: t.participant.isLocal,
      isScreen: false,
      audio: t.participant.isMicrophoneEnabled,
      video: t.participant.isCameraEnabled,
    });
  });

  const total = allTiles.length;
  if (total === 0) return <div style={{ flex: 1, background: '#030108' }} />;

  // ── Determine default focus ─────────────────────────────────────────────────
  const screenTile = allTiles.find(t => t.isScreen);
  const staffTile  = allTiles.find(tile => {
    const role = tile.isLocal
      ? (currentUser?.role || 'student')
      : (participants.find(p => p.name === tile.name)?.role || 'student');
    return ['staff', 'admin', 'superadmin'].includes(role);
  });
  const defaultFocusedId = screenTile?.id ?? staffTile?.id ?? allTiles[0]?.id;
  const activeFocusedId  = (focusedTileId && allTiles.some(t => t.id === focusedTileId))
    ? focusedTileId
    : defaultFocusedId;

  // Switch focus and scroll thumb into view
  const handleThumbClick = (tileId) => {
    setFocusedTileId(tileId);
    setStripVisible(true);
    // Scroll clicked thumb into view
    if (stripRef.current) {
      const el = stripRef.current.querySelector(`[data-tile-id="${tileId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  };

  // ── Single participant — no strip needed ────────────────────────────────────
  if (total === 1) {
    return (
      <div style={{ flex: 1, minHeight: 0 }}>
        <VideoTile
          trackRef={allTiles[0].trackRef}
          audioTrackRef={allTiles[0].audioTrackRef}
          name={allTiles[0].name}
          isLocal={allTiles[0].isLocal}
          audioEnabled={allTiles[0].audio}
          videoEnabled={allTiles[0].video}
          isScreenShare={allTiles[0].isScreen}
        />
      </div>
    );
  }

  // ── Multi-participant: Google Meet–style spotlight + thumbnail strip ─────────
  const mainTile   = allTiles.find(t => t.id === activeFocusedId) || allTiles[0];
  const thumbTiles = allTiles.filter(t => t.id !== mainTile.id);

  return (
    <div style={S.root}>

      {/* ── Main (spotlight) view ───────────────────────────────────────────── */}
      <div style={S.mainWrapper}>
        <VideoTile
          trackRef={mainTile.trackRef}
          audioTrackRef={mainTile.audioTrackRef}
          name={mainTile.name}
          isLocal={mainTile.isLocal}
          // audioEnabled={mainTile.audio}
          videoEnabled={mainTile.video}
          isScreenShare={mainTile.isScreen}
        />

        {/* Strip toggle button — overlaid on main video bottom-right */}
        <button
          title={stripVisible ? 'Hide participants' : 'Show participants'}
          onClick={() => setStripVisible(v => !v)}
          style={S.floatToggleBtn(stripVisible)}
        >
          <ChevronIcon up={!stripVisible} />
        </button>

        {/* Participant count badge — bottom-left, only when strip is hidden */}
        {!stripVisible && (
          <div style={{
            position: 'absolute',
            bottom: '1px',
            right: '60px',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '12px',
            fontWeight: '600',
            padding: '6px 10px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            zIndex: 20,
          }}>
            <PeopleIcon />
            {total} participants
          </div>
        )}
      </div>

      {/* ── Horizontal thumbnail strip ──────────────────────────────────────── */}
      <div
        ref={stripRef}
        style={S.strip(stripVisible)}
        aria-hidden={!stripVisible}
      >
        {/* Include ALL tiles in the strip (even mainTile) so users can quickly switch */}
        {allTiles.map(tile => {
          const isActive = tile.id === mainTile.id;
          return (
            <div
              key={tile.id}
              data-tile-id={tile.id}
              style={S.thumb(isActive)}
              onClick={() => handleThumbClick(tile.id)}
              title={`Switch to ${tile.name}`}
            >
              <VideoTile
                trackRef={tile.trackRef}
                audioTrackRef={tile.audioTrackRef}
                name={tile.name}
                isLocal={tile.isLocal}
                audioEnabled={tile.audio}
                videoEnabled={tile.video && !isActive}
                isScreenShare={tile.isScreen}
              />
         
             
              {/* Active indicator dot */}
              {isActive && <div style={S.activeIndicator} />}
            </div>
          );
        })}      
      </div>
    </div>
  );
}
