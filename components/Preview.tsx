import React from 'react';
import { CVData } from '../types';
import { getLangText, getLangArray, UI_TRANSLATIONS, LANGUAGES } from '../lib/i18n';
import { MapPin, Mail, PenLine, Linkedin, Github } from 'lucide-react';

interface PreviewProps {
  data: CVData;
}

const Preview: React.FC<PreviewProps> = ({ data }) => {
  const { personalInfo, skills, experience, education, languages, currentLanguage: lang } = data;
  const h = UI_TRANSLATIONS[lang] ?? UI_TRANSLATIONS['fr'];
  const locale = LANGUAGES.find(l => l.code === lang)?.locale ?? 'fr-FR';

  return (
    <div className="bg-white shadow-2xl w-full max-w-[21cm] min-h-[29.7cm] p-8 md:p-10 mx-auto text-slate-800 font-sans leading-relaxed origin-top scale-[0.6] sm:scale-[0.7] md:scale-[0.8] lg:scale-100 transition-transform duration-300">

      {/* HEADER: Photo Left (Requested), Info Right */}
      <div className="flex flex-row gap-6 mb-8 items-center border-b pb-6 border-slate-200">

        {/* Photo Section (Left) */}
        <div className="w-1/4 flex justify-center flex-shrink-0">
          <div className="w-32 h-32 md:w-40 md:h-40 relative rounded-full overflow-hidden border-4 border-slate-100 shadow-md">
            {personalInfo.photo ? (
              <img
                src={personalInfo.photo}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                {h.noPhoto}
              </div>
            )}
          </div>
        </div>

        {/* Text Section (Right) */}
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-slate-800 uppercase tracking-tight">
            {personalInfo.firstName} <span className="text-slate-900">{personalInfo.lastName}</span>
          </h1>
          <h2 className="text-xl text-indigo-600 font-medium mt-1 mb-3">
            {getLangText(personalInfo.title, lang)}
          </h2>

          <div className="text-sm text-slate-600 space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" /> <span>{personalInfo.location}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" /> <span>{personalInfo.email}</span>
              </div>
              {personalInfo.medium && (
                <div className="flex items-center gap-2">
                  <PenLine className="w-4 h-4" /> <span>{personalInfo.medium.replace(/https?:\/\//, '')}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {personalInfo.linkedin && (
                <div className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4" /> <span>{personalInfo.linkedin.replace(/https?:\/\//, '')}</span>
                </div>
              )}
              {personalInfo.github && (
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4" /> <span>{personalInfo.github.replace(/https?:\/\//, '')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="mb-8 text-sm text-slate-600 text-justify whitespace-pre-line">
        {getLangText(personalInfo.summary, lang)}
      </div>

      {/* SKILLS */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-indigo-800 border-b-2 border-indigo-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">≡</span> {h.previewSkills}
        </h3>
        <div className="space-y-2">
          {skills.map((skill) => (
            <div key={skill.id} className="flex flex-col sm:flex-row text-sm">
              <div className="w-full sm:w-40 font-bold text-slate-800 text-right pr-4 mb-1 sm:mb-0">
                {getLangText(skill.name, lang)}
              </div>
              <div className="flex-1 text-slate-600">
                {getLangText(skill.items, lang)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EXPERIENCE */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-indigo-800 border-b-2 border-indigo-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">💼</span> {h.previewExperience}
        </h3>
        <div className="space-y-6">
          {experience.map((exp) => (
            <div key={exp.id} className="flex flex-col sm:flex-row">
              <div className="w-full sm:w-40 flex flex-col items-end pr-4 mb-2 sm:mb-0">
                <span className="font-bold text-slate-800 text-sm">{getLangText(exp.startDate, lang)}</span>
                <span className="text-xs text-slate-500">{getLangText(exp.endDate, lang)}</span>
              </div>
              <div className="flex-1 border-l-2 border-slate-200 pl-4 pb-2">
                <div className="font-bold text-base text-slate-800">
                  {getLangText(exp.role, lang)} | <span className="text-slate-600 font-medium">{exp.company}, {exp.location}</span>
                </div>
                <ul className="list-disc list-outside ml-4 mt-2 text-sm text-slate-600 space-y-1">
                  {getLangArray(exp.description, lang).map((desc, idx) => (
                    <li key={idx}>{desc}</li>
                  ))}
                </ul>
                {exp.techStack && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="text-xs text-slate-400 self-center mr-1">{h.previewTech}</span>
                    {exp.techStack.split(',').map((tech, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-slate-600 text-xs rounded-full">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EDUCATION */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-indigo-800 border-b-2 border-indigo-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">🎓</span> {h.previewEducation}
        </h3>
        <div className="space-y-4">
          {education.map((edu) => (
            <div key={edu.id} className="flex flex-col sm:flex-row">
              <div className="w-full sm:w-40 flex flex-col items-end pr-4 mb-2 sm:mb-0">
                <span className="font-bold text-slate-800 text-sm">{edu.startDate}</span>
                <span className="text-xs text-slate-500">{edu.endDate}</span>
              </div>
              <div className="flex-1 border-l-2 border-slate-200 pl-4">
                <div className="font-bold text-base text-slate-800">
                  {getLangText(edu.degree, lang)}
                </div>
                <div className="text-sm text-slate-600 italic mb-1">
                  {edu.school}, {edu.location}
                </div>
                <div className="text-sm text-slate-500">
                  {getLangText(edu.description, lang)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LANGUAGES */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-indigo-800 border-b-2 border-indigo-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">🌐</span> {h.previewLanguages}
        </h3>
        <ul className="list-disc list-outside ml-4 mt-2 text-sm text-slate-600 space-y-1">
          {getLangArray(languages, lang).map((l, idx) => (
            <li key={idx}>{l}</li>
          ))}
        </ul>
      </div>

      {/* FOOTER */}
      <div className="mt-auto pt-8 flex justify-between text-xs text-slate-400 border-t border-slate-100">
        <span>{new Date().toLocaleDateString(locale)}</span>
        <span>{personalInfo.firstName} {personalInfo.lastName} - CV</span>
        <span>1/1</span>
      </div>

    </div>
  );
};

export default Preview;

