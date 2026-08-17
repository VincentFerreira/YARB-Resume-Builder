import { create } from 'zustand';
import { CvMeta } from '../types';
import { listCVs, deleteCV } from '../services/cvStorageService';

interface CvsState {
  cvs: CvMeta[];
  loading: boolean;
  error: string | null;
  fetchCvs: () => Promise<void>;
  archiveCv: (id: string) => Promise<void>;
}

export const useCvsStore = create<CvsState>((set, get) => ({
  cvs: [],
  loading: false,
  error: null,

  fetchCvs: async () => {
    set({ loading: true, error: null });
    try {
      const cvs = await listCVs();
      set({ cvs, loading: false });
    } catch {
      set({ loading: false, error: 'Unable to load CVs. Is the server running?' });
    }
  },

  archiveCv: async (id: string) => {
    const previous = get().cvs;
    set({ cvs: previous.filter((c) => c.id !== id) });
    try {
      await deleteCV(id);
    } catch {
      set({ cvs: previous, error: 'Unable to archive this CV.' });
    }
  },
}));
