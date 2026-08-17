import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

// One-time, non-destructive migration of the legacy flat `cvs/` directory
// into `YARB_DATA_DIR/cvs/`. Never deletes or modifies the legacy files.
export async function migrateLegacyCvs({ legacyDir, dataDir }) {
    const migratedMarker = path.join(dataDir, '.migrated');
    const cvsDestDir = path.join(dataDir, 'cvs');
    await fsp.mkdir(cvsDestDir, { recursive: true });

    if (fs.existsSync(migratedMarker)) {
        return { migrated: false, count: 0 };
    }

    let files = [];
    if (fs.existsSync(legacyDir)) {
        files = (await fsp.readdir(legacyDir)).filter((f) => f.endsWith('.json'));
    }

    const copied = [];
    for (const file of files) {
        const src = path.join(legacyDir, file);
        const dest = path.join(cvsDestDir, file);
        if (!fs.existsSync(dest)) {
            await fsp.copyFile(src, dest);
            copied.push(file);
        }
    }

    const report = {
        migratedAt: new Date().toISOString(),
        legacyDir,
        cvsDestDir,
        count: copied.length,
        files: copied,
    };
    await fsp.writeFile(migratedMarker, JSON.stringify(report, null, 2));

    if (copied.length > 0) {
        console.log(`[migrate] Copied ${copied.length} legacy CV file(s) from ${legacyDir} to ${cvsDestDir}`);
    }

    return { migrated: true, count: copied.length };
}
