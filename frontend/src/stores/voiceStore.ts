import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels: Record<string, string>;
  preview_url?: string;
}

interface VoiceState {
  voices: Voice[];
  selectedVoiceId: string | null;
  isLoading: boolean;
  error: string | null;
  setVoices: (voices: Voice[]) => void;
  setSelectedVoiceId: (voiceId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchVoices: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Safe localStorage wrapper that handles SecurityError
const safeStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch {
      console.warn('localStorage not available, using in-memory storage');
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch {
      console.warn('localStorage not available, changes will not persist');
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch {
      console.warn('localStorage not available');
    }
  },
};

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set, get) => ({
      voices: [],
      selectedVoiceId: null,
      isLoading: false,
      error: null,

      setVoices: (voices) => set({ voices }),
      setSelectedVoiceId: (voiceId) => set({ selectedVoiceId: voiceId }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),

      fetchVoices: async () => {
        const { isLoading } = get();
        if (isLoading) return;

        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/translate/voices`);
          if (!response.ok) {
            throw new Error('Failed to fetch voices');
          }
          const data = await response.json();
          set({ voices: data.voices, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch voices',
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'rosetta-voice',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        selectedVoiceId: state.selectedVoiceId,
        voices: state.voices,
      }),
    }
  )
);
