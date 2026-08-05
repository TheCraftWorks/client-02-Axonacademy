import { createSlice } from '@reduxjs/toolkit';

const meetingSlice = createSlice({
  name: 'meeting',
  initialState: {
    roomId: null,
    status: 'idle',           // idle | waiting | live | ended | rejected | error
    participants: [],         // [{ socketId, name, role, audio, video }]
    waitingList: [],          // [{ socketId, name }]
    messages: [],             // [{ senderId, senderName, message, timestamp, _unread, _system }]
    activePanel: null,        // null | 'chat' | 'participants' | 'waiting'
    isScreenSharing: false,
    raisedHands: [],          // [{ socketId, name }]
    viewMode: 'gallery',      // 'gallery' | 'speaker'
    speakerSocketId: null,    // socketId of the pinned/spotlighted participant
  },
  reducers: {
    setRoomId(state, { payload }) { state.roomId = payload; },

    setStatus(state, { payload }) { state.status = payload; },

    setParticipants(state, { payload }) { state.participants = payload; },

    addParticipant(state, { payload }) {
      if (!state.participants.find(p => p.socketId === payload.socketId))
        state.participants.push({ audio: true, video: true, ...payload });
    },

    removeParticipant(state, { payload: socketId }) {
      state.participants = state.participants.filter(p => p.socketId !== socketId);
    },

    updateParticipantMedia(state, { payload: { socketId, audio, video } }) {
      const p = state.participants.find(p => p.socketId === socketId);
      if (p) {
        if (audio !== undefined) p.audio = audio;
        if (video !== undefined) p.video = video;
      }
    },

    addToWaiting(state, { payload }) {
      if (!state.waitingList.find(w => w.socketId === payload.socketId))
        state.waitingList.push(payload);
    },

    removeFromWaiting(state, { payload: socketId }) {
      state.waitingList = state.waitingList.filter(w => w.socketId !== socketId);
    },

    // Mark as unread automatically unless chat panel is currently open
    addMessage(state, { payload }) {
      state.messages.push({
        ...payload,
        _unread: state.activePanel !== 'chat' && !payload._system,
      });
    },

    // Clear unread flag on all messages (called when chat panel opens)
    markMessagesRead(state) {
      state.messages.forEach(m => { m._unread = false; });
    },

    clearMessages(state) { state.messages = []; },

    setActivePanel(state, { payload }) {
      // Toggle — clicking same panel closes it
      const next = state.activePanel === payload ? null : payload;
      state.activePanel = next;
      // Auto-clear unread when opening chat
      if (next === 'chat') {
        state.messages.forEach(m => { m._unread = false; });
      }
    },

    closePanel(state) { state.activePanel = null; },

    setScreenSharing(state, { payload }) { state.isScreenSharing = payload; },

    addRaisedHand(state, { payload }) {
      if (!state.raisedHands.find(h => h.socketId === payload.socketId))
        state.raisedHands.push(payload);
    },

    removeRaisedHand(state, { payload: socketId }) {
      state.raisedHands = state.raisedHands.filter(h => h.socketId !== socketId);
    },

    setViewMode(state, { payload }) { state.viewMode = payload; },

    setSpeaker(state, { payload }) { state.speakerSocketId = payload; },

    resetMeeting() {
      return {
        roomId: null, status: 'idle', participants: [], waitingList: [],
        messages: [], activePanel: null, isScreenSharing: false, raisedHands: [],
        viewMode: 'gallery', speakerSocketId: null,
      };
    },
  },
});

export const {
  setRoomId, setStatus, setParticipants, addParticipant, removeParticipant,
  updateParticipantMedia, addToWaiting, removeFromWaiting, addMessage, markMessagesRead,
  clearMessages, setActivePanel, closePanel, setScreenSharing,
  addRaisedHand, removeRaisedHand, setViewMode, setSpeaker, resetMeeting,
} = meetingSlice.actions;

export default meetingSlice.reducer;
