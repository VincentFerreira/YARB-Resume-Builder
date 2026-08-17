import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CvMeta, JOB_STATUSES, Job, JobStatus } from '../../types';
import { useJobsStore } from '../../store/jobsStore';
import { STATUS_META } from './statusMeta';
import JobCard from './JobCard';

interface Props {
  jobs: Job[];
  cvsById: Map<string, CvMeta>;
}

const JobsKanban: React.FC<Props> = ({ jobs, cvsById }) => {
  const navigate = useNavigate();
  const moveJob = useJobsStore((s) => s.moveJob);
  const [dragOverStatus, setDragOverStatus] = useState<JobStatus | null>(null);

  const byStatus = (status: JobStatus) => jobs.filter((j) => j.status === status);

  const handleDrop = (status: JobStatus) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverStatus(null);
    const jobId = e.dataTransfer.getData('text/plain');
    if (jobId) moveJob(jobId, status);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4" data-testid="jobs-kanban">
      {JOB_STATUSES.map((status) => {
        const columnJobs = byStatus(status);
        return (
          <div
            key={status}
            data-testid={`kanban-column-${status}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }}
            onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
            onDrop={handleDrop(status)}
            className={`w-64 shrink-0 rounded-xl border transition-colors ${
              dragOverStatus === status ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-600">{STATUS_META[status].label}</span>
              <span className="text-xs text-slate-400 bg-white border border-slate-200 rounded-full px-1.5">
                {columnJobs.length}
              </span>
            </div>
            <div className="p-2 space-y-2 min-h-[80px]">
              {columnJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  cv={job.cvId ? cvsById.get(job.cvId) : undefined}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', job.id)}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default JobsKanban;
