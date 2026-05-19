import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { exec } from 'child_process';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

const app = express();
const PORT = 3001;

// Allow all origins for local network multi-device access
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const CV_STORAGE_DIR = path.join(process.cwd(), 'cvs');
fs.mkdirSync(CV_STORAGE_DIR, { recursive: true });

const compileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many compilation requests, please wait a minute.' },
});
app.use('/compile', compileLimiter);

// Endpoint pour compiler du LaTeX en PDF
app.post('/compile', async (req, res) => {
    const { latex: latexCode, photoData } = req.body;

    if (!latexCode) {
        return res.status(400).json({ error: 'No LaTeX code provided' });
    }

    // Créer un dossier temporaire
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'latex-'));
    const texFile = path.join(tempDir, 'document.tex');
    const pdfFile = path.join(tempDir, 'document.pdf');

    try {
        // Écrire le fichier .tex
        fs.writeFileSync(texFile, latexCode);

        // Si une photo est fournie, l'écrire dans le dossier temporaire
        if (photoData && photoData.data && photoData.extension) {
            const photoFile = path.join(tempDir, `photo.${photoData.extension}`);
            const photoBuffer = Buffer.from(photoData.data, 'base64');
            fs.writeFileSync(photoFile, photoBuffer);
            console.log(`Photo saved: ${photoFile} (${photoBuffer.length} bytes)`);
        }

        // Compiler avec pdflatex (2 passes pour les références)
        await new Promise((resolve, reject) => {
            const pdflatexPath = process.env.PDFLATEX_PATH ?? '/Library/TeX/texbin/pdflatex';
            const command = `cd "${tempDir}" && "${pdflatexPath}" -interaction=nonstopmode "document.tex"`;

            exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
                // pdflatex retourne souvent un code d'erreur même pour des warnings
                // On vérifie si le PDF a été généré
                if (fs.existsSync(pdfFile)) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Compilation failed:\n${stdout}\n${stderr}`));
                }
            });
        });

        // Lire le PDF généré
        const pdfBuffer = fs.readFileSync(pdfFile);

        // Nettoyer les fichiers temporaires
        fs.rmSync(tempDir, { recursive: true, force: true });

        // Renvoyer le PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="cv.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        // Nettoyer en cas d'erreur
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch { }

        console.error('Compilation error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// CV storage endpoints
const isValidId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

app.get('/cvs', async (_req, res) => {
    try {
        const files = await fsp.readdir(CV_STORAGE_DIR);
        const metas = await Promise.all(
            files
                .filter(f => f.endsWith('.json'))
                .map(async (f) => {
                    const raw = await fsp.readFile(path.join(CV_STORAGE_DIR, f), 'utf-8');
                    const { id, name, updatedAt, createdAt } = JSON.parse(raw);
                    return { id, name, updatedAt, createdAt };
                })
        );
        metas.sort((a, b) => b.updatedAt - a.updatedAt);
        res.json(metas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/cvs/:id', async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid ID' });
    try {
        const raw = await fsp.readFile(path.join(CV_STORAGE_DIR, `${id}.json`), 'utf-8');
        res.json(JSON.parse(raw));
    } catch {
        res.status(404).json({ error: 'CV not found' });
    }
});

app.post('/cvs', async (req, res) => {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'name and data are required' });
    const id = randomUUID();
    const now = Date.now();
    const record = { id, name, createdAt: now, updatedAt: now, data };
    try {
        await fsp.writeFile(path.join(CV_STORAGE_DIR, `${id}.json`), JSON.stringify(record));
        res.json({ id, name, createdAt: now, updatedAt: now });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/cvs/:id', async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid ID' });
    const { name, data } = req.body;
    try {
        const filePath = path.join(CV_STORAGE_DIR, `${id}.json`);
        const existing = JSON.parse(await fsp.readFile(filePath, 'utf-8'));
        const updated = { ...existing, name: name ?? existing.name, data: data ?? existing.data, updatedAt: Date.now() };
        await fsp.writeFile(filePath, JSON.stringify(updated));
        res.json({ id: updated.id, name: updated.name, updatedAt: updated.updatedAt });
    } catch {
        res.status(404).json({ error: 'CV not found' });
    }
});

app.delete('/cvs/:id', async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid ID' });
    try {
        await fsp.unlink(path.join(CV_STORAGE_DIR, `${id}.json`));
        res.json({ success: true });
    } catch {
        res.status(404).json({ error: 'CV not found' });
    }
});

export { app };

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`LaTeX compilation server running on http://localhost:${PORT}`);
    });
}
