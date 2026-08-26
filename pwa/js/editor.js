/**
 * Éditeur de patinoire.
 *
 * Choix techniques :
 *  – le canevas est un SVG, pas un <canvas> bitmap. Le test de survol, la
 *    sélection, le zoom et l'export vectoriel deviennent triviaux, et le
 *    diagramme reste net à l'impression comme sur un écran Retina ;
 *  – les entrées passent par les Pointer Events, donc souris, doigt et stylet
 *    suivent exactement le même chemin de code ;
 *  – l'annulation conserve des instantanés complets des séquences. Sur des
 *    diagrammes de quelques dizaines d'éléments, c'est plus sûr qu'un journal
 *    de commandes et impossible à désynchroniser.
 */

import { SURFACES, surfaceViewBox, GRID_STEP, snap } from './rink.js';
import {
  OBJECTS, PATH_STYLES, PATH_STYLE_IDS, CAPS, CAP_IDS,
  objectIcon, pathIcon, capIcon, drawPath, bbox, hitTest, densify, cumulative, sampleAt,
} from './symbols.js';
import { sceneMarkup } from './render.js';
import { COLORS } from './taxonomy.js';
import { el, uid, clamp, deepCopy, toast } from './util.js';
import { t } from './i18n.js';

const MAX_HISTORY = 60;
const OBJ_ORDER = {
  players: ['player', 'opponent', 'forward', 'defence', 'center', 'winger', 'goalie', 'coach'],
  equipment: ['puck', 'pucks', 'cone', 'net', 'mini-net', 'tire', 'stick', 'obstacle'],
  text: ['text', 'step', 'zone'],
};

export function createEditor(opts) {
  const S = {
    drill: opts.drill,
    seq: 0,
    tool: 'select',           // 'select' | 'pan' | 'obj:<kind>' | 'path:<style>'
    color: COLORS[0].hex,
    width: 7,
    startCap: 'none',
    endCap: 'arrow',
    sel: new Set(),
    zoom: 1,
    pan: { x: 0, y: 0 },
    grid: opts.grid || false,
    snap: opts.snap !== false,
    dirty: false,
    draft: null,              // tracé en cours
    clipboard: null,
    history: [], hIndex: -1,
    playing: false, playT: 0, speed: 1, raf: 0, lastTs: 0,
    onDirty: opts.onDirty || (() => {}),
  };

  /* ---------------- Construction du DOM ---------------- */
  const root = el('div', { class: 'editor' });

  // ---- Barre supérieure
  const titleInput = el('input', {
    class: 'ed-title', type: 'text', 'aria-label': t('drill.title'),
    placeholder: 'Nom de l’exercice', value: S.drill.title || '',
    oninput: () => { S.drill.title = titleInput.value; markDirty(); },
  });

  const surfaceSel = el('select', {
    class: 'inp', style: 'width:auto;min-width:150px;height:38px;min-height:38px',
    'aria-label': t('ed.surface'),
    onchange: () => { pushHistory(); S.drill.surface = surfaceSel.value; fit(); render(); markDirty(); },
  }, SURFACES.map((s) => el('option', { value: s.id, selected: s.id === S.drill.surface, text: s.fr })));

  const tb = (label, tip, icon, onclick, extra = {}) => el('button', {
    class: 'btn btn-icon btn-sm tip', 'data-tip': tip, 'aria-label': label, onclick, ...extra,
  }, [el('span', { html: icon })]);

  const I = {
    undo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h11a5 5 0 010 10h-3"/><path d="M6 4L2.5 8 6 12"/></svg>',
    redo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 8H10a5 5 0 000 10h3"/><path d="M18 4l3.5 4L18 12"/></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
    paste: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 4h6v3H9z"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>',
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>',
    magnet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v8a6 6 0 0012 0V3h-4v8a2 2 0 01-4 0V3z"/></svg>',
    flipH: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z"/></svg>',
    flipV: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z"/></svg>',
    cursor: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 8-6 1.5L10 19z"/></svg>',
    hand: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 12V5a1.5 1.5 0 013 0v6M11 11V4a1.5 1.5 0 013 0v7M14 11V6a1.5 1.5 0 013 0v8c0 4-2.5 7-6 7s-6-2.5-6-6v-3a1.5 1.5 0 013 0"/></svg>',
    pen: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20l4-1 10-10a2.1 2.1 0 00-3-3L5 16z"/></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>',
    pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>',
    rewind: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 5v14M20 5L10 12l10 7z"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    fit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    layers: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/></svg>',
    lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    tools: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3l7 7-4 4-7-7z"/><path d="M10 7L3 14v7h7l7-7"/></svg>',
    sliders: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/></svg>',
  };

  const undoBtn = tb(t('act.undo'), `${t('act.undo')} (Ctrl+Z)`, I.undo, () => undo());
  const redoBtn = tb(t('act.redo'), `${t('act.redo')} (Ctrl+Maj+Z)`, I.redo, () => redo());
  const gridBtn = tb(t('ed.grid'), `${t('ed.grid')} (G)`, I.grid, () => { S.grid = !S.grid; syncToggles(); render(); });
  const snapBtn = tb(t('ed.snap'), t('ed.snap'), I.magnet, () => { S.snap = !S.snap; syncToggles(); });

  const topbar = el('div', { class: 'ed-top' }, [
    el('button', { class: 'btn btn-sm', onclick: () => opts.onBack && opts.onBack() }, ['‹ ' + t('act.back')]),
    surfaceSel, titleInput,
    el('span', { class: 'ed-sep' }),
    undoBtn, redoBtn,
    tb(t('act.copy'), `${t('act.copy')} (Ctrl+C)`, I.copy, () => doCopy()),
    tb(t('act.paste'), `${t('act.paste')} (Ctrl+V)`, I.paste, () => doPaste()),
    tb(t('act.delete'), `${t('act.delete')} (Suppr)`, I.trash, () => deleteSelection()),
    el('span', { class: 'ed-sep' }),
    gridBtn, snapBtn,
    tb(t('ed.flipH'), t('ed.flipH'), I.flipH, () => flip('h')),
    tb(t('ed.flipV'), t('ed.flipV'), I.flipV, () => flip('v')),
    el('span', { class: 'spacer', style: 'flex:1' }),
    el('button', { class: 'btn btn-sm', onclick: () => opts.onInfo && opts.onInfo() }, [t('ed.info')]),
    el('button', { class: 'btn btn-sm', onclick: () => opts.onExport && opts.onExport() }, [t('act.export')]),
    el('button', { class: 'btn btn-sm btn-primary', onclick: () => save() }, [t('act.save')]),
  ]);

  /* ---- Palette d'outils ---- */
  function toolButton(id, label, tip, iconHtml, isPath) {
    const key = (isPath ? 'path:' : 'obj:') + id;
    return el('button', {
      class: 'tool tip', 'data-tool': key, 'data-tip': tip, 'aria-pressed': String(S.tool === key),
      'aria-label': label, onclick: () => setTool(key),
    }, [el('span', { html: iconHtml, style: 'width:26px;height:26px;display:block' }), el('span', { class: 'tl', text: label })]);
  }

  function buildPalette() {
    const groups = [];
    const mk = (title, ids, isPath) => el('div', { class: 'tool-group' }, [
      el('div', { class: 'gh', text: title }),
      el('div', { class: 'tool-grid' }, ids.map((id) => isPath
        ? toolButton(id, PATH_STYLES[id].fr, PATH_STYLES[id].tip, pathIcon(id, 'currentColor'), true)
        : toolButton(id, OBJECTS[id].fr, OBJECTS[id].tip, objectIcon(id, 'currentColor'), false))),
    ]);
    groups.push(el('div', { class: 'tool-group' }, [
      el('div', { class: 'gh', text: t('ed.tools') }),
      el('div', { class: 'tool-grid' }, [
        el('button', { class: 'tool tip', 'data-tool': 'select', 'data-tip': `${t('ed.select')} (V)`,
          'aria-pressed': String(S.tool === 'select'), 'aria-label': t('ed.select'), onclick: () => setTool('select') },
          [el('span', { html: I.cursor }), el('span', { class: 'tl', text: t('ed.select') })]),
        el('button', { class: 'tool tip', 'data-tool': 'pan', 'data-tip': `${t('ed.pan')} (H)`,
          'aria-pressed': String(S.tool === 'pan'), 'aria-label': t('ed.pan'), onclick: () => setTool('pan') },
          [el('span', { html: I.hand }), el('span', { class: 'tl', text: t('ed.pan') })]),
        el('button', { class: 'tool tip', 'data-tool': 'path:freehand', 'data-tip': PATH_STYLES.freehand.tip,
          'aria-pressed': String(S.tool === 'path:freehand'), 'aria-label': PATH_STYLES.freehand.fr,
          onclick: () => setTool('path:freehand') },
          [el('span', { html: I.pen }), el('span', { class: 'tl', text: 'Crayon' })]),
      ]),
    ]));
    groups.push(mk(t('ed.players'), OBJ_ORDER.players, false));
    groups.push(mk(t('ed.lines'), PATH_STYLE_IDS.filter((s) => s !== 'freehand'), true));
    groups.push(mk(t('ed.equipment'), OBJ_ORDER.equipment, false));
    groups.push(mk(t('ed.text'), OBJ_ORDER.text, false));
    return groups;
  }

  const toolsPanel = el('div', { class: 'ed-tools', role: 'toolbar', 'aria-label': t('ed.tools') }, buildPalette());

  /* ---- Canevas ---- */
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'rinkSvg');
  svg.setAttribute('role', 'application');
  svg.setAttribute('aria-label', 'Canevas de patinoire');
  svg.setAttribute('tabindex', '0');

  const stage = el('div', { class: 'ed-stage mode-select' }, [svg]);
  const zoomLbl = el('div', { class: 'zoom-lvl', text: '100 %' });
  const zoomCtl = el('div', { class: 'zoom-ctl no-print' }, [
    tb(t('ed.zoomIn'), t('ed.zoomIn'), I.plus, () => setZoom(S.zoom * 1.25)),
    zoomLbl,
    tb(t('ed.zoomOut'), t('ed.zoomOut'), I.minus, () => setZoom(S.zoom / 1.25)),
    tb(t('ed.zoomFit'), t('ed.zoomFit'), I.fit, () => { fit(); render(); }),
  ]);

  const finishBtn = el('button', {
    class: 'btn btn-primary btn-sm', style: 'position:absolute;left:50%;transform:translateX(-50%);bottom:12px;display:none;z-index:5',
    onclick: () => finishDraft(),
  }, [t('ed.finishPath')]);

  const canvasWrap = el('div', { class: 'ed-canvas-wrap' }, [stage, zoomCtl, finishBtn]);

  /* ---- Panneau des propriétés ---- */
  const propsPanel = el('div', { class: 'ed-props' });

  /* ---- Barre de séquences + lecteur ---- */
  const seqList = el('div', { class: 'seq-list' });
  const seqBar = el('div', { class: 'ed-seq' }, [
    seqList,
    el('button', { class: 'btn btn-sm tip', 'data-tip': t('ed.newSeq'), onclick: () => addSequence() },
      [el('span', { html: I.plus }), el('span', { class: 'sr-only', text: t('ed.newSeq') })]),
    el('button', { class: 'btn btn-sm tip', 'data-tip': t('ed.dupSeq'), onclick: () => duplicateSequence() }, [t('act.duplicate')]),
  ]);

  const playBtn = el('button', { class: 'btn btn-sm tip', 'data-tip': `${t('ed.play')} (Espace)`,
    'aria-label': t('ed.play'), onclick: () => togglePlay() }, [el('span', { html: I.play })]);
  const timeline = el('input', { class: 'timeline', type: 'range', min: '0', max: '1000', value: '0',
    'aria-label': 'Ligne du temps',
    oninput: () => { stopPlay(); S.playT = (+timeline.value / 1000) * totalDuration(); renderPlayback(); } });
  const timeLbl = el('div', { class: 'tl-time', text: '0,0 s' });
  const speedSel = el('select', { class: 'inp', style: 'width:auto;min-height:36px;height:36px', 'aria-label': t('ed.speed'),
    onchange: () => { S.speed = +speedSel.value; } },
    [['0.5', '0,5×'], ['1', '1×'], ['1.5', '1,5×'], ['2', '2×']].map(([v, l]) =>
      el('option', { value: v, selected: v === '1', text: l })));

  const playerBar = el('div', { class: 'player-bar no-print' }, [
    playBtn,
    el('button', { class: 'btn btn-sm tip', 'data-tip': t('ed.restart'), 'aria-label': t('ed.restart'),
      onclick: () => { stopPlay(); S.playT = 0; renderPlayback(); } }, [el('span', { html: I.rewind })]),
    timeline, timeLbl,
    el('label', { class: 'txt-sm txt-2', style: 'flex:0 0 auto', text: t('ed.speed') }), speedSel,
  ]);

  /* ---- Barre mobile + tiroir ---- */
  const drawerBack = el('div', { class: 'drawer-backdrop', onclick: () => closeDrawer() });
  const drawer = el('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('ed.more') });
  const mobileBar = el('div', { class: 'ed-mobile-bar' }, [
    el('button', { class: 'tool tip', 'data-tool': 'select', onclick: () => setTool('select'), 'aria-label': t('ed.select') },
      [el('span', { html: I.cursor }), el('span', { class: 'tl', text: t('ed.select') })]),
    el('button', { class: 'tool', onclick: () => openDrawer('players'), 'aria-label': t('ed.players') },
      [el('span', { html: objectIcon('player', 'currentColor'), style: 'width:26px;height:26px' }),
       el('span', { class: 'tl', text: t('ed.players') })]),
    el('button', { class: 'tool', onclick: () => openDrawer('lines'), 'aria-label': t('ed.lines') },
      [el('span', { html: pathIcon('skate', 'currentColor'), style: 'width:26px;height:26px' }),
       el('span', { class: 'tl', text: t('ed.lines') })]),
    el('button', { class: 'tool', onclick: () => openDrawer('equipment'), 'aria-label': t('ed.equipment') },
      [el('span', { html: objectIcon('cone', 'currentColor'), style: 'width:26px;height:26px' }),
       el('span', { class: 'tl', text: t('ed.equipment') })]),
    el('button', { class: 'tool', onclick: () => openDrawer('text'), 'aria-label': t('ed.text') },
      [el('span', { html: objectIcon('text', 'currentColor'), style: 'width:26px;height:26px' }),
       el('span', { class: 'tl', text: t('ed.text') })]),
    el('button', { class: 'tool', onclick: () => openDrawer('props'), 'aria-label': t('ed.props') },
      [el('span', { html: I.sliders }), el('span', { class: 'tl', text: t('ed.props') })]),
  ]);

  const rotateHint = el('div', { class: 'rotate-hint' }, [
    el('span', { html: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M8 3.5A9 9 0 0112 3"/></svg>' }),
    el('span', { text: 'Tourne l’appareil en paysage pour agrandir la glace.' }),
  ]);

  // Lecteur et séquences partagent une même rangée sur les écrans bas
  // (téléphone en paysage) : deux barres empilées coûtent 45 px de glace.
  const bottomBars = el('div', { class: 'ed-bottom' }, [playerBar, seqBar]);

  root.append(topbar, el('div', { class: 'ed-main' }, [toolsPanel, canvasWrap, propsPanel]),
    rotateHint, bottomBars, mobileBar);
  document.body.append(drawerBack, drawer);

  /* ---------------- Accès aux données ---------------- */
  const seqs = () => S.drill.sequences;
  const cur = () => seqs()[S.seq] || seqs()[0];
  const els = () => cur().elements;
  const byId = (id) => els().find((e) => e.id === id);
  const selected = () => [...S.sel].map(byId).filter(Boolean);

  function markDirty() { S.dirty = true; S.onDirty(true); }

  /* ---------------- Historique ---------------- */
  function pushHistory() {
    S.history = S.history.slice(0, S.hIndex + 1);
    S.history.push({ seqs: deepCopy(seqs()), seq: S.seq, surface: S.drill.surface });
    if (S.history.length > MAX_HISTORY) S.history.shift();
    S.hIndex = S.history.length - 1;
    syncToggles();
  }
  function restore(snapshot) {
    S.drill.sequences = deepCopy(snapshot.seqs);
    S.drill.surface = snapshot.surface;
    S.seq = clamp(snapshot.seq, 0, seqs().length - 1);
    surfaceSel.value = S.drill.surface;
    S.sel.clear();
    renderAll(); markDirty();
  }
  function undo() {
    if (S.hIndex <= 0) { if (S.hIndex === 0) { restore(S.history[0]); S.hIndex = -1; syncToggles(); } return; }
    S.hIndex--; restore(S.history[S.hIndex]); syncToggles();
  }
  function redo() {
    if (S.hIndex >= S.history.length - 1) return;
    S.hIndex++; restore(S.history[S.hIndex]); syncToggles();
  }

  function syncToggles() {
    undoBtn.disabled = S.hIndex < 0;
    redoBtn.disabled = S.hIndex >= S.history.length - 1;
    gridBtn.classList.toggle('is-on', S.grid);
    snapBtn.classList.toggle('is-on', S.snap);
    gridBtn.setAttribute('aria-pressed', String(S.grid));
    snapBtn.setAttribute('aria-pressed', String(S.snap));
  }

  /* ---------------- Outils ---------------- */
  function setTool(key) {
    finishDraft(true);
    S.tool = key;
    stage.className = 'ed-stage ' + (key === 'select' ? 'mode-select' : key === 'pan' ? 'mode-pan' : '');
    for (const b of root.querySelectorAll('[data-tool]')) {
      b.setAttribute('aria-pressed', String(b.dataset.tool === key));
    }
    for (const b of drawer.querySelectorAll('[data-tool]')) {
      b.setAttribute('aria-pressed', String(b.dataset.tool === key));
    }
    if (key !== 'select') S.sel.clear();
    renderProps(); render();
  }

  /* ---------------- Conversion de coordonnées ---------------- */
  function viewBox() {
    const vb = surfaceViewBox(S.drill.surface);
    const w = vb[2] / S.zoom, h = vb[3] / S.zoom;
    const cx = vb[0] + vb[2] / 2 + S.pan.x, cy = vb[1] + vb[3] / 2 + S.pan.y;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function toIce(evt) {
    const r = svg.getBoundingClientRect();
    const vb = viewBox();
    const x = vb[0] + ((evt.clientX - r.left) / r.width) * vb[2];
    const y = vb[1] + ((evt.clientY - r.top) / r.height) * vb[3];
    return { x, y };
  }
  function fit() { S.zoom = 1; S.pan = { x: 0, y: 0 }; updateViewBox(); }
  function setZoom(z) { S.zoom = clamp(z, 0.5, 6); updateViewBox(); zoomLbl.textContent = Math.round(S.zoom * 100) + ' %'; }
  /**
   * Dimensionne le SVG à la main plutôt que par CSS.
   *
   * `width:100% + aspect-ratio` échoue dès que la hauteur disponible est le
   * facteur limitant : le navigateur écrase la hauteur sans réduire la largeur,
   * et la patinoire se retrouve minuscule au milieu d'une boîte trop large.
   * On calcule donc la boîte qui tient dans l'estrade, en respectant le ratio.
   */
  function updateViewBox() {
    const vb = viewBox();
    svg.setAttribute('viewBox', vb.join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const base = surfaceViewBox(S.drill.surface);
    const ratio = base[2] / base[3];
    const r = stage.getBoundingClientRect();
    const availW = Math.max(80, r.width - 10);
    const availH = Math.max(80, r.height - 10);
    const w = Math.min(availW, availH * ratio);
    svg.style.width = `${Math.round(w)}px`;
    svg.style.height = `${Math.round(w / ratio)}px`;
    svg.style.aspectRatio = '';
    zoomLbl.textContent = Math.round(S.zoom * 100) + ' %';
  }

  // Le redimensionnement de la fenêtre ou la rotation de l'appareil
  // recalculent la boîte de la patinoire.
  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => updateViewBox()) : null;
  if (ro) ro.observe(stage);

  /* ---------------- Rendu ---------------- */
  function selectionOverlay() {
    if (S.playing) return '';
    let s = '';
    const items = selected();
    if (items.length === 0) return marqueeMarkup();
    const k = 1 / S.zoom;
    for (const it of items) {
      const b = bbox(it);
      s += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none"
        stroke="#e23b41" stroke-width="${3 * k}" stroke-dasharray="${8 * k} ${6 * k}" pointer-events="none"/>`;
      if (it.locked) {
        s += `<circle cx="${b.x + b.w}" cy="${b.y}" r="${9 * k}" fill="#e23b41"/>`;
      }
    }
    if (items.length === 1 && !items[0].locked) {
      const it = items[0], b = bbox(it);
      const hr = 13 * k;
      if (it.kind !== 'path') {
        s += `<line x1="${b.x + b.w / 2}" y1="${b.y}" x2="${b.x + b.w / 2}" y2="${b.y - 34 * k}" stroke="#e23b41" stroke-width="${2.5 * k}"/>`;
        s += `<circle class="h-rot" data-handle="rot" cx="${b.x + b.w / 2}" cy="${b.y - 34 * k}" r="${hr}" fill="#fff" stroke="#e23b41" stroke-width="${3 * k}" style="cursor:grab"/>`;
        s += `<rect class="h-scale" data-handle="scale" x="${b.x + b.w - hr}" y="${b.y + b.h - hr}" width="${hr * 2}" height="${hr * 2}" rx="${3 * k}" fill="#fff" stroke="#e23b41" stroke-width="${3 * k}" style="cursor:nwse-resize"/>`;
      } else {
        it.points.forEach((p, i) => {
          s += `<circle data-handle="pt" data-i="${i}" cx="${p.x}" cy="${p.y}" r="${hr * 0.85}" fill="#fff" stroke="#e23b41" stroke-width="${2.5 * k}" style="cursor:move"/>`;
        });
      }
    }
    return s + marqueeMarkup();
  }

  let marquee = null;
  function marqueeMarkup() {
    if (!marquee) return '';
    const x = Math.min(marquee.x0, marquee.x1), y = Math.min(marquee.y0, marquee.y1);
    const w = Math.abs(marquee.x1 - marquee.x0), h = Math.abs(marquee.y1 - marquee.y0);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(226,59,65,.12)"
      stroke="#e23b41" stroke-width="${2 / S.zoom}" stroke-dasharray="${6 / S.zoom} ${4 / S.zoom}" pointer-events="none"/>`;
  }

  /** Aperçu du tracé en cours de construction, avec ses points de contrôle. */
  function draftMarkup() {
    if (!S.draft || S.draft.points.length < 1) return '';
    const k = 1 / S.zoom;
    let s = S.draft.points.length >= 2 ? `<g opacity=".8">${drawPath(S.draft)}</g>` : '';
    for (const p of S.draft.points) {
      s += `<circle cx="${p.x}" cy="${p.y}" r="${7 * k}" fill="#e23b41" stroke="#fff" stroke-width="${2 * k}"/>`;
    }
    return s;
  }

  function render() {
    const grid = S.grid;
    const html = sceneMarkup({ surface: S.drill.surface, elements: els(), grid })
      + draftMarkup() + selectionOverlay();
    svg.innerHTML = html;
    updateViewBox();
    renderSeqBar();
    timeLbl.textContent = fmtSec(S.playT) + ' / ' + fmtSec(totalDuration());
  }

  function renderAll() { render(); renderProps(); }

  const fmtSec = (s) => (Math.round(s * 10) / 10).toFixed(1).replace('.', ',') + ' s';

  /* ---------------- Séquences ---------------- */
  function renderSeqBar() {
    seqList.innerHTML = '';
    seqs().forEach((sq, i) => {
      const b = el('button', {
        class: 'seq-item', 'aria-current': String(i === S.seq),
        onclick: () => { S.seq = i; S.sel.clear(); S.playT = seqStart(i); renderAll(); },
      }, [el('span', { class: 'n', text: String(i + 1) }), el('span', { text: sq.name || `Séquence ${i + 1}` }),
          el('span', { class: 'txt-2', style: 'font-size:.72rem', text: `${sq.duration}s` })]);
      seqList.appendChild(b);
    });
  }

  function addSequence(copyCurrent = false) {
    pushHistory();
    const base = cur();
    const sq = {
      id: uid('seq'),
      name: `Séquence ${seqs().length + 1}`,
      duration: base ? base.duration : 4,
      note: '',
      elements: copyCurrent ? deepCopy(base.elements).map((e) => ({ ...e, id: uid('el') })) : [],
    };
    seqs().splice(S.seq + 1, 0, sq);
    S.seq += 1; S.sel.clear();
    renderAll(); markDirty();
  }
  function duplicateSequence() { addSequence(true); }
  function deleteSequence(i) {
    if (seqs().length <= 1) { toast('Un exercice doit garder au moins une séquence.', 'warn'); return; }
    pushHistory();
    seqs().splice(i, 1);
    S.seq = clamp(S.seq, 0, seqs().length - 1);
    S.sel.clear(); renderAll(); markDirty();
  }
  function moveSequence(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= seqs().length) return;
    pushHistory();
    const [x] = seqs().splice(i, 1); seqs().splice(j, 0, x);
    S.seq = j; renderAll(); markDirty();
  }

  const totalDuration = () => seqs().reduce((a, s) => a + (s.duration || 0), 0);
  const seqStart = (i) => seqs().slice(0, i).reduce((a, s) => a + (s.duration || 0), 0);

  /* ---------------- Interactions du canevas ---------------- */
  const pointers = new Map();
  let drag = null;
  let pinch = null;

  svg.addEventListener('pointerdown', (e) => {
    if (S.playing) stopPlay();
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) { startPinch(); return; }

    const pt = toIce(e);
    const handle = e.target && e.target.getAttribute && e.target.getAttribute('data-handle');

    if (handle) {
      const it = selected()[0];
      drag = { kind: handle, it, start: pt, i: +(e.target.getAttribute('data-i') || 0),
        orig: deepCopy(it), pushed: false };
      return;
    }

    if (S.tool === 'pan') { drag = { kind: 'pan', start: pt, pan0: { ...S.pan } }; stage.classList.add('is-panning'); return; }

    if (S.tool.startsWith('obj:')) { addObject(S.tool.slice(4), pt); return; }

    if (S.tool.startsWith('path:')) {
      const style = S.tool.slice(5);
      if (style === 'freehand') {
        S.draft = newPath('freehand', [pt]);
        drag = { kind: 'freehand' };
      } else if (!S.draft) {
        S.draft = newPath(style, [snapPt(pt)]);
        finishBtn.style.display = 'block';
      } else {
        S.draft.points.push(snapPt(pt));
      }
      render();
      return;
    }

    // Outil sélection
    const hit = topmostAt(pt);
    if (hit) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (S.sel.has(hit.id)) S.sel.delete(hit.id); else S.sel.add(hit.id);
      } else if (!S.sel.has(hit.id)) {
        S.sel.clear(); S.sel.add(hit.id);
      }
      if (!hit.locked) {
        drag = { kind: 'move', start: pt, orig: selected().map((x) => deepCopy(x)), pushed: false };
      }
      renderProps(); render();
    } else {
      if (!e.shiftKey) S.sel.clear();
      marquee = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
      drag = { kind: 'marquee' };
      renderProps(); render();
    }
  });

  svg.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
    if (pointers.size === 2 && pinch) { updatePinch(); return; }
    if (!drag) return;
    const pt = toIce(e);

    if (drag.kind === 'pan') {
      const vb = surfaceViewBox(S.drill.surface);
      S.pan.x = drag.pan0.x - (pt.x - drag.start.x);
      S.pan.y = drag.pan0.y - (pt.y - drag.start.y);
      const lim = vb[2] * 0.5, limY = vb[3] * 0.5;
      S.pan.x = clamp(S.pan.x, -lim, lim); S.pan.y = clamp(S.pan.y, -limY, limY);
      updateViewBox(); return;
    }
    if (drag.kind === 'freehand') {
      const last = S.draft.points[S.draft.points.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 14) S.draft.points.push(pt);
      render(); return;
    }
    if (drag.kind === 'marquee') { marquee.x1 = pt.x; marquee.y1 = pt.y; render(); return; }

    if (!drag.pushed) { pushHistory(); drag.pushed = true; }

    if (drag.kind === 'move') {
      const dx = pt.x - drag.start.x, dy = pt.y - drag.start.y;
      drag.orig.forEach((o0) => {
        const it = byId(o0.id); if (!it || it.locked) return;
        if (it.kind === 'path') {
          it.points = o0.points.map((p) => ({ x: snapV(p.x + dx), y: snapV(p.y + dy) }));
        } else { it.x = snapV(o0.x + dx); it.y = snapV(o0.y + dy); }
      });
      render(); markDirty(); return;
    }
    if (drag.kind === 'rot') {
      const it = drag.it; const b = bbox(drag.orig);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      let a = Math.atan2(pt.y - cy, pt.x - cx) * 180 / Math.PI + 90;
      if (S.snap) a = Math.round(a / 15) * 15;
      it.rot = Math.round(a); render(); markDirty(); return;
    }
    if (drag.kind === 'scale') {
      const it = drag.it; const b0 = bbox(drag.orig);
      const cx = b0.x + b0.w / 2, cy = b0.y + b0.h / 2;
      const d0 = Math.hypot(drag.start.x - cx, drag.start.y - cy) || 1;
      const d1 = Math.hypot(pt.x - cx, pt.y - cy);
      if (it.obj === 'zone') {
        it.w = clamp(Math.abs(pt.x - cx) * 2, 60, 2400);
        it.h = clamp(Math.abs(pt.y - cy) * 2, 60, 1200);
      } else {
        it.scale = clamp((drag.orig.scale || 1) * (d1 / d0), 0.3, 4);
      }
      render(); markDirty(); return;
    }
    if (drag.kind === 'pt') {
      const it = drag.it;
      it.points[drag.i] = snapPt(pt);
      render(); markDirty(); return;
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    stage.classList.remove('is-panning');
    if (!drag) return;
    if (drag.kind === 'marquee') {
      const x0 = Math.min(marquee.x0, marquee.x1), x1 = Math.max(marquee.x0, marquee.x1);
      const y0 = Math.min(marquee.y0, marquee.y1), y1 = Math.max(marquee.y0, marquee.y1);
      if (Math.abs(x1 - x0) > 12 || Math.abs(y1 - y0) > 12) {
        for (const it of els()) {
          const b = bbox(it);
          if (b.x >= x0 - 8 && b.x + b.w <= x1 + 8 && b.y >= y0 - 8 && b.y + b.h <= y1 + 8) S.sel.add(it.id);
        }
      }
      marquee = null; renderProps(); render();
    } else if (drag.kind === 'freehand') {
      finishDraft();
    }
    drag = null;
  }
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);

  svg.addEventListener('dblclick', (e) => {
    if (S.draft) { finishDraft(); return; }
    const pt = toIce(e);
    const hit = topmostAt(pt);
    if (hit && (hit.obj === 'text' || hit.obj === 'step' || OBJECTS[hit.obj])) {
      S.sel.clear(); S.sel.add(hit.id); renderProps();
      const f = propsPanel.querySelector('[data-focus="label"]');
      if (f) f.focus();
    }
  });

  svg.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 4) return;
    e.preventDefault();
    setZoom(S.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { passive: false });

  function startPinch() {
    const [a, b] = [...pointers.values()];
    pinch = { d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z0: S.zoom };
    drag = null;
  }
  function updatePinch() {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinch.d0 > 8) setZoom(pinch.z0 * (d / pinch.d0));
  }

  const snapV = (v) => snap(v, S.snap);
  const snapPt = (p) => ({ x: snapV(p.x), y: snapV(p.y) });

  function topmostAt(pt) {
    const sorted = [...els()].sort((a, b) => (b.z || 0) - (a.z || 0));
    const tol = 14 / S.zoom;
    return sorted.find((e2) => hitTest(e2, pt.x, pt.y, tol)) || null;
  }

  /* ---------------- Création d'éléments ---------------- */
  function nextZ() { return els().reduce((m, e2) => Math.max(m, e2.z || 0), 0) + 1; }

  function addObject(kind, pt) {
    pushHistory();
    const def = OBJECTS[kind] || OBJECTS.player;
    const o = {
      id: uid('el'), kind: 'object', obj: kind,
      x: snapV(pt.x), y: snapV(pt.y), rot: 0, scale: 1,
      color: S.color, z: nextZ(),
    };
    if (def.defLabel) o.label = kind === 'step' ? String(countSteps() + 1) : def.defLabel;
    if (kind === 'zone') { o.w = 400; o.h = 300; }
    if (kind === 'text') { o.text = 'Texte'; o.fontSize = 46; o.color = S.color; }
    els().push(o);
    S.sel.clear(); S.sel.add(o.id);
    setTool('select');
    renderAll(); markDirty();
  }
  const countSteps = () => els().filter((e2) => e2.obj === 'step').length;

  function newPath(style, points) {
    return {
      id: uid('el'), kind: 'path', style, points,
      width: S.width, color: S.color,
      startCap: S.startCap, endCap: S.endCap === 'auto' ? (PATH_STYLES[style].defCap) : S.endCap,
      z: nextZ(), followerId: null,
    };
  }

  function finishDraft(silent = false) {
    finishBtn.style.display = 'none';
    if (!S.draft) return;
    const d = S.draft; S.draft = null;
    if (d.points.length < 2) { if (!silent) toast(t('msg.pathTooShort'), 'warn'); render(); return; }
    pushHistory();
    d.followerId = autoFollower(d);
    els().push(d);
    S.sel.clear(); S.sel.add(d.id);
    renderAll(); markDirty();
  }

  /** Rattache automatiquement l'objet le plus proche du départ du tracé. */
  function autoFollower(path) {
    const p0 = path.points[0];
    let best = null, bestD = 90;
    for (const e2 of els()) {
      if (e2.kind !== 'object') continue;
      if (!['player', 'opponent', 'forward', 'defence', 'center', 'winger', 'goalie', 'puck'].includes(e2.obj)) continue;
      const d = Math.hypot(e2.x - p0.x, e2.y - p0.y);
      if (d < bestD) { bestD = d; best = e2.id; }
    }
    return best;
  }

  /* ---------------- Actions sur la sélection ---------------- */
  function deleteSelection() {
    const items = selected().filter((i) => !i.locked);
    if (!items.length) return;
    pushHistory();
    const ids = new Set(items.map((i) => i.id));
    cur().elements = els().filter((e2) => !ids.has(e2.id));
    for (const e2 of els()) if (e2.followerId && ids.has(e2.followerId)) e2.followerId = null;
    S.sel.clear(); renderAll(); markDirty();
  }
  function doCopy() {
    const items = selected();
    if (!items.length) return;
    S.clipboard = deepCopy(items);
    toast(`${items.length} élément(s) copié(s).`, 'ok', 1800);
  }
  function doPaste() {
    if (!S.clipboard || !S.clipboard.length) return;
    pushHistory();
    S.sel.clear();
    for (const it of S.clipboard) {
      const c = deepCopy(it);
      c.id = uid('el'); c.z = nextZ(); c.followerId = null;
      if (c.kind === 'path') c.points = c.points.map((p) => ({ x: p.x + 40, y: p.y + 40 }));
      else { c.x += 40; c.y += 40; }
      els().push(c); S.sel.add(c.id);
    }
    renderAll(); markDirty();
  }
  function flip(axis) {
    const vb = surfaceViewBox(S.drill.surface);
    const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
    const items = selected().length ? selected() : els();
    if (!items.length) return;
    pushHistory();
    for (const it of items) {
      if (it.locked) continue;
      if (it.kind === 'path') {
        it.points = it.points.map((p) => axis === 'h' ? { x: 2 * cx - p.x, y: p.y } : { x: p.x, y: 2 * cy - p.y });
      } else {
        if (axis === 'h') { it.x = 2 * cx - it.x; it.rot = -(it.rot || 0); }
        else { it.y = 2 * cy - it.y; it.rot = 180 - (it.rot || 0); }
      }
    }
    renderAll(); markDirty();
  }
  function layer(dir) {
    const items = selected(); if (!items.length) return;
    pushHistory();
    const all = [...els()].sort((a, b) => (a.z || 0) - (b.z || 0));
    if (dir > 0) for (const it of items) it.z = nextZ();
    else { const minZ = (all[0].z || 0) - 1; items.forEach((it, i) => { it.z = minZ - i; }); }
    renderAll(); markDirty();
  }
  function toggleLock() {
    const items = selected(); if (!items.length) return;
    pushHistory();
    const anyUnlocked = items.some((i) => !i.locked);
    for (const it of items) it.locked = anyUnlocked;
    renderAll(); markDirty();
  }
  function nudge(dx, dy) {
    const items = selected().filter((i) => !i.locked); if (!items.length) return;
    pushHistory();
    for (const it of items) {
      if (it.kind === 'path') it.points = it.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      else { it.x += dx; it.y += dy; }
    }
    render(); markDirty();
  }
  function clearSequence() {
    if (!els().length) return;
    pushHistory(); cur().elements = []; S.sel.clear(); renderAll(); markDirty();
  }

  /* ---------------- Panneau des propriétés ---------------- */
  function renderProps(target) {
    const host = target || propsPanel;
    host.innerHTML = '';
    const items = selected();

    // Couleur, épaisseur, extrémités : toujours visibles (valeurs par défaut du prochain élément)
    host.appendChild(el('div', { class: 'tool-group' }, [
      el('div', { class: 'gh', text: t('ed.color') }),
      el('div', { class: 'swatches' }, COLORS.map((c) => el('span', { class: 'sw-wrap' }, [
        el('button', {
          class: 'sw', style: `background:${c.hex}`, 'aria-pressed': String(S.color === c.hex),
          'aria-label': c.fr, title: c.fr,
          onclick: () => {
            S.color = c.hex;
            const sel2 = selected().filter((i) => !i.locked);
            if (sel2.length) { pushHistory(); sel2.forEach((i) => { i.color = c.hex; }); markDirty(); }
            renderProps(target); render();
          },
        }),
      ]))),
    ]));

    const widthWrap = el('label', { class: 'field' }, [
      el('span', { class: 'lbl', text: `${t('ed.width')} : ${S.width}` }),
      el('input', {
        type: 'range', min: '3', max: '20', value: String(S.width), 'aria-label': t('ed.width'),
        oninput: (e2) => {
          S.width = +e2.target.value;
          const sel2 = selected().filter((i) => i.kind === 'path' && !i.locked);
          if (sel2.length) { sel2.forEach((i) => { i.width = S.width; }); markDirty(); }
          widthWrap.querySelector('.lbl').textContent = `${t('ed.width')} : ${S.width}`;
          render();
        },
      }),
    ]);
    host.appendChild(widthWrap);

    host.appendChild(el('div', { class: 'tool-group' }, [
      el('div', { class: 'gh', text: t('ed.caps') }),
      el('div', { class: 'tool-grid' }, CAP_IDS.map((c) => el('button', {
        class: 'tool tip', 'data-tip': CAPS[c].tip, 'aria-label': CAPS[c].fr,
        'aria-pressed': String(S.endCap === c),
        onclick: () => {
          S.endCap = c;
          const sel2 = selected().filter((i) => i.kind === 'path' && !i.locked);
          if (sel2.length) { pushHistory(); sel2.forEach((i) => { i.endCap = c; }); markDirty(); }
          renderProps(target); render();
        },
      }, [el('span', { html: capIcon(c, 'currentColor'), style: 'width:26px;height:26px;display:block' }),
          el('span', { class: 'tl', text: CAPS[c].fr })]))),
    ]));

    host.appendChild(el('hr', { class: 'sep' }));

    if (!items.length) {
      host.appendChild(el('p', { class: 'prop-empty', text: t('ed.nothingSelected') }));
    } else {
      const one = items.length === 1 ? items[0] : null;
      host.appendChild(el('div', { class: 'gh', style: 'font-size:.7rem;text-transform:uppercase;color:var(--tx-2);margin-bottom:8px',
        text: items.length === 1 ? (one.kind === 'path' ? PATH_STYLES[one.style].fr : OBJECTS[one.obj].fr)
                                 : `${items.length} éléments sélectionnés` }));

      if (one && one.kind === 'object') {
        if (one.obj === 'text') {
          host.appendChild(el('label', { class: 'field' }, [
            el('span', { class: 'lbl', text: t('ed.text') }),
            el('textarea', { class: 'inp', 'data-focus': 'label', rows: '3', value: one.text || '',
              oninput: (e2) => { one.text = e2.target.value; render(); markDirty(); } }),
          ]));
          host.appendChild(el('label', { class: 'field' }, [
            el('span', { class: 'lbl', text: 'Taille du texte' }),
            el('input', { type: 'range', min: '20', max: '120', value: String(one.fontSize || 46),
              oninput: (e2) => { one.fontSize = +e2.target.value; render(); markDirty(); } }),
          ]));
        } else if (OBJECTS[one.obj].defLabel != null) {
          host.appendChild(el('label', { class: 'field' }, [
            el('span', { class: 'lbl', text: t('ed.label') }),
            el('input', { class: 'inp', 'data-focus': 'label', maxlength: '4', value: one.label || '',
              oninput: (e2) => { one.label = e2.target.value; render(); markDirty(); } }),
          ]));
        }
        host.appendChild(el('label', { class: 'field' }, [
          el('span', { class: 'lbl', text: `${t('ed.rotate')} : ${one.rot || 0}°` }),
          el('input', { type: 'range', min: '-180', max: '180', value: String(one.rot || 0),
            oninput: (e2) => { one.rot = +e2.target.value; e2.target.previousSibling.textContent = `${t('ed.rotate')} : ${one.rot}°`; render(); markDirty(); } }),
        ]));
        host.appendChild(el('label', { class: 'field' }, [
          el('span', { class: 'lbl', text: t('ed.size') }),
          el('input', { type: 'range', min: '30', max: '400', value: String(Math.round((one.scale || 1) * 100)),
            oninput: (e2) => { one.scale = +e2.target.value / 100; render(); markDirty(); } }),
        ]));
      }

      if (one && one.kind === 'path') {
        const objs = els().filter((e2) => e2.kind === 'object');
        host.appendChild(el('label', { class: 'field' }, [
          el('span', { class: 'lbl', text: t('ed.follower') }),
          el('select', { class: 'inp', onchange: (e2) => { one.followerId = e2.target.value || null; markDirty(); } },
            [el('option', { value: '', text: t('ed.followerNone'), selected: !one.followerId }),
             ...objs.map((ob) => el('option', {
               value: ob.id, selected: one.followerId === ob.id,
               text: `${OBJECTS[ob.obj].fr}${ob.label ? ' ' + ob.label : ''}`,
             }))]),
        ]));
        host.appendChild(el('div', { class: 'hint', text: 'L’objet choisi se déplace le long du tracé pendant l’animation.' }));
      }

      host.appendChild(el('div', { class: 'row mt-1' }, [
        el('button', { class: 'btn btn-sm', onclick: () => layer(1) }, [t('ed.front')]),
        el('button', { class: 'btn btn-sm', onclick: () => layer(-1) }, [t('ed.back')]),
      ]));
      host.appendChild(el('div', { class: 'row mt-1' }, [
        el('button', { class: 'btn btn-sm', onclick: () => toggleLock() },
          [items.some((i) => !i.locked) ? t('ed.lock') : t('ed.unlock')]),
        el('button', { class: 'btn btn-sm btn-danger', onclick: () => deleteSelection() }, [t('act.delete')]),
      ]));
    }

    host.appendChild(el('hr', { class: 'sep' }));
    // Réglages de la séquence courante
    const sq = cur();
    host.appendChild(el('div', { class: 'gh', style: 'font-size:.7rem;text-transform:uppercase;color:var(--tx-2);margin-bottom:8px',
      text: `${t('drill.sequences')} ${S.seq + 1}/${seqs().length}` }));
    host.appendChild(el('label', { class: 'field' }, [
      el('span', { class: 'lbl', text: t('ed.seqName') }),
      el('input', { class: 'inp', value: sq.name || '', oninput: (e2) => { sq.name = e2.target.value; renderSeqBar(); markDirty(); } }),
    ]));
    host.appendChild(el('label', { class: 'field' }, [
      el('span', { class: 'lbl', text: t('ed.seqDuration') }),
      el('input', { class: 'inp', type: 'number', min: '1', max: '60', value: String(sq.duration || 4),
        oninput: (e2) => { sq.duration = clamp(+e2.target.value || 1, 1, 60); renderSeqBar(); markDirty(); } }),
    ]));
    host.appendChild(el('label', { class: 'field' }, [
      el('span', { class: 'lbl', text: 'Note de séquence' }),
      el('input', { class: 'inp', value: sq.note || '', oninput: (e2) => { sq.note = e2.target.value; markDirty(); } }),
    ]));
    host.appendChild(el('div', { class: 'row' }, [
      el('button', { class: 'btn btn-sm', onclick: () => moveSequence(S.seq, -1) }, ['↑ ' + t('plan.moveUp')]),
      el('button', { class: 'btn btn-sm', onclick: () => moveSequence(S.seq, 1) }, ['↓ ' + t('plan.moveDown')]),
    ]));
    host.appendChild(el('div', { class: 'row mt-1' }, [
      el('button', { class: 'btn btn-sm', onclick: () => clearSequence() }, [t('ed.clear')]),
      el('button', { class: 'btn btn-sm btn-danger', onclick: () => deleteSequence(S.seq) }, [t('ed.delSeq')]),
    ]));
  }

  /* ---------------- Tiroir mobile ---------------- */
  function openDrawer(which) {
    drawer.innerHTML = '';
    drawer.appendChild(el('div', { class: 'drawer-grip' }));
    if (which === 'props') {
      drawer.appendChild(el('h3', { text: t('ed.props') }));
      const box = el('div'); drawer.appendChild(box); renderProps(box);
    } else {
      const map = { players: [t('ed.players'), OBJ_ORDER.players, false],
        lines: [t('ed.lines'), PATH_STYLE_IDS, true],
        equipment: [t('ed.equipment'), OBJ_ORDER.equipment, false],
        text: [t('ed.text'), OBJ_ORDER.text, false] };
      const [title, ids, isPath] = map[which];
      drawer.appendChild(el('h3', { text: title }));
      drawer.appendChild(el('div', { class: 'tool-grid' }, ids.map((id) => {
        const b = isPath
          ? toolButton(id, PATH_STYLES[id].fr, PATH_STYLES[id].tip, pathIcon(id, 'currentColor'), true)
          : toolButton(id, OBJECTS[id].fr, OBJECTS[id].tip, objectIcon(id, 'currentColor'), false);
        b.addEventListener('click', () => closeDrawer());
        return b;
      })));
    }
    drawer.classList.add('open'); drawerBack.classList.add('open');
  }
  function closeDrawer() { drawer.classList.remove('open'); drawerBack.classList.remove('open'); }

  /* ---------------- Animation ---------------- */
  function togglePlay() { S.playing ? stopPlay() : startPlay(); }
  function startPlay() {
    if (totalDuration() <= 0) return;
    if (S.playT >= totalDuration() - 0.01) S.playT = 0;
    S.playing = true; S.lastTs = 0;
    playBtn.innerHTML = I.pause; playBtn.setAttribute('aria-label', t('ed.pause'));
    S.raf = requestAnimationFrame(tick);
  }
  function stopPlay() {
    S.playing = false; cancelAnimationFrame(S.raf);
    playBtn.innerHTML = I.play; playBtn.setAttribute('aria-label', t('ed.play'));
  }
  function tick(ts) {
    if (!S.playing) return;
    if (!S.lastTs) S.lastTs = ts;
    const dt = Math.min(0.1, (ts - S.lastTs) / 1000) * S.speed;
    S.lastTs = ts;
    S.playT += dt;
    if (S.playT >= totalDuration()) { S.playT = totalDuration(); stopPlay(); }
    renderPlayback();
    if (S.playing) S.raf = requestAnimationFrame(tick);
  }

  /** Position dans la ligne du temps → séquence + progression locale. */
  function locate(tSec) {
    let acc = 0;
    for (let i = 0; i < seqs().length; i++) {
      const d = seqs()[i].duration || 0;
      if (tSec <= acc + d || i === seqs().length - 1) return { i, p: d ? clamp((tSec - acc) / d, 0, 1) : 1 };
      acc += d;
    }
    return { i: 0, p: 0 };
  }

  function renderPlayback() {
    const { i, p } = locate(S.playT);
    if (i !== S.seq) { S.seq = i; renderSeqBar(); }
    const source = seqs()[i].elements;
    const reveal = new Map();
    const moved = [];
    for (const e2 of source) {
      if (e2.kind === 'path') {
        reveal.set(e2.id, p);
        if (e2.followerId) {
          const ob = source.find((x) => x.id === e2.followerId);
          if (ob) {
            const dense = densify(e2.points, 10);
            const acc = cumulative(dense);
            const s0 = sampleAt(dense, acc, acc[acc.length - 1] * p);
            moved.push({ ...ob, x: s0.x, y: s0.y });
          }
        }
      }
    }
    const movedIds = new Set(moved.map((m) => m.id));
    const elements = source.filter((e2) => !movedIds.has(e2.id)).concat(moved);
    svg.innerHTML = sceneMarkup({ surface: S.drill.surface, elements, grid: S.grid, reveal });
    updateViewBox();
    timeline.value = String(Math.round((S.playT / (totalDuration() || 1)) * 1000));
    timeLbl.textContent = fmtSec(S.playT) + ' / ' + fmtSec(totalDuration());
  }

  /* ---------------- Raccourcis clavier ---------------- */
  function onKey(e) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); doCopy(); return; }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); doPaste(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); doCopy(); doPaste(); return; }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); S.sel = new Set(els().map((x) => x.id)); renderProps(); render(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
    if (e.key === 'Escape') { if (S.draft) { S.draft = null; finishBtn.style.display = 'none'; render(); } else { S.sel.clear(); renderProps(); render(); } return; }
    if (e.key === 'Enter' && S.draft) { e.preventDefault(); finishDraft(); return; }
    if (e.key === ' ') { e.preventDefault(); togglePlay(); return; }
    if (e.key === 'v' || e.key === 'V') { setTool('select'); return; }
    if (e.key === 'h' || e.key === 'H') { setTool('pan'); return; }
    if (e.key === 'g' || e.key === 'G') { S.grid = !S.grid; syncToggles(); render(); return; }
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = e.shiftKey ? GRID_STEP : 5;
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d) nudge(d[0], d[1]);
    }
  }
  document.addEventListener('keydown', onKey);

  /* ---------------- Sauvegarde ---------------- */
  function save() {
    if (!S.drill.title || !S.drill.title.trim()) {
      toast(t('msg.titleRequired'), 'err');
      titleInput.focus();
      return;
    }
    S.dirty = false; S.onDirty(false);
    opts.onSave && opts.onSave(S.drill);
  }

  /* ---------------- Cycle de vie ---------------- */
  function destroy() {
    stopPlay();
    if (ro) ro.disconnect();
    document.removeEventListener('keydown', onKey);
    drawer.remove(); drawerBack.remove();
  }

  fit(); syncToggles(); renderAll();

  return {
    root, destroy,
    get state() { return S; },
    currentSequenceIndex: () => S.seq,
    isDirty: () => S.dirty,
    setSequence: (i) => { S.seq = clamp(i, 0, seqs().length - 1); renderAll(); },
    reload: (drill) => { S.drill = drill; S.seq = 0; S.sel.clear(); S.history = []; S.hIndex = -1;
      titleInput.value = drill.title || ''; surfaceSel.value = drill.surface; fit(); renderAll(); },
  };
}
