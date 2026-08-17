import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { AIProvider } from '../services/aiService';

export type AnalysisStep = 'idle' | 'reading' | 'sending' | 'processing' | 'done' | 'error';

interface Props {
  step: AnalysisStep;
  provider: AIProvider;
  error: string | null;
  timeoutSeconds: number;
  onDismiss: () => void;
}

const STEPS: { id: AnalysisStep; label: string; sublabel: string }[] = [
  { id: 'reading',    label: 'Reading file',       sublabel: 'Decoding PDF to base64' },
  { id: 'sending',    label: 'Sending to AI',      sublabel: 'Waiting for API response' },
  { id: 'processing', label: 'Extracting data',   sublabel: 'Structuring JSON' },
];

const STEP_ORDER: AnalysisStep[] = ['reading', 'sending', 'processing'];

function categorizeError(raw: string, timeoutSeconds: number): { friendly: string; technical: string | null } {
  const lower = raw.toLowerCase();
  if (lower.includes('401') || lower.includes('403') || lower.includes('api key') || lower.includes('unauthorized')) {
    return { friendly: 'Invalid or expired API key. Check your .env.local file.', technical: raw };
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota')) {
    return { friendly: 'Rate limit reached. Wait a few seconds and try again.', technical: raw };
  }
  if (lower.includes('timeout') || lower.includes('expired')) {
    return { friendly: `Request timed out (> ${timeoutSeconds} s). The API may be overloaded, please retry.`, technical: null };
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('connection')) {
    return { friendly: 'Unable to reach the API. Check your Internet connection.', technical: null };
  }
  if (lower.includes('json') || lower.includes('parse') || lower.includes('unexpected token')) {
    return { friendly: 'The AI response could not be parsed as JSON. Try the other provider.', technical: raw };
  }
  return { friendly: raw, technical: null };
}

const AnalysisOverlay: React.FC<Props> = ({ step, provider, error, timeoutSeconds, onDismiss }) => {
  const [countdown, setCountdown] = useState(timeoutSeconds);

  const isActive = step !== 'idle' && step !== 'done' && step !== 'error';

  // Reset and run countdown only while analysis is active
  useEffect(() => {
    if (!isActive) return;
    setCountdown(timeoutSeconds);
    const interval = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (step === 'idle') return null;

  const isError = step === 'error';
  const isDone = step === 'done';
  const currentIdx = STEP_ORDER.indexOf(step);
  const providerLabel = provider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude';
  const parsedError = error ? categorizeError(error, timeoutSeconds) : null;

  return (
    <div className="absolute inset-0 bg-black/60 z-[60] flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className={`p-2.5 rounded-full shrink-0 ${
            isError ? 'bg-red-100' : isDone ? 'bg-green-100' : 'bg-indigo-100'
          }`}>
            {isError
              ? <AlertCircle className="w-6 h-6 text-red-500" />
              : isDone
              ? <CheckCircle className="w-6 h-6 text-green-500" />
              : <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
            }
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-800">
              {isError ? 'Analysis failed' : isDone ? 'Analysis complete!' : 'Analyzing CV'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {isError ? 'See details below' : `Provider: ${providerLabel}`}
            </p>
          </div>
          {isActive && (
            <div className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-sm font-mono font-bold border ${
              countdown <= 10
                ? 'bg-orange-50 border-orange-200 text-orange-600'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              {countdown}s
            </div>
          )}
        </div>

        {/* Steps */}
        {!isError && (
          <div className="space-y-2 mb-6">
            {STEPS.map((s, i) => {
              const isCompleted = isDone || currentIdx > i;
              const isCurrent = !isDone && currentIdx === i;
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                    isCurrent ? 'bg-indigo-50 border border-indigo-100' : ''
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isCompleted ? 'bg-green-500' : isCurrent ? 'bg-indigo-500' : 'bg-slate-200'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isCurrent ? (
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold">{i + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${
                      isCompleted ? 'text-green-700' : isCurrent ? 'text-indigo-700' : 'text-slate-400'
                    }`}>{s.label}</p>
                    <p className={`text-xs mt-0.5 ${isCurrent ? 'text-indigo-400' : 'text-slate-400'}`}>
                      {s.sublabel}
                    </p>
                  </div>
                  {isCurrent && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Timeout warning */}
        {isActive && countdown === 0 && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
            <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
            <p className="text-sm text-orange-700">The request is taking longer than expected…</p>
          </div>
        )}

        {/* Error detail */}
        {isError && parsedError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1.5">Error cause</p>
            <p className="text-sm text-red-700">{parsedError.friendly}</p>
            {parsedError.technical && parsedError.technical !== parsedError.friendly && (
              <details className="mt-3">
                <summary className="text-xs text-red-400 cursor-pointer select-none hover:text-red-500">
                  Technical message
                </summary>
                <p className="text-xs text-red-400 font-mono mt-1.5 break-all bg-red-100/50 p-2 rounded">
                  {parsedError.technical}
                </p>
              </details>
            )}
          </div>
        )}

        {/* Dismiss */}
        {(isError || isDone) && (
          <button
            onClick={onDismiss}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
              isError
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {isError ? 'Close' : 'Done!'}
          </button>
        )}
      </div>
    </div>
  );
};

export default AnalysisOverlay;
