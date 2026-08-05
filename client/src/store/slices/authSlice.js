import { createSlice } from '@reduxjs/toolkit';

const saved = (() => {
  try {
    const u = localStorage.getItem('user');
    const t = localStorage.getItem('token');
    return u && t ? { user: JSON.parse(u), token: t } : null;
  } catch { return null; }
})();

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: saved?.user || null,
    token: saved?.token || null,
    isAuthenticated: !!saved,
  },
  reducers: {
    loginSuccess(state, { payload }) {
      state.user = payload.user;
      state.token = payload.token;
      state.isAuthenticated = true;
      localStorage.setItem('token', payload.token);
      localStorage.setItem('user', JSON.stringify(payload.user));
    },
    setGuestUser(state, { payload }) {
      state.user = payload;
      state.token = null;
      state.isAuthenticated = false; // guests don't have full auth
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const { loginSuccess, setGuestUser, logout } = authSlice.actions;
export default authSlice.reducer;
