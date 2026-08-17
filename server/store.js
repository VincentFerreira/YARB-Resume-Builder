import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

// Per-path write queues serialize writes/deletes to the same file so that
// concurrent requests (e.g. two browser tabs saving the same CV) can't race.
const writeQueues = new Map();

function enqueue(filePath, task) {
    const previous = writeQueues.get(filePath) ?? Promise.resolve();
    const next = previous.then(task, task);
    // Swallow errors here so the queue keeps flowing for the next caller;
    // the error itself is still returned to whoever awaits `next`.
    writeQueues.set(filePath, next.catch(() => { }));
    return next;
}

export function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

export async function listJsonFiles(dir) {
    try {
        const files = await fsp.readdir(dir);
        return files.filter((f) => f.endsWith('.json'));
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

export async function readJson(filePath) {
    const raw = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
}

export async function writeJsonAtomic(filePath, data) {
    return enqueue(filePath, async () => {
        const dir = path.dirname(filePath);
        await fsp.mkdir(dir, { recursive: true });
        const tmpPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
        await fsp.writeFile(tmpPath, JSON.stringify(data));
        await fsp.rename(tmpPath, filePath);
    });
}

export async function deleteJson(filePath) {
    return enqueue(filePath, async () => {
        await fsp.unlink(filePath);
    });
}
