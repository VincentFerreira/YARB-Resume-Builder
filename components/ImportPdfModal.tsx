import React from 'react';
import { UploadCloud, X, AlertTriangle } from 'lucide-react';
import { AIProvider } from '../services/aiService';

interface ImportPdfModalProps {
  open: boolean;
  aiProvider: AIProvider;
  onAiProviderChange: (provider: AIProvider) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const AI_OPTIONS: { value: AIProvider; emoji: string; name: string; description: string }[] = [
  { value: 'gemini', emoji: '🤖', name: 'Gemini', description: 'Google — fast and accurate' },
  { value: 'claude', emoji: '🧠', name: 'Claude', description: 'Anthropic — excellent understanding' },
];

const ImportPdfModal: React.FC<ImportPdfModalProps> = ({
  open,
  aiProvider,
  onAiProviderChange,
  onConfirm,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col gap-5 p-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl shrink-0">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Import from PDF</h2>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                AI analyzes your CV PDF and automatically fills all builder fields.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 mt-0.5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI model selector */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI Model</p>
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {AI_OPTIONS.map(({ value, emoji, name, description }) => (
              <button
                key={value}
                onClick={() => onAiProviderChange(value)}
                className={`flex-1 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  aiProvider === value
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className="text-base">{emoji} {name}</span>
                <span className={`text-xs font-normal ${aiProvider === value ? 'text-indigo-400' : 'text-slate-400'}`}>
                  {description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            Your current CV data will be replaced by the data extracted from the PDF.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            Choose a PDF file
          </button>
        </div>

      </div>
    </div>
  );
};

export default ImportPdfModal;
