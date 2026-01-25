import { create } from 'zustand';

type TranslationStatus = 'ready' | 'connecting' | 'live' | 'muted' | 'reconnecting' | 'error';

interface TranslationState {
  // State
  status: TranslationStatus;
  targetLanguage: string;
  volume: number;
  isMuted: boolean;
  error: string | null;

  // Actions
  setStatus: (status: TranslationStatus) => void;
  setTargetLanguage: (lang: string) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTranslationStore = create<TranslationState>((set) => ({
  // Initial state
  status: 'ready',
  targetLanguage: 'zh',
  volume: 100,
  isMuted: false,
  error: null,

  // Actions
  setStatus: (status) => set({ status, error: status === 'error' ? null : undefined }),

  setTargetLanguage: (lang) => set({ targetLanguage: lang }),

  setVolume: (vol) => set({ volume: Math.max(0, Math.min(100, vol)) }),

  toggleMute: () =>
    set((state) => ({
      isMuted: !state.isMuted,
    })),

  setMuted: (muted) => set({ isMuted: muted }),

  setError: (error) => set({ error, status: error ? 'error' : 'ready' }),

  reset: () =>
    set({
      status: 'ready',
      error: null,
    }),
}));
