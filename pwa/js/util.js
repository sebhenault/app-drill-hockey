/** Utilitaires transverses : identifiants, échappement, validation, DOM. */

export function uid(prefix = 'id') {
  const r = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${r}`;
}

export const nowIso = () => new Date().toISOString();

/** Échappement HTML — toute donnée utilisateur passe par ici avant innerHTML. */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Échappement pour un attribut d'URL : refuse tout schéma autre que http(s). */
export function safeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const url = new URL(s);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch { return ''; }
}

export function isValidUrl(u) { return safeUrl(u) !== ''; }

/** Analyse une URL vidéo et en déduit la plateforme, l'identifiant et la miniature. */
export function parseVideoUrl(raw) {
  const href = safeUrl(raw);
  if (!href) return null;
  const url = new URL(href);
  const host = url.hostname.replace(/^www\./, '');
  let provider = 'externe', id = '', thumbnail = '', embed = '';
  let startAt = 0;
  const tParam = url.searchParams.get('t') || url.searchParams.get('start') || '';
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(\d+)s?$/.exec(tParam);
  if (m) startAt = (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
  else if (/^\d+$/.test(tParam)) startAt = +tParam;

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    id = url.searchParams.get('v') || '';
    if (!id && url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2] || '';
    if (!id && url.pathname.startsWith('/embed/')) id = url.pathname.split('/')[2] || '';
    if (id) provider = 'youtube';
  } else if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0]; if (id) provider = 'youtube';
  } else if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const seg = url.pathname.split('/').filter(Boolean);
    id = seg.find((s) => /^\d+$/.test(s)) || ''; if (id) provider = 'vimeo';
  }
  if (provider === 'youtube' && /^[A-Za-z0-9_-]{6,20}$/.test(id)) {
    thumbnail = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    embed = `https://www.youtube-nocookie.com/embed/${id}` + (startAt ? `?start=${startAt}` : '');
  } else if (provider === 'vimeo' && /^\d+$/.test(id)) {
    embed = `https://player.vimeo.com/video/${id}` + (startAt ? `#t=${startAt}s` : '');
  } else { provider = 'externe'; id = ''; }
  return { url: href, provider, id, thumbnail, embed, startAt, sourceName: host };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDuration(min) {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${String(m % 60).padStart(2, '0')}`;
}

/** Construction d'un élément DOM (jamais d'innerHTML avec données brutes). */
export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;          // uniquement du balisage généré par nous
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

export function qs(sel, root = document) { return root.querySelector(sel); }
export function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }

/** Rôties (toasts) — messages courts, en français clair. */
export function toast(msg, kind = 'info', ms = 3600) {
  let box = document.getElementById('toasts');
  if (!box) { box = el('div', { id: 'toasts' }); document.body.appendChild(box); }
  const t = el('div', { class: `toast ${kind}`, role: kind === 'err' ? 'alert' : 'status', text: msg });
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, ms);
}

/** Téléchargement d'un fichier local. */
export function download(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyText(s) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(s); return true; }
  } catch { /* replis ci-dessous */ }
  try {
    const ta = el('textarea', { style: 'position:fixed;opacity:0' }); ta.value = s;
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove();
    return ok;
  } catch { return false; }
}

/** Nom de fichier sûr, sans accents ni caractères réservés. */
export function slug(s, fallback = 'exercice') {
  const base = String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || fallback;
}

export function debounce(fn, ms = 200) {
  let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

export const deepCopy = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
