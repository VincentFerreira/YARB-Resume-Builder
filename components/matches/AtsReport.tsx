import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Target,
  Lightbulb, CheckSquare, ChevronDown, ChevronUp, TrendingUp,
} from 'lucide-react';
import { ATSAnalysisResult, ATSKeyword, ATSFormattingCheck, ATSRecommendation } from '../../types';

interface Props {
  analysis: ATSAnalysisResult;
  headerAction?: React.ReactNode;
}

const statusCfg = {
  present: {
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    pill: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    row: 'border-l-2 border-emerald-400 bg-white',
  },
  missing: {
    icon: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
    pill: 'bg-red-100 text-red-800 border-red-300',
    row: 'border-l-2 border-red-400 bg-white',
  },
  partial: {
    icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
    pill: 'bg-amber-100 text-amber-800 border-amber-300',
    row: 'border-l-2 border-amber-400 bg-white',
  },
} as const;

const KeywordRow: React.FC<{ kw: ATSKeyword }> = ({ kw }) => {
  const cfg = statusCfg[kw.status] ?? statusCfg.missing;
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg ${cfg.row}`} data-testid={`keyword-${kw.keyword}`}>
      <div className="mt-0.5">{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-bold ${cfg.pill}`}>
            {kw.keyword}
          </span>
          {kw.status === 'present' && kw.frequency > 0 && (
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
              ×{kw.frequency} in CV
            </span>
          )}
          {kw.status === 'missing' && (
            <span className="text-xs text-red-500 font-semibold">missing</span>
          )}
          {kw.status === 'partial' && (
            <span className="text-xs text-amber-600 font-semibold">partial</span>
          )}
        </div>
        {kw.analysis && (
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{kw.analysis}</p>
        )}
      </div>
    </div>
  );
};

const SectionCard: React.FC<{
  color: 'red' | 'amber' | 'slate' | 'violet';
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
}> = ({ color, icon, title, badge, children }) => {
  const themes = {
    red: { header: 'bg-red-50 border-red-200', border: 'border-red-200', text: 'text-red-700', badgeBg: 'bg-red-100 text-red-700' },
    amber: { header: 'bg-amber-50 border-amber-200', border: 'border-amber-200', text: 'text-amber-700', badgeBg: 'bg-amber-100 text-amber-700' },
    slate: { header: 'bg-slate-50 border-slate-200', border: 'border-slate-200', text: 'text-slate-600', badgeBg: 'bg-slate-200 text-slate-600' },
    violet: { header: 'bg-violet-50 border-violet-200', border: 'border-violet-200', text: 'text-violet-700', badgeBg: 'bg-violet-100 text-violet-700' },
  };
  const t = themes[color];
  return (
    <div className={`rounded-xl border ${t.border} overflow-hidden`}>
      <div className={`flex items-center justify-between px-3 py-2 ${t.header} border-b ${t.border}`}>
        <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${t.text}`}>
          {icon}
          {title}
        </div>
        {badge && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.badgeBg}`}>{badge}</span>}
      </div>
      <div className="p-3 bg-white">{children}</div>
    </div>
  );
};

const FormattingRow: React.FC<{ check: ATSFormattingCheck }> = ({ check }) => {
  const cfg = {
    pass: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />, bg: 'bg-emerald-50', text: 'text-emerald-800' },
    fail: { icon: <XCircle className="w-4 h-4 text-red-500 shrink-0" />, bg: 'bg-red-50', text: 'text-red-800' },
    warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />, bg: 'bg-amber-50', text: 'text-amber-800' },
  };
  const { icon, bg, text } = cfg[check.status] ?? cfg.warning;
  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg ${bg}`}>
      {icon}
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${text}`}>{check.label}</p>
        {check.detail && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{check.detail}</p>}
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{ rec: ATSRecommendation; index: number }> = ({ rec, index }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-violet-100 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2.5 p-2.5 text-left hover:bg-violet-50 transition-colors"
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-600 text-white text-xs font-bold shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">{rec.section}</span>
          <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{rec.issue}</p>
        </div>
        {(rec.before || rec.after) && (
          open ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-1" />
        )}
      </button>
      {open && (rec.before || rec.after) && (
        <div className="px-3 pb-3 space-y-2 border-t border-violet-100">
          {rec.before && (
            <div className="mt-2">
              <p className="text-xs font-bold text-red-500 mb-1 flex items-center gap-1"><XCircle className="w-3 h-3" /> Before</p>
              <p className="text-xs text-slate-600 bg-red-50 border border-red-100 rounded p-2 italic leading-relaxed">"{rec.before}"</p>
            </div>
          )}
          {rec.after && (
            <div>
              <p className="text-xs font-bold text-emerald-600 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> After</p>
              <p className="text-xs text-slate-600 bg-emerald-50 border border-emerald-100 rounded p-2 italic leading-relaxed">"{rec.after}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AtsReport: React.FC<Props> = ({ analysis, headerAction }) => {
  const scoreColor = analysis.overallScore >= 80 ? 'text-emerald-600' : analysis.overallScore >= 60 ? 'text-amber-500' : 'text-red-500';
  const scoreBarColor = analysis.overallScore >= 80 ? 'bg-emerald-500' : analysis.overallScore >= 60 ? 'bg-amber-400' : 'bg-red-500';
  const scoreBg = analysis.overallScore >= 80 ? 'from-emerald-50' : analysis.overallScore >= 60 ? 'from-amber-50' : 'from-red-50';

  const criticals = analysis.criticalKeywords ?? [];
  const importants = analysis.importantKeywords ?? [];
  const formatting = analysis.formattingChecks ?? [];
  const recommendations = analysis.recommendations ?? [];

  const missingCritical = criticals.filter((k) => k.status === 'missing').length;
  const failedFormatting = formatting.filter((c) => c.status === 'fail').length;

  return (
    <div className="flex flex-col bg-slate-50" data-testid="ats-report">

      {/* ── Score banner ─────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-b ${scoreBg} to-white border-b border-slate-200 rounded-t-xl p-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Score ATS</span>
          </div>
          {headerAction}
        </div>

        <div className="flex items-end gap-3 mb-3">
          <div data-testid="score-badge">
            <span className={`text-5xl font-black ${scoreColor} leading-none`}>{analysis.overallScore}</span>
            <span className="text-slate-400 text-sm">/100</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1 text-slate-400">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs">after corrections:</span>
            <span className="text-lg font-bold text-emerald-600">{analysis.estimatedNewScore}</span>
            <span className="text-xs text-slate-400">/100</span>
          </div>
        </div>

        <div className="relative h-2.5 bg-slate-200 rounded-full overflow-hidden mb-3">
          <div className="absolute inset-y-0 left-0 bg-emerald-200 rounded-full transition-all"
            style={{ width: `${analysis.estimatedNewScore}%` }} />
          <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${scoreBarColor}`}
            style={{ width: `${analysis.overallScore}%` }} />
        </div>

        <div className="flex gap-2 mb-3">
          {missingCritical > 0 && (
            <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
              <XCircle className="w-3 h-3" />{missingCritical} missing critical keyword{missingCritical > 1 ? 's' : ''}
            </span>
          )}
          {failedFormatting > 0 && (
            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
              <AlertTriangle className="w-3 h-3" />{failedFormatting} formatting issue{failedFormatting > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {analysis.summary && (
          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <p className="text-xs text-slate-600 leading-relaxed">{analysis.summary}</p>
          </div>
        )}
      </div>

      {/* ── Sections ─────────────────────────────────────────────────────── */}
      <div className="p-3 space-y-3">

        {criticals.length > 0 && (
          <SectionCard
            color="red"
            icon={<XCircle className="w-3.5 h-3.5" />}
            title="Critical keywords"
            badge={`${criticals.filter((k) => k.status === 'present').length}/${criticals.length} found`}
          >
            <div className="space-y-1.5">
              {criticals.map((kw, i) => <KeywordRow key={i} kw={kw} />)}
            </div>
          </SectionCard>
        )}

        {importants.length > 0 && (
          <SectionCard
            color="amber"
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            title="Important keywords"
            badge={`${importants.filter((k) => k.status === 'present').length}/${importants.length} found`}
          >
            <div className="space-y-1.5">
              {importants.map((kw, i) => <KeywordRow key={i} kw={kw} />)}
            </div>
          </SectionCard>
        )}

        {formatting.length > 0 && (
          <SectionCard
            color="slate"
            icon={<CheckSquare className="w-3.5 h-3.5" />}
            title="Formatting checks"
            badge={`${formatting.filter((c) => c.status === 'pass').length}/${formatting.length} OK`}
          >
            <div className="space-y-1.5">
              {formatting.map((c, i) => <FormattingRow key={i} check={c} />)}
            </div>
          </SectionCard>
        )}

        {recommendations.length > 0 && (
          <SectionCard
            color="violet"
            icon={<Lightbulb className="w-3.5 h-3.5" />}
            title="Recommendations"
            badge={`${recommendations.length}`}
          >
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} index={i} />
              ))}
            </div>
          </SectionCard>
        )}

      </div>
    </div>
  );
};

export default AtsReport;
