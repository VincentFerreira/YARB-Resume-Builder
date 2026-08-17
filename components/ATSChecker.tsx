import React, { useState } from 'react';
import { XCircle, Target, RotateCcw, Loader2 } from 'lucide-react';
import { CVData, ATSAnalysisResult } from '../types';
import { analyzeATS, AIProvider } from '../services/aiService';
import AtsReport from './matches/AtsReport';

interface ATSCheckerProps {
  cvData: CVData;
  aiProvider: AIProvider;
  onAiProviderChange: (provider: AIProvider) => void;
  initialJobDescription?: string;
  initialResult?: ATSAnalysisResult | null;
}

// ── Main component ────────────────────────────────────────────────────────────

const ATSChecker: React.FC<ATSCheckerProps> = ({ cvData, aiProvider, onAiProviderChange, initialJobDescription, initialResult }) => {
  const [jobDescription, setJobDescription] = useState(initialJobDescription ?? '');
  const [result, setResult] = useState<ATSAnalysisResult | null>(initialResult ?? null);
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

  const handleReset = () => { setResult(null); setError(null); };

  const providerLabel = aiProvider === 'claude' ? 'Claude' : aiProvider === 'fake' ? 'Fake' : 'Gemini';

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-100 flex items-center justify-center">
            <Target className="w-7 h-7 text-indigo-300" />
          </div>
          <Loader2 className="w-16 h-16 text-indigo-500 animate-spin absolute inset-0" />
        </div>
        <div>
          <p className="font-semibold text-slate-700">ATS analysis in progress...</p>
          <p className="text-xs text-slate-400 mt-1">with {providerLabel}</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">Analysis error</p>
              <p className="text-xs text-red-500 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        </div>
        <button onClick={handleReset} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <RotateCcw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  // ── Input form ───────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex flex-col h-full p-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-100 rounded-lg">
            <Target className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">ATS Resume Checker</h2>
            <p className="text-xs text-slate-400">Analyze your resume against a job posting</p>
          </div>
        </div>
        <textarea
          className="flex-1 w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-300 leading-relaxed"
          placeholder="Paste the full job description here..."
          value={jobDescription}
          onChange={e => setJobDescription(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Model</p>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {([
              { value: 'gemini' as AIProvider, label: '🤖 Gemini' },
              { value: 'claude' as AIProvider, label: '🧠 Claude' },
              ...(import.meta.env.VITE_ATS_PROVIDER === 'fake' ? [{ value: 'fake' as AIProvider, label: '🧪 Fake' }] : []),
            ]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => onAiProviderChange(value)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  aiProvider === value
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={!jobDescription.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <Target className="w-4 h-4" />
          Analyze with {providerLabel}
        </button>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto">
      <AtsReport
        analysis={result}
        headerAction={
          <button onClick={handleReset} className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition-colors">
            <RotateCcw className="w-3 h-3" /> New analysis
          </button>
        }
      />
    </div>
  );
};

export default ATSChecker;
