import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, Trash2, Plus, Upload, Loader2, AlertCircle, CheckCircle, FolderOpen,
} from 'lucide-react';
import { CVData } from '../types';
import {
  listCVs, loadCV, saveCV, createCV, deleteCV, migrateCV, CVMeta,
} from '../services/cvStorageService';

interface Props {
  open: boolean;
  onClose: () => void;
  currentCVId: string | null;
  currentCVName: string;
  cvData: CVData;
  onLoad: (data: CVData, id: string, name: string) => void;
  onSaved: (id: string, name: string) => void;
  onNewCV: () => void;
}

function formatDate(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}min ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US');
}

const CVManager: React.FC<Props> = ({
  open, onClose, currentCVId, currentCVName, cvData, onLoad, onSaved, onNewCV,
}) => {
  const [cvs, setCvs] = useState<CVMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [name, setName] = useState(currentCVName);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setName(currentCVName); }, [currentCVName]);

  useEffect(() => {
    if (!open) return;
    setServerError(false);
    setLoading(true);
    listCVs()
      .then(setCvs)
      .catch(() => setServerError(true))
      .finally(() => setLoading(false));
  }, [open]);

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = async () => {
    if (!name.trim()) { notify('error', 'Please name this CV.'); return; }
    setSaving(true);
    try {
      if (currentCVId) {
        const updated = await saveCV(currentCVId, name.trim(), cvData);
        onSaved(currentCVId, name.trim());
        setCvs(prev => prev.map(c => c.id === currentCVId ? { ...c, name: name.trim(), updatedAt: updated.updatedAt } : c));
        notify('success', 'CV updated.');
      } else {
        const created = await createCV(name.trim(), cvData);
        onSaved(created.id, name.trim());
        setCvs(prev => [created, ...prev]);
        notify('success', 'CV saved.');
      }
    } catch {
      notify('error', 'Save error. Is the server running?');
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    try {
      const record = await loadCV(id);
      onLoad(record.data, record.id, record.name);
      setName(record.name);
    } catch {
      notify('error', 'Unable to load this CV.');
    }
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return; }
    setDeleteConfirm(null);
    try {
      await deleteCV(id);
      setCvs(prev => prev.filter(c => c.id !== id));
      if (currentCVId === id) onSaved('', '');
      notify('success', 'CV deleted.');
    } catch {
      notify('error', 'Unable to delete this CV.');
    }
  };

  const handleNewCV = () => {
    setName('');
    onNewCV();
    notify('success', 'New CV created.');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        const migrated = migrateCV(json);
        if (!migrated) { notify('error', 'Invalid JSON file.'); return; }
        onLoad(migrated, '', '');
        setName('');
        notify('success', 'CV imported. Save it to keep it.');
      } catch {
        notify('error', 'Error reading the file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">My CVs</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`mx-6 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium shrink-0 ${
            notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {notification.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {notification.message}
          </div>
        )}

        {/* Save current CV */}
        <div className="px-6 py-4 border-b border-slate-100 shrink-0">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Current CV</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="CV name (e.g. Senior Dev EN)"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
          <button
            onClick={handleNewCV}
            className="mt-2.5 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New blank CV
          </button>
        </div>

        {/* CV List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Saved CVs {!loading && !serverError && `(${cvs.length})`}
          </p>

          {serverError && (
            <div className="flex items-start gap-2 text-amber-700 text-sm bg-amber-50 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Server unreachable. Start it with{' '}
                <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">npm start</code>.
              </span>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && !serverError && cvs.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No saved CVs yet.</p>
          )}

          {!loading && !serverError && cvs.map(cv => (
            <div key={cv.id} className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate flex items-center gap-1.5 ${cv.id === currentCVId ? 'text-indigo-600' : 'text-slate-700'}`}>
                  {cv.id === currentCVId && (
                    <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                  )}
                  {cv.name}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDate(cv.updatedAt)}</p>
              </div>
              <button
                onClick={() => handleLoad(cv.id)}
                disabled={cv.id === currentCVId}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-30 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Load
              </button>
              <button
                onClick={() => handleDelete(cv.id)}
                className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                  deleteConfirm === cv.id
                    ? 'text-red-600 hover:text-red-800'
                    : 'text-slate-300 hover:text-red-500'
                }`}
                title={deleteConfirm === cv.id ? 'Click to confirm deletion' : 'Delete'}
                onBlur={() => setDeleteConfirm(null)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteConfirm === cv.id ? 'Confirm?' : ''}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={handleFileImport} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-700 border border-dashed border-slate-200 hover:border-slate-300 rounded-lg py-2.5 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import from a JSON file
          </button>
        </div>
      </div>
    </div>
  );
};

export default CVManager;
