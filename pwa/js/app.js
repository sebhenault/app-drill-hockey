/**
 * DrillBuilder Hockey — coquille applicative.
 * Routeur à fragment, écrans, formulaires et intégration PWA.
 */

import * as store from './store.js';
import { seedDrills } from './seed.js';
import { createEditor } from './editor.js';
import { thumbSvg, sequenceSvg, legendHtml } from './render.js';
import {
  AGE_GROUPS, SKILLS, SITUATIONS, ICE_SPACES, DIFFICULTIES, VISIBILITIES,
  labelAge, labelSkill, labelSituation, labelSpace, labelDiff, skillsByGroup,
} from './taxonomy.js';
import { SURFACES } from './rink.js';
import { OBJECTS, PATH_STYLES, CAPS, objectIcon, pathIcon, capIcon } from './symbols.js';
import {
  DEFAULT_EXPORT_OPTIONS, exportPng, exportSvg, exportJson, bundle, parseBundle,
  copyPngToClipboard, copyShareLink, shareLink, readShareLink, drillPrintHtml, printHtml,
} from './exporter.js';
import { qrSvg } from './qr.js';
import { viewCoach, videoBlock, drillCoachLink, shareOrCopy } from './coach.js';
import { viewPlansList, viewPlanEditor, newPlan, planTotal } from './plans.js';
import { t, setLocale, availableLocales } from './i18n.js';
import {
  el, uid, nowIso, esc, clamp, fmtDate, fmtDuration, toast, debounce, deepCopy,
  parseVideoUrl, safeUrl, download, copyText, slug,
} from './util.js';

/* ==========================================================================
   État global
   ========================================================================== */
const state = {
  seeds: [],
  userDrills: [],
  plans: [],
  favorites: [],
  recent: [],
  settings: null,
  storageMode: 'idb',
  editor: null,
  installPrompt: null,
  filters: emptyFilters(),
  libView: 'grid',
  librarySort: 'recent',
};

function emptyFilters() {
  return {
    q: '', ages: new Set(), skills: new Set(), situations: new Set(), spaces: new Set(),
    maxDuration: 0, difficulty: new Set(), goalie: '', video: false, fav: false, mine: false,
  };
}

const allDrills = () => [...state.userDrills, ...state.seeds];
const drillById = (id) => allDrills().find((d) => d.id === id) || null;

/* ==========================================================================
   Coquille
   ========================================================================== */
const appRoot = document.getElementById('app');
const viewport = el('div', { class: 'viewport', id: 'main' });

const NAV = [
  ['#/', 'nav.home', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>'],
  ['#/bibliotheque', 'nav.library', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="6" height="16" rx="1"/><rect x="11" y="4" width="4" height="16" rx="1"/><path d="M17 5l4 14"/></svg>'],
  ['#/editeur', 'nav.editor', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20l4-1 10-10a2.1 2.1 0 00-3-3L5 16z"/></svg>'],
  ['#/plans', 'nav.plans', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>'],
  ['#/parametres', 'nav.settings', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>'],
];

const BRAND = `<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
  <rect width="40" height="40" rx="9" fill="#131b24"/>
  <ellipse cx="20" cy="20" rx="15" ry="10" fill="none" stroke="#8fb2cf" stroke-width="2"/>
  <path d="M13.5 11.6v16.8M26.5 11.6v16.8" stroke="#6e96be" stroke-width="1.8"/>
  <path d="M6 20h28" stroke="#e23b41" stroke-width="2.4"/>
  <circle cx="20" cy="20" r="4.4" fill="none" stroke="#e23b41" stroke-width="2"/>
  <circle cx="20" cy="20" r="1.6" fill="#e23b41"/>
</svg>`;

const navDesk = el('nav', { class: 'nav-desk', 'aria-label': 'Navigation principale' },
  NAV.map(([href, key]) => el('a', {
    class: 'btn', href, 'data-nav': href, text: t(key),
  })));

const tabbar = el('nav', { class: 'tabbar', 'aria-label': 'Navigation principale' },
  NAV.map(([href, key, icon]) => el('button', {
    'data-nav': href, onclick: () => go(href), 'aria-label': t(key),
  }, [el('span', { html: icon }), el('span', { text: t(key) })])));

const topbar = el('header', { class: 'topbar' }, [
  el('a', { class: 'brand', href: '#/', 'aria-label': t('app.name') },
    [el('span', { html: BRAND }), el('span', { class: 'brand-txt', html: 'Drill<em>Builder</em>' })]),
  el('span', { class: 'spacer' }),
  navDesk,
  el('button', { class: 'btn btn-primary btn-sm', onclick: () => go('#/editeur') }, ['+ ' + t('act.new')]),
]);

appRoot.append(
  el('a', { class: 'skip-link', href: '#main', text: 'Aller au contenu principal' }),
  topbar, viewport, tabbar,
);

function setActiveNav(hash) {
  const base = '#/' + (hash.split('/')[1] || '');
  for (const n of document.querySelectorAll('[data-nav]')) {
    const on = n.dataset.nav === base || (base === '#/' && n.dataset.nav === '#/');
    if (on) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current');
  }
}

/* ==========================================================================
   Modales
   ========================================================================== */
let modalEl = null;
function openModal(title, body, footer = []) {
  closeModal();
  const close = () => closeModal();
  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
    el('div', { class: 'modal-head' }, [
      el('h2', { text: title }),
      el('button', { class: 'btn btn-icon btn-ghost', 'aria-label': t('act.close'), onclick: close }, ['✕']),
    ]),
    el('div', { class: 'modal-body' }, [body]),
    footer.length ? el('div', { class: 'modal-foot' }, footer) : null,
  ]);
  modalEl = el('div', { class: 'modal-back', onclick: (e) => { if (e.target === modalEl) close(); } }, [modal]);
  document.body.appendChild(modalEl);
  const f = modal.querySelector('input,textarea,select,button');
  if (f) setTimeout(() => f.focus(), 30);
  document.addEventListener('keydown', escClose);
  return modal;
}
function escClose(e) { if (e.key === 'Escape') closeModal(); }
function closeModal() {
  if (modalEl) { modalEl.remove(); modalEl = null; }
  document.removeEventListener('keydown', escClose);
}
function confirmDialog(message) {
  return new Promise((resolve) => {
    const body = el('p', { text: message });
    openModal(t('act.confirm'), body, [
      el('button', { class: 'btn', onclick: () => { closeModal(); resolve(false); } }, [t('act.cancel')]),
      el('button', { class: 'btn btn-primary', onclick: () => { closeModal(); resolve(true); } }, [t('act.confirm')]),
    ]);
  });
}

/* ==========================================================================
   Persistance
   ========================================================================== */
async function saveDrill(d) {
  d.updatedAt = nowIso();
  await store.put('drills', d);
  const i = state.userDrills.findIndex((x) => x.id === d.id);
  if (i >= 0) state.userDrills[i] = d; else state.userDrills.unshift(d);
}
async function deleteDrill(id) {
  await store.del('drills', id);
  state.userDrills = state.userDrills.filter((d) => d.id !== id);
}
async function savePlan(p) {
  p.updatedAt = nowIso();
  await store.put('plans', p);
  const i = state.plans.findIndex((x) => x.id === p.id);
  if (i >= 0) state.plans[i] = p; else state.plans.unshift(p);
}
async function deletePlan(id) {
  await store.del('plans', id);
  state.plans = state.plans.filter((p) => p.id !== id);
}
async function toggleFav(id) {
  const added = await store.toggleFavorite(id);
  state.favorites = await store.getFavorites();
  return added;
}

const ctx = {
  get drills() { return allDrills(); },
  get plans() { return state.plans; },
  drillById, savePlan, deletePlan, go, openModal, closeModal,
  confirm: confirmDialog, debounce,
};

/* ==========================================================================
   Écran : Accueil
   ========================================================================== */
function viewHome() {
  const wrap = el('div', { class: 'view-pad' });

  wrap.appendChild(el('section', { class: 'hero' }, [
    el('h1', { text: t('app.name') }),
    el('p', { text: t('app.tagline') }),
    el('p', { class: 'txt-sm txt-2', text: t('app.localData') }),
    el('div', { class: 'hero-actions' }, [
      el('button', { class: 'btn btn-primary', onclick: () => go('#/editeur') }, ['+ ' + t('act.newDrill')]),
      el('button', { class: 'btn', onclick: async () => {
        const p = newPlan(); await savePlan(p); go(`#/plan/${p.id}`);
      } }, ['+ ' + t('act.newPlan')]),
      el('button', { class: 'btn btn-outline', onclick: () => go('#/bibliotheque') }, [t('nav.library')]),
    ]),
  ]));

  wrap.appendChild(el('div', { class: 'notice mb-2', text: t('legal.disclaimer') }));

  const recent = state.recent.map(drillById).filter(Boolean).slice(0, 8);
  wrap.appendChild(section(t('home.recent'), recent, t('home.noRecent')));

  const favs = state.favorites.map(drillById).filter(Boolean).slice(0, 8);
  wrap.appendChild(section(t('home.favorites'), favs, t('home.noFav')));

  // Suggestions par âge
  const sug = el('section', {}, [el('div', { class: 'sec-head' }, [el('h2', { text: t('home.suggestions') })])]);
  const chipRow = el('div', { class: 'flex gap-1 wrap mb-2' }, AGE_GROUPS.map((a) => el('button', {
    class: 'opt', onclick: () => {
      state.filters = emptyFilters(); state.filters.ages.add(a.id); go('#/bibliotheque');
    },
  }, [a.fr])));
  sug.appendChild(chipRow);
  const byAge = allDrills().filter((d) => d.ageGroups.includes('u11')).slice(0, 4);
  sug.appendChild(cardGrid(byAge));
  wrap.appendChild(sug);

  return wrap;
}

function section(title, drills, emptyMsg) {
  const s = el('section', {}, [
    el('div', { class: 'sec-head' }, [
      el('h2', { text: title }),
      el('a', { class: 'more', href: '#/bibliotheque', text: 'Tout voir' }),
    ]),
  ]);
  s.appendChild(drills.length ? cardGrid(drills) : el('p', { class: 'txt-2 txt-sm', text: emptyMsg }));
  return s;
}

function drillCard(d) {
  const isFav = state.favorites.includes(d.id);
  const favBtn = el('button', {
    class: 'drill-fav', 'aria-pressed': String(isFav), 'aria-label': `${t('act.favorite')} : ${d.title}`,
    onclick: async (e) => {
      e.stopPropagation();
      const added = await toggleFav(d.id);
      favBtn.setAttribute('aria-pressed', String(added));
    },
  }, [el('span', { html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.7 6.3.9-4.5 4.4 1 6.2-5.5-3-5.5 3 1-6.2L3 9.6l6.3-.9z"/></svg>' })]);

  return el('div', { class: 'drill-card', style: 'position:relative' }, [
    el('button', {
      class: 'drill-thumb', style: 'border:0;cursor:pointer;width:100%;padding:0',
      'aria-label': `${t('act.edit')} : ${d.title}`, onclick: () => go(`#/drill/${d.id}`),
      html: thumbSvg(d),
    }),
    favBtn,
    el('button', { class: 'drill-body', style: 'border:0;background:none;cursor:pointer;text-align:left;color:inherit',
      onclick: () => go(`#/drill/${d.id}`) }, [
      el('h3', { text: d.title }),
      el('p', { class: 'sum', text: d.summary }),
      el('div', { class: 'drill-meta' }, [
        el('span', { class: 'badge badge-acc', text: d.ageGroups.map(labelAge).join(' · ') }),
        el('span', { class: 'badge', text: `${d.durationMin} min` }),
        el('span', { class: 'badge', text: labelDiff(d.difficulty) }),
        d.videos && d.videos.length ? el('span', { class: 'badge', text: '▶ vidéo' }) : null,
        d.isDemo ? null : el('span', { class: 'badge badge-ok', text: 'Mon exercice' }),
      ]),
    ]),
  ]);
}

const cardGrid = (drills) => el('div', { class: 'grid-cards' }, drills.map(drillCard));

/* ==========================================================================
   Écran : Bibliothèque
   ========================================================================== */
function matches(d, f) {
  if (f.q) {
    const hay = `${d.title} ${d.summary} ${d.description} ${(d.keywords || []).join(' ')} ${
      d.skills.map(labelSkill).join(' ')}`.toLowerCase();
    if (!hay.includes(f.q.toLowerCase())) return false;
  }
  if (f.ages.size && !d.ageGroups.some((a) => f.ages.has(a))) return false;
  if (f.skills.size && !d.skills.some((s) => f.skills.has(s))) return false;
  if (f.situations.size && !d.situations.some((s) => f.situations.has(s))) return false;
  if (f.spaces.size && !f.spaces.has(d.iceSpace)) return false;
  if (f.difficulty.size && !f.difficulty.has(d.difficulty)) return false;
  if (f.maxDuration && d.durationMin > f.maxDuration) return false;
  if (f.goalie === 'with' && !d.goalies) return false;
  if (f.goalie === 'without' && d.goalies) return false;
  if (f.video && !(d.videos && d.videos.length)) return false;
  if (f.fav && !state.favorites.includes(d.id)) return false;
  if (f.mine && d.isDemo) return false;
  return true;
}

function activeChips(f, onChange) {
  const chips = [];
  const chip = (label, remove) => el('span', { class: 'chip' }, [
    el('span', { text: label }),
    el('button', { 'aria-label': `Retirer le filtre ${label}`, onclick: () => { remove(); onChange(); } }, ['✕']),
  ]);
  if (f.q) chips.push(chip(`« ${f.q} »`, () => { f.q = ''; }));
  for (const a of f.ages) chips.push(chip(labelAge(a), () => f.ages.delete(a)));
  for (const s of f.skills) chips.push(chip(labelSkill(s), () => f.skills.delete(s)));
  for (const s of f.situations) chips.push(chip(labelSituation(s), () => f.situations.delete(s)));
  for (const s of f.spaces) chips.push(chip(labelSpace(s), () => f.spaces.delete(s)));
  for (const d of f.difficulty) chips.push(chip(labelDiff(d), () => f.difficulty.delete(d)));
  if (f.maxDuration) chips.push(chip(`≤ ${f.maxDuration} min`, () => { f.maxDuration = 0; }));
  if (f.goalie) chips.push(chip(f.goalie === 'with' ? t('f.goalie.with') : t('f.goalie.without'), () => { f.goalie = ''; }));
  if (f.video) chips.push(chip(t('f.video'), () => { f.video = false; }));
  if (f.fav) chips.push(chip(t('f.fav'), () => { f.fav = false; }));
  if (f.mine) chips.push(chip(t('f.mine'), () => { f.mine = false; }));
  return chips;
}

function viewLibrary() {
  const f = state.filters;
  const wrap = el('div', { class: 'view-pad' });

  const search = el('input', {
    class: 'inp', type: 'search', value: f.q, placeholder: t('lib.search'), 'aria-label': t('lib.search'),
  });
  search.addEventListener('input', debounce(() => { f.q = search.value; refresh(); }, 180));

  const filtersBtn = el('button', { class: 'btn', 'aria-expanded': 'false',
    onclick: () => { const open = panel.style.display !== 'none'; panel.style.display = open ? 'none' : 'block';
      filtersBtn.setAttribute('aria-expanded', String(!open)); } }, [t('lib.filters')]);

  const sortSel = el('select', { class: 'inp', style: 'width:auto', 'aria-label': t('lib.sort'),
    onchange: () => { state.librarySort = sortSel.value; refresh(); } },
    [['recent', t('lib.sort.recent')], ['title', t('lib.sort.title')],
     ['duration', t('lib.sort.duration')], ['difficulty', t('lib.sort.difficulty')]]
      .map(([v, l]) => el('option', { value: v, selected: state.librarySort === v, text: l })));

  const viewBtn = el('button', { class: 'btn btn-icon', 'aria-label': state.libView === 'grid' ? t('lib.list') : t('lib.grid'),
    onclick: () => { state.libView = state.libView === 'grid' ? 'list' : 'grid'; refresh(); } },
    [el('span', { html: state.libView === 'grid'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>' })]);

  wrap.appendChild(el('div', { class: 'lib-bar' }, [
    el('div', { class: 'search-wrap' }, [
      el('span', { html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' }),
      search,
    ]),
    filtersBtn, sortSel, viewBtn,
  ]));

  /* Panneau de filtres */
  const panel = el('div', { class: 'filters-panel', style: 'display:none' });
  // Les boutons d'option sont mémorisés : retirer une pastille doit remettre à
  // jour le panneau sans le reconstruire, sinon il se referme sous le doigt.
  const optButtons = [];
  const optList = (items, set, getLabel, getId) => el('div', { class: 'opt-list' },
    items.map((it) => {
      const id = getId(it);
      const b = el('button', { class: 'opt', 'aria-pressed': String(set.has(id)), text: getLabel(it),
        onclick: () => { set.has(id) ? set.delete(id) : set.add(id); syncOptions(); refresh(); } });
      optButtons.push(() => b.setAttribute('aria-pressed', String(set.has(id))));
      return b;
    }));
  const otherSyncs = [];
  function syncOptions() { for (const f2 of optButtons) f2(); for (const f2 of otherSyncs) f2(); }

  const skillGroups = [...skillsByGroup().entries()].map(([g, list]) => el('div', {}, [
    el('div', { class: 'lbl', style: 'font-size:.72rem;color:var(--tx-2);margin:6px 0 4px', text: g }),
    optList(list, f.skills, (s) => s.fr, (s) => s.id),
  ]));

  panel.appendChild(el('div', { class: 'filters-grid' }, [
    el('div', {}, [el('div', { class: 'lbl', text: t('f.age') }), optList(AGE_GROUPS, f.ages, (a) => a.fr, (a) => a.id)]),
    el('div', {}, [el('div', { class: 'lbl', text: t('f.situation') }), optList(SITUATIONS, f.situations, (s) => s.fr, (s) => s.id)]),
    el('div', {}, [el('div', { class: 'lbl', text: t('f.space') }), optList(ICE_SPACES, f.spaces, (s) => s.fr, (s) => s.id)]),
    el('div', {}, [el('div', { class: 'lbl', text: t('f.difficulty') }), optList(DIFFICULTIES, f.difficulty, (d) => d.fr, (d) => d.id)]),
    el('div', { style: 'grid-column:1/-1' }, [el('div', { class: 'lbl', text: t('f.skill') }),
      el('div', { class: 'filters-grid' }, skillGroups)]),
  ]));

  const durLbl = el('span', { class: 'lbl', text: f.maxDuration ? `${t('f.duration')} : ${f.maxDuration} min` : `${t('f.duration')} : toutes` });
  panel.appendChild(el('div', { class: 'filters-grid mt-2' }, [
    el('label', { class: 'field' }, [durLbl,
      el('input', { type: 'range', min: '0', max: '30', step: '2', value: String(f.maxDuration),
        oninput: (e) => { f.maxDuration = +e.target.value; durLbl.textContent = f.maxDuration ? `${t('f.duration')} : ${f.maxDuration} min` : `${t('f.duration')} : toutes`; refresh(); } })]),
    el('div', {}, [el('div', { class: 'lbl', text: t('f.goalie') }), el('div', { class: 'opt-list' }, [
      toggleOpt(t('f.goalie.with'), () => f.goalie === 'with', () => { f.goalie = f.goalie === 'with' ? '' : 'with'; refresh(); }),
      toggleOpt(t('f.goalie.without'), () => f.goalie === 'without', () => { f.goalie = f.goalie === 'without' ? '' : 'without'; refresh(); }),
    ])]),
    el('div', {}, [el('div', { class: 'lbl', text: 'Autres' }), el('div', { class: 'opt-list' }, [
      toggleOpt(t('f.video'), () => f.video, () => { f.video = !f.video; refresh(); }),
      toggleOpt(t('f.fav'), () => f.fav, () => { f.fav = !f.fav; refresh(); }),
      toggleOpt(t('f.mine'), () => f.mine, () => { f.mine = !f.mine; refresh(); }),
    ])]),
  ]));
  panel.appendChild(el('button', { class: 'btn btn-sm mt-2', onclick: () => {
    // Vidage sur place : les ensembles sont capturés par les boutons du panneau.
    f.q = ''; search.value = '';
    f.ages.clear(); f.skills.clear(); f.situations.clear(); f.spaces.clear(); f.difficulty.clear();
    f.maxDuration = 0; f.goalie = ''; f.video = false; f.fav = false; f.mine = false;
    durLbl.textContent = `${t('f.duration')} : toutes`;
    const dur = panel.querySelector('input[type="range"]'); if (dur) dur.value = '0';
    syncOptions(); refresh();
  } }, [t('lib.clearFilters')]));
  wrap.appendChild(panel);

  const chipsBox = el('div', { class: 'chips' });
  const countLbl = el('p', { class: 'txt-sm txt-2', role: 'status' });
  const results = el('div');
  wrap.append(chipsBox, countLbl, results);

  function toggleOpt(label, isOn, onClick) {
    const b = el('button', { class: 'opt', 'aria-pressed': String(isOn()), text: label,
      onclick: () => { onClick(); syncOptions(); } });
    otherSyncs.push(() => b.setAttribute('aria-pressed', String(isOn())));
    return b;
  }

  function refresh() {
    chipsBox.innerHTML = '';
    for (const c of activeChips(f, () => { syncOptions(); refresh(); })) chipsBox.appendChild(c);
    let list = allDrills().filter((d) => matches(d, f));
    const sorters = {
      recent: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
      title: (a, b) => a.title.localeCompare(b.title, 'fr'),
      duration: (a, b) => a.durationMin - b.durationMin,
      difficulty: (a, b) => a.difficulty - b.difficulty,
    };
    list = list.sort(sorters[state.librarySort] || sorters.recent);
    countLbl.textContent = t('lib.results', { n: list.length });
    results.innerHTML = '';
    if (!list.length) {
      results.appendChild(el('div', { class: 'empty' }, [el('p', { text: t('lib.none') })]));
      return;
    }
    if (state.libView === 'grid') results.appendChild(cardGrid(list));
    else {
      results.appendChild(el('div', { class: 'list-rows' }, list.map((d) => el('button', {
        class: 'list-row', onclick: () => go(`#/drill/${d.id}`),
      }, [
        el('div', { class: 'th', html: thumbSvg(d) }),
        el('div', { class: 'info' }, [
          el('h3', { text: d.title }),
          el('p', { class: 'txt-sm txt-2', style: 'margin:0', text: d.summary }),
          el('div', { class: 'flex gap-1 wrap mt-1' }, [
            el('span', { class: 'badge badge-acc', text: d.ageGroups.map(labelAge).join(' · ') }),
            el('span', { class: 'badge', text: `${d.durationMin} min` }),
            el('span', { class: 'badge', text: labelSpace(d.iceSpace) }),
          ]),
        ]),
      ]))));
    }
  }
  refresh();
  return wrap;
}

/* ==========================================================================
   Écran : Fiche d'exercice
   ========================================================================== */
function viewDrill(id) {
  const d = drillById(id);
  if (!d) return notFound();
  store.pushRecent(d.id).then(async () => { state.recent = await store.getRecent(); });

  const wrap = el('div', { class: 'view-pad' });
  let seqIdx = 0;

  const diagram = el('div', { class: 'detail-diagram', html: sequenceSvg(d, 0) });
  const seqNote = el('p', { class: 'txt-sm txt-2' });
  const seqTabs = el('div', { class: 'seq-tabs' });

  function renderSeq() {
    diagram.innerHTML = sequenceSvg(d, seqIdx);
    const s = d.sequences[seqIdx];
    seqNote.textContent = s ? (s.note || '') : '';
    seqTabs.innerHTML = '';
    d.sequences.forEach((s2, i) => seqTabs.appendChild(el('button', {
      class: 'seq-item', 'aria-current': String(i === seqIdx),
      onclick: () => { seqIdx = i; renderSeq(); },
    }, [el('span', { class: 'n', text: String(i + 1) }), el('span', { text: s2.name || `Séquence ${i + 1}` }),
        el('span', { class: 'txt-2', style: 'font-size:.72rem', text: `${s2.duration}s` })])));
  }
  renderSeq();

  const isFav = () => state.favorites.includes(d.id);
  const favBtn = el('button', { class: 'btn', 'aria-pressed': String(isFav()),
    onclick: async () => { const a = await toggleFav(d.id); favBtn.setAttribute('aria-pressed', String(a));
      favBtn.classList.toggle('is-on', a); } }, ['★ ' + t('act.favorite')]);
  favBtn.classList.toggle('is-on', isFav());

  const left = el('div', {}, [
    el('div', { class: 'flex items-c gap-1 mb-1 wrap' }, [
      el('button', { class: 'btn btn-sm', onclick: () => history.back() }, ['‹ ' + t('act.back')]),
      el('h1', { style: 'margin:0;flex:1;min-width:200px', text: d.title }),
    ]),
    el('p', { class: 'txt-2', text: d.summary }),
    diagram, seqTabs, seqNote,
    el('div', { class: 'card mt-2' }, [
      el('h3', { text: t('ed.legend') }),
      el('div', { html: legendHtml(d.sequences[0] ? d.sequences[0].elements : []) }),
    ]),
    el('div', { class: 'card mt-2' }, [
      el('h3', { text: t('drill.description') }),
      el('p', { text: d.description }),
      d.objectives.length ? el('div', {}, [el('h4', { text: t('drill.objectives') }),
        el('ul', { class: 'bul' }, d.objectives.map((o) => el('li', { text: o })))]) : null,
      el('h4', { text: t('drill.setup') }), el('p', { text: d.setup }),
      el('h4', { text: t('drill.steps') }),
      el('ol', { class: 'steps' }, d.steps.map((s) => el('li', { text: s }))),
    ]),
    el('div', { class: 'card mt-2' }, [
      el('h3', { text: t('drill.teaching') }),
      el('ul', { class: 'bul' }, d.teachingPoints.map((s) => el('li', { text: s }))),
      d.commonErrors.length ? el('div', {}, [el('h4', { text: t('drill.errors') }),
        el('ul', { class: 'bul' }, d.commonErrors.map((s) => el('li', { text: s })))]) : null,
      d.variationsEasier.length ? el('div', {}, [el('h4', { text: t('drill.easier') }),
        el('ul', { class: 'bul' }, d.variationsEasier.map((s) => el('li', { text: s })))]) : null,
      d.variationsHarder.length ? el('div', {}, [el('h4', { text: t('drill.harder') }),
        el('ul', { class: 'bul' }, d.variationsHarder.map((s) => el('li', { text: s })))]) : null,
      d.safety.length ? el('div', {}, [el('h4', { text: t('drill.safety') }),
        el('ul', { class: 'bul' }, d.safety.map((s) => el('li', { text: s })))]) : null,
    ]),
  ]);

  /* Colonne de droite */
  const right = el('div', { class: 'stack' }, [
    el('div', { class: 'card stack' }, [
      el('button', { class: 'btn btn-primary btn-block', onclick: () => editDrill(d) }, [t('act.edit')]),
      favBtn,
      el('button', { class: 'btn btn-block', onclick: () => duplicateDrill(d) }, [t('act.duplicate')]),
      el('button', { class: 'btn btn-block', onclick: () => addToPlanDialog(d) }, [t('act.addToPlan')]),
      el('button', { class: 'btn btn-block', onclick: () => exportDialog(d, seqIdx) }, [t('act.export')]),
      !d.isDemo ? el('button', { class: 'btn btn-block btn-danger', onclick: async () => {
        if (!(await confirmDialog(t('msg.confirmDelete', { t: d.title })))) return;
        await deleteDrill(d.id); toast(t('msg.deleted'), 'ok'); go('#/bibliotheque');
      } }, [t('act.delete')]) : null,
    ]),
    el('div', { class: 'card' }, [
      el('h3', { text: 'Renseignements' }),
      el('dl', { class: 'kv' }, [
        ...kv(t('drill.age'), d.ageGroups.map(labelAge).join(', ')),
        ...kv(t('drill.level'), labelDiff(d.difficulty)),
        ...kv(t('drill.duration'), fmtDuration(d.durationMin)),
        ...kv(t('drill.space'), labelSpace(d.iceSpace)),
        ...kv(t('drill.players'), `${d.playersMin} à ${d.playersMax}`),
        ...kv(t('drill.goalies'), String(d.goalies)),
        ...kv(t('drill.situation'), d.situations.map(labelSituation).join(', ') || '—'),
        ...kv(t('drill.equipment'), d.equipment.join(', ') || '—'),
        ...kv(t('drill.author'), d.author),
        ...kv(t('drill.created'), fmtDate(d.createdAt)),
        ...kv(t('drill.updated'), fmtDate(d.updatedAt)),
      ]),
      el('h4', { class: 'mt-2', text: t('drill.skills') }),
      el('div', { class: 'flex gap-1 wrap' }, d.skills.map((s) => el('span', { class: 'badge', text: labelSkill(s) }))),
      d.keywords.length ? el('div', { class: 'mt-2' }, [
        el('h4', { text: t('drill.keywords') }),
        el('div', { class: 'flex gap-1 wrap' }, d.keywords.map((k) => el('span', { class: 'badge', text: k }))),
      ]) : null,
    ]),
    videoCard(d),
    d.source ? el('div', { class: 'card' }, [
      el('h3', { text: t('drill.source') }),
      el('p', { class: 'txt-sm', style: 'margin:0', text: d.source.name }),
      d.source.url ? el('a', { class: 'txt-sm', href: safeUrl(d.source.url), target: '_blank', rel: 'noopener noreferrer',
        text: 'Ouvrir le site d’origine ↗' }) : null,
      d.source.external ? el('p', { class: 'notice mt-1', text: t('legal.external') }) : null,
      d.isDemo ? el('p', { class: 'notice mt-1', text: t('legal.demoOrigin') }) : null,
    ]) : null,
    el('div', { class: 'notice notice-warn', text: t('legal.disclaimer') }),
  ]);

  wrap.appendChild(el('div', { class: 'detail-wrap' }, [left, right]));
  return wrap;
}

const kv = (k, v) => [el('dt', { text: k }), el('dd', { text: v })];

function videoCard(d) {
  const box = el('div', { class: 'card stack' }, [el('h3', { text: t('drill.video') })]);
  if (!d.videos || !d.videos.length) {
    box.appendChild(el('p', { class: 'txt-sm txt-2', text: 'Aucune vidéo associée.' }));
    return box;
  }
  box.appendChild(videoBlock(d.videos));
  return box;
}

function notFound() {
  return el('div', { class: 'view-pad' }, [el('div', { class: 'empty' }, [
    el('h2', { text: 'Introuvable' }),
    el('p', { text: 'Cet élément n’existe plus sur cet appareil.' }),
    el('a', { class: 'btn', href: '#/bibliotheque', text: t('nav.library') }),
  ])]);
}

/* ==========================================================================
   Actions sur un exercice
   ========================================================================== */
async function duplicateDrill(d) {
  const copy = deepCopy(d);
  copy.id = uid('drill');
  copy.title = d.title + ' (copie)';
  copy.isDemo = false;
  copy.author = 'Moi';
  copy.visibility = 'prive';
  copy.createdAt = copy.updatedAt = nowIso();
  copy.sequences = copy.sequences.map((s) => ({ ...s, id: uid('seq'),
    elements: s.elements.map((e) => ({ ...e, id: uid('el') })) }));
  await saveDrill(copy);
  toast(t('msg.duplicated'), 'ok');
  go(`#/editeur/${copy.id}`);
  return copy;
}

async function editDrill(d) {
  if (d.isDemo) {
    toast('Les exercices de démonstration sont en lecture seule : une copie modifiable a été créée.', 'info', 5000);
    await duplicateDrill(d);
    return;
  }
  go(`#/editeur/${d.id}`);
}

function addToPlanDialog(d) {
  const body = el('div', { class: 'stack' });
  if (!state.plans.length) {
    body.appendChild(el('p', { text: 'Aucun plan de pratique. Crée-en un d’abord.' }));
    body.appendChild(el('button', { class: 'btn btn-primary', onclick: async () => {
      const p = newPlan();
      p.items.push({ id: uid('pi'), type: 'drill', drillId: d.id, title: d.title, duration: d.durationMin });
      await savePlan(p); closeModal(); go(`#/plan/${p.id}`);
    } }, ['Créer un plan avec cet exercice']));
  } else {
    for (const p of state.plans) {
      body.appendChild(el('button', { class: 'list-row', onclick: async () => {
        p.items.push({ id: uid('pi'), type: 'drill', drillId: d.id, title: d.title, duration: d.durationMin });
        await savePlan(p);
        toast(t('msg.addedToPlan', { t: p.title }), 'ok');
        closeModal();
      } }, [el('div', { class: 'info' }, [
        el('h3', { text: p.title }),
        el('span', { class: 'txt-sm txt-2', text: `${labelAge(p.ageGroup)} · ${planTotal(p)}/${p.plannedDuration} min` }),
      ])]));
    }
  }
  openModal(t('act.addToPlan'), body, [el('button', { class: 'btn', onclick: closeModal }, [t('act.close')])]);
}

/* ---------- Boîte d'exportation ---------- */
function exportDialog(d, seqIdx = 0) {
  const opt = { ...DEFAULT_EXPORT_OPTIONS };
  const checks = [
    ['includeTitle', 'Titre'], ['includeDiagram', 'Diagramme'], ['includeLegend', 'Légende'],
    ['includeDescription', 'Description et déroulement'], ['includeTeachingPoints', 'Points d’enseignement'],
    ['includeDuration', 'Durée et catégorie'], ['includeEquipment', 'Équipement'],
    ['includeSource', 'Source'], ['includeQrCode', 'Code QR vers la fiche partagée'],
  ];
  const qrBox = el('div', { class: 'mt-2' });
  const body = el('div', { class: 'stack' }, [
    el('h4', { text: t('exp.options') }),
    el('div', {}, checks.map(([k, label]) => el('label', { class: 'chk' }, [
      el('input', { type: 'checkbox', checked: opt[k], onchange: (e) => { opt[k] = e.target.checked; if (k === 'includeQrCode') updateQr(); } }),
      el('span', { text: label }),
    ]))),
    qrBox,
    el('hr', { class: 'sep' }),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', onclick: () => exportPng(d, seqIdx) }, [t('exp.png')]),
      el('button', { class: 'btn', onclick: () => exportSvg(d, seqIdx) }, [t('exp.svg')]),
      el('button', { class: 'btn', onclick: () => copyPngToClipboard(d, seqIdx) }, [t('exp.copyImg')]),
    ]),
    el('div', { class: 'row' }, [
      el('button', { class: 'btn', onclick: () => exportJson(bundle({ drills: [d] }), `${slug(d.title)}.json`) }, [t('exp.json')]),
      el('button', { class: 'btn', onclick: async () => {
        const url = opt.includeQrCode ? await shareLink(d) : '';
        printHtml(drillPrintHtml(d, opt, url));
      } }, [t('exp.print')]),
      el('button', { class: 'btn', onclick: () => copyShareLink(d) }, [t('exp.link')]),
    ]),
    el('button', { class: 'btn btn-primary btn-block', onclick: async () => shareOrCopy(await drillCoachLink(d), d.title) },
      ['Lien pour les coachs (diagramme, vidéo, points clés)']),
    el('p', { class: 'hint', text: 'Le lien de partage contient l’exercice complet : il fonctionne sans serveur, mais reste long. Pour un envoi par courriel, préfère le fichier JSON.' }),
  ]);
  async function updateQr() {
    qrBox.innerHTML = '';
    if (!opt.includeQrCode) return;
    const url = await shareLink(d);
    const svg = qrSvg(url, 150);
    qrBox.appendChild(svg
      ? el('div', { html: svg })
      : el('p', { class: 'err-msg', text: 'Cet exercice est trop volumineux pour tenir dans un code QR. Utilise le lien ou le fichier JSON.' }));
  }
  openModal(t('act.export'), body, [el('button', { class: 'btn', onclick: closeModal }, [t('act.close')])]);
}

/* ==========================================================================
   Formulaire de la fiche (métadonnées)
   ========================================================================== */
function drillFormModal(d, onDone) {
  const chipsField = (label, items, selected, getId, getLabel) => {
    const set = new Set(selected);
    const box = el('div', { class: 'opt-list' }, items.map((it) => {
      const id = getId(it);
      const b = el('button', { type: 'button', class: 'opt', 'aria-pressed': String(set.has(id)), text: getLabel(it),
        onclick: () => { set.has(id) ? set.delete(id) : set.add(id); b.setAttribute('aria-pressed', String(set.has(id))); } });
      return b;
    }));
    return { node: el('div', { class: 'field' }, [el('span', { class: 'lbl', text: label }), box]), set };
  };

  const f = {};
  const txt = (key, label, val, type = 'text') => {
    const inp = el('input', { class: 'inp', type, value: val == null ? '' : String(val) });
    f[key] = () => inp.value;
    return el('label', { class: 'field' }, [el('span', { class: 'lbl', text: label }), inp]);
  };
  const area = (key, label, val, rows = 3, hint = '') => {
    const inp = el('textarea', { class: 'inp', rows: String(rows) });
    inp.value = val || '';
    f[key] = () => inp.value;
    return el('label', { class: 'field' }, [el('span', { class: 'lbl', text: label }), inp,
      hint ? el('span', { class: 'hint', text: hint }) : null]);
  };
  const lines = (key, label, arr, hint = 'Une ligne par élément.') => area(key, label, (arr || []).join('\n'), 4, hint);

  const ages = chipsField(t('drill.age'), AGE_GROUPS, d.ageGroups, (a) => a.id, (a) => a.fr);
  const skills = chipsField(t('drill.skills'), SKILLS, d.skills, (s) => s.id, (s) => s.fr);
  const sits = chipsField(t('drill.situation'), SITUATIONS, d.situations, (s) => s.id, (s) => s.fr);

  const diffSel = el('select', { class: 'inp' }, DIFFICULTIES.map((x) =>
    el('option', { value: String(x.id), selected: x.id === d.difficulty, text: `${x.id} — ${x.fr}` })));
  const spaceSel = el('select', { class: 'inp' }, ICE_SPACES.map((x) =>
    el('option', { value: x.id, selected: x.id === d.iceSpace, text: x.fr })));
  const visSel = el('select', { class: 'inp' }, VISIBILITIES.map((x) =>
    el('option', { value: x.id, selected: x.id === d.visibility, text: x.fr })));

  // Vidéo
  const vid = (d.videos && d.videos[0]) || { url: '', title: '', note: '' };
  const vidUrl = el('input', { class: 'inp', type: 'url', value: vid.url, placeholder: 'https://…' });
  const vidTitle = el('input', { class: 'inp', value: vid.title || '' });
  const vidNote = el('input', { class: 'inp', value: vid.note || '' });
  const vidErr = el('div', { class: 'err-msg', style: 'display:none' });
  vidUrl.addEventListener('input', () => {
    const ok = !vidUrl.value.trim() || !!safeUrl(vidUrl.value);
    vidUrl.setAttribute('aria-invalid', String(!ok));
    vidErr.style.display = ok ? 'none' : 'block';
    vidErr.textContent = ok ? '' : t('msg.badUrl');
  });

  const body = el('div', {}, [
    txt('title', t('drill.title'), d.title),
    txt('summary', t('drill.summary'), d.summary),
    area('description', t('drill.description'), d.description, 4),
    lines('objectives', t('drill.objectives'), d.objectives),
    ages.node,
    el('div', { class: 'row' }, [
      el('label', { class: 'field' }, [el('span', { class: 'lbl', text: t('drill.level') }), diffSel]),
      el('label', { class: 'field' }, [el('span', { class: 'lbl', text: t('drill.space') }), spaceSel]),
      el('label', { class: 'field' }, [el('span', { class: 'lbl', text: t('drill.visibility') }), visSel]),
    ]),
    skills.node, sits.node,
    el('div', { class: 'row' }, [
      txt('playersMin', 'Joueurs (min)', d.playersMin, 'number'),
      txt('playersMax', 'Joueurs (max)', d.playersMax, 'number'),
      txt('goalies', t('drill.goalies'), d.goalies, 'number'),
      txt('durationMin', 'Durée (min)', d.durationMin, 'number'),
    ]),
    lines('equipment', t('drill.equipment'), d.equipment, 'Une ligne par article.'),
    area('setup', t('drill.setup'), d.setup, 3),
    lines('steps', t('drill.steps'), d.steps, 'Une étape par ligne, dans l’ordre.'),
    lines('teachingPoints', t('drill.teaching'), d.teachingPoints),
    lines('commonErrors', t('drill.errors'), d.commonErrors),
    lines('variationsEasier', t('drill.easier'), d.variationsEasier),
    lines('variationsHarder', t('drill.harder'), d.variationsHarder),
    lines('safety', t('drill.safety'), d.safety),
    lines('keywords', t('drill.keywords'), d.keywords, 'Un mot-clé par ligne.'),
    el('hr', { class: 'sep' }),
    el('h4', { text: t('drill.video') }),
    el('label', { class: 'field' }, [el('span', { class: 'lbl', text: 'Adresse de la vidéo' }), vidUrl, vidErr,
      el('span', { class: 'hint', text: 'YouTube et Vimeo sont intégrés avec le lecteur officiel. Toute autre adresse s’affiche comme lien vers le site source.' })]),
    el('label', { class: 'field' }, [el('span', { class: 'lbl', text: 'Titre de la vidéo' }), vidTitle]),
    el('label', { class: 'field' }, [el('span', { class: 'lbl', text: 'Note personnelle' }), vidNote]),
    el('p', { class: 'notice', text: t('legal.noMinors') }),
  ]);

  const splitLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  openModal(t('ed.info'), body, [
    el('button', { class: 'btn', onclick: closeModal }, [t('act.cancel')]),
    el('button', { class: 'btn btn-primary', onclick: () => {
      const title = f.title().trim();
      if (!title) { toast(t('msg.titleRequired'), 'err'); return; }
      if (vidUrl.value.trim() && !safeUrl(vidUrl.value)) { toast(t('msg.badUrl'), 'err'); return; }
      d.title = title;
      d.summary = f.summary().trim();
      d.description = f.description().trim();
      d.objectives = splitLines(f.objectives());
      d.ageGroups = [...ages.set];
      d.skills = [...skills.set];
      d.situations = [...sits.set];
      d.difficulty = clamp(+diffSel.value || 3, 1, 5);
      d.iceSpace = spaceSel.value;
      d.visibility = visSel.value;
      d.playersMin = clamp(+f.playersMin() || 1, 1, 40);
      d.playersMax = clamp(+f.playersMax() || d.playersMin, d.playersMin, 60);
      d.goalies = clamp(+f.goalies() || 0, 0, 4);
      d.durationMin = clamp(+f.durationMin() || 10, 1, 120);
      d.equipment = splitLines(f.equipment());
      d.setup = f.setup().trim();
      d.steps = splitLines(f.steps());
      d.teachingPoints = splitLines(f.teachingPoints());
      d.commonErrors = splitLines(f.commonErrors());
      d.variationsEasier = splitLines(f.variationsEasier());
      d.variationsHarder = splitLines(f.variationsHarder());
      d.safety = splitLines(f.safety());
      d.keywords = splitLines(f.keywords());
      const u = safeUrl(vidUrl.value);
      if (u) {
        const info = parseVideoUrl(u);
        d.videos = [{
          id: (d.videos && d.videos[0] && d.videos[0].id) || uid('vid'),
          url: u, provider: info ? info.provider : 'externe',
          title: vidTitle.value.trim(), sourceName: info ? info.sourceName : '',
          thumbnail: info ? info.thumbnail : '', startAt: info ? info.startAt : 0,
          note: vidNote.value.trim(),
        }];
      } else d.videos = [];
      closeModal();
      onDone && onDone(d);
    } }, [t('act.apply')]),
  ]);
}

/* ==========================================================================
   Écran : Éditeur
   ========================================================================== */
function blankDrill() {
  const now = nowIso();
  return {
    id: uid('drill'), schemaVersion: 1,
    title: '', summary: '', description: '', objectives: [],
    ageGroups: ['u11'], difficulty: 2, skills: [], situations: [],
    playersMin: 6, playersMax: 18, goalies: 0, durationMin: 10, iceSpace: 'pleine',
    equipment: [], setup: '', steps: [], teachingPoints: [], commonErrors: [],
    variationsEasier: [], variationsHarder: [], safety: [], keywords: [],
    surface: 'full',
    sequences: [{ id: uid('seq'), name: 'Séquence 1', duration: 4, note: '', elements: [] }],
    videos: [], source: { id: 'src_own', name: 'Mes exercices', url: '', external: false },
    author: 'Moi', visibility: 'prive', isDemo: false,
    createdAt: now, updatedAt: now,
  };
}

function viewEditor(id) {
  let drill;
  if (id) {
    const found = drillById(id);
    if (!found) return notFound();
    if (found.isDemo) {
      // Lecture seule : on ouvre une copie de travail.
      drill = deepCopy(found);
      drill.id = uid('drill'); drill.isDemo = false;
      drill.title = found.title + ' (copie)';
      drill.author = 'Moi'; drill.visibility = 'prive';
      drill.createdAt = drill.updatedAt = nowIso();
      toast('Copie modifiable créée à partir de l’exercice de démonstration.', 'info', 4500);
    } else drill = deepCopy(found);
  } else {
    drill = blankDrill();
  }

  if (state.editor) { state.editor.destroy(); state.editor = null; }

  const wrap = el('div', { style: 'height:100%' });
  const ed = createEditor({
    drill,
    grid: state.settings.gridVisible,
    snap: state.settings.snapToGrid,
    onBack: () => { if (confirmLeave()) go('#/bibliotheque'); },
    onInfo: () => drillFormModal(drill, () => { /* champs mis à jour en place */ }),
    onExport: () => exportDialog(drill, ed.currentSequenceIndex()),
    onSave: async (d) => {
      if (!d.summary) d.summary = d.description.slice(0, 140) || 'Exercice personnel.';
      await saveDrill(d);
      toast(t('msg.saveOk'), 'ok');
      if (location.hash !== `#/editeur/${d.id}`) history.replaceState(null, '', `#/editeur/${d.id}`);
    },
    onDirty: (dirty) => { dirtyFlag = dirty; },
  });
  state.editor = ed;
  wrap.appendChild(ed.root);
  return wrap;
}

let dirtyFlag = false;
function confirmLeave() {
  if (!dirtyFlag) return true;
  // eslint-disable-next-line no-alert
  return window.confirm(t('msg.unsaved'));
}

/* ==========================================================================
   Écran : Paramètres
   ========================================================================== */
function viewSettings() {
  const s = state.settings;
  const wrap = el('div', { class: 'view-pad' });
  wrap.appendChild(el('h1', { text: t('nav.settings') }));

  const apply = debounce(async () => { await store.saveSettings(s); applySettings(); }, 200);

  wrap.appendChild(el('div', { class: 'card mb-2' }, [
    el('h3', { text: 'Affichage' }),
    el('div', { class: 'row' }, [
      el('label', { class: 'field' }, [el('span', { class: 'lbl', text: t('set.language') }),
        el('select', { class: 'inp', onchange: (e) => { s.locale = e.target.value; setLocale(s.locale); apply(); rerender(); } },
          availableLocales().map((l) => el('option', { value: l.id, selected: l.id === s.locale, text: l.label })))]),
      el('label', { class: 'field' }, [el('span', { class: 'lbl', text: t('set.theme') }),
        el('select', { class: 'inp', onchange: (e) => { s.theme = e.target.value; apply(); } },
          [['auto', t('set.theme.auto')], ['dark', t('set.theme.dark')], ['light', t('set.theme.light')]].map(([v, l]) =>
            el('option', { value: v, selected: s.theme === v, text: l })))]),
      el('label', { class: 'field' }, [el('span', { class: 'lbl', text: t('set.textSize') }),
        el('select', { class: 'inp', onchange: (e) => { s.textSize = e.target.value; apply(); } },
          [['m', 'Normale'], ['l', 'Grande'], ['xl', 'Très grande']].map(([v, l]) =>
            el('option', { value: v, selected: s.textSize === v, text: l })))]),
    ]),
    el('label', { class: 'chk' }, [
      el('input', { type: 'checkbox', checked: s.contrast === 'high',
        onchange: (e) => { s.contrast = e.target.checked ? 'high' : 'normal'; apply(); } }),
      el('span', { text: t('set.contrast') }),
    ]),
    el('label', { class: 'chk' }, [
      el('input', { type: 'checkbox', checked: s.snapToGrid, onchange: (e) => { s.snapToGrid = e.target.checked; apply(); } }),
      el('span', { text: 'Aimanter à la grille par défaut dans l’éditeur' }),
    ]),
    el('label', { class: 'chk' }, [
      el('input', { type: 'checkbox', checked: s.gridVisible, onchange: (e) => { s.gridVisible = e.target.checked; apply(); } }),
      el('span', { text: 'Afficher la grille par défaut' }),
    ]),
  ]));

  const stats = el('p', { class: 'txt-sm txt-2' });
  store.storageEstimate().then((e) => {
    const mode = state.storageMode === 'idb' ? 'IndexedDB' : 'localStorage (mode de repli)';
    stats.textContent = e
      ? `Stockage : ${mode} — ${(e.usage / 1048576).toFixed(1)} Mo utilisés.`
      : `Stockage : ${mode}.`;
  });

  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none',
    onchange: async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const parsed = parseBundle(text);
      if (!parsed) { toast(t('msg.badFile'), 'err'); return; }
      let n = 0;
      for (const d of parsed.drills) {
        d.id = d.id && !drillById(d.id) ? d.id : uid('drill');
        d.isDemo = false;
        await saveDrill(d); n++;
      }
      for (const p of parsed.plans) {
        p.id = p.id && !state.plans.find((x) => x.id === p.id) ? p.id : uid('plan');
        await savePlan(p); n++;
      }
      if (parsed.favorites && parsed.favorites.length) {
        const merged = [...new Set([...state.favorites, ...parsed.favorites])];
        await store.setMeta('favorites', merged);
        state.favorites = merged;
      }
      toast(t('msg.imported', { n }), 'ok');
      e.target.value = '';
      rerender();
    } });

  wrap.appendChild(el('div', { class: 'card mb-2' }, [
    el('h3', { text: t('set.data') }),
    stats,
    el('p', { class: 'txt-sm', text: t('app.localData') }),
    el('div', { class: 'row mt-1' }, [
      el('button', { class: 'btn', onclick: () => {
        const data = bundle({ drills: state.userDrills, plans: state.plans, favorites: state.favorites, settings: s });
        if (!data.drills.length && !data.plans.length) { toast(t('msg.nothingToExport'), 'warn'); return; }
        exportJson(data, `drillbuilder-${new Date().toISOString().slice(0, 10)}.json`);
      } }, [t('set.exportAll')]),
      el('button', { class: 'btn', onclick: () => fileInput.click() }, [t('set.importAll')]),
      el('button', { class: 'btn btn-danger', onclick: async () => {
        if (!(await confirmDialog(t('msg.confirmWipe')))) return;
        await store.wipeAll();
        state.userDrills = []; state.plans = []; state.favorites = []; state.recent = [];
        state.settings = await store.getSettings();
        applySettings(); toast('Toutes les données locales ont été effacées.', 'ok'); go('#/');
      } }, [t('set.wipe')]),
    ]),
    fileInput,
  ]));

  const installBtn = el('button', { class: 'btn', disabled: !state.installPrompt, onclick: async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    const r = await state.installPrompt.userChoice;
    if (r && r.outcome === 'accepted') toast(t('msg.installed'), 'ok');
    state.installPrompt = null; installBtn.disabled = true;
  } }, [t('set.install')]);

  wrap.appendChild(el('div', { class: 'card mb-2' }, [
    el('h3', { text: t('set.install') }),
    installBtn,
    el('p', { class: 'txt-sm txt-2 mt-1', text: t('msg.installHelpIos') }),
  ]));

  wrap.appendChild(el('div', { class: 'card mb-2' }, [
    el('h3', { text: t('set.privacy') }),
    el('ul', { class: 'bul' }, [
      el('li', { text: 'Aucun compte, aucune inscription, aucune donnée envoyée sur Internet.' }),
      el('li', { text: 'Aucun cookie de suivi, aucune publicité, aucun outil d’analyse.' }),
      el('li', { text: 'Les exercices, plans et favoris restent dans le stockage de ce navigateur.' }),
      el('li', { text: 'Le bouton « Effacer toutes mes données » supprime tout, sans reste.' }),
      el('li', { text: t('legal.noMinors') }),
    ]),
    el('label', { class: 'chk' }, [
      el('input', { type: 'checkbox', checked: s.analyticsConsent,
        onchange: (e) => { s.analyticsConsent = e.target.checked; apply(); } }),
      el('span', { text: 'J’accepte une mesure d’usage anonyme (aucune n’est active dans cette version)' }),
    ]),
  ]));

  wrap.appendChild(el('div', { class: 'card mb-2' }, [
    el('h3', { text: t('set.symbols') }),
    el('p', { class: 'txt-sm txt-2', text: 'Tous les symboles, leur nom et leur sens.' }),
    el('a', { class: 'btn', href: '#/symboles', text: 'Ouvrir le guide' }),
  ]));

  wrap.appendChild(el('div', { class: 'card' }, [
    el('h3', { text: t('set.about') }),
    el('p', { class: 'txt-sm', text: `${t('app.name')} — prototype hors ligne. Symboles, diagrammes et exercices de démonstration créés pour cette application.` }),
    el('p', { class: 'notice', text: t('legal.demoOrigin') }),
    el('p', { class: 'notice notice-warn', text: t('legal.disclaimer') }),
  ]));

  return wrap;
}

/* ==========================================================================
   Écran : Guide des symboles
   ========================================================================== */
function viewSymbols() {
  const wrap = el('div', { class: 'view-pad' });
  wrap.appendChild(el('h1', { text: t('set.symbols') }));
  wrap.appendChild(el('p', { class: 'txt-2', text: 'Les symboles marqués « Légende officielle » suivent la convention utilisée par Hockey Canada et Hockey Québec : un entraîneur d’une autre équipe lit le diagramme sans explication. Les « compléments » sont propres à l’application — mets-les en légende si le diagramme sort de ton club.' }));
  wrap.appendChild(el('p', { class: 'txt-2 txt-sm', text: 'Chaque symbole se distingue par sa forme, pas seulement par sa couleur : les diagrammes restent lisibles en noir et blanc et à l’impression.' }));

  const grid = (title, entries) => {
    const box = el('section', { class: 'mt-3' }, [el('h2', { text: title })]);
    box.appendChild(el('div', { class: 'grid-cards' }, entries.map(({ icon, name, tip, official }) => el('div', { class: 'card' }, [
      el('div', { style: 'width:64px;height:64px;color:var(--tx-0);background:var(--ice);border-radius:10px;padding:4px', html: icon }),
      el('div', { class: 'flex items-c gap-1 wrap mt-1' }, [
        el('h3', { style: 'margin:0', text: name }),
        official
          ? el('span', { class: 'badge badge-ok', text: 'Légende officielle' })
          : el('span', { class: 'badge', text: 'Complément' }),
      ]),
      el('p', { class: 'txt-sm txt-2', style: 'margin:4px 0 0', text: tip }),
    ]))));
    return box;
  };

  const objEntries = (ids) => ids.map((id) => ({
    icon: objectIcon(id, OBJECTS[id].defColor || '#12212e'),
    name: OBJECTS[id].fr, tip: OBJECTS[id].tip, official: OBJECTS[id].official,
  }));
  wrap.appendChild(grid('Joueurs et personnes',
    objEntries(['player', 'opponent', 'forward', 'defence', 'center', 'winger', 'goalie', 'coach'])));
  wrap.appendChild(grid('Équipement et objets',
    objEntries(['puck', 'pucks', 'cone', 'net', 'mini-net', 'tire', 'stick', 'obstacle', 'zone', 'text', 'step'])));
  wrap.appendChild(grid('Trajectoires',
    Object.keys(PATH_STYLES).map((id) => ({ icon: pathIcon(id, '#12212e'),
      name: PATH_STYLES[id].fr, tip: PATH_STYLES[id].tip, official: PATH_STYLES[id].official }))));
  wrap.appendChild(grid('Extrémités de ligne',
    Object.keys(CAPS).map((id) => ({ icon: capIcon(id, '#12212e'),
      name: CAPS[id].fr, tip: CAPS[id].tip, official: CAPS[id].official }))));

  wrap.appendChild(el('section', { class: 'mt-3' }, [
    el('h2', { text: 'Surfaces de glace' }),
    el('div', { class: 'flex gap-1 wrap' }, SURFACES.map((s) => el('span', { class: 'badge', text: s.fr }))),
  ]));

  wrap.appendChild(el('div', { class: 'card mt-3' }, [
    el('h3', { text: 'Raccourcis clavier' }),
    el('dl', { class: 'kv' }, [
      ...kv('Ctrl/Cmd + Z', t('act.undo')),
      ...kv('Ctrl/Cmd + Maj + Z', t('act.redo')),
      ...kv('Ctrl/Cmd + C / V', 'Copier / coller'),
      ...kv('Ctrl/Cmd + D', 'Dupliquer la sélection'),
      ...kv('Ctrl/Cmd + A', 'Tout sélectionner'),
      ...kv('Ctrl/Cmd + S', t('act.save')),
      ...kv('Suppr / Retour arrière', 'Effacer la sélection'),
      ...kv('Échap', 'Désélectionner ou abandonner un tracé'),
      ...kv('Entrée', 'Terminer le tracé en cours'),
      ...kv('Espace', 'Lecture / pause de l’animation'),
      ...kv('Flèches', 'Déplacement précis (Maj = pas de grille)'),
      ...kv('V / H / G', 'Sélection / main / grille'),
    ]),
  ]));
  return wrap;
}

/* ==========================================================================
   Réception d'un exercice partagé
   ========================================================================== */
async function viewShared(payload) {
  const wrap = el('div', { class: 'view-pad' });
  const d = await readShareLink(payload);
  if (!d) {
    wrap.appendChild(el('div', { class: 'empty' }, [
      el('h2', { text: 'Lien illisible' }),
      el('p', { text: 'Ce lien de partage est incomplet ou a été tronqué par la messagerie qui l’a transmis.' }),
      el('a', { class: 'btn', href: '#/', text: t('nav.home') }),
    ]));
    return wrap;
  }
  wrap.append(
    el('h1', { text: 'Exercice reçu' }),
    el('p', { class: 'txt-2', text: 'Cet exercice provient d’un lien de partage. Il n’est pas encore enregistré sur cet appareil.' }),
    el('div', { class: 'card' }, [
      el('h2', { text: d.title }),
      el('p', { text: d.summary || '' }),
      el('div', { class: 'detail-diagram', html: sequenceSvg(d, 0) }),
      el('div', { class: 'row mt-2' }, [
        el('button', { class: 'btn btn-primary', onclick: async () => {
          d.id = uid('drill'); d.isDemo = false;
          d.createdAt = d.updatedAt = nowIso();
          await saveDrill(d);
          toast(t('msg.saveOk'), 'ok');
          go(`#/drill/${d.id}`);
        } }, ['Enregistrer sur cet appareil']),
        el('button', { class: 'btn', onclick: () => go('#/') }, [t('act.cancel')]),
      ]),
    ]),
  );
  return wrap;
}

/* ==========================================================================
   Routeur
   ========================================================================== */
function go(hash) { if (location.hash === hash) rerender(); else location.hash = hash; }

let currentView = null;
async function rerender() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\//, '').split('/');
  const [route, param] = parts;

  if (state.editor && route !== 'editeur') { state.editor.destroy(); state.editor = null; dirtyFlag = false; }
  closeModal();
  viewport.innerHTML = '';
  setActiveNav(hash);
  // Les coachs reçoivent une page épurée, sans la navigation de l'application.
  if (route === 'coachs') document.body.dataset.mode = 'coach';
  else delete document.body.dataset.mode;

  let node;
  switch (route) {
    case '': node = viewHome(); break;
    case 'bibliotheque': node = viewLibrary(); break;
    case 'drill': node = viewDrill(param); break;
    case 'editeur': node = viewEditor(param); break;
    case 'plans': node = viewPlansList(ctx); break;
    case 'plan': {
      const p = state.plans.find((x) => x.id === param);
      node = p ? viewPlanEditor(ctx, p) : notFound();
      break;
    }
    case 'parametres': node = viewSettings(); break;
    case 'symboles': node = viewSymbols(); break;
    case 'partage': node = await viewShared(parts.slice(1).join('/')); break;
    case 'coachs': node = await viewCoach(parts.slice(1).join('/')); break;
    default: node = notFound();
  }
  const view = el('div', { class: 'view' }, [node]);
  viewport.appendChild(view);
  currentView = route;
  if (route !== 'editeur') view.scrollTop = 0;
  document.title = `${t('app.name')} — ${routeTitle(route)}`;
}

function routeTitle(r) {
  return ({ '': t('nav.home'), bibliotheque: t('nav.library'), drill: t('drill.title'),
    editeur: t('nav.editor'), plans: t('nav.plans'), plan: t('nav.plans'),
    parametres: t('nav.settings'), symboles: t('set.symbols'), coachs: 'Version coachs' })[r] || t('app.name');
}

window.addEventListener('hashchange', () => {
  if (currentView === 'editeur' && !location.hash.startsWith('#/editeur') && !confirmLeave()) {
    history.forward();
    return;
  }
  rerender();
});

/* ==========================================================================
   Réglages appliqués au document
   ========================================================================== */
function applySettings() {
  const s = state.settings;
  const html = document.documentElement;
  // « auto » ne pose aucun attribut : la feuille de style laisse alors
  // prefers-color-scheme décider, ce qui respecte le réglage de l'appareil.
  if (s.theme === 'auto') delete html.dataset.theme;
  else html.dataset.theme = s.theme;
  html.dataset.contrast = s.contrast;
  html.dataset.textsize = s.textSize;
  setLocale(s.locale);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const light = s.theme === 'light'
      || (s.theme === 'auto' && window.matchMedia
          && window.matchMedia('(prefers-color-scheme: light)').matches);
    meta.setAttribute('content', light ? '#f4f7fa' : '#0d1218');
  }
}

/* ==========================================================================
   Démarrage
   ========================================================================== */
async function boot() {
  state.storageMode = await store.storageMode();
  state.settings = await store.getSettings();
  applySettings();

  state.seeds = seedDrills();
  state.userDrills = (await store.getAll('drills')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  state.plans = (await store.getAll('plans')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  state.favorites = await store.getFavorites();
  state.recent = await store.getRecent();

  await rerender();

  window.addEventListener('online', () => toast(t('msg.online'), 'ok', 2200));
  window.addEventListener('offline', () => toast(t('msg.offline'), 'warn', 4000));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try { await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: './' }); }
    catch { /* le mode hors-ligne restera limité au cache du navigateur */ }
  }
}

boot().catch((e) => {
  console.error(e);
  viewport.appendChild(el('div', { class: 'view-pad' }, [
    el('div', { class: 'empty' }, [
      el('h2', { text: 'Démarrage impossible' }),
      el('p', { text: 'Une erreur est survenue au chargement. Recharge la page ; si le problème persiste, vide le cache du navigateur.' }),
      el('pre', { class: 'txt-sm', text: String(e && e.message || e) }),
    ]),
  ]));
});
