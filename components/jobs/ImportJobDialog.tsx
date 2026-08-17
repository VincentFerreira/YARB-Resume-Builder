import React, { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { Job } from '../../types';
import { CreateJobInput } from '../../services/jobService';
import { AIProvider, extractJobFromText } from '../../services/aiService';
import JobForm from './JobForm';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateJobInput) => Promise<void>;
}

const FAKE_PROVIDER_ENABLED = import.meta.env.VITE_ATS_PROVIDER === 'fake';
const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'gemini', label: '🤖 Gemini' },
  { value: 'claude', label: '🧠 Claude' },
  ...(FAKE_PROVIDER_ENABLED ? [{ value: 'fake' as AIProvider, label: '🧪 Fake' }] : []),
];

const ImportJobDialog: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [rawText, setRawText] = useState('');
  const [provider, setProvider] = useState<AIProvider>(FAKE_PROVIDER_ENABLED ? 'fake' : 'gemini');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Partial<Job> | null>(null);

  if (!open) return null;

  const handleExtract = async () => {
    if (!rawText.trim()) return;
    setExtracting(true);
    setError(null);
    try {
      const fields = await extractJobFromText(rawText, provider);
      setExtracted({
        company: fields.company,
        title: fields.title,
        descriptionRaw: rawText,
        location: fields.location || undefined,
        workMode: fields.workMode || undefined,
        contractType: fields.contractType || undefined,
        salaryRange: fields.salaryRange || undefined,
        keywords: fields.keywords,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to extract fields from this text.');
    } finally {
      setExtracting(false);
    }
  };

  const handleClose = () => {
    setRawText('');
    setExtracted(null);
    setError(null);
    onClose();
  };

  // Extraction never saves anything by itself — the user always reviews the prefilled
  // JobForm and explicitly submits it before a job is created.
  if (extracted) {
    return <JobForm open initial={extracted} onClose={handleClose} onSubmit={onSubmit} />;
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div data-testid="import-job-dialog" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Import a job posting</h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {error && <div className="text-red-700 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <p className="text-sm text-slate-500">
            Paste the full job posting text below — company, title and a few other fields
            will be extracted automatically. You'll review everything before saving.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the job posting here…"
            rows={10}
            data-testid="import-raw-text-input"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-y"
          />
          {PROVIDERS.length > 1 && (
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 w-fit">
              {PROVIDERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setProvider(value)}
                  data-testid={`import-provider-${value}`}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    provider === value ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 shrink-0 flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleExtract}
            disabled={extracting || !rawText.trim()}
            data-testid="extract-job-button"
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Extract fields
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportJobDialog;
