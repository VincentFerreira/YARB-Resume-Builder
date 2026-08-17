import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ensureDir, listJsonFiles, readJson, writeJsonAtomic, deleteJson } from '../../server/store.js';

let tempDir: string;

afterEach(() => {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

function makeTempDir() {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yarb-store-test-'));
    return tempDir;
}

describe('ensureDir', () => {
    it('creates a directory recursively', () => {
        const dir = makeTempDir();
        const nested = path.join(dir, 'a', 'b', 'c');
        ensureDir(nested);
        expect(fs.existsSync(nested)).toBe(true);
    });
});

describe('listJsonFiles', () => {
    it('returns only .json files', async () => {
        const dir = makeTempDir();
        fs.writeFileSync(path.join(dir, 'a.json'), '{}');
        fs.writeFileSync(path.join(dir, 'b.json'), '{}');
        fs.writeFileSync(path.join(dir, 'notes.txt'), 'hi');
        const files = await listJsonFiles(dir);
        expect(files.sort()).toEqual(['a.json', 'b.json']);
    });

    it('returns an empty array for a missing directory', async () => {
        const dir = makeTempDir();
        const files = await listJsonFiles(path.join(dir, 'does-not-exist'));
        expect(files).toEqual([]);
    });
});

describe('writeJsonAtomic / readJson', () => {
    it('round-trips a JSON value', async () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'record.json');
        await writeJsonAtomic(filePath, { id: '1', value: 'hello' });
        const result = await readJson(filePath);
        expect(result).toEqual({ id: '1', value: 'hello' });
    });

    it('never leaves a temp file behind on success', async () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'record.json');
        await writeJsonAtomic(filePath, { ok: true });
        const files = fs.readdirSync(dir);
        expect(files).toEqual(['record.json']);
    });

    it('creates the destination directory if missing', async () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'nested', 'record.json');
        await writeJsonAtomic(filePath, { ok: true });
        expect(await readJson(filePath)).toEqual({ ok: true });
    });

    it('serializes concurrent writes to the same path — last write wins, no corruption', async () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'record.json');

        const writes = Array.from({ length: 20 }, (_, i) => writeJsonAtomic(filePath, { seq: i }));
        await Promise.all(writes);

        const result = await readJson(filePath);
        expect(result).toEqual({ seq: 19 });
    });
});

describe('deleteJson', () => {
    it('removes an existing file', async () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'record.json');
        await writeJsonAtomic(filePath, { ok: true });
        await deleteJson(filePath);
        expect(fs.existsSync(filePath)).toBe(false);
    });

    it('rejects when the file does not exist', async () => {
        const dir = makeTempDir();
        const filePath = path.join(dir, 'missing.json');
        await expect(deleteJson(filePath)).rejects.toThrow();
    });
});
