/* ─────────────────────────────────────────────────────────────
   MAINTENANCE — APP
   maintenance.js

   Seventh management app (login tile + profile menus of all apps).
   Tabs: Renovierungen · Schäden. Each tab lists its cases grouped
   by property, in the order of the Properties app; a property
   without cases is not shown. Done cases fold per property.

   Two levels only: the list and ONE panel (read view ⇄ edit).
   Panel: bottom sheet (phone) · centred window (iPad) ·
          side panel next to the list (laptop) — like Settlements.
   After Save the panel goes back to its read view.

   Data:       maint_cases · maint_docs · bucket maintenance-docs
               (MAINTENANCE.sql)
   Properties: read only, from `properties` (Properties app)
   Rules:      Kosten = sum of the Rechnungen (year by Rechnungsdatum)
               · one status field: open / in_progress / done
                 ("Planned" in Renovierungen, "Open" in Schäden)
               · the property name is saved with the case, so the case
                 keeps it if the property is removed later
               · Save shows at once and retries once by itself; a toast
                 only when it really failed (the form comes back)

   Bucket B: list, summary, panel (read, edit, new, delete, type switch).
   Bucket C: documents (photos, upload, Rechnungen → Kosten).
   ───────────────────────────────────────────────────────────── */

'use strict';

const MT = {
  tab: (() => {
    try { const t = localStorage.getItem('mt_last_tab'); return ['renovierung', 'schaden'].includes(t) ? t : 'renovierung'; }
    catch (e) { return 'renovierung'; }
  })(),
  props: [],        // properties: id, name, sort_order
  cases: [],        // maint_cases rows
  docs:  [],        // maint_docs rows (no file contents)
  loaded: false,
  loadError: null,
  open: {},         // unfolded "Done" groups: { 'schaden|p:4': true }
  sel: null,        // panel: { id, isNew, edit, draft, snap }
  busy: false,      // a save / delete is running
};

const MT_KIND = {
  renovierung: { title: 'Renovierungen', one: 'Renovierung', empty: 'No Renovierungen yet.', open: 'Planned', openCount: 'planned' },
  schaden:     { title: 'Schäden',       one: 'Schaden',     empty: 'No Schäden yet.',       open: 'Open',    openCount: 'open' },
};
const MT_PAID = [['me', 'Me'], ['versicherung', 'Versicherung'], ['mieter', 'Mieter'], ['weg', 'WEG / HV']];

/* ── Small helpers ────────────────────────────────────────── */
const mtEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mtEur = n => ccFmtEUR(Math.round((Number(n) || 0) * 100) / 100);
const mtDate = iso => (iso ? ccFmtDate(iso) : '');
const mtYear = () => ccTodayISO().slice(0, 4);
const mtStatusLabel = (kind, s) => (s === 'done' ? 'Done' : s === 'in_progress' ? 'In progress' : (MT_KIND[kind] || MT_KIND.schaden).open);
const mtPillCls = s => (s === 'done' ? 'mt-pill--done' : s === 'in_progress' ? 'mt-pill--prog' : 'mt-pill--open');
const mtPill = (kind, s) => `<span class="mt-pill ${mtPillCls(s)}">${mtStatusLabel(kind, s)}</span>`;
const mtPaidLabel = v => (MT_PAID.find(p => p[0] === v) || [null, ''])[1];
const mtCase = id => MT.cases.find(c => String(c.id) === String(id)) || null;
const mtProp = id => (id === null || id === undefined || id === '' ? null : MT.props.find(p => String(p.id) === String(id)) || null);
const mtPropName = c => { const p = mtProp(c.property_id); return p ? p.name : (c.property_name || 'Unknown property'); };
function mtSay(msg) { if (typeof ctlToast === 'function') ctlToast(msg); }
function mtUuid() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
const mtNativeVal = el => (el ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(el) : '');
const mtFine = () => window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Kosten: the Rechnungen of these cases (optionally one year, by Rechnungsdatum) */
function mtCost(caseIds, year) {
  const ids = new Set(caseIds.map(String));
  const sum = MT.docs.reduce((a, d) => {
    if (d.doc_type !== 'rechnung' || !ids.has(String(d.case_id))) return a;
    if (year && String(d.doc_date || ccDayOf(d.created_at) || '').slice(0, 4) !== year) return a;
    return a + (Number(d.amount) || 0);
  }, 0);
  return Math.round(sum * 100) / 100;
}
const mtAmt = n => (n ? mtEur(n) : '—');

/* A save/delete: one automatic retry (a connection hiccup is not an error) */
async function mtTry(fn) {
  const run = async () => { try { return (await fn()) || {}; } catch (e) { return { error: e }; } };
  let r = await run();
  if (r.error) { await new Promise(res => setTimeout(res, 400)); r = await run(); }
  return r;
}

/* ── Data ─────────────────────────────────────────────────── */
async function mtLoad() {
  const sb = _ctlSupa;
  const once = () => Promise.all([
    sb.from('properties').select('id,name,sort_order').order('sort_order', { ascending: true }),
    sb.from('maint_cases').select('*'),
    sb.from('maint_docs').select('id,case_id,doc_type,file_path,file_name,amount,doc_date,created_at'),
  ]);
  let res = await once();
  if (res.some(r => r.error)) {
    await new Promise(r => setTimeout(r, 400));
    res = await once();
  }
  const bad = res.find(r => r.error);
  if (bad) throw bad.error;
  [MT.props, MT.cases, MT.docs] = res.map(r => r.data || []);
  MT.loaded = true;
}

/* ── Tabs ─────────────────────────────────────────────────── */
function mtSwitchTab(kind) {
  if (!MT_KIND[kind]) kind = 'renovierung';
  MT.tab = kind;
  try { localStorage.setItem('mt_last_tab', kind); } catch (e) {}
  document.querySelectorAll('#appTabs .cc-tab').forEach(b => {
    const on = b.dataset.tab === kind;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  Object.keys(MT_KIND).forEach(k => {
    const el = document.getElementById('tab-' + k);
    if (el) el.style.display = k === kind ? '' : 'none';
  });
  mtRender();
}
/* Tapping a tab: an open panel closes (asks first if there are unsaved changes) */
async function mtTabClick(kind) {
  if (kind === MT.tab) return;
  if (MT.sel && !(await mtClose())) return;
  mtSwitchTab(kind);
  window.scrollTo(0, 0);
}

/* ── List ─────────────────────────────────────────────────── */
/* Cases of one tab, grouped by property (Properties order; removed properties last) */
function mtGroups(kind) {
  const list = MT.cases.filter(c => c.kind === kind);
  const groups = new Map();
  list.forEach(c => {
    const p = mtProp(c.property_id);
    const key = p ? 'p:' + p.id : 'n:' + (c.property_name || '');
    if (!groups.has(key)) groups.set(key, { key, name: mtPropName(c), order: p ? (Number(p.sort_order) || 0) : 1e9, cases: [] });
    groups.get(key).cases.push(c);
  });
  const byDate = (a, b) => String(b.case_date || '').localeCompare(String(a.case_date || '')) ||
                           String(b.created_at || '').localeCompare(String(a.created_at || ''));
  return [...groups.values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'de'))
    .map(g => ({ ...g, active: g.cases.filter(c => c.status !== 'done').sort(byDate), done: g.cases.filter(c => c.status === 'done').sort(byDate) }));
}

function mtRowHTML(c) {
  const sub = [c.area, mtDate(c.case_date)].filter(Boolean).map(mtEsc).join(' · ');
  const cost = mtCost([c.id]);
  const sel = MT.sel && !MT.sel.isNew && String(MT.sel.id) === String(c.id) ? ' is-sel' : '';
  return `<button type="button" class="mt-row${sel}" data-mt="open" data-id="${mtEsc(c.id)}">
      <span class="mt-row__l"><span class="mt-row__t">${mtEsc(c.title)}</span>${sub ? `<span class="mt-row__s">${sub}</span>` : ''}</span>
      <span class="mt-row__r"><span class="mt-row__a${cost ? '' : ' mt-mu'}">${mtAmt(cost)}</span>${mtPill(c.kind, c.status)}</span>
    </button>`;
}

function mtRender() {
  const kind = MT.tab;
  const el = document.getElementById('tab-' + kind);
  if (!el) return;
  if (MT.loadError) { el.innerHTML = mtErrorHTML(MT.loadError); return; }
  const list = MT.cases.filter(c => c.kind === kind);
  const head = `
    <div class="mt-hdr">
      <h1 class="cc-h1">${MT_KIND[kind].title}</h1>
      <button type="button" class="mt-add" data-mt="new"><i class="ti ti-plus" aria-hidden="true"></i><span>New</span></button>
    </div>`;
  if (!list.length) { el.innerHTML = head + `<p class="mt-empty">${MT_KIND[kind].empty}</p>`; return; }

  const ids = list.map(c => c.id), y = mtYear();
  const nOpen = list.filter(c => c.status === 'open').length, nProg = list.filter(c => c.status === 'in_progress').length;
  const counts = [nOpen ? `${nOpen} ${MT_KIND[kind].openCount}` : '', nProg ? `${nProg} in progress` : ''].filter(Boolean).join(' · ') || 'all done';
  const sum = `
    <div class="cc-sum2">
      <div class="cc-sum2__meta"><b>Kosten</b><span>${counts}</span></div>
      <div class="cc-sum2__vals"><span><i>${y}</i>${mtEur(mtCost(ids, y))}</span><span><i>Total</i>${mtEur(mtCost(ids))}</span></div>
    </div>`;

  const cards = mtGroups(kind).map(g => {
    const total = mtCost(g.cases.map(c => c.id));
    const fk = kind + '|' + g.key, open = !!MT.open[fk];
    const fold = g.done.length ? `
      <button type="button" class="mt-fold" data-mt="fold" data-key="${mtEsc(fk)}" aria-expanded="${open}">
        <span>Done (${g.done.length})</span><i class="ti ti-chevron-down" aria-hidden="true"></i>
      </button>${open ? g.done.map(mtRowHTML).join('') : ''}` : '';
    return `
      <section class="mt-card" aria-label="${mtEsc(g.name)}">
        <div class="mt-card__hd"><h2 class="mt-card__name">${mtEsc(g.name)}</h2><span class="mt-card__sum${total ? '' : ' mt-mu'}">${mtAmt(total)}</span></div>
        ${g.active.map(mtRowHTML).join('')}${fold}
      </section>`;
  }).join('');

  el.innerHTML = head + sum + `<div class="mt-list">${cards}</div>`;
}

function mtErrorHTML(e) {
  const msg = String((e && (e.message || e.code)) || e || '');
  const missing = /maint_(cases|docs)/i.test(msg);
  const again = t => `<a href="#" onclick="location.reload();return false;">${t}</a>`;
  return `
    <div class="mt-hdr"><h1 class="cc-h1">${MT_KIND[MT.tab].title}</h1></div>
    <p class="mt-note">${missing
      ? `The Maintenance tables are missing. Run MAINTENANCE.sql in Supabase, then ${again('try again')}.`
      : `The data could not be loaded. ${again('Try again')}`}</p>
    <p class="mt-muted">${mtEsc(msg)}</p>`;
}

/* ── Panel ────────────────────────────────────────────────── */
function mtPanelHTML() {
  const s = MT.sel;
  if (!s) return '';
  const c = s.isNew ? null : mtCase(s.id);
  if (!s.isNew && !c) return '';
  const kind = s.isNew ? s.draft.kind : c.kind;
  const title = s.isNew ? 'New ' + MT_KIND[kind].one : c.title;
  const sub = s.isNew ? 'Fill in the details' : `${mtPropName(c)} · ${MT_KIND[c.kind].one}`;
  return `
    <div class="mt-ph">
      <div class="mt-ph__ht"><p class="mt-ph__t" id="mtPanelTitle">${mtEsc(title)}</p><p class="mt-ph__s" id="mtPanelSub">${mtEsc(sub)}</p></div>
      <button type="button" class="mt-ph__x" data-mt="close" aria-label="Close"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>
    ${s.edit ? mtEditHTML(c, s) : mtReadHTML(c)}`;
}

function mtReadHTML(c) {
  const f = (k, v, full) => `<div class="mt-f${full ? ' mt-f--full' : ''}"><span class="mt-k">${k}</span>${v}</div>`;
  const v = (t, cls) => (t ? `<span class="mt-v${cls ? ' ' + cls : ''}">${mtEsc(t)}</span>` : '<span class="mt-v mt-mu">—</span>');
  return `
    <section class="mt-sec">
      <p class="mt-sec__t">Details</p>
      <div class="mt-grid">
        ${f('Property', v(mtPropName(c)))}
        ${f('Area', v(c.area))}
        ${f('Type', v(MT_KIND[c.kind].one))}
        ${f('Date', v(mtDate(c.case_date)))}
        ${f('Status', mtPill(c.kind, c.status))}
        ${c.kind === 'schaden' ? f('Paid by', v(mtPaidLabel(c.paid_by))) : ''}
        ${f('Description', v(c.description, 'mt-v--text'), true)}
      </div>
      <div class="cc-sec-foot"><button type="button" class="cc-foot-btn" data-mt="edit"><i class="ti ti-pencil" aria-hidden="true"></i> Edit</button></div>
    </section>`;
}

function mtEditHTML(c, s) {
  const d = s.draft || {
    kind: c.kind, title: c.title, property_id: c.property_id, property_name: c.property_name, area: c.area,
    case_date: c.case_date, status: c.status, paid_by: c.paid_by, description: c.description,
  };
  const pid = d.property_id === null || d.property_id === undefined ? '' : String(d.property_id);
  let props = `<option value=""${pid ? '' : ' selected'}>Choose</option>` +
    MT.props.map(p => `<option value="${mtEsc(p.id)}"${String(p.id) === pid ? ' selected' : ''}>${mtEsc(p.name)}</option>`).join('');
  if (pid && !mtProp(pid)) props += `<option value="${mtEsc(pid)}" selected>${mtEsc(d.property_name || 'Property')} (removed)</option>`;
  const kinds = Object.keys(MT_KIND).map(k => `<option value="${k}"${d.kind === k ? ' selected' : ''}>${MT_KIND[k].one}</option>`).join('');
  const stats = ['open', 'in_progress', 'done'].map(st => `<option value="${st}"${(d.status || 'open') === st ? ' selected' : ''}>${mtStatusLabel(d.kind, st)}</option>`).join('');
  const paid = `<option value=""${d.paid_by ? '' : ' selected'}>—</option>` +
    MT_PAID.map(([v, l]) => `<option value="${v}"${d.paid_by === v ? ' selected' : ''}>${l}</option>`).join('');
  return `
    <section class="mt-sec mt-sec--edit">
      <p class="mt-sec__t">Details</p>
      <div class="mt-grid">
        <div class="mt-f mt-f--full"><label class="mt-k" for="mtF-title">Title</label>
          <input class="mt-in" id="mtF-title" type="text" maxlength="120" autocomplete="off" value="${mtEsc(d.title || '')}"/></div>
        <div class="mt-f"><label class="mt-k" for="mtF-prop">Property</label><select class="mt-in" id="mtF-prop">${props}</select></div>
        <div class="mt-f"><label class="mt-k" for="mtF-area">Area</label>
          <input class="mt-in" id="mtF-area" type="text" maxlength="80" autocomplete="off" placeholder="e.g. Bad 1. OG" value="${mtEsc(d.area || '')}"/></div>
        <div class="mt-f"><label class="mt-k" for="mtF-kind">Type</label><select class="mt-in" id="mtF-kind">${kinds}</select></div>
        <div class="mt-f"><label class="mt-k" for="mtF-date">Date</label><input class="mt-in" id="mtF-date" type="date" value="${mtEsc(d.case_date || '')}"/></div>
        <div class="mt-f"><label class="mt-k" for="mtF-status">Status</label><select class="mt-in" id="mtF-status">${stats}</select></div>
        <div class="mt-f" data-only="schaden"${d.kind === 'schaden' ? '' : ' hidden'}><label class="mt-k" for="mtF-paid">Paid by</label><select class="mt-in" id="mtF-paid">${paid}</select></div>
        <div class="mt-f mt-f--full"><label class="mt-k" for="mtF-desc">Description</label>
          <textarea class="mt-in mt-ta" id="mtF-desc" rows="3" maxlength="2000">${mtEsc(d.description || '')}</textarea></div>
      </div>
      <div class="cc-sec-foot">
        ${s.isNew ? '' : '<button type="button" class="cc-foot-btn mt-del is-left" data-mt="del"><i class="ti ti-trash" aria-hidden="true"></i> Delete</button>'}
        <span class="cc-foot-right">
          <button type="button" class="cc-foot-btn" data-mt="cancel">Cancel</button>
          <button type="button" class="cc-foot-btn mt-save" data-mt="save">Save</button>
        </span>
      </div>
    </section>`;
}

function mtRenderPanel() {
  const p = document.getElementById('mtPanel'), sc = document.getElementById('mtScrim'), split = document.getElementById('mtSplit');
  if (!p) return;
  const html = mtPanelHTML();
  if (!html) {
    MT.sel = null;
    p.hidden = true; p.innerHTML = ''; p._key = '';
    if (sc) sc.hidden = true;
    split?.classList.remove('has-panel');
    document.body.classList.remove('mt-panel-open');
    return;
  }
  const who = MT.sel.isNew ? 'new' : String(MT.sel.id);
  const keep = p._key === who ? p.scrollTop : 0;             // same entry → keep the scroll position
  p.innerHTML = html;
  p.hidden = false;
  if (sc) sc.hidden = false;
  split?.classList.add('has-panel');
  document.body.classList.add('mt-panel-open');
  p.scrollTop = keep;
  p._key = who;
  // the date field becomes a German field right after it is drawn → note the form after that
  if (MT.sel.edit) { const sel = MT.sel; delete sel.snap; setTimeout(() => { if (MT.sel === sel && sel.edit) sel.snap = mtFormSnap(); }, 0); }
}

/* What the form says right now (to notice unsaved changes) */
function mtFormSnap() {
  return ['mtF-title', 'mtF-prop', 'mtF-area', 'mtF-kind', 'mtF-date', 'mtF-status', 'mtF-paid', 'mtF-desc']
    .map(id => { const el = document.getElementById(id); return el ? el.value : ''; })
    .join('\u0001');
}
const mtDirty = () => !!(MT.sel && MT.sel.edit && MT.sel.snap !== undefined && mtFormSnap() !== MT.sel.snap);

/* Type changed in the form: status words, "Paid by" and the new-entry title follow */
function mtKindChanged() {
  const kind = document.getElementById('mtF-kind')?.value;
  if (!MT_KIND[kind]) return;
  const st = document.getElementById('mtF-status');
  if (st) [...st.options].forEach(o => { o.textContent = mtStatusLabel(kind, o.value); });
  const paid = document.querySelector('#mtPanel [data-only="schaden"]');
  if (paid) paid.hidden = kind !== 'schaden';
  if (MT.sel && MT.sel.isNew) {
    MT.sel.draft.kind = kind;
    const t = document.getElementById('mtPanelTitle');
    if (t) t.textContent = 'New ' + MT_KIND[kind].one;
  }
}

/* Read + check the form. Returns the fields, or null (and says what is missing). */
function mtReadForm() {
  const g = id => document.getElementById(id);
  const bad = (id, msg) => {
    const el = g(id);
    if (el) {
      el.setAttribute('aria-invalid', 'true');
      el.addEventListener('input', () => el.removeAttribute('aria-invalid'), { once: true });
      if (!el.classList.contains('cc-cal')) el.focus();       // a date field would open the calendar on focus
    }
    mtSay(msg);
    return null;
  };
  const title = g('mtF-title').value.trim();
  const pid = g('mtF-prop').value;
  const kind = g('mtF-kind').value;
  const dateEl = g('mtF-date');
  const date = dateEl.value || '';                         // ISO, or '' when empty / not a date
  if (!title) return bad('mtF-title', 'Add a title.');
  if (!pid) return bad('mtF-prop', MT.props.length ? 'Choose the property.' : 'No properties yet. Add them in the Properties app first.');
  if (!date && mtNativeVal(dateEl).trim()) return bad('mtF-date', 'Check the date (TT.MM.JJJJ).');
  const p = mtProp(pid);
  const old = MT.sel && !MT.sel.isNew ? mtCase(MT.sel.id) : null;
  return {
    kind: MT_KIND[kind] ? kind : MT.tab,
    title,
    property_id: Number(pid),
    property_name: p ? p.name : ((MT.sel.draft && MT.sel.draft.property_name) || (old && old.property_name) || ''),
    area: g('mtF-area').value.trim() || null,
    case_date: date || null,
    status: g('mtF-status').value || 'open',
    paid_by: kind === 'schaden' ? (g('mtF-paid').value || null) : null,
    description: g('mtF-desc').value.trim() || null,
  };
}

/* ── Panel actions ────────────────────────────────────────── */
async function mtOpen(id) {
  if (MT.sel && !MT.sel.isNew && String(MT.sel.id) === String(id) && !MT.sel.edit) return;
  if (MT.sel && !(await mtClose())) return;
  MT.sel = { id, isNew: false, edit: false };
  mtRenderPanel();
  mtRender();
}

async function mtNew() {
  if (MT.sel && !(await mtClose())) return;
  MT.sel = {
    id: null, isNew: true, edit: true,
    draft: { kind: MT.tab, title: '', property_id: '', area: '', case_date: ccTodayISO(), status: 'open', paid_by: '', description: '' },
  };
  mtRenderPanel();
  mtRender();
  if (mtFine()) document.getElementById('mtF-title')?.focus();
}

function mtEdit() {
  if (!MT.sel || MT.sel.isNew) return;
  MT.sel = { id: MT.sel.id, isNew: false, edit: true };
  mtRenderPanel();
}

function mtCancel() {
  if (!MT.sel) return;
  if (MT.sel.isNew) { mtClose(true); return; }
  MT.sel = { id: MT.sel.id, isNew: false, edit: false };
  mtRenderPanel();
}

/* Close the panel. Unsaved changes → ask first. Returns true when it closed. */
async function mtClose(force) {
  if (!MT.sel) return true;
  if (!force && mtDirty()) {
    const ok = await mtConfirm({ title: 'Discard your changes?', text: 'What you typed in this entry is not saved.', ok: 'Discard', cancel: 'Keep editing', danger: true });
    if (!ok) return false;
  }
  MT.sel = null;
  mtRenderPanel();
  mtRender();
  return true;
}

async function mtSave() {
  const s = MT.sel;
  if (!s || !s.edit || MT.busy) return;
  const f = mtReadForm();
  if (!f) return;
  MT.busy = true;
  const isNew = !!s.isNew, id = isNew ? mtUuid() : s.id;
  const oldRow = isNew ? null : { ...mtCase(id) };
  const now = new Date().toISOString();
  const row = { ...(oldRow || {}), ...f, id, updated_at: now, created_at: oldRow ? oldRow.created_at : now };

  // 1 · show it at once: list + panel back in the read view
  if (isNew) MT.cases.push(row); else Object.assign(mtCase(id), row);
  MT.sel = { id, isNew: false, edit: false };
  if (row.kind !== MT.tab) mtSwitchTab(row.kind); else mtRender();       // type changed → the list follows
  mtRenderPanel();

  // 2 · store it (one retry)
  const sb = _ctlSupa;
  const payload = {
    kind: f.kind, title: f.title, property_id: f.property_id, property_name: f.property_name, area: f.area,
    case_date: f.case_date, status: f.status, paid_by: f.paid_by, description: f.description,
  };
  const r = await mtTry(() => (isNew ? sb.from('maint_cases').insert({ id, ...payload }) : sb.from('maint_cases').update(payload).eq('id', id)));
  MT.busy = false;
  if (!r.error) return;

  // 3 · not stored: everything back as it was, the form comes back with what you typed
  console.error('[maintenance] save failed:', r.error);
  if (isNew) MT.cases = MT.cases.filter(c => c.id !== id);
  else Object.assign(mtCase(id), oldRow);
  MT.sel = { id: isNew ? null : id, isNew, edit: true, draft: { ...f } };
  const backTo = isNew ? MT.tab : oldRow.kind;
  if (backTo !== MT.tab) mtSwitchTab(backTo); else mtRender();
  mtRenderPanel();
  mtSay('Not saved. Check the connection and save again.');
}

async function mtDelete() {
  const c = MT.sel && !MT.sel.isNew ? mtCase(MT.sel.id) : null;
  if (!c || MT.busy) return;
  const n = MT.docs.filter(d => String(d.case_id) === String(c.id)).length;
  const ok = await mtConfirm({
    title: 'Delete this entry?',
    text: `"${c.title}"${n ? ` and its ${n} document${n === 1 ? '' : 's'}` : ''} will be deleted for good.`,
    ok: 'Delete', danger: true,
  });
  if (!ok) return;
  MT.busy = true;
  const idx = MT.cases.indexOf(c);
  const docs = MT.docs.filter(d => String(d.case_id) === String(c.id));
  MT.cases.splice(idx, 1);
  MT.docs = MT.docs.filter(d => String(d.case_id) !== String(c.id));
  MT.sel = null;
  mtRenderPanel();
  mtRender();

  const sb = _ctlSupa;
  const r = await mtTry(() => sb.from('maint_cases').delete().eq('id', c.id));      // its document rows go with it
  MT.busy = false;
  if (r.error) {
    console.error('[maintenance] delete failed:', r.error);
    MT.cases.splice(idx, 0, c);
    MT.docs.push(...docs);
    mtRender();
    mtSay('Not deleted. Check the connection and try again.');
    return;
  }
  const paths = docs.map(d => d.file_path).filter(Boolean);
  if (paths.length) {
    try { await sb.storage.from('maintenance-docs').remove(paths); }
    catch (e) { console.warn('[maintenance] files not removed:', e); }
  }
  mtSay('Deleted');
}

/* ── In-app confirm sheet (instead of confirm()) ─────────────
   mtConfirm({ title, text, ok, cancel, danger }) → Promise<boolean> */
function mtConfirm(o) {
  return new Promise(resolve => {
    document.getElementById('mtConfirm')?.remove();
    const h = document.createElement('div');
    h.id = 'mtConfirm';
    h.className = 'mt-cf';
    h.innerHTML = `<div class="mt-cf__bg" data-v="0"></div>
      <div class="mt-cf__s" role="alertdialog" aria-modal="true" aria-labelledby="mtCfT">
        <p class="mt-cf__t" id="mtCfT">${mtEsc(o.title || 'Are you sure?')}</p>
        ${o.text ? `<p class="mt-cf__x">${mtEsc(o.text)}</p>` : ''}
        <div class="mt-cf__b">
          <button type="button" class="mt-btn ${o.danger ? 'mt-btn--d' : 'mt-btn--p'}" data-v="1">${mtEsc(o.ok || 'OK')}</button>
          <button type="button" class="mt-btn mt-btn--s" data-v="0">${mtEsc(o.cancel || 'Cancel')}</button>
        </div>
      </div>`;
    document.body.appendChild(h);
    const done = v => { document.removeEventListener('keydown', key, true); h.remove(); resolve(v); };
    const key = e => { if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); done(false); } };
    document.addEventListener('keydown', key, true);
    h.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { e.stopPropagation(); done(b.dataset.v === '1'); } });
    setTimeout(() => h.querySelector('[data-v="1"]')?.focus(), 0);
  });
}

/* ── Wiring ───────────────────────────────────────────────── */
function mtWire() {
  document.querySelectorAll('#appTabs .cc-tab').forEach(b => {
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => mtTabClick(b.dataset.tab));
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mt]');
    if (!b || MT.loadError) return;
    const a = b.dataset.mt;
    if (a === 'new') mtNew();
    else if (a === 'open') mtOpen(b.dataset.id);
    else if (a === 'fold') { MT.open[b.dataset.key] = !MT.open[b.dataset.key]; mtRender(); }
    else if (a === 'close') mtClose();
    else if (a === 'edit') mtEdit();
    else if (a === 'cancel') mtCancel();
    else if (a === 'save') mtSave();
    else if (a === 'del') mtDelete();
  });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'mtF-kind') mtKindChanged(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && MT.sel && !document.getElementById('mtConfirm') && !document.getElementById('ccCal')) mtClose();
  });
}

/* ── Boot ─────────────────────────────────────────────────── */
async function mtBoot() {
  ctlShowLoading(true);
  const session = await ctlGetSession();
  if (!session) { ctlShowLoading(false); location.replace('login.html'); return; }
  try { localStorage.setItem('mgmt_last_app', 'maintenance.html'); } catch (e) {}
  mtWire();
  try {
    await mtLoad();
    document.getElementById('appShell').style.display = 'block';
    mtSwitchTab(MT.tab);
  } catch (e) {
    console.error('[maintenance] boot failed:', e);
    MT.loadError = e;
    document.getElementById('appShell').style.display = 'block';
    mtSwitchTab(MT.tab);
  } finally {
    ctlShowLoading(false);
  }
}
