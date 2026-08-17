import express from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import { listJsonFiles, readJson, writeJsonAtomic, ensureDir } from './store.js';
import { sha256Json } from './hash.js';

const isValidId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

function errorBody(code, message) {
    return { error: { code, message } };
}

async function readAllCvs(cvsDir) {
    const files = await listJsonFiles(cvsDir);
    return Promise.all(files.map((f) => readJson(path.join(cvsDir, f))));
}

async function isReferencedByActiveJob(jobsDir, cvId) {
    const files = await listJsonFiles(jobsDir);
    for (const f of files) {
        const job = await readJson(path.join(jobsDir, f));
        if (job.cvId === cvId && job.status !== 'archived') return true;
    }
    return false;
}

function toMeta(record) {
    const { id, label, name, language, tags, contentHash, createdAt, updatedAt, archivedAt } = record;
    return {
        id,
        label: label ?? name,
        language: language ?? 'fr',
        tags: tags ?? [],
        contentHash,
        createdAt,
        updatedAt,
        ...(archivedAt ? { archivedAt } : {}),
    };
}

// jobsDir is only used to enforce the "can't delete a CV in use" rule (§3.4.4).
export function createCvsRouter({ cvsDir, jobsDir }) {
    const router = express.Router();
    ensureDir(cvsDir);

    router.get('/', async (req, res) => {
        try {
            const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';
            const records = await readAllCvs(cvsDir);
            const metas = records.filter((r) => includeArchived || !r.archivedAt).map(toMeta);
            metas.sort((a, b) => b.updatedAt - a.updatedAt);
            res.json(metas);
        } catch (err) {
            res.status(500).json(errorBody('internal_error', err.message));
        }
    });

    router.get('/:id', async (req, res) => {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json(errorBody('invalid_id', 'Invalid ID'));
        try {
            const record = await readJson(path.join(cvsDir, `${id}.json`));
            res.json({
                ...record,
                label: record.label ?? record.name,
                language: record.language ?? 'fr',
                tags: record.tags ?? [],
            });
        } catch {
            res.status(404).json(errorBody('not_found', 'CV not found'));
        }
    });

    router.post('/', async (req, res) => {
        const duplicateOf = req.query.duplicateOf;
        let { label, language, tags, data } = req.body ?? {};

        if (duplicateOf) {
            if (!isValidId(duplicateOf)) return res.status(400).json(errorBody('invalid_id', 'Invalid duplicateOf ID'));
            let source;
            try {
                source = await readJson(path.join(cvsDir, `${duplicateOf}.json`));
            } catch {
                return res.status(404).json(errorBody('not_found', 'CV to duplicate not found'));
            }
            data = data ?? source.data;
            label = label ?? `${source.label ?? source.name} (copy)`;
            language = language ?? source.language;
            tags = tags ?? source.tags;
        }

        if (!label || !data) {
            return res.status(400).json(errorBody('invalid_body', 'label and data are required'));
        }

        const id = randomUUID();
        const now = Date.now();
        const record = {
            id,
            label,
            language: language ?? data.currentLanguage ?? 'fr',
            tags: Array.isArray(tags) ? tags : [],
            data,
            contentHash: sha256Json(data),
            createdAt: now,
            updatedAt: now,
        };
        try {
            await writeJsonAtomic(path.join(cvsDir, `${id}.json`), record);
            res.json(toMeta(record));
        } catch (err) {
            res.status(500).json(errorBody('internal_error', err.message));
        }
    });

    router.put('/:id', async (req, res) => {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json(errorBody('invalid_id', 'Invalid ID'));
        const { label, language, tags, data } = req.body ?? {};
        try {
            const filePath = path.join(cvsDir, `${id}.json`);
            const existing = await readJson(filePath);
            const nextData = data ?? existing.data;
            const updated = {
                ...existing,
                label: label ?? existing.label ?? existing.name,
                language: language ?? existing.language ?? 'fr',
                tags: tags ?? existing.tags ?? [],
                data: nextData,
                contentHash: sha256Json(nextData),
                updatedAt: Date.now(),
            };
            delete updated.name;
            await writeJsonAtomic(filePath, updated);
            res.json(toMeta(updated));
        } catch {
            res.status(404).json(errorBody('not_found', 'CV not found'));
        }
    });

    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        if (!isValidId(id)) return res.status(400).json(errorBody('invalid_id', 'Invalid ID'));
        try {
            const filePath = path.join(cvsDir, `${id}.json`);
            const existing = await readJson(filePath);
            if (await isReferencedByActiveJob(jobsDir, id)) {
                return res
                    .status(409)
                    .json(errorBody('cv_in_use', 'This CV is associated with an active job and cannot be deleted.'));
            }
            const archived = {
                ...existing,
                archivedAt: existing.archivedAt ?? new Date().toISOString(),
                updatedAt: Date.now(),
            };
            await writeJsonAtomic(filePath, archived);
            res.json({ success: true, archived: true });
        } catch {
            res.status(404).json(errorBody('not_found', 'CV not found'));
        }
    });

    return router;
}
