import React from 'react';
import { ArrowRight, MessageSquare, Bell, Users, Target } from 'lucide-react';
import { JobEvent } from '../../types';
import { STATUS_META } from './statusMeta';

interface Props {
  events: JobEvent[];
}

const ICONS: Record<JobEvent['type'], React.ComponentType<{ className?: string }>> = {
  status_change: ArrowRight,
  note: MessageSquare,
  follow_up: Bell,
  interview: Users,
  match_submitted: Target,
};

function describe(event: JobEvent): string {
  switch (event.type) {
    case 'status_change':
      return `Status changed: ${event.from ? STATUS_META[event.from].label : '—'} → ${event.to ? STATUS_META[event.to].label : '—'}`;
    case 'match_submitted':
      return 'Score computed and saved';
    case 'follow_up':
      return event.comment ?? 'Follow-up';
    case 'interview':
      return event.comment ?? 'Interview';
    case 'note':
    default:
      return event.comment ?? 'Note';
  }
}

const JobTimeline: React.FC<Props> = ({ events }) => {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));

  if (sorted.length === 0) {
    return <p className="text-sm text-slate-400 py-4">No activity yet.</p>;
  }

  return (
    <ul data-testid="job-timeline" className="space-y-3">
      {sorted.map((event) => {
        const Icon = ICONS[event.type];
        return (
          <li key={event.id} data-testid={`timeline-event-${event.id}`} className="flex gap-3">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-700">{describe(event)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{new Date(event.at).toLocaleString('en-US')}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default JobTimeline;
