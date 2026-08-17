import { CvMeta, Job } from '../types';
import { ATS_PROMPT_VERSION } from './atsConstants';

/**
 * A job's score is stale once the CV it was computed against has changed, or the
 * scoring prompt itself has moved on. This intentionally skips comparing
 * `ats.jobDescriptionHash` (that leg needs a client-side hash of `descriptionRaw`
 * matching the server's canonical-JSON sha256, added alongside real scoring in lot 4).
 */
export function isJobStale(job: Job, cv: CvMeta | undefined): boolean {
  if (!job.ats || !job.cvId) return false;
  if (!cv) return true;
  if (job.cvContentHash !== cv.contentHash) return true;
  if (job.ats.promptVersion !== ATS_PROMPT_VERSION) return true;
  return false;
}
