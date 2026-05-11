import React, { ChangeEvent, useState } from 'react';
import { CVData, ExperienceItem, SkillCategory, EducationItem, Language } from '../types';
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, Languages } from 'lucide-react';

interface EditorProps {
  data: CVData;
  onChange: (newData: CVData) => void;
}

const Editor: React.FC<EditorProps> = ({ data, onChange }) => {
  const [activeSection, setActiveSection] = useState<string | null>('personal');
  const lang = data.currentLanguage;

  const setLanguage = (newLang: Language) => {
    onChange({ ...data, currentLanguage: newLang });
  };

  const updatePersonal = (field: keyof CVData['personalInfo'], value: string) => {
    const personalInfo = { ...data.personalInfo };
    if (field === 'title' || field === 'summary') {
      personalInfo[field] = { ...personalInfo[field], [lang]: value };
    } else {
      (personalInfo as any)[field] = value;
    }
    onChange({ ...data, personalInfo });
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange({
          ...data,
          personalInfo: { ...data.personalInfo, photo: reader.result as string }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSkill = (index: number, field: keyof SkillCategory, value: string) => {
    const newSkills = [...data.skills];
    if (field === 'name' || field === 'items') {
      newSkills[index] = {
        ...newSkills[index],
        [field]: { ...newSkills[index][field], [lang]: value }
      };
    }
    onChange({ ...data, skills: newSkills });
  };

  const addSkill = () => {
    onChange({
      ...data,
      skills: [
        ...data.skills,
        {
          id: Date.now().toString(),
          name: { fr: 'Nouvelle Catégorie', en: 'New Category' },
          items: { fr: '', en: '' }
        }
      ]
    });
  };

  const removeSkill = (index: number) => {
    const newSkills = data.skills.filter((_, i) => i !== index);
    onChange({ ...data, skills: newSkills });
  };

  const updateExperience = (index: number, field: keyof ExperienceItem, value: any) => {
    const newExp = [...data.experience];
    if (field === 'role' || field === 'startDate' || field === 'endDate') {
      newExp[index] = {
        ...newExp[index],
        [field]: { ...newExp[index][field], [lang]: value }
      };
    } else {
      (newExp[index] as any)[field] = value;
    }
    onChange({ ...data, experience: newExp });
  };

  const updateExperienceDesc = (expIndex: number, descIndex: number, value: string) => {
    const newExp = [...data.experience];
    const currentDescs = [...newExp[expIndex].description[lang]];
    currentDescs[descIndex] = value;
    newExp[expIndex].description = {
      ...newExp[expIndex].description,
      [lang]: currentDescs
    };
    onChange({ ...data, experience: newExp });
  };

  const addExperienceDesc = (expIndex: number) => {
    const newExp = [...data.experience];
    const currentDescs = [...newExp[expIndex].description[lang]];
    currentDescs.push(lang === 'fr' ? "Nouvelle tâche..." : "New task...");
    newExp[expIndex].description = {
      ...newExp[expIndex].description,
      [lang]: currentDescs
    };
    onChange({ ...data, experience: newExp });
  };

  const removeExperienceDesc = (expIndex: number, descIndex: number) => {
    const newExp = [...data.experience];
    newExp[expIndex].description = {
      ...newExp[expIndex].description,
      [lang]: newExp[expIndex].description[lang].filter((_, i) => i !== descIndex)
    };
    onChange({ ...data, experience: newExp });
  };

  const addExperience = () => {
    onChange({
      ...data,
      experience: [{
        id: Date.now().toString(),
        role: { fr: 'Nouveau Poste', en: 'New Role' },
        company: 'Entreprise',
        location: 'Lieu',
        startDate: { fr: 'Début', en: 'Start' },
        endDate: { fr: 'Fin', en: 'End' },
        description: { fr: ['Description de la mission'], en: ['Task description'] },
        techStack: ''
      }, ...data.experience]
    });
  };

  const removeExperience = (index: number) => {
    const newExp = data.experience.filter((_, i) => i !== index);
    onChange({ ...data, experience: newExp });
  };

  const updateEducation = (index: number, field: keyof EducationItem, value: string) => {
    const newEdu = [...data.education];
    if (field === 'degree' || field === 'description') {
      newEdu[index] = {
        ...newEdu[index],
        [field]: { ...newEdu[index][field], [lang]: value }
      };
    } else {
      (newEdu[index] as any)[field] = value;
    }
    onChange({ ...data, education: newEdu });
  };

  const addEducation = () => {
    onChange({
      ...data,
      education: [...data.education, {
        id: Date.now().toString(),
        school: 'Université',
        degree: { fr: 'Diplôme', en: 'Degree' },
        location: 'Ville',
        startDate: '2020',
        endDate: '2022',
        description: { fr: 'Description', en: 'Description' }
      }]
    });
  };

  const removeEducation = (index: number) => {
    const newEdu = data.education.filter((_, i) => i !== index);
    onChange({ ...data, education: newEdu });
  };

  const updateLanguageItem = (index: number, value: string) => {
    const newLangs = [...data.languages[lang]];
    newLangs[index] = value;
    onChange({
      ...data,
      languages: { ...data.languages, [lang]: newLangs }
    });
  };

  const addLanguageItem = () => {
    const newLangs = [...data.languages[lang]];
    newLangs.push(lang === 'fr' ? "Nouvelle langue" : "New language");
    onChange({
      ...data,
      languages: { ...data.languages, [lang]: newLangs }
    });
  };

  const removeLanguageItem = (index: number) => {
    onChange({
      ...data,
      languages: {
        ...data.languages,
        [lang]: data.languages[lang].filter((_, i) => i !== index)
      }
    });
  };

  const SectionHeader = ({ title, id }: { title: string, id: string }) => (
    <button
      onClick={() => setActiveSection(activeSection === id ? null : id)}
      className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 border-b border-slate-200 transition-colors"
    >
      <span className="font-semibold text-slate-700">{title}</span>
      {activeSection === id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden h-full flex flex-col">

      <div className="flex-1 overflow-y-auto">
        {/* Personal Info */}
        <SectionHeader title={lang === 'fr' ? "Informations Personnelles" : "Personal Information"} id="personal" />
        {activeSection === 'personal' && (
          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text" placeholder={lang === 'fr' ? "Prénom" : "First Name"} className="border p-2 rounded"
                value={data.personalInfo.firstName} onChange={(e) => updatePersonal('firstName', e.target.value)}
              />
              <input
                type="text" placeholder={lang === 'fr' ? "Nom" : "Last Name"} className="border p-2 rounded"
                value={data.personalInfo.lastName} onChange={(e) => updatePersonal('lastName', e.target.value)}
              />
            </div>
            <input
              type="text" placeholder={lang === 'fr' ? "Titre du poste" : "Job Title"} className="w-full border p-2 rounded"
              value={data.personalInfo.title[lang]} onChange={(e) => updatePersonal('title', e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded border border-slate-300 transition-colors">
                <Upload className="w-4 h-4" />
                <span className="text-sm">{lang === 'fr' ? "Changer la photo" : "Change Photo"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
              {data.personalInfo.photo && <span className="text-xs text-green-600">{lang === 'fr' ? "Photo chargée" : "Photo loaded"}</span>}
            </div>
            <textarea
              placeholder={lang === 'fr' ? "Résumé professionnel" : "Professional Summary"} className="w-full border p-2 rounded h-24"
              value={data.personalInfo.summary[lang]} onChange={(e) => updatePersonal('summary', e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="email" placeholder="Email" className="border p-2 rounded" value={data.personalInfo.email} onChange={(e) => updatePersonal('email', e.target.value)} />
              <input type="url" placeholder="Medium URL" className="border p-2 rounded" value={data.personalInfo.medium} onChange={(e) => updatePersonal('medium', e.target.value)} />
              <input type="text" placeholder={lang === 'fr' ? "Adresse" : "Location"} className="border p-2 rounded" value={data.personalInfo.location} onChange={(e) => updatePersonal('location', e.target.value)} />
              <input type="text" placeholder="LinkedIn URL" className="border p-2 rounded" value={data.personalInfo.linkedin} onChange={(e) => updatePersonal('linkedin', e.target.value)} />
              <input type="text" placeholder="GitHub URL" className="border p-2 rounded" value={data.personalInfo.github} onChange={(e) => updatePersonal('github', e.target.value)} />
            </div>
          </div>
        )}

        {/* Skills */}
        <SectionHeader title={lang === 'fr' ? "Compétences" : "Skills"} id="skills" />
        {activeSection === 'skills' && (
          <div className="p-4 space-y-4">
            {data.skills.map((skill, index) => (
              <div key={skill.id} className="border p-3 rounded bg-slate-50 relative group">
                <button
                  onClick={() => removeSkill(index)}
                  className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <input
                  className="font-bold bg-transparent border-b border-slate-300 w-full mb-2 focus:outline-none focus:border-indigo-500"
                  value={skill.name[lang]} onChange={(e) => updateSkill(index, 'name', e.target.value)}
                  placeholder={lang === 'fr' ? "Catégorie (ex: Frameworks)" : "Category (e.g. Frameworks)"}
                />
                <textarea
                  className="w-full border p-2 rounded text-sm"
                  value={skill.items[lang]} onChange={(e) => updateSkill(index, 'items', e.target.value)}
                  placeholder={lang === 'fr' ? "Liste des compétences séparées par des virgules" : "List of skills separated by commas"}
                />
              </div>
            ))}
            <button onClick={addSkill} className="w-full py-2 flex justify-center items-center gap-2 border-2 border-dashed border-slate-300 rounded text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors">
              <Plus className="w-4 h-4" /> {lang === 'fr' ? "Ajouter une catégorie" : "Add category"}
            </button>
          </div>
        )}

        {/* Experience */}
        <SectionHeader title={lang === 'fr' ? "Expérience Professionnelle" : "Professional Experience"} id="experience" />
        {activeSection === 'experience' && (
          <div className="p-4 space-y-6">
            <button onClick={addExperience} className="w-full py-2 bg-indigo-50 text-indigo-700 rounded font-medium hover:bg-indigo-100 transition-colors mb-4">
              + {lang === 'fr' ? "Ajouter une expérience" : "Add experience"}
            </button>
            {data.experience.map((exp, index) => (
              <div key={exp.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-slate-700">{lang === 'fr' ? "Expérience" : "Experience"} #{index + 1}</h4>
                  <button onClick={() => removeExperience(index)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "Rôle" : "Role"} value={exp.role[lang]} onChange={(e) => updateExperience(index, 'role', e.target.value)} />
                  <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "Entreprise" : "Company"} value={exp.company} onChange={(e) => updateExperience(index, 'company', e.target.value)} />
                  <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "Date début" : "Start Date"} value={exp.startDate[lang]} onChange={(e) => updateExperience(index, 'startDate', e.target.value)} />
                  <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "Date fin" : "End Date"} value={exp.endDate[lang]} onChange={(e) => updateExperience(index, 'endDate', e.target.value)} />
                  <input className="border p-2 rounded text-sm col-span-2" placeholder={lang === 'fr' ? "Lieu" : "Location"} value={exp.location} onChange={(e) => updateExperience(index, 'location', e.target.value)} />
                </div>

                <div className="space-y-2 mb-3">
                  <label className="text-xs font-semibold text-slate-500 uppercase">{lang === 'fr' ? "Responsabilités" : "Responsibilities"} (Bullet points)</label>
                  {exp.description[lang].map((desc, dIndex) => (
                    <div key={dIndex} className="flex gap-2">
                      <input
                        className="flex-1 border p-1 rounded text-sm"
                        value={desc}
                        onChange={(e) => updateExperienceDesc(index, dIndex, e.target.value)}
                      />
                      <button onClick={() => removeExperienceDesc(index, dIndex)} className="text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addExperienceDesc(index)} className="text-xs text-indigo-600 hover:underline">+ {lang === 'fr' ? "Ajouter une ligne" : "Add line"}</button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Tech Stack ({lang === 'fr' ? "séparé par virgules" : "comma separated"})</label>
                  <input
                    className="w-full border p-2 rounded text-sm"
                    value={exp.techStack}
                    onChange={(e) => updateExperience(index, 'techStack', e.target.value)}
                    placeholder="Java, React, SQL..."
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Education */}
        <SectionHeader title={lang === 'fr' ? "Éducation" : "Education"} id="education" />
        {activeSection === 'education' && (
          <div className="p-4 space-y-6">
            <button onClick={addEducation} className="w-full py-2 bg-indigo-50 text-indigo-700 rounded font-medium hover:bg-indigo-100 transition-colors mb-4">
              + {lang === 'fr' ? "Ajouter une formation" : "Add education"}
            </button>
            {data.education.map((edu, index) => (
              <div key={edu.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-slate-700">{lang === 'fr' ? "Formation" : "Education"} #{index + 1}</h4>
                  <button onClick={() => removeEducation(index)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "Diplôme" : "Degree"} value={edu.degree[lang]} onChange={(e) => updateEducation(index, 'degree', e.target.value)} />
                  <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "École" : "School"} value={edu.school} onChange={(e) => updateEducation(index, 'school', e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "Début" : "Start"} value={edu.startDate} onChange={(e) => updateEducation(index, 'startDate', e.target.value)} />
                    <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "Fin" : "End"} value={edu.endDate} onChange={(e) => updateEducation(index, 'endDate', e.target.value)} />
                  </div>
                  <input className="border p-2 rounded text-sm" placeholder={lang === 'fr' ? "Lieu" : "Location"} value={edu.location} onChange={(e) => updateEducation(index, 'location', e.target.value)} />
                  <textarea className="w-full border p-2 rounded text-sm" placeholder="Description" value={edu.description[lang]} onChange={(e) => updateEducation(index, 'description', e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Languages */}
        <SectionHeader title={lang === 'fr' ? "Langues" : "Languages"} id="languages" />
        {activeSection === 'languages' && (
          <div className="p-4 space-y-4">
            {data.languages[lang].map((l, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className="flex-1 border p-2 rounded text-sm"
                  value={l}
                  onChange={(e) => updateLanguageItem(index, e.target.value)}
                  placeholder={lang === 'fr' ? "Langue (ex: Anglais - Courant)" : "Language (e.g. English - Fluent)"}
                />
                <button onClick={() => removeLanguageItem(index)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button onClick={addLanguageItem} className="w-full py-2 flex justify-center items-center gap-2 border-2 border-dashed border-slate-300 rounded text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors">
              <Plus className="w-4 h-4" /> {lang === 'fr' ? "Ajouter une langue" : "Add language"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Editor;

