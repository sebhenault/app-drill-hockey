/**
 * Plans de pratique : liste, constructeur, totaux, impression.
 * Le module ne connaît pas le routeur : il reçoit un contexte `ctx` qui
 * expose les données et la navigation.
 */

import { el, uid, nowIso, esc, clamp, fmtDate, toast, deepCopy } from './util.js';
import { AGE_GROUPS, labelAge } from './taxonomy.js';
import { t } from './i18n.js';
import { drillPrintHtml, printHtml, exportJson, bundle } from './exporter.js';
import { standaloneSvg } from './render.js';
import { practiceCoachLink, drillCoachLink, shareOrCopy } from './coach.js';

export function newPlan() {
  const now = nowIso();
  return {
    id: uid('plan'), schemaVersion: 1,
    title: 'Nouvelle pratique', ageGroup: 'u11',
    date: new Date().toISOString().slice(0, 10),
    plannedDuration: 60,
    items: [], equipment: [], coachNotes: '',
    createdAt: now, updatedAt: now,
  };
}

const ITEM_LABELS = {
  drill: 'Exercice', warmup: 'Échauffement', break: 'Pause',
  conclusion: 'Conclusion', note: 'Note',
};

export const planTotal = (plan) => plan.items.reduce((a, i) => a + (+i.duration || 0), 0);

/* ==========================================================================
   Liste des plans
   ========================================================================== */
export function viewPlansList(ctx) {
  const wrap = el('div', { class: 'view-pad' });
  wrap.appendChild(el('div', { class: 'sec-head' }, [
    el('h1', { text: t('nav.plans') }),
    el('button', { class: 'btn btn-primary ml-auto', onclick: async () => {
      const p = newPlan();
      await ctx.savePlan(p);
      ctx.go(`#/plan/${p.id}`);
    } }, ['+ ' + t('act.newPlan')]),
  ]));

  if (!ctx.plans.length) {
    wrap.appendChild(el('div', { class: 'empty' }, [el('p', { text: t('plan.none') })]));
    return wrap;
  }

  const list = el('div', { class: 'grid-cards' });
  for (const p of [...ctx.plans].sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
    const total = planTotal(p);
    const over = total > p.plannedDuration;
    list.appendChild(el('button', { class: 'card', style: 'text-align:left;cursor:pointer',
      onclick: () => ctx.go(`#/plan/${p.id}`) }, [
      el('h3', { text: p.title }),
      el('div', { class: 'flex gap-1 wrap mt-1' }, [
        el('span', { class: 'badge', text: labelAge(p.ageGroup) }),
        el('span', { class: 'badge', text: fmtDate(p.date) || p.date }),
        el('span', { class: `badge ${over ? 'badge-warn' : 'badge-ok'}`,
          text: `${total} / ${p.plannedDuration} min` }),
      ]),
      el('p', { class: 'txt-sm txt-2 mt-1',
        text: `${p.items.filter((i) => i.type === 'drill').length} exercice(s), ${p.items.length} bloc(s)` }),
    ]));
  }
  wrap.appendChild(list);
  return wrap;
}

/* ==========================================================================
   Constructeur de plan
   ========================================================================== */
export function viewPlanEditor(ctx, plan) {
  const wrap = el('div', { class: 'view-pad' });
  let dragId = null;

  const save = ctx.debounce(async () => {
    plan.updatedAt = nowIso();
    await ctx.savePlan(plan);
  }, 400);

  /* ---- En-tête ---- */
  const head = el('div', { class: 'card mb-2' }, [
    el('div', { class: 'row' }, [
      el('label', { class: 'field', style: 'flex:2 1 240px' }, [
        el('span', { class: 'lbl', text: t('plan.title') }),
        el('input', { class: 'inp', value: plan.title, oninput: (e) => { plan.title = e.target.value; save(); } }),
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'lbl', text: t('drill.age') }),
        el('select', { class: 'inp', onchange: (e) => { plan.ageGroup = e.target.value; save(); } },
          AGE_GROUPS.map((a) => el('option', { value: a.id, selected: a.id === plan.ageGroup, text: a.fr }))),
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'lbl', text: t('plan.date') }),
        el('input', { class: 'inp', type: 'date', value: plan.date, oninput: (e) => { plan.date = e.target.value; save(); } }),
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'lbl', text: `${t('plan.planned')} (min)` }),
        el('input', { class: 'inp', type: 'number', min: '15', max: '180', step: '5', value: String(plan.plannedDuration),
          oninput: (e) => { plan.plannedDuration = clamp(+e.target.value || 60, 5, 240); save(); refreshTotal(); } }),
      ]),
    ]),
  ]);

  /* ---- Total ---- */
  const totalBar = el('div', { class: 'total-bar mb-2', role: 'status' });
  function refreshTotal() {
    const total = planTotal(plan);
    const diff = total - plan.plannedDuration;
    totalBar.className = 'total-bar mb-2' + (diff > 0 ? ' over' : '');
    totalBar.innerHTML = '';
    totalBar.append(
      el('span', { text: t('plan.total') + ' :' }),
      el('span', { class: 'big', text: `${total} min` }),
      el('span', { class: 'txt-2', text: `/ ${plan.plannedDuration} min prévues` }),
      diff > 0
        ? el('span', { class: 'badge badge-warn', text: t('plan.over', { n: diff }) })
        : el('span', { class: 'badge badge-ok', text: `${t('plan.remaining')} : ${-diff} min` }),
    );
  }

  /* ---- Liste des blocs ---- */
  const itemsBox = el('div', { class: 'plan-items' });

  function moveItem(from, to) {
    if (to < 0 || to >= plan.items.length || from === to) return;
    const [x] = plan.items.splice(from, 1);
    plan.items.splice(to, 0, x);
    save(); renderItems();
  }

  function renderItems() {
    itemsBox.innerHTML = '';
    if (!plan.items.length) {
      itemsBox.appendChild(el('div', { class: 'empty' }, [el('p', { text: t('plan.empty') })]));
      refreshTotal();
      return;
    }
    plan.items.forEach((it, idx) => {
      const drill = it.drillId ? ctx.drillById(it.drillId) : null;
      const row = el('div', {
        class: `plan-item type-${it.type}`, draggable: 'true',
        ondragstart: (e) => { dragId = it.id; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; },
        ondragend: () => { dragId = null; row.classList.remove('dragging'); },
        ondragover: (e) => { e.preventDefault(); row.classList.add('drop-target'); },
        ondragleave: () => row.classList.remove('drop-target'),
        ondrop: (e) => {
          e.preventDefault(); row.classList.remove('drop-target');
          const from = plan.items.findIndex((x) => x.id === dragId);
          if (from >= 0) moveItem(from, idx);
        },
      }, [
        el('span', { class: 'handle', 'aria-hidden': 'true',
          html: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.4"/><circle cx="11" cy="3" r="1.4"/><circle cx="5" cy="8" r="1.4"/><circle cx="11" cy="8" r="1.4"/><circle cx="5" cy="13" r="1.4"/><circle cx="11" cy="13" r="1.4"/></svg>' }),
        el('div', { class: 'pi-body' }, [
          el('strong', { text: it.title }),
          el('span', { class: 'txt-sm txt-2', text: ITEM_LABELS[it.type] + (drill ? ` · ${drill.summary.slice(0, 70)}` : '') }),
        ]),
        el('label', { class: 'pi-dur' }, [
          el('span', { class: 'sr-only', text: 'Durée en minutes' }),
          el('input', { class: 'inp', type: 'number', min: '1', max: '60', value: String(it.duration),
            'aria-label': `Durée de ${it.title}`,
            oninput: (e) => { it.duration = clamp(+e.target.value || 1, 1, 120); refreshTotal(); save(); } }),
        ]),
        el('div', { class: 'flex', style: 'flex:0 0 auto;gap:2px' }, [
          el('button', { class: 'btn btn-icon btn-sm btn-ghost', 'aria-label': t('plan.moveUp'), title: t('plan.moveUp'),
            onclick: () => moveItem(idx, idx - 1) }, ['↑']),
          el('button', { class: 'btn btn-icon btn-sm btn-ghost', 'aria-label': t('plan.moveDown'), title: t('plan.moveDown'),
            onclick: () => moveItem(idx, idx + 1) }, ['↓']),
          drill ? el('button', { class: 'btn btn-icon btn-sm btn-ghost', 'aria-label': 'Voir la fiche', title: 'Voir la fiche',
            onclick: () => ctx.go(`#/drill/${drill.id}`) }, ['↗']) : null,
          el('button', { class: 'btn btn-icon btn-sm btn-ghost', 'aria-label': t('act.delete'), title: t('act.delete'),
            onclick: () => { plan.items.splice(idx, 1); save(); renderItems(); } }, ['✕']),
        ]),
      ]);
      itemsBox.appendChild(row);
    });
    refreshTotal();
  }

  function addBlock(type, title, duration) {
    plan.items.push({ id: uid('pi'), type, title, duration });
    save(); renderItems();
  }

  const addBar = el('div', { class: 'flex gap-1 wrap mb-2' }, [
    el('button', { class: 'btn btn-primary', onclick: () => openDrillPicker() }, ['+ ' + t('plan.addDrill')]),
    el('button', { class: 'btn btn-sm', onclick: () => addBlock('warmup', 'Échauffement', 8) }, [t('plan.addWarmup')]),
    el('button', { class: 'btn btn-sm', onclick: () => addBlock('break', 'Pause / gorgée d’eau', 2) }, [t('plan.addBreak')]),
    el('button', { class: 'btn btn-sm', onclick: () => addBlock('conclusion', 'Retour au calme et message', 5) }, [t('plan.addConclusion')]),
    el('button', { class: 'btn btn-sm', onclick: () => addBlock('note', 'Note', 0) }, [t('plan.addNote')]),
  ]);

  /* ---- Sélecteur d'exercice ---- */
  function openDrillPicker() {
    const search = el('input', { class: 'inp', placeholder: t('lib.search'), 'aria-label': t('lib.search') });
    const results = el('div', { class: 'stack', style: 'max-height:52vh;overflow-y:auto' });
    const fill = () => {
      const q = search.value.trim().toLowerCase();
      results.innerHTML = '';
      const list = ctx.drills
        .filter((d) => !q || d.title.toLowerCase().includes(q) || (d.keywords || []).some((k) => k.includes(q)))
        .filter((d) => !q ? d.ageGroups.includes(plan.ageGroup) || true : true)
        .slice(0, 60);
      if (!list.length) { results.appendChild(el('p', { class: 'txt-2', text: t('lib.none') })); return; }
      for (const d of list) {
        results.appendChild(el('button', { class: 'list-row', onclick: () => {
          plan.items.push({ id: uid('pi'), type: 'drill', drillId: d.id, title: d.title, duration: d.durationMin });
          save(); renderItems();
          toast(t('msg.addedToPlan', { t: plan.title }), 'ok');
          ctx.closeModal();
        } }, [
          el('div', { class: 'info' }, [
            el('h3', { text: d.title }),
            el('div', { class: 'flex gap-1 wrap' }, [
              el('span', { class: 'badge', text: d.ageGroups.map(labelAge).join(', ') }),
              el('span', { class: 'badge', text: `${d.durationMin} min` }),
            ]),
          ]),
        ]));
      }
    };
    search.addEventListener('input', fill);
    fill();
    ctx.openModal(t('plan.addDrill'), el('div', { class: 'stack' }, [search, results]), []);
    setTimeout(() => search.focus(), 40);
  }

  /* ---- Notes et matériel ---- */
  const notes = el('div', { class: 'card' }, [
    el('label', { class: 'field' }, [
      el('span', { class: 'lbl', text: t('plan.equipment') }),
      el('input', { class: 'inp', value: (plan.equipment || []).join(', '),
        placeholder: 'cônes, rondelles, dossards',
        oninput: (e) => { plan.equipment = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); save(); } }),
    ]),
    el('label', { class: 'field' }, [
      el('span', { class: 'lbl', text: t('plan.notes') }),
      el('textarea', { class: 'inp', rows: '4', value: plan.coachNotes,
        oninput: (e) => { plan.coachNotes = e.target.value; save(); } }),
    ]),
  ]);

  /* ---- Actions ---- */
  const actions = el('div', { class: 'card stack' }, [
    el('h3', { text: t('act.export') }),
    el('button', { class: 'btn btn-primary btn-block', onclick: () => openCoachShare(ctx, plan) }, ['Liens pour les coachs']),
    el('button', { class: 'btn btn-block', onclick: () => printPlan(ctx, plan) }, [t('act.print') + ' / PDF']),
    el('button', { class: 'btn btn-block', onclick: () => exportJson(bundle({ plans: [plan] }), `plan-${plan.date}.json`) },
      [t('exp.json')]),
    el('button', { class: 'btn btn-block', onclick: async () => {
      const copy = deepCopy(plan);
      copy.id = uid('plan'); copy.title = plan.title + ' (copie)';
      copy.createdAt = copy.updatedAt = nowIso();
      copy.items = copy.items.map((i) => ({ ...i, id: uid('pi') }));
      await ctx.savePlan(copy); ctx.go(`#/plan/${copy.id}`);
      toast(t('msg.duplicated'), 'ok');
    } }, [t('act.duplicate')]),
    el('button', { class: 'btn btn-block btn-danger', onclick: async () => {
      if (!(await ctx.confirm(t('msg.confirmDelete', { t: plan.title })))) return;
      await ctx.deletePlan(plan.id); ctx.go('#/plans'); toast(t('msg.deleted'), 'ok');
    } }, [t('act.delete')]),
  ]);

  wrap.append(
    el('div', { class: 'flex items-c gap-1 mb-2' }, [
      el('button', { class: 'btn btn-sm', onclick: () => ctx.go('#/plans') }, ['‹ ' + t('nav.plans')]),
    ]),
    head, totalBar,
    el('div', { class: 'plan-grid' }, [
      el('div', {}, [addBar, itemsBox]),
      el('div', { class: 'stack' }, [notes, actions]),
    ]),
  );
  renderItems();
  return wrap;
}

/* ==========================================================================
   Liens pour les coachs
   ========================================================================== */
function openCoachShare(ctx, plan) {
  const drillItems = plan.items
    .map((it) => ({ it, d: it.type === 'drill' && it.drillId ? ctx.drillById(it.drillId) : null }))
    .filter((x) => x.d);
  const noVideo = drillItems.filter((x) => !(x.d.videos && x.d.videos.length)).length;

  const body = el('div', { class: 'stack' }, [
    el('p', { class: 'txt-sm', text: 'Les coachs ouvrent le lien sur leur téléphone : aucun compte ni application à installer. '
      + 'Chaque exercice montre son diagramme, sa vidéo et ses points clés.' }),
    el('button', { class: 'btn btn-primary btn-block', onclick: async () => {
      shareOrCopy(await practiceCoachLink(plan, ctx.drillById), plan.title);
    } }, ['Partager toute la pratique']),
    el('button', { class: 'btn btn-block', onclick: async () => {
      const url = await practiceCoachLink(plan, ctx.drillById);
      ctx.closeModal();
      location.href = url;
    } }, ['Voir l’aperçu']),
    noVideo ? el('p', { class: 'notice notice-warn txt-sm',
      text: `${noVideo} exercice(s) sans vidéo. Ajoute l’adresse dans la fiche (bouton Informations de l’éditeur).` }) : null,
    drillItems.length ? el('h4', { class: 'mt-1', text: 'Un exercice à la fois' }) : null,
    ...drillItems.map(({ it, d }) => el('div', { class: 'flex items-c gap-1' }, [
      el('span', { style: 'flex:1;min-width:0', text: it.title }),
      el('button', { class: 'btn btn-sm', onclick: async () => shareOrCopy(await drillCoachLink(d, it.duration), it.title) },
        ['Partager']),
    ])),
  ]);
  ctx.openModal('Liens pour les coachs', body, [el('button', { class: 'btn', onclick: ctx.closeModal }, [t('act.close')])]);
}

/* ==========================================================================
   Impression d'un plan
   ========================================================================== */
export function printPlan(ctx, plan) {
  const total = planTotal(plan);
  let clock = 0;
  let h = `<div class="print-doc">
    <h1>${esc(plan.title)}</h1>
    <p><strong>${esc(labelAge(plan.ageGroup))}</strong> · ${esc(fmtDate(plan.date) || plan.date)} ·
       ${total} min planifiées sur ${plan.plannedDuration} min</p>`;
  if (total > plan.plannedDuration) {
    h += `<p><strong>Attention :</strong> ${t('plan.over', { n: total - plan.plannedDuration })}</p>`;
  }
  if (plan.equipment && plan.equipment.length) {
    h += `<p><strong>${t('plan.equipment')} :</strong> ${esc(plan.equipment.join(', '))}</p>`;
  }
  h += '<h3>Déroulement</h3>';
  for (const it of plan.items) {
    const start = clock; clock += (+it.duration || 0);
    h += `<div class="plan-print-row">
      <div class="t">${fmtClock(start)}</div>
      <div style="flex:1">
        <strong>${esc(it.title)}</strong> <span class="txt-2">(${it.duration} min · ${esc(ITEM_LABELS[it.type])})</span>
        ${it.notes ? `<br>${esc(it.notes)}` : ''}
      </div></div>`;
  }
  if (plan.coachNotes) h += `<h3>${t('plan.notes')}</h3><p>${esc(plan.coachNotes).replace(/\n/g, '<br>')}</p>`;

  // Une page par exercice, avec son premier diagramme.
  for (const it of plan.items) {
    if (it.type !== 'drill' || !it.drillId) continue;
    const d = ctx.drillById(it.drillId);
    if (!d) continue;
    h += `<div class="page-break"></div>${drillPrintHtml(d, {
      includeTitle: true, includeDiagram: true, includeLegend: true, includeDescription: true,
      includeTeachingPoints: true, includeDuration: true, includeEquipment: true,
      includeSource: true, includeQrCode: false, sequenceIds: [],
    })}`;
  }
  h += `<p class="txt-sm">${t('legal.disclaimer')}</p></div>`;
  printHtml(h);
}

function fmtClock(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Vignette d'aperçu d'un plan (non utilisée en impression). */
export function planThumb(ctx, plan) {
  const first = plan.items.find((i) => i.type === 'drill' && i.drillId);
  const d = first && ctx.drillById(first.drillId);
  if (!d) return '';
  return standaloneSvg({ surface: d.surface, elements: d.sequences[0].elements, width: 400, title: d.title });
}
