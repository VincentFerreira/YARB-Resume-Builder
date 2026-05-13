import React, { useState, useRef, useEffect } from 'react';
import { INITIAL_CV_DATA } from './constants';
import { CVData } from './types';
import { LANGUAGES, createMultiLangString, createMultiLangArray } from './lib/i18n';
import Editor from './components/Editor';
import Preview from './components/Preview';
import ATSChecker from './components/ATSChecker';
import AnalysisOverlay, { AnalysisStep } from './components/AnalysisOverlay';
import { generateLatex, generateLatexWithPhoto } from './services/latexService';
import { parseResumeFromPdf, AIProvider } from './services/aiService';
import { compileToPdf, downloadBlob } from './services/pdfService';
import { FileDown, X, UploadCloud, Loader2, Save, FolderOpen, Download } from 'lucide-react';

const App: React.FC = () => {
  const [cvData, setCvData] = useState<CVData>(INITIAL_CV_DATA);
  const [activeTab, setActiveTab] = useState<'editor' | 'ats'>('editor');
  const [showLatex, setShowLatex] = useState(false);
  const [latexCode, setLatexCode] = useState('');
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.lang = cvData.currentLanguage;
  }, [cvData.currentLanguage]);

  const isOverlayVisible = analysisStep !== 'idle';

  // Sauvegarder le CV en JSON
  const handleSaveJson = () => {
    const dataStr = JSON.stringify(cvData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = `cv_${cvData.personalInfo.firstName || 'export'}_${cvData.personalInfo.lastName || ''}_${new Date().toISOString().split('T')[0]}.json`;
    link.download = fileName.replace(/\s+/g, '_');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Charger un CV depuis un fichier JSON
  const handleLoadJsonClick = () => {
    jsonInputRef.current?.click();
  };

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      alert('Veuillez sélectionner un fichier JSON.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);

        // Basic validation
        if (!jsonData.personalInfo || !jsonData.skills || !jsonData.experience || !jsonData.education) {
          alert('Le fichier JSON ne contient pas une structure de CV valide.');
          return;
        }

        // Migration: convert old format to new format if needed
        const migratedData: any = { ...jsonData };
        if (!migratedData.currentLanguage) migratedData.currentLanguage = 'fr';

        const toBilingual = (val: any) => typeof val === 'string' ? createMultiLangString({ fr: val, en: val }) : val;
        const toBilingualArray = (val: any) => Array.isArray(val) ? createMultiLangArray({ fr: val, en: val }) : val;

        if (typeof migratedData.personalInfo.title === 'string') {
          migratedData.personalInfo.title = toBilingual(migratedData.personalInfo.title);
        }
        if (typeof migratedData.personalInfo.summary === 'string') {
          migratedData.personalInfo.summary = toBilingual(migratedData.personalInfo.summary);
        }

        migratedData.skills = migratedData.skills.map((s: any) => ({
          ...s,
          name: toBilingual(s.name),
          items: toBilingual(s.items)
        }));

        migratedData.experience = migratedData.experience.map((exp: any) => ({
          ...exp,
          role: toBilingual(exp.role),
          startDate: toBilingual(exp.startDate),
          endDate: toBilingual(exp.endDate),
          description: toBilingualArray(exp.description)
        }));

        migratedData.education = migratedData.education.map((edu: any) => ({
          ...edu,
          degree: toBilingual(edu.degree),
          description: toBilingual(edu.description)
        }));

        if (Array.isArray(migratedData.languages)) {
          migratedData.languages = toBilingualArray(migratedData.languages);
        } else if (!migratedData.languages) {
          migratedData.languages = { fr: [], en: [] };
        }

        setCvData(migratedData as CVData);
        alert('CV chargé avec succès !');
      } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);

    // Reset input
    if (jsonInputRef.current) {
      jsonInputRef.current.value = '';
    }
  };

  const handleGenerateLatex = () => {
    const code = generateLatex(cvData);
    setLatexCode(code);
    setShowLatex(true);
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const { latex: latexCode, photoData } = generateLatexWithPhoto(cvData);
      const pdfBlob = await compileToPdf(latexCode, photoData);
      const fileName = `cv_${cvData.personalInfo.firstName || 'export'}_${cvData.personalInfo.lastName || ''}.pdf`;
      downloadBlob(pdfBlob, fileName.replace(/\s+/g, '_'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const [copied, setCopied] = useState(false);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(latexCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (file.type !== 'application/pdf') {
      setAnalysisError('Le fichier sélectionné n\'est pas un PDF.');
      setAnalysisStep('error');
      return;
    }

    setAnalysisError(null);
    setAnalysisStep('reading');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      if (!base64) return;
      try {
        const extractedData = await parseResumeFromPdf(base64, aiProvider, (step) => {
          setAnalysisStep(step);
        });
        setCvData(prev => ({
          ...extractedData,
          personalInfo: { ...extractedData.personalInfo, photo: prev.personalInfo.photo }
        }));
        setAnalysisStep('done');
      } catch (error) {
        console.error('Error parsing PDF:', error);
        setAnalysisError(error instanceof Error ? error.message : String(error));
        setAnalysisStep('error');
      }
    };
    reader.onerror = () => {
      setAnalysisError('Impossible de lire le fichier. Vérifiez qu\'il n\'est pas corrompu.');
      setAnalysisStep('error');
    };
    reader.readAsDataURL(file);
  };

  const handleDismissAnalysis = () => {
    setAnalysisStep('idle');
    setAnalysisError(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen overflow-hidden relative">
      <AnalysisOverlay
        step={analysisStep}
        provider={aiProvider}
        error={analysisError}
        timeoutSeconds={60}
        onDismiss={handleDismissAnalysis}
      />

      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="bg-indigo-600 text-white p-1 rounded">CV</span> Builder
          </h1>
          <div className="flex bg-slate-100 rounded p-1 gap-1">
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setCvData(prev => ({ ...prev, currentLanguage: code }))}
                className={`px-3 py-1 text-sm rounded transition-colors ${cvData.currentLanguage === code ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="file"
            accept=".json"
            ref={jsonInputRef}
            className="hidden"
            onChange={handleJsonFileChange}
          />
          <input
            type="file"
            accept=".pdf"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleLoadJsonClick}
            className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded hover:bg-emerald-100 transition-colors"
            disabled={isOverlayVisible}
            title="Charger un CV sauvegardé"
          >
            <FolderOpen className="w-4 h-4" />
            Charger
          </button>
          <button
            onClick={handleSaveJson}
            className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded hover:bg-amber-100 transition-colors"
            disabled={isOverlayVisible}
            title="Sauvegarder le CV en JSON"
          >
            <Save className="w-4 h-4" />
            Sauvegarder
          </button>
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as AIProvider)}
            className="bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            disabled={isOverlayVisible}
            title="Choisir le modèle IA"
          >
            <option value="gemini">🤖 Gemini</option>
            <option value="claude">🧠 Claude</option>
          </select>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded hover:bg-indigo-100 transition-colors"
            disabled={isOverlayVisible}
          >
            <UploadCloud className="w-4 h-4" />
            Importer PDF
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 transition-colors"
            disabled={isOverlayVisible || isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isGeneratingPdf ? 'Génération...' : 'Télécharger PDF'}
          </button>
          <button
            onClick={handleGenerateLatex}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded hover:bg-slate-700 transition-colors"
            disabled={isOverlayVisible || isGeneratingPdf}
          >
            <FileDown className="w-4 h-4" />
            Exporter en LaTeX
          </button>
        </div>
      </header>


      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Panel (Left) */}
        <div className="w-full md:w-1/3 lg:w-1/4 min-w-[350px] border-r border-slate-200 bg-white h-full overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 shrink-0">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'editor'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Éditeur
            </button>
            <button
              onClick={() => setActiveTab('ats')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'ats'
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              ATS Checker
            </button>
          </div>
          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'editor'
              ? <Editor data={cvData} onChange={setCvData} />
              : <ATSChecker cvData={cvData} aiProvider={aiProvider} />
            }
          </div>
        </div>

        {/* Preview Panel (Right) */}
        <div className="flex-1 bg-slate-100 overflow-auto p-8 flex justify-center items-start">
          <Preview data={cvData} />
        </div>
      </main>

      {/* LaTeX Modal */}
      {showLatex && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-bold">Code Source LaTeX</h3>
              <button onClick={() => setShowLatex(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 bg-slate-50 overflow-hidden relative">
              <textarea
                readOnly
                className="w-full h-full p-4 font-mono text-sm bg-slate-900 text-slate-300 resize-none rounded focus:outline-none"
                value={latexCode}
              />
            </div>
            <div className="p-4 border-t flex justify-end gap-3 bg-white rounded-b-xl">
              <div className="text-xs text-slate-500 self-center mr-auto">
                * Copiez ce code dans Overleaf ou un éditeur .tex. Assurez-vous d'avoir une image nommée 'photo.jpg' pour la photo.
              </div>
              <button onClick={() => setShowLatex(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">
                Fermer
              </button>
              <button onClick={copyToClipboard} className={`px-4 py-2 rounded font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                {copied ? '✓ Copié !' : 'Copier le code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
