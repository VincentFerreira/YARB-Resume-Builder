export interface CvFont {
  id: string;
  name: string;
  category: 'sans-serif' | 'serif';
  cssFontFamily: string;
  latexPackage: string;
}

export const CV_FONTS: CvFont[] = [
  {
    id: 'raleway',
    name: 'Raleway',
    category: 'sans-serif',
    cssFontFamily: "'Raleway', sans-serif",
    latexPackage: '\\usepackage[default]{raleway}',
  },
  {
    id: 'helvet',
    name: 'Helvetica',
    category: 'sans-serif',
    cssFontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    latexPackage: '\\usepackage[scaled]{helvet}\n\\renewcommand\\familydefault{\\sfdefault}',
  },
  {
    id: 'avant',
    name: 'Avant Garde',
    category: 'sans-serif',
    cssFontFamily: "'Century Gothic', 'Trebuchet MS', sans-serif",
    latexPackage: '\\usepackage{avant}\n\\renewcommand\\familydefault{\\sfdefault}',
  },
  {
    id: 'charter',
    name: 'Charter',
    category: 'serif',
    cssFontFamily: "Charter, 'Bitstream Charter', 'Libre Baskerville', serif",
    latexPackage: '\\usepackage{charter}',
  },
  {
    id: 'palatino',
    name: 'Palatino',
    category: 'serif',
    cssFontFamily: "'Palatino Linotype', Palatino, 'Book Antiqua', serif",
    latexPackage: '\\usepackage{palatino}',
  },
  {
    id: 'times',
    name: 'Times New Roman',
    category: 'serif',
    cssFontFamily: "'Times New Roman', Times, serif",
    latexPackage: '\\usepackage{times}',
  },
];

export const DEFAULT_FONT_ID = 'raleway';

export const getFontById = (id?: string): CvFont =>
  CV_FONTS.find(f => f.id === id) ?? CV_FONTS[0];
