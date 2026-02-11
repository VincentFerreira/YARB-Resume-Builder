import { CVData } from '../types';

const escapeLatex = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
};

const escapeLatexMultiline = (str: string): string => {
  if (!str) return '';
  const lineBreak = ' \\\\';
  return str
    .split('\n')
    .map(line => escapeLatex(line))
    .join(lineBreak + '\n');
};

// Extrait les données base64 d'une data URL
const extractBase64Data = (dataUrl: string | null | undefined): { data: string; extension: string } | null => {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!match) return null;
  return { data: match[2], extension: match[1] === 'jpeg' ? 'jpg' : match[1] };
};

export const generateLatex = (data: CVData): string => {
  const { personalInfo, skills, experience, education, languages } = data;

  // Vérifier si une photo est disponible
  const photoData = extractBase64Data(personalInfo.photo);
  const hasPhoto = !!photoData;

  let latex = `\\documentclass[11pt, a4paper]{article}

% Packages
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[default]{raleway}
\\usepackage{geometry}
\\usepackage{fontawesome5}
\\usepackage{xcolor}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{graphicx}
\\usepackage{tabularx}

% Colors
\\definecolor{darkblue}{RGB}{50, 60, 110}
\\definecolor{graytext}{RGB}{80, 80, 80}
\\definecolor{lightgray}{RGB}{200, 200, 200}
\\definecolor{accent}{RGB}{59, 130, 246} % Blue-500 similar

% Page Layout
\\geometry{left=1.5cm, right=1.5cm, top=1.5cm, bottom=1.5cm}
\\pagestyle{empty}
\\linespread{1.15}

% Éviter les veuves et orphelines
\\widowpenalty=10000
\\clubpenalty=10000
\\brokenpenalty=10000

% Commands
\\newcommand{\\cvsection}[1]{
  \\nopagebreak[4]
  \\vspace{0.6cm}
  {\\color{darkblue}\\Large\\bfseries\\uppercase{#1}} \\\\[-0.2cm]
  {\\color{darkblue}\\rule{\\linewidth}{1pt}}
  \\vspace{0.35cm}
  \\nopagebreak[4]
}

\\newcommand{\\cvtag}[1]{
  \\tikz[baseline]\\node[anchor=base,draw=lightgray,rounded corners,inner xsep=1ex,inner ysep =0.75ex,text height=1.5ex,text depth=.25ex]{\\small #1};
}

\\newcommand{\\cvtag}[1]{
  \\tikz[baseline]\\node[anchor=base,draw=lightgray,rounded corners,inner xsep=1ex,inner ysep =0.75ex,text height=1.5ex,text depth=.25ex]{\\small #1};
}

\\begin{document}

% HEADER (Photo Left, Info Right)
\\noindent
`;

  // Ajouter la minipage pour la photo seulement si elle existe
  if (hasPhoto) {
    latex += `\\begin{minipage}{0.22\\textwidth}
    \\begin{center}
        \\includegraphics[width=3cm, height=3.5cm, keepaspectratio]{photo.${photoData.extension}}
    \\end{center}
\\end{minipage}%
\\hspace{0.03\\textwidth}%
\\begin{minipage}{0.75\\textwidth}`;
  } else {
    latex += `\\begin{minipage}{\\textwidth}`
  }

  latex += `
    {\\fontsize{24}{30}\\selectfont\\color{darkblue}\\textbf{${escapeLatex(personalInfo.firstName)} \\uppercase{${escapeLatex(personalInfo.lastName)}}}} \\\\[0.2cm]
    {\\Large\\color{accent} ${escapeLatex(personalInfo.title)}} \\\\[0.3cm]
    
    \\small\\color{graytext}
    \\faMapMarker* \\hspace{0.1cm} ${escapeLatex(personalInfo.location)} \\\\
    \\faEnvelope \\hspace{0.1cm} ${escapeLatex(personalInfo.email)} \\quad
    \\faMedium \\hspace{0.1cm} ${escapeLatex(personalInfo.medium)} \\\\
    \\faLinkedin \\hspace{0.1cm} ${escapeLatex(personalInfo.linkedin)}${personalInfo.github ? ` \\quad
    \\faGithub \\hspace{0.1cm} ${escapeLatex(personalInfo.github)}` : ''}
\\end{minipage}

\\vspace{0.5cm}
\\noindent
\\small\\color{graytext}
${escapeLatexMultiline(personalInfo.summary)}

% SKILLS
\\cvsection{Skills}
\\vspace{0.45cm}
\\begin{tabularx}{\\linewidth}{@{}l X@{}}
`;

  latex += `  \\noalign{\\vspace{0.2cm}}\n`;

  skills.forEach(skill => {
    latex += `\\textbf{${escapeLatex(skill.name)}} & ${escapeLatex(skill.items)} \\\\[0.25cm]\n`;
  });

  latex += `\\end{tabularx}

% EXPERIENCE
\\cvsection{Experience}
\\vspace{-0.2cm}
`;

  experience.forEach((exp, index) => {
    // Utiliser minipage pour éviter de couper une expérience
    const isLast = index === experience.length - 1;
    latex += `
\\noindent
\\begin{minipage}{\\textwidth}
\\begin{tabularx}{\\linewidth}{@{}p{2cm} X@{}}
\\textbf{${escapeLatex(exp.startDate)}} & \\textbf{${escapeLatex(exp.role)}} \\\\
\\emph{${escapeLatex(exp.endDate)}} & \\emph{${escapeLatex(exp.company)} -- ${escapeLatex(exp.location)}} \\\\
& \\begin{itemize}[leftmargin=*, noitemsep, topsep=0pt]
`;
    exp.description.forEach(desc => {
      latex += `    \\item ${escapeLatex(desc)}\n`;
    });
    latex += `\\end{itemize} \\\\
& {\\footnotesize \\color{graytext} Tech: ${escapeLatex(exp.techStack)}}
\\end{tabularx}
\\end{minipage}
${isLast ? '' : '\\vspace{0.3cm}'}
`;
  });

  latex += `

% EDUCATION
\\cvsection{Education}
\\vspace{0.1cm}
\\begin{tabularx}{\\linewidth}{@{}p{3cm} X@{}}
`;

  education.forEach(edu => {
    latex += `
\\textbf{${escapeLatex(edu.startDate)} -- ${escapeLatex(edu.endDate)}} & \\textbf{${escapeLatex(edu.degree)}} \\\\
& ${escapeLatex(edu.school)}, ${escapeLatex(edu.location)} \\\\
& {\\small ${escapeLatex(edu.description)}} \\\\[0.2cm]
`;
  });

  latex += `\\end{tabularx}

\\end{document}
`;

  return latex;
};

// Export pour le serveur: retourne le LaTeX + les données de photo si disponible
export const generateLatexWithPhoto = (data: CVData): { latex: string; photoData: { data: string; extension: string } | null } => {
  const photoData = extractBase64Data(data.personalInfo.photo);
  return {
    latex: generateLatex(data),
    photoData
  };
};
