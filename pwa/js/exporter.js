/**
 * Exportation et partage.
 *
 * Tout se fait dans le navigateur : aucun serveur, aucun téléversement.
 *  – PNG  : le SVG autonome est rasterisé dans un <canvas> hors écran.
 *  – SVG  : fichier vectoriel autonome, imprimable et réutilisable.
 *  – JSON : sauvegarde complète, ré-importable.
 *  – PDF  : passe par la boîte d'impression du navigateur (« Enregistrer en PDF »).
 *  – Lien : l'exercice est encodé dans le fragment d'URL, compressé quand le
 *           navigateur expose CompressionStream. Le lien ne quitte donc jamais
 *           l'appareil tant que l'utilisateur ne le partage pas lui-même.
 */

import { standaloneSvg } from './render.js';
import { legendFor } from './symbols.js';
import { qrSvg } from './qr.js';
import { download, slug, copyText, toast, esc, deepCopy } from './util.js';
import { labelAge, labelSkill, labelSpace, labelDiff } from './taxonomy.js';
import { t } from './i18n.js';

export const DEFAULT_EXPORT_OPTIONS = {
  includeTitle: true, includeDiagram: true, includeLegend: true,
  includeDescription: true, includeTeachingPoints: true, includeDuration: true,
  includeEquipment: true, includeSource: true, includeQrCode: false,
  sequenceIds: [],
};

const seqOf = (drill, opt) => (opt.sequenceIds && opt.sequenceIds.length
  ? drill.sequences.filter((s) => opt.sequenceIds.includes(s.id))
  : drill.sequences);

/* ---------------- SVG ---------------- */

export function exportSvg(drill, seqIndex = 0) {
  const s = drill.sequences[seqIndex] || drill.sequences[0];
  const svg = standaloneSvg({ surface: drill.surface, elements: s.elements, width: 1600, title: drill.title });
  download(`${slug(drill.title)}-seq${seqIndex + 1}.svg`, svg, 'image/svg+xml');
}

/* ---------------- PNG ---------------- */

/** Rasterise un SVG en Blob PNG. */
export function svgToPngBlob(svgText, width = 1600) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const h = Math.round(width * (img.naturalHeight / img.naturalWidth || 0.425));
      const c = document.createElement('canvas');
      c.width = width; c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f4f9fd'; ctx.fillRect(0, 0, width, h);
      ctx.drawImage(img, 0, 0, width, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Rasterisation impossible'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Rasterisation impossible')); };
    img.src = url;
  });
}

export async function exportPng(drill, seqIndex = 0) {
  const s = drill.sequences[seqIndex] || drill.sequences[0];
  const svg = standaloneSvg({ surface: drill.surface, elements: s.elements, width: 1600, title: drill.title });
  try {
    const blob = await svgToPngBlob(svg, 1600);
    download(`${slug(drill.title)}-seq${seqIndex + 1}.png`, blob, 'image/png');
  } catch {
    toast('Ce navigateur n’a pas pu produire le PNG. Utilise l’export SVG.', 'err');
  }
}

export async function copyPngToClipboard(drill, seqIndex = 0) {
  const s = drill.sequences[seqIndex] || drill.sequences[0];
  const svg = standaloneSvg({ surface: drill.surface, elements: s.elements, width: 1400, title: drill.title });
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('non supporté');
    const blob = await svgToPngBlob(svg, 1400);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast(t('msg.copied'), 'ok');
  } catch {
    toast(t('msg.noClipboardImg'), 'warn');
  }
}

/* ---------------- JSON ---------------- */

export function bundle({ drills = [], plans = [], favorites = [], settings = null }) {
  return {
    app: 'drillbuilder-hockey', schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    drills: deepCopy(drills), plans: deepCopy(plans), favorites: [...favorites],
    ...(settings ? { settings } : {}),
  };
}

export function exportJson(data, filename) {
  download(filename, JSON.stringify(data, null, 2), 'application/json');
}

/** Valide et normalise un fichier importé. Renvoie null si le format ne colle pas. */
export function parseBundle(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || typeof obj !== 'object') return null;
  // Un exercice seul est aussi accepté.
  if (obj.sequences && obj.title) return { drills: [obj], plans: [], favorites: [] };
  if (obj.app !== 'drillbuilder-hockey') return null;
  return {
    drills: Array.isArray(obj.drills) ? obj.drills.filter(isDrillLike) : [],
    plans: Array.isArray(obj.plans) ? obj.plans.filter(isPlanLike) : [],
    favorites: Array.isArray(obj.favorites) ? obj.favorites.filter((x) => typeof x === 'string') : [],
    settings: obj.settings || null,
  };
}
const isDrillLike = (d) => d && typeof d.title === 'string' && Array.isArray(d.sequences);
const isPlanLike = (p) => p && typeof p.title === 'string' && Array.isArray(p.items);

/* ---------------- Lien de partage ---------------- */

const b64url = {
  enc(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  },
};

async function deflate(bytes) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}
async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') return null;
  try {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { return null; }
}

/** Construit un lien autonome contenant l'exercice. */
export async function shareLink(drill) {
  const json = JSON.stringify(drill);
  const raw = new TextEncoder().encode(json);
  const comp = await deflate(raw);
  const payload = comp ? 'z' + b64url.enc(comp) : 'r' + b64url.enc(raw);
  const base = location.href.split('#')[0];
  return `${base}#/partage/${payload}`;
}

/** Décode un exercice reçu par lien. */
export async function readShareLink(payload) {
  try {
    const kind = payload[0];
    const bytes = b64url.dec(payload.slice(1));
    const raw = kind === 'z' ? await inflate(bytes) : bytes;
    if (!raw) return null;
    const obj = JSON.parse(new TextDecoder().decode(raw));
    return isDrillLike(obj) ? obj : null;
  } catch { return null; }
}

export async function copyShareLink(drill) {
  const url = await shareLink(drill);
  if (url.length > 8000) {
    toast('Ce lien est très long ; certains services de messagerie le tronqueront. Préfère l’export JSON.', 'warn', 6000);
  }
  const ok = await copyText(url);
  toast(ok ? t('msg.copied') : 'Copie impossible. Le lien est affiché dans la console.', ok ? 'ok' : 'warn');
  if (!ok) console.log(url);
  return url;
}

/* ---------------- Vue d'impression / PDF ---------------- */

function li(arr) { return (arr || []).map((x) => `<li>${esc(x)}</li>`).join(''); }

/** Fiche complète mise en page pour l'impression. */
export function drillPrintHtml(drill, opt = DEFAULT_EXPORT_OPTIONS, shareUrl = '') {
  const seqs = seqOf(drill, opt);
  const legend = legendFor(seqs.flatMap((s) => s.elements));
  let h = '<div class="print-doc">';
  if (opt.includeTitle) {
    h += `<h1>${esc(drill.title)}</h1><p class="txt-2">${esc(drill.summary || '')}</p>`;
  }
  if (opt.includeDuration) {
    h += `<p class="txt-sm"><strong>${esc(labelAge(drill.ageGroups[0] || ''))}</strong> ·
      ${drill.durationMin} ${t('drill.min')} · ${esc(labelSpace(drill.iceSpace))} ·
      ${drill.playersMin}–${drill.playersMax} joueurs · ${esc(labelDiff(drill.difficulty))}</p>`;
  }
  if (opt.includeDiagram) {
    for (const [i, s] of seqs.entries()) {
      h += `<div style="break-inside:avoid;margin:12px 0">
        <h3>Séquence ${i + 1} — ${esc(s.name || '')} <span class="txt-2">(${s.duration} s)</span></h3>
        ${standaloneSvg({ surface: drill.surface, elements: s.elements, width: 900, title: drill.title })}
        ${s.note ? `<p class="txt-sm">${esc(s.note)}</p>` : ''}</div>`;
    }
  }
  if (opt.includeLegend && (legend.objects.length || legend.paths.length)) {
    h += `<h3>${t('ed.legend')}</h3><p class="txt-sm">${
      [...legend.objects, ...legend.paths].map((x) => esc(x.fr)).join(' · ')}</p>`;
  }
  if (opt.includeDescription) {
    h += `<h3>${t('drill.setup')}</h3><p>${esc(drill.setup)}</p>`;
    h += `<h3>${t('drill.steps')}</h3><ol>${li(drill.steps)}</ol>`;
  }
  if (opt.includeTeachingPoints) {
    h += `<h3>${t('drill.teaching')}</h3><ul>${li(drill.teachingPoints)}</ul>`;
    if (drill.commonErrors.length) h += `<h3>${t('drill.errors')}</h3><ul>${li(drill.commonErrors)}</ul>`;
  }
  if (opt.includeEquipment && drill.equipment.length) {
    h += `<h3>${t('drill.equipment')}</h3><p>${esc(drill.equipment.join(', '))}</p>`;
  }
  if (drill.skills && drill.skills.length) {
    h += `<h3>${t('drill.skills')}</h3><p class="txt-sm">${drill.skills.map((s) => esc(labelSkill(s))).join(' · ')}</p>`;
  }
  if (drill.safety && drill.safety.length) {
    h += `<h3>Sécurité</h3><ul>${li(drill.safety)}</ul>`;
  }
  if (opt.includeSource && drill.source) {
    h += `<p class="txt-sm">${t('drill.source')} : ${esc(drill.source.name)}${
      drill.source.url ? ` — ${esc(drill.source.url)}` : ''}${
      drill.source.external ? `<br>${t('legal.external')}` : ''}</p>`;
  }
  if (opt.includeQrCode && shareUrl) {
    const q = qrSvg(shareUrl, 130);
    if (q) h += `<div style="margin-top:12px">${q}<p class="txt-sm">Code QR vers la fiche partagée</p></div>`;
    else h += `<p class="txt-sm">Fiche trop volumineuse pour un code QR : partage plutôt le fichier JSON.</p>`;
  }
  h += `<p class="txt-sm">${t('legal.disclaimer')}</p></div>`;
  return h;
}

/** Ouvre la boîte d'impression du navigateur sur un contenu donné. */
export function printHtml(html) {
  const host = document.getElementById('printArea') || (() => {
    const d = document.createElement('div');
    d.id = 'printArea'; d.className = 'print-only';
    document.body.appendChild(d); return d;
  })();
  host.innerHTML = html;
  document.body.classList.add('printing');
  const done = () => {
    document.body.classList.remove('printing');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 60);
}
