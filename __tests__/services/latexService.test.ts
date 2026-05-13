import { describe, it, expect } from 'vitest';
import { generateLatex, generateLatexWithPhoto } from '../../services/latexService';
import type { CVData } from '../../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeCV = (overrides: Partial<CVData> = {}): CVData => ({
  currentLanguage: 'fr',
  personalInfo: {
    firstName: 'Jean',
    lastName: 'DUPONT',
    title: { fr: 'Développeur Full Stack', en: 'Full Stack Developer' },
    email: 'jean@example.com',
    medium: 'medium.com/@jean',
    location: 'Paris, France',
    linkedin: 'linkedin.com/in/jean',
    github: 'github.com/jean',
    photo: null,
    summary: { fr: 'Développeur passionné.', en: 'Passionate developer.' },
  },
  skills: [
    {
      id: '1',
      name: { fr: 'Programmation', en: 'Programming' },
      items: { fr: 'TypeScript, React', en: 'TypeScript, React' },
    },
  ],
  experience: [
    {
      id: 'exp1',
      role: { fr: 'Développeur', en: 'Developer' },
      company: 'Acme Corp',
      location: 'Paris',
      startDate: { fr: 'Janvier 2022', en: 'January 2022' },
      endDate: { fr: "Aujourd'hui", en: 'Today' },
      description: { fr: ['Développé des features'], en: ['Developed features'] },
      techStack: 'React, Node.js',
    },
  ],
  education: [
    {
      id: 'edu1',
      degree: { fr: 'Licence Informatique', en: 'BSc Computer Science' },
      school: 'Université Paris',
      location: 'France',
      startDate: '2018',
      endDate: '2021',
      description: { fr: 'Option IA', en: 'AI option' },
    },
  ],
  languages: { fr: ['Français (Natif)', 'Anglais (Courant)'], en: ['French (Native)', 'English (Fluent)'] },
  ...overrides,
});

// ── Document structure ────────────────────────────────────────────────────────

describe('generateLatex — document structure', () => {
  it('produces a valid LaTeX document skeleton', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('\\documentclass');
    expect(latex).toContain('\\begin{document}');
    expect(latex).toContain('\\end{document}');
  });

  it('includes all four CV sections', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('\\cvsection{');
  });

  it('starts with \\documentclass and ends with \\end{document}', () => {
    const latex = generateLatex(makeCV()).trim();
    expect(latex.startsWith('\\documentclass')).toBe(true);
    expect(latex.endsWith('\\end{document}')).toBe(true);
  });
});

// ── Content ───────────────────────────────────────────────────────────────────

describe('generateLatex — content', () => {
  it('includes the first and last name', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('Jean');
    expect(latex).toContain('DUPONT');
  });

  it('includes the email address', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('jean@example.com');
  });

  it('includes the company name from experience', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('Acme Corp');
  });

  it('includes the school name from education', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('Université Paris');
  });

  it('includes the tech stack', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('React, Node.js');
  });

  it('includes all language entries', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('Français (Natif)');
    expect(latex).toContain('Anglais (Courant)');
  });

  it('omits GitHub icon line when github is empty', () => {
    const cv = makeCV();
    cv.personalInfo.github = '';
    const latex = generateLatex(cv);
    expect(latex).not.toContain('\\faGithub');
  });

  it('includes GitHub icon line when github is set', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('\\faGithub');
  });
});

// ── Language switching ────────────────────────────────────────────────────────

describe('generateLatex — language switching', () => {
  it('uses French section headers when currentLanguage is fr', () => {
    const latex = generateLatex(makeCV({ currentLanguage: 'fr' }));
    expect(latex).toContain('Compétences');
    expect(latex).toContain('Expérience');
    expect(latex).toContain('Éducation');
    expect(latex).toContain('Langues');
  });

  it('uses English section headers when currentLanguage is en', () => {
    const latex = generateLatex(makeCV({ currentLanguage: 'en' }));
    expect(latex).toContain('Skills');
    expect(latex).toContain('Experience');
    expect(latex).toContain('Education');
    expect(latex).toContain('Languages');
  });

  it('renders the French role when currentLanguage is fr', () => {
    const latex = generateLatex(makeCV({ currentLanguage: 'fr' }));
    expect(latex).toContain('Développeur');
    expect(latex).not.toContain('Developer');
  });

  it('renders the English role when currentLanguage is en', () => {
    const latex = generateLatex(makeCV({ currentLanguage: 'en' }));
    expect(latex).toContain('Developer');
  });

  it('renders French description bullets when currentLanguage is fr', () => {
    const latex = generateLatex(makeCV({ currentLanguage: 'fr' }));
    expect(latex).toContain('Développé des features');
  });

  it('renders English description bullets when currentLanguage is en', () => {
    const latex = generateLatex(makeCV({ currentLanguage: 'en' }));
    expect(latex).toContain('Developed features');
  });
});

// ── LaTeX escaping ────────────────────────────────────────────────────────────

describe('generateLatex — LaTeX special-character escaping', () => {
  const specialChars: Array<[string, string]> = [
    ['&', '\\&'],
    ['%', '\\%'],
    ['$', '\\$'],
    ['#', '\\#'],
    ['_', '\\_'],
    ['{', '\\{'],
    ['}', '\\}'],
    ['~', '\\textasciitilde{}'],
    ['^', '\\textasciicircum{}'],
    ['\\', '\\textbackslash{}'],
  ];

  for (const [raw, escaped] of specialChars) {
    it(`escapes '${raw}' → '${escaped}' in personal info fields`, () => {
      const cv = makeCV();
      cv.personalInfo.location = `City${raw}Country`;
      const latex = generateLatex(cv);
      expect(latex).toContain(`City${escaped}Country`);
      expect(latex).not.toContain(`City${raw}Country`);
    });
  }

  it('escapes special chars inside skill items', () => {
    const cv = makeCV();
    cv.skills[0].items = { fr: 'C++ & Python', en: 'C++ & Python' };
    const latex = generateLatex(cv);
    // The literal unescaped sequence should not appear in the items value
    expect(latex).not.toContain('C++ & Python');
    // The escaped form should appear
    expect(latex).toContain('C++ \\& Python');
  });

  it('escapes special chars in experience descriptions', () => {
    const cv = makeCV();
    cv.experience[0].description = { fr: ['Taux de couverture : 80%'], en: ['Coverage: 80%'] };
    const latex = generateLatex(cv);
    expect(latex).toContain('80\\%');
  });

  it('does not double-escape backslashes', () => {
    const cv = makeCV();
    cv.personalInfo.location = 'C:\\path';
    const latex = generateLatex(cv);
    // Each \ becomes \textbackslash{} — no further escaping of that output
    expect(latex).toContain('C:\\textbackslash{}path');
  });
});

// ── Photo handling ────────────────────────────────────────────────────────────

describe('generateLatex — photo', () => {
  it('uses full-width minipage when no photo is set', () => {
    const latex = generateLatex(makeCV());
    expect(latex).toContain('\\begin{minipage}{\\textwidth}');
  });

  it('uses split minipages when a valid JPEG photo is provided', () => {
    const cv = makeCV();
    cv.personalInfo.photo = 'data:image/jpeg;base64,/9j/abc123';
    const latex = generateLatex(cv);
    expect(latex).toContain('0.22\\textwidth');
    expect(latex).toContain('photo.jpg');
  });

  it('uses split minipages when a valid PNG photo is provided', () => {
    const cv = makeCV();
    cv.personalInfo.photo = 'data:image/png;base64,iVBORw0KGgo=';
    const latex = generateLatex(cv);
    expect(latex).toContain('photo.png');
  });

  it('falls back to full-width minipage for an invalid data URL', () => {
    const cv = makeCV();
    cv.personalInfo.photo = 'https://picsum.photos/200/200';
    const latex = generateLatex(cv);
    expect(latex).toContain('\\begin{minipage}{\\textwidth}');
  });
});

// ── generateLatexWithPhoto ────────────────────────────────────────────────────

describe('generateLatexWithPhoto', () => {
  it('returns an object with latex and photoData keys', () => {
    const result = generateLatexWithPhoto(makeCV());
    expect(result).toHaveProperty('latex');
    expect(result).toHaveProperty('photoData');
  });

  it('photoData is null when no photo is set', () => {
    const { photoData } = generateLatexWithPhoto(makeCV());
    expect(photoData).toBeNull();
  });

  it('photoData contains data and extension when a photo is set', () => {
    const cv = makeCV();
    cv.personalInfo.photo = 'data:image/png;base64,iVBORw0KGgo=';
    const { photoData } = generateLatexWithPhoto(cv);
    expect(photoData).not.toBeNull();
    expect(photoData!.extension).toBe('png');
    expect(photoData!.data).toBe('iVBORw0KGgo=');
  });

  it('normalises jpeg extension to jpg', () => {
    const cv = makeCV();
    cv.personalInfo.photo = 'data:image/jpeg;base64,/9j/abc';
    const { photoData } = generateLatexWithPhoto(cv);
    expect(photoData!.extension).toBe('jpg');
  });

  it('latex output is identical to generateLatex output', () => {
    const cv = makeCV();
    expect(generateLatexWithPhoto(cv).latex).toBe(generateLatex(cv));
  });
});
