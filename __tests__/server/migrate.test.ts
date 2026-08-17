import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { migrateLegacyCvs } from '../../server/migrate.js';

let legacyDir: string;
let dataDir: string;

afterEach(() => {
    if (legacyDir) fs.rmSync(legacyDir, { recursive: true, force: true });
    if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
});

function makeDirs() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yarb-migrate-test-'));
    legacyDir = path.join(root, 'cvs');
    dataDir = path.join(root, 'data');
    fs.mkdirSync(legacyDir, { recursive: true });
    return { legacyDir, dataDir };
}

describe('migrateLegacyCvs', () => {
    it('copies legacy CV files into dataDir/cvs and writes a report marker', async () => {
        const { legacyDir, dataDir } = makeDirs();
        fs.writeFileSync(path.join(legacyDir, 'a.json'), JSON.stringify({ id: 'a' }));
        fs.writeFileSync(path.join(legacyDir, 'b.json'), JSON.stringify({ id: 'b' }));

        const result = await migrateLegacyCvs({ legacyDir, dataDir });

        expect(result).toEqual({ migrated: true, count: 2 });
        expect(fs.existsSync(path.join(dataDir, 'cvs', 'a.json'))).toBe(true);
        expect(fs.existsSync(path.join(dataDir, 'cvs', 'b.json'))).toBe(true);

        const marker = JSON.parse(fs.readFileSync(path.join(dataDir, '.migrated'), 'utf-8'));
        expect(marker.count).toBe(2);
        expect(marker.files.sort()).toEqual(['a.json', 'b.json']);
    });

    it('never modifies or deletes the legacy files', async () => {
        const { legacyDir, dataDir } = makeDirs();
        const content = JSON.stringify({ id: 'a', name: 'Original' });
        fs.writeFileSync(path.join(legacyDir, 'a.json'), content);

        await migrateLegacyCvs({ legacyDir, dataDir });

        expect(fs.readFileSync(path.join(legacyDir, 'a.json'), 'utf-8')).toBe(content);
    });

    it('is a no-op on a second run (marker already present)', async () => {
        const { legacyDir, dataDir } = makeDirs();
        fs.writeFileSync(path.join(legacyDir, 'a.json'), JSON.stringify({ id: 'a' }));
        await migrateLegacyCvs({ legacyDir, dataDir });

        // Simulate a file added to the legacy dir after migration already ran once.
        fs.writeFileSync(path.join(legacyDir, 'b.json'), JSON.stringify({ id: 'b' }));
        const second = await migrateLegacyCvs({ legacyDir, dataDir });

        expect(second).toEqual({ migrated: false, count: 0 });
        expect(fs.existsSync(path.join(dataDir, 'cvs', 'b.json'))).toBe(false);
    });

    it('does not overwrite a destination file that already exists', async () => {
        const { legacyDir, dataDir } = makeDirs();
        fs.mkdirSync(path.join(dataDir, 'cvs'), { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'cvs', 'a.json'), JSON.stringify({ id: 'a', name: 'Already migrated' }));
        fs.writeFileSync(path.join(legacyDir, 'a.json'), JSON.stringify({ id: 'a', name: 'Legacy version' }));

        await migrateLegacyCvs({ legacyDir, dataDir });

        const dest = JSON.parse(fs.readFileSync(path.join(dataDir, 'cvs', 'a.json'), 'utf-8'));
        expect(dest.name).toBe('Already migrated');
    });

    it('handles a missing legacy directory gracefully', async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'yarb-migrate-test-'));
        dataDir = path.join(root, 'data');
        legacyDir = path.join(root, 'does-not-exist');

        const result = await migrateLegacyCvs({ legacyDir, dataDir });

        expect(result).toEqual({ migrated: true, count: 0 });
        expect(fs.existsSync(path.join(dataDir, 'cvs'))).toBe(true);
    });
});
