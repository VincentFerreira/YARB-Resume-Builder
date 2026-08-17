import { create } from 'zustand';
import { AtsResult, Job, JobEvent, JobStatus } from '../types';
import { ApiError } from '../services/apiClient';
import {
  addJobEvent,
  createJob,
  CreateJobInput,
  deleteJob as deleteJobRequest,
  listJobs,
  scoreJob as scoreJobRequest,
  updateJob as updateJobRequest,
} from '../services/jobService';

interface JobsState {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  statusFilter: JobStatus[];
  query: string;
  staleOnly: boolean;
  dueOnly: boolean;
  fetchJobs: () => Promise<void>;
  setStatusFilter: (statuses: JobStatus[]) => void;
  setQuery: (q: string) => void;
  setStaleOnly: (staleOnly: boolean) => void;
  setDueOnly: (dueOnly: boolean) => void;
  addJob: (input: CreateJobInput) => Promise<Job>;
  patchJob: (id: string, patch: Partial<Job>) => Promise<Job>;
  removeJob: (id: string) => Promise<void>;
  addEvent: (id: string, event: Pick<JobEvent, 'type' | 'comment' | 'from' | 'to'>) => Promise<Job>;
  scoreJob: (id: string, payload: { cvId: string; cvContentHash: string; ats: AtsResult }) => Promise<Job>;
  moveJob: (id: string, status: JobStatus) => Promise<void>;
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,
  statusFilter: [],
  query: '',
  staleOnly: false,
  dueOnly: false,

  // Always fetches the full, unfiltered set — statusFilter/query/staleOnly are applied
  // client-side (see JobsPage's `visibleJobs`). This keeps KPI tiles and the kanban board
  // (which needs every status, not just the ones currently selected in the table filter
  // pills) consistent with whatever the table shows, without a second network round-trip.
  fetchJobs: async () => {
    set({ loading: true, error: null });
    try {
      const jobs = await listJobs();
      set({ jobs, loading: false });
    } catch {
      set({ loading: false, error: 'Unable to load jobs. Is the server running?' });
    }
  },

  setStatusFilter: (statuses) => set({ statusFilter: statuses }),

  setQuery: (q) => set({ query: q }),

  setStaleOnly: (staleOnly) => set({ staleOnly }),

  setDueOnly: (dueOnly) => set({ dueOnly }),

  addJob: async (input) => {
    const job = await createJob(input);
    set({ jobs: [job, ...get().jobs] });
    return job;
  },

  patchJob: async (id, patch) => {
    const updated = await updateJobRequest(id, patch);
    set({ jobs: get().jobs.map((j) => (j.id === id ? updated : j)) });
    return updated;
  },

  removeJob: async (id) => {
    await deleteJobRequest(id);
    set({ jobs: get().jobs.filter((j) => j.id !== id) });
  },

  addEvent: async (id, event) => {
    const updated = await addJobEvent(id, event);
    set({ jobs: get().jobs.map((j) => (j.id === id ? updated : j)) });
    return updated;
  },

  scoreJob: async (id, payload) => {
    const updated = await scoreJobRequest(id, payload);
    set({ jobs: get().jobs.map((j) => (j.id === id ? updated : j)) });
    return updated;
  },

  // Optimistic status update for kanban drag & drop (§5.2): apply immediately, roll back
  // on failure (e.g. dragging into "applied" without a CV assigned → 409).
  moveJob: async (id, status) => {
    const previous = get().jobs;
    const target = previous.find((j) => j.id === id);
    if (!target || target.status === status) return;

    set({ jobs: previous.map((j) => (j.id === id ? { ...j, status } : j)), error: null });
    try {
      const updated = await updateJobRequest(id, { status });
      set({ jobs: get().jobs.map((j) => (j.id === id ? updated : j)) });
    } catch (err) {
      set({
        jobs: previous,
        error: err instanceof ApiError ? err.message : 'Unable to update status.',
      });
    }
  },
}));
