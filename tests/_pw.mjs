/**
 * Résolution de Playwright, qu'il soit installé dans le projet ou globalement.
 * Node ne consulte pas NODE_PATH pour les modules ES : il faut donc chercher
 * explicitement dans le dossier des paquets globaux avant d'abandonner.
 */
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

async function load() {
  try { return await import('playwright'); } catch { /* essai suivant */ }
  try {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    for (const name of ['playwright', 'playwright-core']) {
      const entry = path.join(root, name, 'index.mjs');
      if (existsSync(entry)) return await import(pathToFileURL(entry).href);
    }
  } catch { /* essai suivant */ }
  throw new Error(
    'Playwright est introuvable.\n' +
    'Installe-le dans le projet :  npm install --no-save playwright\n' +
    'ou globalement :               npm install -g playwright',
  );
}

const pw = await load();
export const chromium = pw.chromium;
export const devices = pw.devices;
