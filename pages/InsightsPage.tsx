import React, { useEffect, useMemo } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { useJobsStore } from '../store/jobsStore';

const BUCKETS: { label: string; min: number; max: number; className: string }[] = [
  { label: '0–59', min: 0, max: 59, className: 'bg-red-400' },
  { label: '60–79', min: 60, max: 79, className: 'bg-amber-400' },
  { label: '80–100', min: 80, max: 100, className: 'bg-emerald-400' },
];

const InsightsPage: React.FC = () => {
  const { jobs, loading, fetchJobs } = useJobsStore();

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const scored = useMemo(() => jobs.filter((j) => j.ats), [jobs]);

  const distribution = useMemo(() => {
    return BUCKETS.map((bucket) => ({
      ...bucket,
      count: scored.filter((j) => j.ats!.analysis.overallScore >= bucket.min && j.ats!.analysis.overallScore <= bucket.max).length,
    }));
  }, [scored]);

  const topMissingKeywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of scored) {
      const keywords = [...(job.ats!.analysis.criticalKeywords ?? []), ...(job.ats!.analysis.importantKeywords ?? [])];
      for (const kw of keywords) {
        if (kw.status !== 'missing') continue;
        counts.set(kw.keyword, (counts.get(kw.keyword) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [scored]);

  const maxCount = Math.max(1, ...distribution.map((b) => b.count));

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (scored.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-slate-400 max-w-sm">
          <BarChart3 className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No scores yet.</p>
          <p className="text-sm">Compute a score on a job to see analytics here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" data-testid="insights-page">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-xl font-bold text-slate-800">Analyse</h1>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Score distribution ({scored.length} scored job{scored.length > 1 ? 's' : ''})
          </p>
          <div className="space-y-2.5">
            {distribution.map((bucket) => (
              <div key={bucket.label} className="flex items-center gap-3" data-testid={`distribution-${bucket.label}`}>
                <span className="text-xs text-slate-500 w-14 shrink-0">{bucket.label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${bucket.className} transition-all`}
                    style={{ width: `${(bucket.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 w-6 text-right shrink-0">{bucket.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Top missing keywords</p>
          {topMissingKeywords.length === 0 ? (
            <p className="text-sm text-slate-400">No missing keywords across your scored jobs — nicely done.</p>
          ) : (
            <ul className="space-y-2">
              {topMissingKeywords.map(([keyword, count]) => (
                <li key={keyword} className="flex items-center justify-between text-sm" data-testid={`missing-keyword-${keyword}`}>
                  <span className="text-slate-700 font-medium">{keyword}</span>
                  <span className="text-xs text-slate-400">missing in {count} job{count > 1 ? 's' : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsightsPage;
