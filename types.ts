export type Language = 'fr' | 'en';

export interface MultiLangString {
  fr: string;
  en: string;
}

export interface MultiLangStringArray {
  fr: string[];
  en: string[];
}

export interface CVData {
  currentLanguage: Language;
  personalInfo: {
    firstName: string;
    lastName: string;
    title: MultiLangString;
    email: string;
    medium: string;
    location: string;
    linkedin: string;
    github: string;
    photo: string | null; // Base64 data URL for preview
    summary: MultiLangString;
  };
  skills: SkillCategory[];
  experience: ExperienceItem[];
  education: EducationItem[];
  languages: MultiLangStringArray;
}

export interface SkillCategory {
  id: string;
  name: MultiLangString;
  items: MultiLangString; // Comma separated string for easier editing
}

export interface ExperienceItem {
  id: string;
  role: MultiLangString;
  company: string;
  location: string;
  startDate: MultiLangString;
  endDate: MultiLangString;
  description: MultiLangStringArray; // Bullet points
  techStack: string; // Comma separated tags
}

export interface EducationItem {
  id: string;
  school: string;
  degree: MultiLangString;
  location: string;
  startDate: string;
  endDate: string;
  description: MultiLangString;
}

export interface ATSKeyword {
  keyword: string;
  status: 'present' | 'missing' | 'partial';
  frequency: number;
  importance: 'critical' | 'important';
  analysis: string; // short contextual note, e.g. "Present in tools but overshadowed by TypeScript"
}

export interface ATSFormattingCheck {
  label: string;
  status: 'pass' | 'fail' | 'warning';
  detail?: string;
}

export interface ATSRecommendation {
  section: string;
  issue: string;
  before?: string;
  after?: string;
}

export interface ATSAnalysisResult {
  overallScore: number;
  estimatedNewScore: number;
  criticalKeywords: ATSKeyword[];
  importantKeywords: ATSKeyword[];
  formattingChecks: ATSFormattingCheck[];
  recommendations: ATSRecommendation[];
  summary: string;
}

