import { create } from 'zustand';

interface FolderState {
  // UI State
  selectedFolderId: string | null;
  expandedFolderIds: Set<string>;
  sidebarWidth: number;

  // Actions
  setSelectedFolderId: (id: string | null) => void;
  toggleFolderExpanded: (id: string) => void;
  setFolderExpanded: (id: string, expanded: boolean) => void;
  setSidebarWidth: (width: number) => void;
}

export const useFolderStore = create<FolderState>((set) => ({
  // Initial state
  selectedFolderId: null,
  expandedFolderIds: new Set<string>(),
  sidebarWidth: 280,

  // Actions
  setSelectedFolderId: (id) => set({ selectedFolderId: id }),

  toggleFolderExpanded: (id) =>
    set((state) => {
      const newSet = new Set(state.expandedFolderIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { expandedFolderIds: newSet };
    }),

  setFolderExpanded: (id, expanded) =>
    set((state) => {
      const newSet = new Set(state.expandedFolderIds);
      if (expanded) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return { expandedFolderIds: newSet };
    }),

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
}));
