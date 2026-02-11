import React, { ChangeEvent, useState } from 'react';
import { CVData, ExperienceItem, SkillCategory, EducationItem } from '../types';
import { Plus, Trash2, ChevronDown, ChevronUp, Upload } from 'lucide-react';

interface EditorProps {
  data: CVData;
  onChange: (newData: CVData) => void;
}

const Editor: React.FC<EditorProps> = ({ data, onChange }) => {
  const [activeSection, setActiveSection] = useState<string | null>('personal');

  const updatePersonal = (field: keyof CVData['personalInfo'], value: string) => {
    onChange({
      ...data,
      personalInfo: { ...data.personalInfo, [field]: value }
    });
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updatePersonal('photo', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateSkill = (index: number, field: keyof SkillCategory, value: string) => {
    const newSkills = [...data.skills];
    newSkills[index] = { ...newSkills[index], [field]: value };
    onChange({ ...data, skills: newSkills });
  };

  const addSkill = () => {
    onChange({
      ...data,
      skills: [...data.skills, { id: Date.now().toString(), name: 'New Category', items: '' }]
    });
  };

  const removeSkill = (index: number) => {
    const newSkills = data.skills.filter((_, i) => i !== index);
    onChange({ ...data, skills: newSkills });
  };

  const updateExperience = (index: number, field: keyof ExperienceItem, value: any) => {
    const newExp = [...data.experience];
    newExp[index] = { ...newExp[index], [field]: value };
    onChange({ ...data, experience: newExp });
  };

  const updateExperienceDesc = (expIndex: number, descIndex: number, value: string) => {
    const newExp = [...data.experience];
    const newDesc = [...newExp[expIndex].description];
    newDesc[descIndex] = value;
    newExp[expIndex].description = newDesc;
    onChange({ ...data, experience: newExp });
  };

  const addExperienceDesc = (expIndex: number) => {
    const newExp = [...data.experience];
    newExp[expIndex].description.push("Nouvelle tâche...");
    onChange({ ...data, experience: newExp });
  };

  const removeExperienceDesc = (expIndex: number, descIndex: number) => {
    const newExp = [...data.experience];
    newExp[expIndex].description = newExp[expIndex].description.filter((_, i) => i !== descIndex);
    onChange({ ...data, experience: newExp });
  };

  const addExperience = () => {
    onChange({
      ...data,
      experience: [{
        id: Date.now().toString(),
        role: 'Nouveau Poste',
        company: 'Entreprise',
        location: 'Lieu',
        startDate: 'Début',
        endDate: 'Fin',
        description: ['Description de la mission'],
        techStack: ''
      }, ...data.experience]
    });
  };

  const removeExperience = (index: number) => {
    const newExp = data.experience.filter((_, i) => i !== index);
    onChange({ ...data, experience: newExp });
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
      <div className="p-4 bg-indigo-600 text-white font-bold text-lg">
        Éditeur de CV
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Personal Info */}
        <SectionHeader title="Informations Personnelles" id="personal" />
        {activeSection === 'personal' && (
          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text" placeholder="Prénom" className="border p-2 rounded"
                value={data.personalInfo.firstName} onChange={(e) => updatePersonal('firstName', e.target.value)}
              />
              <input
                type="text" placeholder="Nom" className="border p-2 rounded"
                value={data.personalInfo.lastName} onChange={(e) => updatePersonal('lastName', e.target.value)}
              />
            </div>
            <input
              type="text" placeholder="Titre du poste" className="w-full border p-2 rounded"
              value={data.personalInfo.title} onChange={(e) => updatePersonal('title', e.target.value)}
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded border border-slate-300 transition-colors">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Changer la photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
              {data.personalInfo.photo && <span className="text-xs text-green-600">Photo chargée</span>}
            </div>
            <textarea
              placeholder="Résumé professionnel" className="w-full border p-2 rounded h-24"
              value={data.personalInfo.summary} onChange={(e) => updatePersonal('summary', e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="email" placeholder="Email" className="border p-2 rounded" value={data.personalInfo.email} onChange={(e) => updatePersonal('email', e.target.value)} />
              <input type="url" placeholder="Medium URL" className="border p-2 rounded" value={data.personalInfo.medium} onChange={(e) => updatePersonal('medium', e.target.value)} />
              <input type="text" placeholder="Adresse" className="border p-2 rounded" value={data.personalInfo.location} onChange={(e) => updatePersonal('location', e.target.value)} />
              <input type="text" placeholder="LinkedIn URL" className="border p-2 rounded" value={data.personalInfo.linkedin} onChange={(e) => updatePersonal('linkedin', e.target.value)} />
              <input type="text" placeholder="GitHub URL" className="border p-2 rounded" value={data.personalInfo.github} onChange={(e) => updatePersonal('github', e.target.value)} />
            </div>
          </div>
        )}

        {/* Skills */}
        <SectionHeader title="Compétences" id="skills" />
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
                  value={skill.name} onChange={(e) => updateSkill(index, 'name', e.target.value)}
                  placeholder="Catégorie (ex: Frameworks)"
                />
                <textarea
                  className="w-full border p-2 rounded text-sm"
                  value={skill.items} onChange={(e) => updateSkill(index, 'items', e.target.value)}
                  placeholder="Liste des compétences séparées par des virgules"
                />
              </div>
            ))}
            <button onClick={addSkill} className="w-full py-2 flex justify-center items-center gap-2 border-2 border-dashed border-slate-300 rounded text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors">
              <Plus className="w-4 h-4" /> Ajouter une catégorie
            </button>
          </div>
        )}

        {/* Experience */}
        <SectionHeader title="Expérience Professionnelle" id="experience" />
        {activeSection === 'experience' && (
          <div className="p-4 space-y-6">
            <button onClick={addExperience} className="w-full py-2 bg-indigo-50 text-indigo-700 rounded font-medium hover:bg-indigo-100 transition-colors mb-4">
              + Ajouter une expérience
            </button>
            {data.experience.map((exp, index) => (
              <div key={exp.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="font-bold text-slate-700">Expérience #{index + 1}</h4>
                  <button onClick={() => removeExperience(index)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input className="border p-2 rounded text-sm" placeholder="Rôle" value={exp.role} onChange={(e) => updateExperience(index, 'role', e.target.value)} />
                  <input className="border p-2 rounded text-sm" placeholder="Entreprise" value={exp.company} onChange={(e) => updateExperience(index, 'company', e.target.value)} />
                  <input className="border p-2 rounded text-sm" placeholder="Date début" value={exp.startDate} onChange={(e) => updateExperience(index, 'startDate', e.target.value)} />
                  <input className="border p-2 rounded text-sm" placeholder="Date fin" value={exp.endDate} onChange={(e) => updateExperience(index, 'endDate', e.target.value)} />
                  <input className="border p-2 rounded text-sm col-span-2" placeholder="Lieu" value={exp.location} onChange={(e) => updateExperience(index, 'location', e.target.value)} />
                </div>

                <div className="space-y-2 mb-3">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Responsabilités (Bullet points)</label>
                  {exp.description.map((desc, dIndex) => (
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
                  <button onClick={() => addExperienceDesc(index)} className="text-xs text-indigo-600 hover:underline">+ Ajouter une ligne</button>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Tech Stack (séparé par virgules)</label>
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

      </div>
    </div>
  );
};

export default Editor;
