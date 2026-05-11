import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { CVData } from "../types";

// Types pour le provider IA
export type AIProvider = 'gemini' | 'claude';

// Prompt partagé pour l'extraction de CV
const RESUME_PARSER_PROMPT = `You are an expert resume parser. Extract information from the PDF resume into the JSON structure below.

CRITICAL RULES — each field must contain ONE piece of information only, never multiple:
- "firstName": ONLY the given name (e.g. "Vincent")
- "lastName": ONLY the family name (e.g. "FERREIRA")
- "title": ONLY the professional job title line (e.g. "Lead QA Engineer | Test Automation | CI/CD"). Do NOT include location, email, phone, URLs or any other contact info here.
- "email": ONLY the email address (e.g. "john@example.com")
- "medium": ONLY the Medium blog URL if present, else empty string
- "location": ONLY the city / country (e.g. "Paris, France")
- "linkedin": ONLY the LinkedIn profile URL
- "github": ONLY the GitHub profile URL, else empty string
- "summary": ONLY the professional summary paragraph(s). Do NOT include skills, experience or education here.
- skills[].name: ONLY the skill category label (e.g. "Testing Expertise")
- skills[].items: comma-separated skills for that category only (e.g. "Playwright, Cypress, Selenium")
- experience[].role: ONLY the job title (e.g. "Lead Quality Assurance Engineer")
- experience[].company: ONLY the company name (e.g. "Comet")
- experience[].location: ONLY the city (e.g. "Paris (Remote)")
- experience[].startDate: ONLY the start date (e.g. "2019-08")
- experience[].endDate: ONLY the end date or "Present"
- experience[].description: array of bullet point strings, one string per bullet
- experience[].techStack: comma-separated tech tags only (e.g. "Playwright, Cypress, GitLab CI")
- education[].school: ONLY the school name
- education[].degree: ONLY the degree / diploma name
- education[].startDate / endDate: year only (e.g. "2008")
- languages[]: each entry is one language with proficiency (e.g. "French (Native)")

Return valid JSON only. No markdown, no code blocks, no extra keys.`;

// Instance Gemini
const geminiAi = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Instance Claude
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true
});

// Discover the best available Gemini model via REST — avoids SDK version issues
let cachedGeminiModel: string | null = null;

const GEMINI_PREFERRED = [
    'gemini-3.1-flash', 'gemini-3.1-pro',
    'gemini-3-flash',   'gemini-3-pro',
    'gemini-2.5-flash', 'gemini-2.5-pro',
    'gemini-2.0-flash', 'gemini-2.0-pro',
    'gemini-1.5-flash', 'gemini-1.5-pro',
];

const getBestGeminiModel = async (): Promise<string> => {
    if (cachedGeminiModel) return cachedGeminiModel;

    const apiKey = process.env.API_KEY;
    let available: string[] = [];

    for (const apiVersion of ['v1', 'v1beta']) {
        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${apiKey}`
            );
            if (!res.ok) continue;
            const data = await res.json();
            const models: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models ?? [];
            available = models
                .filter(m => m.supportedGenerationMethods?.includes('generateContent') && !m.name.includes('embedding'))
                .map(m => m.name.replace('models/', ''));
            console.log(`[Gemini] Modèles disponibles (${apiVersion}):`, available);
            if (available.length > 0) break;
        } catch { /* try next version */ }
    }

    if (available.length === 0) {
        throw new Error('Aucun modèle Gemini disponible. Vérifiez votre clé API.');
    }

    for (const keyword of GEMINI_PREFERRED) {
        const match = available.find(m => m.startsWith(keyword));
        if (match) {
            cachedGeminiModel = match;
            console.log('[Gemini] Modèle sélectionné :', match);
            return match;
        }
    }

    cachedGeminiModel = available[0];
    console.log('[Gemini] Modèle sélectionné (fallback) :', cachedGeminiModel);
    return cachedGeminiModel;
};

// Parse avec Gemini
const parseWithGemini = async (pdfBase64: string): Promise<any> => {
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const model = await getBestGeminiModel();

    const response = await geminiAi.models.generateContent({
        model,
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
                            firstName: { type: Type.STRING, description: "Given name only, e.g. 'Vincent'" },
                            lastName:  { type: Type.STRING, description: "Family name only, e.g. 'FERREIRA'" },
                            title:     { type: Type.STRING, description: "Professional job title only, e.g. 'Lead QA Engineer | Test Automation'. No location, email or URLs." },
                            email:     { type: Type.STRING, description: "Email address only, e.g. 'john@example.com'" },
                            medium:    { type: Type.STRING, description: "Medium blog URL only, or empty string" },
                            location:  { type: Type.STRING, description: "City/country only, e.g. 'Paris, France'" },
                            linkedin:  { type: Type.STRING, description: "LinkedIn profile URL only" },
                            github:    { type: Type.STRING, description: "GitHub profile URL only, or empty string" },
                            summary:   { type: Type.STRING, description: "Professional summary paragraph(s) only. No skills or experience bullets." },
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
        model: "claude-sonnet-4-6",
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

const TIMEOUT_MS = 60_000;

const withTimeout = <T>(promise: Promise<T>): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: la requête a dépassé 60 secondes')), TIMEOUT_MS)
    );
    return Promise.race([promise, timeout]);
};

// Fonction principale avec sélection du provider
export const parseResumeFromPdf = async (
    pdfBase64: string,
    provider: AIProvider = 'gemini',
    onProgress?: (step: 'sending' | 'processing') => void
): Promise<CVData> => {

    onProgress?.('sending');
    const extracted = await withTimeout(
        provider === 'claude'
            ? parseWithClaude(pdfBase64)
            : parseWithGemini(pdfBase64)
    );
    onProgress?.('processing');

    // Helper to create bilingual string from one
    const toBilingual = (str: string): { fr: string, en: string } => ({ fr: str || "", en: str || "" });
    const toBilingualArray = (arr: string[]): { fr: string[], en: string[] } => ({ fr: arr || [], en: arr || [] });

    // Post-process to add IDs and ensure structure matches CVData interface
    return {
        currentLanguage: 'fr',
        personalInfo: {
            firstName: extracted.personalInfo?.firstName || "",
            lastName: extracted.personalInfo?.lastName || "",
            title: toBilingual(extracted.personalInfo?.title),
            email: extracted.personalInfo?.email || "",
            medium: extracted.personalInfo?.medium || "",
            location: extracted.personalInfo?.location || "",
            linkedin: extracted.personalInfo?.linkedin || "",
            github: extracted.personalInfo?.github || "",
            summary: toBilingual(extracted.personalInfo?.summary),
            photo: null
        },
        skills: (extracted.skills || []).map((s: any) => ({
            id: crypto.randomUUID(),
            name: toBilingual(s.name || "Compétences"),
            items: toBilingual(s.items || "")
        })),
        experience: (extracted.experience || []).map((e: any) => ({
            id: crypto.randomUUID(),
            role: toBilingual(e.role || ""),
            company: e.company || "",
            location: e.location || "",
            startDate: toBilingual(e.startDate || ""),
            endDate: toBilingual(e.endDate || ""),
            description: toBilingualArray(Array.isArray(e.description) ? e.description : []),
            techStack: e.techStack || ""
        })),
        education: (extracted.education || []).map((e: any) => ({
            id: crypto.randomUUID(),
            school: e.school || "",
            degree: toBilingual(e.degree || ""),
            location: e.location || "",
            startDate: e.startDate || "",
            endDate: e.endDate || "",
            description: toBilingual(e.description || "")
        })),
        languages: toBilingualArray(Array.isArray(extracted.languages) ? extracted.languages : [])
    };
};
