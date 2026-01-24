import { create } from 'zustand';

interface TranslationHistoryItem {
  id: string;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  timestamp: Date;
}

interface QuestionTranslationState {
  // State
  history: TranslationHistoryItem[];
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addTranslation: (item: Omit<TranslationHistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  setOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useQuestionStore = create<QuestionTranslationState>((set) => ({
  // Initial state
  history: [],
  isOpen: false,
  isLoading: false,
  error: null,

  // Actions
  addTranslation: (item) =>
    set((state) => ({
      history: [
        {
          ...item,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        },
        ...state.history,
      ].slice(0, 20), // Keep max 20 items
      error: null,
    })),

  clearHistory: () => set({ history: [] }),

  setOpen: (open) => set({ isOpen: open }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));
