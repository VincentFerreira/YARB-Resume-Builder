import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json({ limit: '20mb' }));

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

app.listen(PORT, () => {
    console.log(`LaTeX compilation server running on http://localhost:${PORT}`);
});
