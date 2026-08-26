/**
 * Persistance locale.
 *
 * Stratégie : IndexedDB en premier (capacité, robustesse), repli automatique
 * sur localStorage si IndexedDB est indisponible (navigation privée iOS
 * ancienne, environnement bac à sable). Les deux implémentations exposent la
 * même interface asynchrone, donc l'application ne sait pas laquelle est
 * active — sauf pour l'afficher dans les Paramètres.
 *
 * Aucune donnée ne quitte l'appareil. Aucun appel réseau n'est fait ici.
 */

import { deepCopy, nowIso } from './util.js';

const DB_NAME = 'drillbuilder';
const DB_VER = 1;
const STORES = ['drills', 'plans', 'meta'];
const LS_PREFIX = 'db.';

let mode = 'unknown';   // 'idb' | 'ls'
let dbp = null;

function openIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB absent'));
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { return reject(e); }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB refusé'));
    req.onblocked = () => reject(new Error('IndexedDB bloqué'));
    setTimeout(() => reject(new Error('IndexedDB : délai dépassé')), 3000);
  });
}

async function db() {
  if (!dbp) {
    dbp = openIdb().then((d) => { mode = 'idb'; return d; }).catch(() => { mode = 'ls'; return null; });
  }
  return dbp;
}

export async function storageMode() { await db(); return mode; }

/* ---------- Repli localStorage ---------- */
const ls = {
  all(store) {
    try {
      const raw = localStorage.getItem(LS_PREFIX + store);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  write(store, arr) {
    try { localStorage.setItem(LS_PREFIX + store, JSON.stringify(arr)); return true; }
    catch { return false; }
  },
};

/* ---------- API commune ---------- */

export async function getAll(store) {
  const d = await db();
  if (!d) return ls.all(store);
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
}

export async function get(store, id) {
  const d = await db();
  if (!d) return ls.all(store).find((o) => o.id === id) || null;
  return new Promise((resolve) => {
    try {
      const req = d.transaction(store, 'readonly').objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function put(store, obj) {
  const rec = deepCopy(obj);
  const d = await db();
  if (!d) {
    const arr = ls.all(store);
    const i = arr.findIndex((o) => o.id === rec.id);
    if (i >= 0) arr[i] = rec; else arr.push(rec);
    if (!ls.write(store, arr)) throw new Error('Espace de stockage insuffisant sur cet appareil.');
    return rec;
  }
  return new Promise((resolve, reject) => {
    try {
      const tx = d.transaction(store, 'readwrite');
      tx.objectStore(store).put(rec);
      tx.oncomplete = () => resolve(rec);
      tx.onerror = () => reject(tx.error || new Error('Écriture refusée'));
    } catch (e) { reject(e); }
  });
}

export async function del(store, id) {
  const d = await db();
  if (!d) { ls.write(store, ls.all(store).filter((o) => o.id !== id)); return; }
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(store, 'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

export async function clearStore(store) {
  const d = await db();
  if (!d) { ls.write(store, []); return; }
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

/* ---------- Métadonnées : réglages, favoris, historique ---------- */

const DEFAULT_SETTINGS = {
  locale: 'fr-CA', theme: 'auto', contrast: 'normal', textSize: 'm',
  analyticsConsent: false, snapToGrid: true, gridVisible: false,
  seedVersion: 0,
};

export async function getMeta(id, fallback) {
  const r = await get('meta', id);
  return r ? r.value : fallback;
}
export async function setMeta(id, value) {
  return put('meta', { id, value, updatedAt: nowIso() });
}

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await getMeta('settings', {})) };
}
export async function saveSettings(s) {
  return setMeta('settings', { ...DEFAULT_SETTINGS, ...s });
}

export async function getFavorites() { return (await getMeta('favorites', [])) || []; }
export async function toggleFavorite(drillId) {
  const f = await getFavorites();
  const i = f.indexOf(drillId);
  if (i >= 0) f.splice(i, 1); else f.push(drillId);
  await setMeta('favorites', f);
  return i < 0;
}

export async function getRecent() { return (await getMeta('recent', [])) || []; }
export async function pushRecent(drillId) {
  const r = (await getRecent()).filter((x) => x !== drillId);
  r.unshift(drillId);
  await setMeta('recent', r.slice(0, 24));
}

/* ---------- Estimation de l'espace utilisé ---------- */
export async function storageEstimate() {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage || 0, quota: e.quota || 0 };
    }
  } catch { /* ignoré */ }
  return null;
}

export async function wipeAll() {
  for (const s of STORES) await clearStore(s);
}
