import { create } from 'zustand';

interface SessionState {
  // Current active session
  activeSessionId: string | null;
  
  // Recording state
  isRecording: boolean;
  recordingStartTime: number | null;
  
  // Actions
  setActiveSessionId: (id: string | null) => void;
  startRecording: () => void;
  stopRecording: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  // Initial state
  activeSessionId: null,
  isRecording: false,
  recordingStartTime: null,

  // Actions
  setActiveSessionId: (id) => set({ activeSessionId: id }),

  startRecording: () =>
    set({
      isRecording: true,
      recordingStartTime: Date.now(),
    }),

  stopRecording: () =>
    set({
      isRecording: false,
      recordingStartTime: null,
    }),
}));
