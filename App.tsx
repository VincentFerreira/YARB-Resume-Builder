import React, { useState, useRef } from 'react';
import { INITIAL_CV_DATA } from './constants';
import { CVData } from './types';
import Editor from './components/Editor';
import Preview from './components/Preview';
import { generateLatex, generateLatexWithPhoto } from './services/latexService';
import { parseResumeFromPdf, AIProvider } from './services/aiService';
import { compileToPdf, downloadBlob } from './services/pdfService';
import { FileDown, X, UploadCloud, Loader2, Save, FolderOpen, Download } from 'lucide-react';

const App: React.FC = () => {
  const [cvData, setCvData] = useState<CVData>(INITIAL_CV_DATA);
  const [showLatex, setShowLatex] = useState(false);
  const [latexCode, setLatexCode] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

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
        const jsonData = JSON.parse(e.target?.result as string) as CVData;
        // Validation basique de la structure
        if (jsonData.personalInfo && jsonData.skills && jsonData.experience && jsonData.education) {
          setCvData(jsonData);
          alert('CV chargé avec succès !');
        } else {
          alert('Le fichier JSON ne contient pas une structure de CV valide.');
        }
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(latexCode);
    alert('Code LaTeX copié dans le presse-papier !');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Veuillez sélectionner un fichier PDF.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        if (base64) {
          try {
            const extractedData = await parseResumeFromPdf(base64, aiProvider);
            // Preserve the existing photo if new one is null (since extraction returns null for photo)
            // Or just reset it. Let's reset it but maybe keep a placeholder if user wants.
            // Actually, best to just use the extracted data.
            setCvData(prev => ({
              ...extractedData,
              personalInfo: {
                ...extractedData.personalInfo,
                photo: prev.personalInfo.photo // Keep previous photo or default if extraction can't get it
              }
            }));
          } catch (error) {
            console.error("Error parsing PDF:", error);
            alert(`Erreur lors de l'analyse du CV via ${aiProvider === 'claude' ? 'Claude' : 'Gemini'}. Vérifiez votre clé API.`);
          } finally {
            setIsAnalyzing(false);
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File reading error:", error);
      setIsAnalyzing(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen overflow-hidden relative">
      {/* Loading Overlay */}
      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/50 z-[60] flex flex-col items-center justify-center backdrop-blur-sm text-white">
          <Loader2 className="w-12 h-12 animate-spin mb-4" />
          <p className="text-xl font-semibold">Analyse du CV en cours...</p>
          <p className="text-sm text-slate-200 mt-2">L'IA de Gemini lit votre PDF.</p>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10 shrink-0">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="bg-indigo-600 text-white p-1 rounded">CV</span> Builder
        </h1>

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
            disabled={isAnalyzing}
            title="Charger un CV sauvegardé"
          >
            <FolderOpen className="w-4 h-4" />
            Charger
          </button>
          <button
            onClick={handleSaveJson}
            className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-2 rounded hover:bg-amber-100 transition-colors"
            disabled={isAnalyzing}
            title="Sauvegarder le CV en JSON"
          >
            <Save className="w-4 h-4" />
            Sauvegarder
          </button>
          <select
            value={aiProvider}
            onChange={(e) => setAiProvider(e.target.value as AIProvider)}
            className="bg-slate-50 text-slate-700 border border-slate-200 px-3 py-2 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            disabled={isAnalyzing}
            title="Choisir le modèle IA"
          >
            <option value="gemini">🤖 Gemini</option>
            <option value="claude">🧠 Claude</option>
          </select>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded hover:bg-indigo-100 transition-colors"
            disabled={isAnalyzing}
          >
            <UploadCloud className="w-4 h-4" />
            Importer PDF
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 transition-colors"
            disabled={isAnalyzing || isGeneratingPdf}
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
            disabled={isAnalyzing || isGeneratingPdf}
          >
            <FileDown className="w-4 h-4" />
            Exporter en LaTeX
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Editor Panel (Left) */}
        <div className="w-full md:w-1/3 lg:w-1/4 min-w-[350px] border-r border-slate-200 bg-white h-full overflow-hidden">
          <Editor data={cvData} onChange={setCvData} />
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
              <button onClick={copyToClipboard} className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded font-medium">
                Copier le code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
