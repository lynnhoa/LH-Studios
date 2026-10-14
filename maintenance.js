/* ─────────────────────────────────────────────────────────────
   MAINTENANCE — APP
   maintenance.js

   Seventh management app (login tile + profile menus of all apps).
   Tabs: Renovierungen · Schäden. Each tab lists its cases grouped
   by property, in the order of the Properties app; a property
   without cases is not shown.

   Data:       maint_cases · maint_docs · bucket maintenance-docs
               (MAINTENANCE.sql)
   Properties: read only, from `properties` (Properties app)
   Rules:      Kosten = sum of the Rechnungen (year by Rechnungsdatum)
               · one status field: open / in_progress / done
               ("Planned" in Renovierungen, "Open" in Schäden)

   Bucket A: shell, data load, tabs, empty state.
   ───────────────────────────────────────────────────────────── */

'use strict';

const MT = {
  tab: (() => {
    try { const t = localStorage.getItem('mt_last_tab'); return ['renovierung', 'schaden'].includes(t) ? t : 'renovierung'; }
    catch (e) { return 'renovierung'; }
  })(),
  props: [],      // properties: id, name, sort_order
  cases: [],      // maint_cases rows
  docs:  [],      // maint_docs rows (no file contents)
  loaded: false,
  loadError: null,
};

const MT_KIND = {
  renovierung: { title: 'Renovierungen', empty: 'No Renovierungen yet.' },
  schaden:     { title: 'Schäden',       empty: 'No Schäden yet.' },
};

const mtEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function mtSay(msg) { if (typeof ctlToast === 'function') ctlToast(msg); }

/* ── Data ─────────────────────────────────────────────────── */
async function mtLoad() {
  const sb = _ctlSupa;
  const once = () => Promise.all([
    sb.from('properties').select('id,name,sort_order').order('sort_order', { ascending: true }),
    sb.from('maint_cases').select('*'),
    sb.from('maint_docs').select('id,case_id,doc_type,file_path,file_name,amount,doc_date,created_at'),
  ]);
  let res = await once();
  if (res.some(r => r.error)) {                       // one retry: a connection hiccup is not an error
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
  window.scrollTo(0, 0);
}

/* ── Render ───────────────────────────────────────────────── */
function mtRender() {
  const kind = MT.tab;
  const el = document.getElementById('tab-' + kind);
  if (!el) return;
  if (MT.loadError) { el.innerHTML = mtErrorHTML(MT.loadError); return; }
  const list = MT.cases.filter(c => c.kind === kind);
  el.innerHTML = `
    <div class="mt-hdr">
      <h1 class="cc-h1">${MT_KIND[kind].title}</h1>
    </div>
    ${list.length ? '' : `<p class="mt-empty">${MT_KIND[kind].empty}</p>`}`;
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

/* ── Boot ─────────────────────────────────────────────────── */
async function mtBoot() {
  ctlShowLoading(true);
  const session = await ctlGetSession();
  if (!session) { ctlShowLoading(false); location.replace('login.html'); return; }
  try { localStorage.setItem('mgmt_last_app', 'maintenance.html'); } catch (e) {}

  document.querySelectorAll('#appTabs .cc-tab').forEach(b => {
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => mtSwitchTab(b.dataset.tab));
  });

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
