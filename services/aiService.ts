import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { CVData } from "../types";

// Types pour le provider IA
export type AIProvider = 'gemini' | 'claude';

// Prompt partagé pour l'extraction de CV
const RESUME_PARSER_PROMPT = `You are an expert resume parser. Your task is to extract information from the provided PDF resume and structure it into a specific JSON format.
          
Guidelines:
1. **Personal Info**: Extract details. Leave 'photo' null.
2. **Skills**: Group skills by category if possible (e.g., Languages, Tools). Join items with commas.
3. **Experience**: Extract role, company, dates, location. Convert bullet points into an array of strings. Extract tech stack if mentioned.
4. **Education**: Extract degree, school, dates, location.
5. **Languages**: List languages with proficiency if available.

Return a JSON object with the following structure:
{
  "personalInfo": {
    "firstName": string,
    "lastName": string,
    "title": string,
    "email": string,
    "medium": string,
    "location": string,
    "linkedin": string,
    "github": string,
    "summary": string
  },
  "skills": [{ "name": string, "items": string }],
  "experience": [{
    "role": string,
    "company": string,
    "location": string,
    "startDate": string,
    "endDate": string,
    "description": [string],
    "techStack": string
  }],
  "education": [{
    "school": string,
    "degree": string,
    "location": string,
    "startDate": string,
    "endDate": string,
    "description": string
  }],
  "languages": [string]
}

Ensure the output is valid JSON only, without any markdown formatting or code blocks.`;

// Instance Gemini
const geminiAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Instance Claude
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true // Nécessaire pour utiliser dans le navigateur
});

// Parse avec Gemini
const parseWithGemini = async (pdfBase64: string): Promise<any> => {
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

    const response = await geminiAi.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: "application/pdf",
                        data: cleanBase64
                    }
                },
                {
                    text: RESUME_PARSER_PROMPT
                }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    personalInfo: {
                        type: Type.OBJECT,
                        properties: {
                            firstName: { type: Type.STRING },
                            lastName: { type: Type.STRING },
                            title: { type: Type.STRING },
                            email: { type: Type.STRING },
                            medium: { type: Type.STRING },
                            location: { type: Type.STRING },
                            linkedin: { type: Type.STRING },
                            github: { type: Type.STRING },
                            summary: { type: Type.STRING },
                        }
                    },
                    skills: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                items: { type: Type.STRING }
                            }
                        }
                    },
                    experience: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                role: { type: Type.STRING },
                                company: { type: Type.STRING },
                                location: { type: Type.STRING },
                                startDate: { type: Type.STRING },
                                endDate: { type: Type.STRING },
                                description: { type: Type.ARRAY, items: { type: Type.STRING } },
                                techStack: { type: Type.STRING }
                            }
                        }
                    },
                    education: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                school: { type: Type.STRING },
                                degree: { type: Type.STRING },
                                location: { type: Type.STRING },
                                startDate: { type: Type.STRING },
                                endDate: { type: Type.STRING },
                                description: { type: Type.STRING }
                            }
                        }
                    },
                    languages: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
        }
    });

    return JSON.parse(response.text);
};

// Parse avec Claude
const parseWithClaude = async (pdfBase64: string): Promise<any> => {
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");

    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "document",
                        source: {
                            type: "base64",
                            media_type: "application/pdf",
                            data: cleanBase64
                        }
                    },
                    {
                        type: "text",
                        text: RESUME_PARSER_PROMPT
                    }
                ]
            }
        ]
    });

    // Extraire le texte de la réponse
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
    }

    // Nettoyer le JSON (enlever les backticks markdown si présents)
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(jsonText);
};

// Fonction principale avec sélection du provider
export const parseResumeFromPdf = async (
    pdfBase64: string,
    provider: AIProvider = 'gemini'
): Promise<CVData> => {

    const extracted = provider === 'claude'
        ? await parseWithClaude(pdfBase64)
        : await parseWithGemini(pdfBase64);

    // Post-process to add IDs and ensure structure matches CVData interface
    return {
        personalInfo: {
            firstName: extracted.personalInfo?.firstName || "",
            lastName: extracted.personalInfo?.lastName || "",
            title: extracted.personalInfo?.title || "",
            email: extracted.personalInfo?.email || "",
            medium: extracted.personalInfo?.medium || "",
            location: extracted.personalInfo?.location || "",
            linkedin: extracted.personalInfo?.linkedin || "",
            github: extracted.personalInfo?.github || "",
            summary: extracted.personalInfo?.summary || "",
            photo: null
        },
        skills: (extracted.skills || []).map((s: any) => ({
            id: crypto.randomUUID(),
            name: s.name || "Compétences",
            items: s.items || ""
        })),
        experience: (extracted.experience || []).map((e: any) => ({
            id: crypto.randomUUID(),
            role: e.role || "",
            company: e.company || "",
            location: e.location || "",
            startDate: e.startDate || "",
            endDate: e.endDate || "",
            description: Array.isArray(e.description) ? e.description : [],
            techStack: e.techStack || ""
        })),
        education: (extracted.education || []).map((e: any) => ({
            id: crypto.randomUUID(),
            school: e.school || "",
            degree: e.degree || "",
            location: e.location || "",
            startDate: e.startDate || "",
            endDate: e.endDate || "",
            description: e.description || ""
        })),
        languages: Array.isArray(extracted.languages) ? extracted.languages : []
    };
};
