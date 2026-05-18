import React, { useState, useEffect } from 'react';
import { CVData } from '../types';
import { generateLatex } from '../services/latexService';
import { Copy, Check } from 'lucide-react';

interface LatexViewerProps {
  data: CVData;
}

const LatexViewer: React.FC<LatexViewerProps> = ({ data }) => {
  const [latexCode, setLatexCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLatexCode(generateLatex(data));
  }, [data]);

  const handleCopy = () => {
    navigator.clipboard.writeText(latexCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <textarea
        readOnly
        value={latexCode}
        className="flex-1 w-full p-6 font-mono text-sm bg-slate-900 text-slate-300 resize-none focus:outline-none rounded-lg leading-relaxed"
        spellCheck={false}
      />
      <p className="text-xs text-slate-400 mt-2 text-center">
        Copy this code into Overleaf or a .tex editor · The photo must be named <code className="bg-slate-200 px-1 rounded">photo.jpg</code>
      </p>
    </div>
  );
};

export default LatexViewer;
