export interface CVData {
  personalInfo: {
    firstName: string;
    lastName: string;
    title: string;
    email: string;
    medium: string;
    location: string;
    linkedin: string;
    github: string;
    photo: string | null; // Base64 data URL for preview
    summary: string;
  };
  skills: SkillCategory[];
  experience: ExperienceItem[];
  education: EducationItem[];
  languages: string[];
}

export interface SkillCategory {
  id: string;
  name: string;
  items: string; // Comma separated string for easier editing
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string[]; // Bullet points
  techStack: string; // Comma separated tags
}

export interface EducationItem {
  id: string;
  school: string;
  degree: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}
