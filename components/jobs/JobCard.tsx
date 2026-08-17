import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CvMeta, Job } from '../../types';
import { isJobStale } from '../../lib/jobStale';
import ScoreBadge from '../matches/ScoreBadge';

interface Props {
  job: Job;
  cv: CvMeta | undefined;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US');
}

const JobCard: React.FC<Props> = ({ job, cv, draggable, onDragStart, onClick }) => {
  const stale = isJobStale(job, cv);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      data-testid={`job-card-${job.id}`}
      className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all"
    >
      <p className="text-sm font-semibold text-slate-800 truncate">{job.company}</p>
      <p className="text-xs text-slate-400 truncate mb-2">{job.title}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400 truncate">{cv?.label ?? '—'}</span>
        <div className="flex items-center gap-1 shrink-0">
          {stale && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          {job.ats && <ScoreBadge score={job.ats.analysis.overallScore} />}
        </div>
      </div>
      <p className="text-[11px] text-slate-300 mt-1.5">{formatDate(job.updatedAt)}</p>
    </div>
  );
};

export default JobCard;
