import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Target,
  Lightbulb, CheckSquare, RotateCcw, Loader2
} from 'lucide-react';
import { CVData, ATSAnalysisResult, ATSKeyword, ATSFormattingCheck, ATSRecommendation } from '../types';
import { analyzeATS, AIProvider } from '../services/aiService';

interface ATSCheckerProps {
  cvData: CVData;
  aiProvider: AIProvider;
}

const ScoreRing: React.FC<{ score: number; label: string; color: string }> = ({ score, label, color }) => (
  <div className="flex flex-col items-center gap-1">
    <div className={`text-4xl font-bold ${color}`}>{score}<span className="text-lg font-normal text-slate-400">/100</span></div>
    <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</div>
  </div>
);

const KeywordBadge: React.FC<{ kw: ATSKeyword }> = ({ kw }) => {
  const styles = {
    present: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    missing: 'bg-red-50 text-red-800 border-red-200',
    partial: 'bg-amber-50 text-amber-800 border-amber-200',
  };
  const icons = {
    present: <CheckCircle2 className="w-3 h-3 shrink-0" />,
    missing: <XCircle className="w-3 h-3 shrink-0" />,
    partial: <AlertTriangle className="w-3 h-3 shrink-0" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${styles[kw.status]}`}>
      {icons[kw.status]}
      {kw.keyword}
      {kw.status === 'present' && kw.frequency > 0 && (
        <span className="ml-0.5 text-emerald-600 font-bold">×{kw.frequency}</span>
      )}
    </span>
  );
};

const FormattingRow: React.FC<{ check: ATSFormattingCheck }> = ({ check }) => {
  const iconMap = {
    pass: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    fail: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  };
  return (
    <div className="flex items-start gap-2 py-1.5">
      {iconMap[check.status]}
      <div>
        <span className="text-sm font-medium text-slate-700">{check.label}</span>
        {check.detail && <p className="text-xs text-slate-500 mt-0.5">{check.detail}</p>}
      </div>
    </div>
  );
};

const RecommendationCard: React.FC<{ rec: ATSRecommendation; index: number }> = ({ rec, index }) => (
  <details className="border border-slate-200 rounded-lg overflow-hidden group">
    <summary className="flex items-start gap-2.5 p-3 cursor-pointer hover:bg-slate-50 transition-colors list-none">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold shrink-0 mt-0.5">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">{rec.section}</span>
        <p className="text-sm text-slate-700 mt-0.5">{rec.issue}</p>
      </div>
    </summary>
    {(rec.before || rec.after) && (
      <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2">
        {rec.before && (
          <div>
            <p className="text-xs font-semibold text-red-600 mb-1">Avant</p>
            <p className="text-xs text-slate-600 bg-red-50 rounded p-2 italic">"{rec.before}"</p>
          </div>
        )}
        {rec.after && (
          <div>
            <p className="text-xs font-semibold text-emerald-600 mb-1">Après</p>
            <p className="text-xs text-slate-600 bg-emerald-50 rounded p-2 italic">"{rec.after}"</p>
          </div>
        )}
      </div>
    )}
  </details>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-indigo-600">{icon}</span>
    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{title}</h3>
  </div>
);

const ATSChecker: React.FC<ATSCheckerProps> = ({ cvData, aiProvider }) => {
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState<ATSAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeATS(cvData, jobDescription, aiProvider);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <div>
          <p className="font-semibold text-slate-700">Analyse en cours...</p>
          <p className="text-sm text-slate-500 mt-1">avec {aiProvider === 'claude' ? 'Claude' : 'Gemini'}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">Erreur d'analyse</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Réessayer
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col h-full p-4 gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-800">ATS Resume Checker</h2>
          <p className="text-xs text-slate-500 mt-1">
            Collez une offre d'emploi pour analyser la compatibilité de votre CV avec les systèmes ATS.
          </p>
        </div>
        <textarea
          className="flex-1 w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-400"
          placeholder="Collez ici l'offre d'emploi..."
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
        />
        <button
          onClick={handleAnalyze}
          disabled={!jobDescription.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Target className="w-4 h-4" />
          Analyser avec {aiProvider === 'claude' ? 'Claude' : 'Gemini'}
        </button>
      </div>
    );
  }

  const scoreColor = result.overallScore >= 80 ? 'text-emerald-600' : result.overallScore >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBarColor = result.overallScore >= 80 ? 'bg-emerald-500' : result.overallScore >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Score header */}
      <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border-b border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Target className="w-4 h-4 text-indigo-600" />
            Score ATS
          </h2>
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Nouvelle analyse
          </button>
        </div>
        <div className="flex items-center justify-around">
          <ScoreRing score={result.overallScore} label="Score actuel" color={scoreColor} />
          <div className="text-slate-300 text-2xl">→</div>
          <ScoreRing score={result.estimatedNewScore} label="Après corrections" color="text-emerald-600" />
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${scoreBarColor}`}
            style={{ width: `${result.overallScore}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2 italic">{result.summary}</p>
      </div>

      <div className="p-4 space-y-5">
        {/* Critical keywords */}
        {result.criticalKeywords.length > 0 && (
          <div>
            <SectionHeader icon={<XCircle className="w-4 h-4" />} title="Mots-clés critiques" />
            <div className="flex flex-wrap gap-1.5">
              {result.criticalKeywords.map((kw, i) => <KeywordBadge key={i} kw={kw} />)}
            </div>
          </div>
        )}

        {/* Important keywords */}
        {result.importantKeywords.length > 0 && (
          <div>
            <SectionHeader icon={<AlertTriangle className="w-4 h-4" />} title="Mots-clés importants" />
            <div className="flex flex-wrap gap-1.5">
              {result.importantKeywords.map((kw, i) => <KeywordBadge key={i} kw={kw} />)}
            </div>
          </div>
        )}

        {/* Formatting checks */}
        {result.formattingChecks.length > 0 && (
          <div>
            <SectionHeader icon={<CheckSquare className="w-4 h-4" />} title="Vérifications formatage" />
            <div className="divide-y divide-slate-100">
              {result.formattingChecks.map((check, i) => <FormattingRow key={i} check={check} />)}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div>
            <SectionHeader icon={<Lightbulb className="w-4 h-4" />} title="Recommandations" />
            <div className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ATSChecker;
