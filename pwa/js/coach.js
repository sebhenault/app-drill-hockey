/**
 * Version coachs : page en lecture seule, pensée pour le téléphone, reçue par
 * lien. Elle montre seulement ce dont un entraîneur adjoint a besoin sur la
 * glace : le diagramme, la vidéo et les points clés.
 *
 * Tout le contenu voyage dans le fragment de l'URL (#/coachs/<données>) :
 * aucun serveur, aucun compte. Un lien vise soit une pratique complète, soit
 * un seul exercice.
 */

import { el, esc, fmtDate, toast, copyText, parseVideoUrl, safeUrl } from './util.js';
import { labelAge } from './taxonomy.js';
import { sequenceSvg } from './render.js';
import { encodePayload, decodePayload } from './exporter.js';

const COACH_KINDS = ['pratique', 'exercice'];

/* ==========================================================================
   Construction du paquet transmis dans le lien
   ========================================================================== */

/** Version allégée d'un exercice : diagramme, vidéos, points clés. */
function coachDrill(d) {
  return {
    t: d.title,
    s: d.summary || '',
    sf: d.surface,
    q: (d.sequences || []).map((x) => ({ n: x.name || '', e: x.elements || [] })),
    tp: d.teachingPoints || [],
    v: (d.videos || []).filter((x) => safeUrl(x.url))
      .map((x) => ({ u: x.url, t: x.title || '', n: x.note || '' })),
  };
}

function practicePack(plan, drillById) {
  return {
    v: 1, k: 'pratique',
    t: plan.title, dt: plan.date || '', a: plan.ageGroup || '',
    eq: plan.equipment || [], n: plan.coachNotes || '',
    it: plan.items.map((i) => {
      const d = i.type === 'drill' && i.drillId ? drillById(i.drillId) : null;
      return { ty: i.type, t: i.title, m: +i.duration || 0, no: i.notes || '', d: d ? coachDrill(d) : null };
    }),
  };
}

function drillPack(d, minutes) {
  return {
    v: 1, k: 'exercice', t: d.title,
    it: [{ ty: 'drill', t: d.title, m: +minutes || +d.durationMin || 0, no: '', d: coachDrill(d) }],
  };
}

async function coachUrl(pack) {
  const base = location.href.split('#')[0];
  return `${base}#/coachs/${await encodePayload(pack)}`;
}

export const practiceCoachLink = (plan, drillById) => coachUrl(practicePack(plan, drillById));
export const drillCoachLink = (d, minutes) => coachUrl(drillPack(d, minutes));

/** Rebâtit un lien « un seul exercice » à partir d'un élément de pratique reçu. */
const itemCoachLink = (it) => coachUrl({ v: 1, k: 'exercice', t: it.t, it: [it] });

function isCoachPack(p) {
  return !!p && COACH_KINDS.includes(p.k) && typeof p.t === 'string' && Array.isArray(p.it);
}

/* ==========================================================================
   Partage : feuille native du téléphone, sinon copie
   ========================================================================== */
export async function shareOrCopy(url, title) {
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const ok = await copyText(url);
  toast(ok ? 'Lien copié. Colle-le dans un texto ou un courriel.' : 'Copie impossible : le lien est affiché dans la console.',
    ok ? 'ok' : 'warn');
  if (!ok) console.log(url);
}

/* ==========================================================================
   Bloc vidéo (aussi utilisé par la fiche complète)
   ========================================================================== */
export function videoBlock(videos) {
  const box = el('div', { class: 'stack' });
  for (const v of videos) {
    const info = parseVideoUrl(v.url);
    if (info && info.embed) {
      box.appendChild(el('div', { class: 'embed' }, [el('iframe', {
        src: info.embed, title: v.title || 'Vidéo', loading: 'lazy',
        allow: 'accelerometer; clipboard-write; encrypted-media; picture-in-picture',
        referrerpolicy: 'strict-origin-when-cross-origin', allowfullscreen: true,
      })]));
      if (v.title) box.appendChild(el('p', { class: 'txt-sm', style: 'margin:0', text: v.title }));
    } else {
      box.appendChild(el('div', { class: 'video-card' }, [
        el('div', { class: 'vt', html: '<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg>' }),
        el('div', { style: 'flex:1;min-width:0' }, [
          el('strong', { class: 'txt-sm', text: v.title || 'Vidéo externe' }),
          el('p', { class: 'txt-sm txt-2', style: 'margin:2px 0', text: v.sourceName || (info ? info.sourceName : '') }),
          el('a', { class: 'btn btn-sm', href: safeUrl(v.url), target: '_blank', rel: 'noopener noreferrer',
            text: 'Voir la vidéo ↗' }),
        ]),
      ]));
    }
    if (v.note) box.appendChild(el('p', { class: 'txt-sm txt-2', style: 'margin:0', text: v.note }));
  }
  return box;
}

/* ==========================================================================
   Page reçue par les coachs
   ========================================================================== */
export async function viewCoach(payload) {
  const wrap = el('div', { class: 'view-pad coach' });
  const pack = await decodePayload(payload);
  if (!isCoachPack(pack)) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('h2', { text: 'Lien illisible' }),
      el('p', { text: 'Ce lien est incomplet ou a été coupé par la messagerie qui l’a transmis. Demande à l’entraîneur de te le renvoyer.' }),
    ]));
    return wrap;
  }

  const drills = pack.it.filter((i) => i.ty === 'drill' && i.d);

  if (pack.k === 'exercice') {
    if (drills[0]) wrap.appendChild(drillSection(drills[0], 0, false));
    wrap.appendChild(footer());
    return wrap;
  }

  const total = pack.it.reduce((a, i) => a + (+i.m || 0), 0);
  wrap.appendChild(el('header', { class: 'coach-head' }, [
    el('h1', { text: pack.t }),
    el('div', { class: 'flex gap-1 wrap' }, [
      pack.dt ? el('span', { class: 'badge', text: fmtDate(pack.dt) || pack.dt }) : null,
      pack.a ? el('span', { class: 'badge', text: labelAge(pack.a) }) : null,
      el('span', { class: 'badge', text: `${total} min` }),
      el('span', { class: 'badge', text: `${drills.length} exercice(s)` }),
    ]),
  ]));

  // Déroulement : chaque exercice est un raccourci vers sa section.
  let clock = 0;
  const order = el('ol', { class: 'coach-order card' });
  pack.it.forEach((it) => {
    const start = clock; clock += +it.m || 0;
    const n = it.d ? drills.indexOf(it) : -1;
    const label = el('span', { class: 'co-t', text: it.t });
    order.appendChild(el('li', {}, [
      el('span', { class: 'co-clock', text: `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}` }),
      n >= 0
        ? el('button', { class: 'co-link', onclick: () => {
          const target = document.getElementById(`coach-ex-${n + 1}`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } }, [el('span', { class: 'co-num', text: String(n + 1) }), label])
        : label,
      el('span', { class: 'co-min', text: `${it.m} min` }),
    ]));
  });
  wrap.appendChild(order);

  if (pack.eq && pack.eq.length) {
    wrap.appendChild(el('p', { class: 'txt-sm' }, [el('strong', { text: 'Matériel : ' }), pack.eq.join(', ')]));
  }
  if (pack.n) wrap.appendChild(el('div', { class: 'card coach-notes' }, [el('h3', { text: 'Notes' }), el('p', { text: pack.n })]));

  drills.forEach((it, i) => wrap.appendChild(drillSection(it, i, true)));
  wrap.appendChild(footer());
  return wrap;
}

function drillSection(it, i, numbered) {
  const d = it.d;
  const sec = el('section', { class: 'card coach-ex', id: `coach-ex-${i + 1}` });
  sec.appendChild(el('div', { class: 'coach-ex-head' }, [
    numbered ? el('span', { class: 'co-num big', text: String(i + 1) }) : null,
    el('div', { style: 'flex:1;min-width:0' }, [
      el('h2', { text: it.t || d.t }),
      it.m ? el('span', { class: 'txt-sm txt-2', text: `${it.m} min` }) : null,
    ]),
  ]));
  if (d.s) sec.appendChild(el('p', { class: 'txt-2', text: d.s }));

  const fake = { title: d.t, surface: d.sf, sequences: (d.q || []).map((x) => ({ name: x.n, elements: x.e })) };
  const seqs = fake.sequences.filter((x) => x.elements && x.elements.length);
  fake.sequences.forEach((s, k) => {
    if (!s.elements || !s.elements.length) return;
    if (seqs.length > 1 && s.name) sec.appendChild(el('h4', { class: 'mt-1', text: s.name }));
    sec.appendChild(el('div', { class: 'detail-diagram', html: sequenceSvg(fake, k) }));
  });

  if (d.v && d.v.length) {
    sec.appendChild(el('h3', { class: 'mt-2', text: 'Vidéo' }));
    sec.appendChild(videoBlock(d.v.map((v) => ({ url: v.u, title: v.t, note: v.n }))));
  }
  if (d.tp && d.tp.length) {
    sec.appendChild(el('h3', { class: 'mt-2', text: 'Points clés' }));
    sec.appendChild(el('ul', { class: 'coach-points' }, d.tp.map((x) => el('li', { text: x }))));
  }
  if (it.no) sec.appendChild(el('p', { class: 'txt-sm txt-2', text: it.no }));

  if (numbered) {
    sec.appendChild(el('button', { class: 'btn btn-sm mt-2 no-print', onclick: async () => {
      shareOrCopy(await itemCoachLink(it), it.t);
    } }, ['Partager cet exercice seul']));
  }
  return sec;
}

const footer = () => el('p', { class: 'txt-sm txt-2 coach-foot', html:
  `Préparé avec ${esc('DrillBuilder Hockey')}. Les vidéos externes restent la propriété de leur source.` });
