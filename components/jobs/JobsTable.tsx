import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { CvMeta, Job } from '../../types';
import { STATUS_META, PRIORITY_META } from './statusMeta';
import { isJobStale } from '../../lib/jobStale';
import ScoreBadge from '../matches/ScoreBadge';

interface Props {
  jobs: Job[];
  cvsById: Map<string, CvMeta>;
}

function formatNextAction(job: Job): string {
  if (!job.nextActionAt) return '—';
  const date = new Date(job.nextActionAt).toLocaleDateString('en-US');
  return job.nextActionLabel ? `${job.nextActionLabel} · ${date}` : date;
}

const JobsTable: React.FC<Props> = ({ jobs, cvsById }) => {
  const navigate = useNavigate();

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-200">
          <th className="py-2.5 pr-3">Company / Title</th>
          <th className="py-2.5 pr-3">Status</th>
          <th className="py-2.5 pr-3">Priority</th>
          <th className="py-2.5 pr-3">CV</th>
          <th className="py-2.5 pr-3">Score</th>
          <th className="py-2.5 pr-3">Next action</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => {
          const cv = job.cvId ? cvsById.get(job.cvId) : undefined;
          const stale = isJobStale(job, cv);
          return (
            <tr
              key={job.id}
              data-testid={`job-row-${job.id}`}
              onClick={() => navigate(`/jobs/${job.id}`)}
              className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <td className="py-3 pr-3">
                <p className="font-medium text-slate-800">{job.company}</p>
                <p className="text-slate-400 text-xs">{job.title}</p>
              </td>
              <td className="py-3 pr-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[job.status].className}`}>
                  {STATUS_META[job.status].label}
                </span>
              </td>
              <td className={`py-3 pr-3 text-xs font-medium ${PRIORITY_META[job.priority].className}`}>
                {PRIORITY_META[job.priority].label}
              </td>
              <td className="py-3 pr-3 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  {cv?.label ?? (job.cvId ? '—' : <span className="text-slate-300">Unassigned</span>)}
                  {stale && (
                    <span title="Score is stale" data-testid={`stale-badge-${job.id}`}>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 pr-3">
                {job.ats ? <ScoreBadge score={job.ats.analysis.overallScore} testId={`score-badge-${job.id}`} /> : <span className="text-xs text-slate-300">—</span>}
              </td>
              <td className="py-3 pr-3 text-xs text-slate-500">{formatNextAction(job)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default JobsTable;
