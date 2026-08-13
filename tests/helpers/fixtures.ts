import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import type { CVData } from '../../types';

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

export function loadCvFixture(name: string): CVData {
  return JSON.parse(fs.readFileSync(fixturePath(name), 'utf-8')) as CVData;
}
