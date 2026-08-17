import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll } from 'vitest';

// Points server.js at an isolated, per-test-file temp directory instead of
// the real ./data (or legacy ./cvs) directory, so running the suite never
// touches real user data and tests don't need manual cleanup of shared state.
const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yarb-test-data-'));
process.env.YARB_DATA_DIR = tempDataDir;

afterAll(() => {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
});
