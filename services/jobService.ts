import { AtsResult, Job, JobEvent, JobStatus } from '../types';
import { apiFetch } from './apiClient';

export interface ListJobsParams {
  status?: JobStatus[];
  q?: string;
  sort?: 'nextActionAt' | 'priority' | 'updatedAt';
}

export interface CreateJobInput {
  company: string;
  title: string;
  descriptionRaw: string;
  status?: JobStatus;
  priority?: 1 | 2 | 3;
  location?: string;
  workMode?: Job['workMode'];
  contractType?: Job['contractType'];
  salaryRange?: string;
  url?: string;
  source?: string;
  contactName?: string;
  keywords?: string[];
  cvId?: string;
  notes?: string;
  nextActionAt?: string;
  nextActionLabel?: string;
}

export async function listJobs(params: ListJobsParams = {}): Promise<Job[]> {
  const search = new URLSearchParams();
  (params.status ?? []).forEach((s) => search.append('status', s));
  if (params.q) search.set('q', params.q);
  if (params.sort) search.set('sort', params.sort);
  const qs = search.toString();
  return apiFetch<Job[]>(`/jobs${qs ? `?${qs}` : ''}`, undefined, 'Failed to list jobs');
}

export async function getJob(id: string): Promise<Job> {
  return apiFetch<Job>(`/jobs/${id}`, undefined, 'Job not found');
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  return apiFetch<Job>('/jobs', { method: 'POST', body: JSON.stringify(input) }, 'Failed to create job');
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<Job> {
  return apiFetch<Job>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }, 'Failed to update job');
}

export async function deleteJob(id: string): Promise<void> {
  await apiFetch<{ success: true }>(`/jobs/${id}`, { method: 'DELETE' }, 'Failed to delete job');
}

export async function addJobEvent(
  id: string,
  event: Pick<JobEvent, 'type' | 'comment' | 'from' | 'to'>
): Promise<Job> {
  return apiFetch<Job>(`/jobs/${id}/events`, { method: 'POST', body: JSON.stringify(event) }, 'Failed to add event');
}

export async function scoreJob(
  id: string,
  payload: { cvId: string; cvContentHash: string; ats: AtsResult }
): Promise<Job> {
  return apiFetch<Job>(`/jobs/${id}/score`, { method: 'POST', body: JSON.stringify(payload) }, 'Failed to save score');
}
