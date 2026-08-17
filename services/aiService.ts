import { GoogleGenAI, Type } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { CVData, ATSAnalysisResult, ATSKeyword, JobWorkMode, JobContractType } from "../types";
import { getLangText, getLangArray, LANGUAGE_CODES } from '../lib/i18n';

// Types pour le provider IA
export type AIProvider = 'gemini' | 'claude' | 'fake';

export function atsProviderModel(provider: AIProvider): string {
    if (provider === 'claude') return 'claude-sonnet-4-6';
    if (provider === 'fake') return 'fake-keyword-match-v1';
    return 'gemini';
}

// Flash(-lite) models can fully disable "thinking" (budget 0); Pro-tier models require
// a non-zero budget and reject 0 outright. Disabling it on flash frees the model's whole
// output-token budget for the actual JSON instead of internal reasoning, which is what
// was causing very long CV/job-description pairs to hit the token cap and come back as
// truncated, unparsable JSON ("Unterminated string in JSON...").
const thinkingConfigFor = (model: string) => (model.includes('flash') ? { thinkingBudget: 0 } : undefined);

// AI responses are occasionally truncated mid-output when they hit the model's output
// token cap (very long CV + job description, or a model that ignores brevity
// instructions) — JSON.parse then fails with a cryptic "Unterminated string" error.
// Surface that as an actionable message instead.
const parseAiJson = (text: string, context: string): any => {
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            `The ${context} response was cut off before it finished (likely too long to fit the model's output limit) and could not be parsed. Try again, or with a shorter/more concise job description.`
        );
    }
};

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
    'gemini-3.7-flash', 'gemini-3.7-pro',
    'gemini-3.6-flash', 'gemini-3.6-pro',
    'gemini-3.5-flash', 'gemini-3.5-pro',
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
                .filter(m => m.supportedGenerationMethods?.includes('generateContent')
                    && !m.name.includes('embedding')
                    && !m.name.includes('-lite')
                    && !m.name.includes('-image'))
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
            thinkingConfig: thinkingConfigFor(model),
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

    if (!response.text) throw new Error('Empty response from Gemini');
    return parseAiJson(response.text, 'resume parsing');
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

    return parseAiJson(jsonText, 'resume parsing');
};

const TIMEOUT_MS = 90_000;
// Structured ATS analysis is the heaviest call (large schema, "thinking" models
// reasoning over long job descriptions), so it gets a more generous budget than
// the lighter PDF/job-posting extraction calls.
const ATS_TIMEOUT_MS = 150_000;

export const withTimeout = <T>(promise: Promise<T>, ms: number = TIMEOUT_MS): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout: the request took longer than ${ms / 1000}s`)), ms);
    });
    // If the real request settles after we've already raced it out via the
    // timeout branch, swallow its rejection so it doesn't surface as an
    // unhandled promise rejection in the console.
    promise.catch(() => {});
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

// ─── ATS Analysis ────────────────────────────────────────────────────────────

export const serializeCVForATS = (data: CVData): string => {
    const { personalInfo: p, skills, experience, education, languages, currentLanguage } = data;
    const lines: string[] = [];

    lines.push('== PERSONAL INFO ==');
    lines.push(`Name: ${p.firstName} ${p.lastName}`);
    // Show all available language versions of the title so the AI has full context
    for (const code of LANGUAGE_CODES) {
        const val = p.title[code];
        if (val) lines.push(`Title (${code.toUpperCase()}): ${val}`);
    }
    lines.push(`Location: ${p.location}`);
    lines.push(`Email: ${p.email}`);
    if (p.linkedin) lines.push(`LinkedIn: ${p.linkedin}`);
    if (p.github) lines.push(`GitHub: ${p.github}`);
    lines.push(`Summary: ${getLangText(p.summary, currentLanguage)}`);
    const altSummary = LANGUAGE_CODES.filter(c => c !== currentLanguage).map(c => p.summary[c]).find(Boolean);
    if (altSummary) lines.push(`Summary (alt): ${altSummary}`);

    lines.push('\n== SKILLS ==');
    for (const s of skills) {
        lines.push(`[${getLangText(s.name, currentLanguage)}]: ${getLangText(s.items, currentLanguage)}`);
    }

    lines.push('\n== EXPERIENCE ==');
    for (const e of experience) {
        lines.push(`\n${getLangText(e.role, currentLanguage)} at ${e.company} (${e.location})`);
        lines.push(`Period: ${getLangText(e.startDate, currentLanguage)} - ${getLangText(e.endDate, currentLanguage)}`);
        if (e.techStack) lines.push(`Tech: ${e.techStack}`);
        for (const b of getLangArray(e.description, currentLanguage)) lines.push(`  - ${b}`);
    }

    lines.push('\n== EDUCATION ==');
    for (const edu of education) {
        lines.push(`${getLangText(edu.degree, currentLanguage)} — ${edu.school} (${edu.startDate}–${edu.endDate})`);
        const desc = getLangText(edu.description, currentLanguage);
        if (desc) lines.push(`  ${desc}`);
    }

    lines.push('\n== LANGUAGES ==');
    lines.push(getLangArray(languages, currentLanguage).join(', '));

    return lines.join('\n');
};

const ATS_ANALYZER_PROMPT = `You are an expert ATS (Applicant Tracking System) analyst and career coach.
Analyze the CV against the job description and return a JSON object matching this exact schema.

RULES:
- overallScore: integer 0-100, current match between CV and job description
- estimatedNewScore: integer 0-100, expected score after applying your recommendations
- criticalKeywords: 5-10 non-negotiable keywords from the job (required skills, tools, certs). For each: keyword (exact term from JD), status ("present" if clearly in CV, "partial" if synonym/related found, "missing" if absent), frequency (exact count in CV, 0 if missing), importance: "critical", analysis: a 1-sentence contextual note (e.g. "Present in tools section but overshadowed by TypeScript — move Python earlier" or "Completely absent — critical gap for this role")
- importantKeywords: 5-10 secondary keywords. Same schema, importance: "important", include analysis note for each
- formattingChecks: ATS formatting checks. Cover: contact info completeness, use of action verbs, measurable achievements present, consistent date formats, bullet points usage, no keyword stuffing. status: "pass", "fail", or "warning", include a detail string
- recommendations: 3-6 concrete actionable items. Each: section (e.g. "Summary", "Experience"), issue (the problem), before (snippet from CV), after (suggested rewrite)
- summary: 1-2 sentence plain-text overview of the match quality

Return ONLY valid JSON, no markdown, no code blocks. Exact schema:
{
  "overallScore": number,
  "estimatedNewScore": number,
  "criticalKeywords": [{"keyword": string, "status": "present"|"missing"|"partial", "frequency": number, "importance": "critical", "analysis": string}],
  "importantKeywords": [{"keyword": string, "status": "present"|"missing"|"partial", "frequency": number, "importance": "important", "analysis": string}],
  "formattingChecks": [{"label": string, "status": "pass"|"fail"|"warning", "detail": string}],
  "recommendations": [{"section": string, "issue": string, "before": string, "after": string}],
  "summary": string
}`;

const analyzeWithGemini = async (cvText: string, jobDescription: string): Promise<any> => {
    const model = await getBestGeminiModel();
    const response = await geminiAi.models.generateContent({
        model,
        contents: {
            parts: [{
                text: `${ATS_ANALYZER_PROMPT}\n\n== CV CONTENT ==\n${cvText}\n\n== JOB DESCRIPTION ==\n${jobDescription}`
            }]
        },
        config: {
            responseMimeType: "application/json",
            thinkingConfig: thinkingConfigFor(model),
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    overallScore: { type: Type.NUMBER },
                    estimatedNewScore: { type: Type.NUMBER },
                    criticalKeywords: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                keyword: { type: Type.STRING },
                                status: { type: Type.STRING },
                                frequency: { type: Type.NUMBER },
                                importance: { type: Type.STRING },
                                analysis: { type: Type.STRING }
                            },
                            required: ['keyword', 'status', 'frequency', 'importance', 'analysis']
                        }
                    },
                    importantKeywords: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                keyword: { type: Type.STRING },
                                status: { type: Type.STRING },
                                frequency: { type: Type.NUMBER },
                                importance: { type: Type.STRING },
                                analysis: { type: Type.STRING }
                            },
                            required: ['keyword', 'status', 'frequency', 'importance', 'analysis']
                        }
                    },
                    formattingChecks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                label: { type: Type.STRING },
                                status: { type: Type.STRING },
                                detail: { type: Type.STRING }
                            },
                            required: ['label', 'status', 'detail']
                        }
                    },
                    recommendations: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                section: { type: Type.STRING },
                                issue: { type: Type.STRING },
                                before: { type: Type.STRING },
                                after: { type: Type.STRING }
                            },
                            required: ['section', 'issue']
                        }
                    },
                    summary: { type: Type.STRING }
                },
                required: [
                    'overallScore', 'estimatedNewScore', 'criticalKeywords',
                    'importantKeywords', 'formattingChecks', 'recommendations', 'summary'
                ]
            }
        }
    });
    if (!response.text) throw new Error('Empty response from Gemini');
    return parseAiJson(response.text, 'ATS analysis');
};

const analyzeWithClaude = async (cvText: string, jobDescription: string): Promise<any> => {
    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [{
            role: "user",
            content: `${ATS_ANALYZER_PROMPT}\n\n== CV CONTENT ==\n${cvText}\n\n== JOB DESCRIPTION ==\n${jobDescription}`
        }]
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return parseAiJson(jsonText, 'ATS analysis');
};

// Deterministic, offline stand-in for the real LLM analyzers — no network call, same output
// shape, score derived purely from keyword overlap between the job description and the CV
// text. Only reachable when VITE_ATS_PROVIDER=fake exposes it in the UI (see components/
// matches/ProviderPicker usage in JobDetail); keeps e2e scoring scenarios deterministic.
const STOPWORDS = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'on', 'is', 'are', 'we', 'you', 'your', 'our', 'this', 'that', 'be', 'as', 'at']);

function extractKeywords(text: string, max: number): string[] {
    const seen = new Map<string, number>();
    for (const word of text.toLowerCase().match(/[a-z][a-z0-9+.#-]{2,}/g) ?? []) {
        if (STOPWORDS.has(word)) continue;
        seen.set(word, (seen.get(word) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([word]) => word);
}

const analyzeWithFake = (cvText: string, jobDescription: string): ATSAnalysisResult => {
    const cvLower = cvText.toLowerCase();
    const jdKeywords = extractKeywords(jobDescription, 10);
    const toEntries = (words: string[], importance: 'critical' | 'important'): ATSKeyword[] =>
        words.map((keyword) => {
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const frequency = (cvLower.match(new RegExp(`\\b${escaped}\\b`, 'g')) ?? []).length;
            const status: ATSKeyword['status'] = frequency > 0 ? 'present' : 'missing';
            return {
                keyword,
                status,
                frequency,
                importance,
                analysis: status === 'present' ? `Found ${frequency}x in the CV.` : 'Not found in the CV.',
            };
        });

    const criticalKeywords = toEntries(jdKeywords.slice(0, 5), 'critical');
    const importantKeywords = toEntries(jdKeywords.slice(5, 10), 'important');
    const all = [...criticalKeywords, ...importantKeywords];
    const presentCount = all.filter((k) => k.status === 'present').length;
    const overallScore = all.length > 0 ? Math.round((presentCount / all.length) * 100) : 50;
    const missingCount = all.length - presentCount;

    return {
        overallScore,
        estimatedNewScore: Math.min(100, overallScore + missingCount * 5),
        criticalKeywords,
        importantKeywords,
        formattingChecks: [
            { label: 'Fake provider', status: 'pass', detail: 'No LLM call was made — score derived from keyword overlap only.' },
        ],
        recommendations: all
            .filter((k) => k.status === 'missing')
            .map((k) => ({ section: 'Skills', issue: `"${k.keyword}" is missing from the CV.` })),
        summary: `Deterministic fake analysis: ${presentCount}/${all.length} keywords found.`,
    };
};

export const analyzeATS = async (
    cvData: CVData,
    jobDescription: string,
    provider: AIProvider = 'gemini'
): Promise<ATSAnalysisResult> => {
    const cvText = serializeCVForATS(cvData);
    if (provider === 'fake') return analyzeWithFake(cvText, jobDescription);
    return withTimeout(
        provider === 'claude'
            ? analyzeWithClaude(cvText, jobDescription)
            : analyzeWithGemini(cvText, jobDescription),
        ATS_TIMEOUT_MS
    ) as Promise<ATSAnalysisResult>;
};

// ─── PDF Parsing ──────────────────────────────────────────────────────────────

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
        certifications: [],
        languages: toBilingualArray(Array.isArray(extracted.languages) ? extracted.languages : [])
    };
};

// ─── Job Posting Extraction ────────────────────────────────────────────────────

export interface ExtractedJobFields {
    company: string;
    title: string;
    location: string;
    workMode: JobWorkMode | '';
    contractType: JobContractType | '';
    salaryRange: string;
    keywords: string[];
}

const JOB_EXTRACTOR_PROMPT = `You are an expert at parsing job postings. Extract structured fields from the raw job posting text below.

RULES:
- "company": ONLY the hiring company's name, else empty string
- "title": ONLY the job title, else empty string
- "location": city/country if mentioned, else empty string
- "workMode": "onsite", "hybrid" or "remote" only if explicitly stated, else empty string
- "contractType": "CDI", "CDD", "freelance" or "internship" only if explicitly stated, else empty string
- "salaryRange": salary/compensation range if mentioned, else empty string
- "keywords": 5-10 distinct technical skills, tools or requirements mentioned

Return ONLY valid JSON, no markdown, no code blocks. Exact schema:
{"company": string, "title": string, "location": string, "workMode": string, "contractType": string, "salaryRange": string, "keywords": string[]}`;

const extractJobWithGemini = async (rawText: string): Promise<any> => {
    const model = await getBestGeminiModel();
    const response = await geminiAi.models.generateContent({
        model,
        contents: { parts: [{ text: `${JOB_EXTRACTOR_PROMPT}\n\n== JOB POSTING ==\n${rawText}` }] },
        config: {
            responseMimeType: "application/json",
            thinkingConfig: thinkingConfigFor(model),
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    company: { type: Type.STRING },
                    title: { type: Type.STRING },
                    location: { type: Type.STRING },
                    workMode: { type: Type.STRING },
                    contractType: { type: Type.STRING },
                    salaryRange: { type: Type.STRING },
                    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
            },
        },
    });
    if (!response.text) throw new Error('Empty response from Gemini');
    return parseAiJson(response.text, 'job posting extraction');
};

const extractJobWithClaude = async (rawText: string): Promise<any> => {
    const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: `${JOB_EXTRACTOR_PROMPT}\n\n== JOB POSTING ==\n${rawText}` }],
    });
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
    }
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return parseAiJson(jsonText, 'job posting extraction');
};

const WORK_MODE_HINTS: [RegExp, JobWorkMode][] = [[/remote/i, 'remote'], [/hybrid/i, 'hybrid'], [/on-?site/i, 'onsite']];
const CONTRACT_HINTS: [RegExp, JobContractType][] = [[/\bCDI\b/i, 'CDI'], [/\bCDD\b/i, 'CDD'], [/freelance/i, 'freelance'], [/internship/i, 'internship']];

// Deterministic, offline stand-in: reads simple "Key: value" lines when present (as a
// crafted test fixture would use), otherwise falls back to the first two non-empty lines
// for title/company and keyword-frequency extraction for the rest — no LLM call.
const extractJobFake = (rawText: string): ExtractedJobFields => {
    const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
    const findField = (label: string) => {
        const line = lines.find((l) => new RegExp(`^${label}\\s*:`, 'i').test(l));
        return line ? line.split(':').slice(1).join(':').trim() : '';
    };

    const title = findField('title') || lines[0] || '';
    const company = findField('company') || lines[1] || '';
    const location = findField('location');
    const salaryRange = findField('salary');

    const workMode = WORK_MODE_HINTS.find(([re]) => re.test(rawText))?.[1] ?? '';
    const contractType = CONTRACT_HINTS.find(([re]) => re.test(rawText))?.[1] ?? '';
    const keywords = extractKeywords(rawText, 8);

    return { company, title, location, workMode, contractType, salaryRange, keywords };
};

export const extractJobFromText = async (
    rawText: string,
    provider: AIProvider = 'gemini'
): Promise<ExtractedJobFields> => {
    if (provider === 'fake') return extractJobFake(rawText);
    const extracted = await withTimeout(
        provider === 'claude' ? extractJobWithClaude(rawText) : extractJobWithGemini(rawText)
    );
    return {
        company: extracted.company || '',
        title: extracted.title || '',
        location: extracted.location || '',
        workMode: (['onsite', 'hybrid', 'remote'] as const).includes(extracted.workMode) ? extracted.workMode : '',
        contractType: (['CDI', 'CDD', 'freelance', 'internship'] as const).includes(extracted.contractType) ? extracted.contractType : '',
        salaryRange: extracted.salaryRange || '',
        keywords: Array.isArray(extracted.keywords) ? extracted.keywords : [],
    };
};
