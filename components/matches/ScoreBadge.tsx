import React from 'react';

interface Props {
  score: number;
  testId?: string;
}

const ScoreBadge: React.FC<Props> = ({ score, testId }) => {
  const className = score >= 80
    ? 'bg-emerald-100 text-emerald-700'
    : score >= 60
      ? 'bg-amber-100 text-amber-700'
      : 'bg-red-100 text-red-700';

  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${className}`}
    >
      {score}
      <span className="font-normal opacity-70">/100</span>
    </span>
  );
};

export default ScoreBadge;
