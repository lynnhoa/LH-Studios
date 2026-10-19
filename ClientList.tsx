// ─────────────────────────────────────────────────────────────
// ClientList — the relationship view: list + detail (split view on
// iPad / desktop, one at a time on the phone).
//   Each client: open value (signed, not invoiced + owed) or its
//   quotes, number of projects, most urgent status, revenue this year
//   (from invoices), license hints. Chips: All · In progress · Quoted ·
//   Dormant (no open work, nothing for 90 days — money.ts).
//   Work on a project happens in Projects: the detail links there.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE, PAL, STATUS_TONE, STATUS_NAME } from "./constants";
import { fmt, addM, today } from "./formatters";
import { I, S, Lbl, Tag, TSel, TSelWrap, SummaryLine, Strong, Chip, ChipRow, PillBtn, SearchField, ListCard, Row, TonedTag } from "./atoms";
import { clientTotals } from "./money";
import { projectLicenses } from "./licenses";
import ClientDetail from "./ClientDetail";

interface ClientListProps {
  clients:          any[];
  isMobile:         boolean;
  settings:         any;
  rc:               any;
  selReset:         number;
  onSelChange:      (id: string | null) => void;
  pendingClientName:string | null;
  pendingProjectQNo:string | null;
  onPendingClear:   () => void;
  onGoToCalc:       (name: string) => void;
  onRevise:         (pr: any, cl: any) => void;
  onAmend:          (pr: any, cl: any) => void;
  goTo:             (n: number) => void;
  clientsHook:      any;
  onOpenProject?:   (projectId: string) => void;
}

// a client saved without a name (old quotes) — shown as "Needs a name"
export const needsName = (c: any) => String(c?.name || "").trim().toLowerCase() === "new client";

function usageEnd(pr: any): string | null {
  if (!pr.deliveryDate || !pr.qd) return null;
  // Longest usage period across ALL lines (matches Calculator 'mo' logic)
  let mo: number | null = pr.qd?.mo && pr.qd.mo > 0 ? pr.qd.mo : null;
  (pr.qd?.lines || []).forEach((l: any) => {
    if (!l.usageLabel) return;
    const m = String(l.usageLabel).match(/(\d+)\s*month/i);
    const itemMo = m ? parseInt(m[1]) : null;
    if (itemMo && (!mo || itemMo > mo)) mo = itemMo;
  });
  const hasRenewals = (pr.renewals || []).length > 0;
  if (!mo && !hasRenewals) return null;
  if (pr.usageEndOverride) return pr.usageEndOverride;
  return mo ? addM(pr.deliveryDate, mo) : null;
}

export default function ClientList({
  clients, isMobile, settings, rc, selReset, onSelChange,
  pendingClientName, pendingProjectQNo, onPendingClear,
  onGoToCalc, onRevise, onAmend, goTo, clientsHook, onOpenProject,
}: ClientListProps) {

  const [sel,            setSel_]          = useState<string | null>(null);
  const [highlightedQNo, setHighlightedQNo]= useState<string | null>(null);
  const [search,         setSearch]        = useState("");
  const [chip,           setChip]          = useState<"all" | "progress" | "quoted" | "dormant">("all");
  const [typeFilter,     setTypeFilter]    = useState("all");
  const [sortOrder,      setSortOrder]     = useState("recent");
  const [showAdd,        setShowAdd]       = useState(false);
  const [tagI,           setTagI]          = useState("");
  const EMPTY_CLIENT = {
    name: "", contact: "", email: "", agency: "Direct",
    street: "", plz: "", city: "", country: "Germany", vatId: "", tags: [] as string[], notes: "",
  };
  const [nb,             setNb]            = useState(EMPTY_CLIENT);

  const setSel = (v: string | null) => { setSel_(v); onSelChange(v); };

  useEffect(() => { setSel(null); }, [selReset]);

  useEffect(() => {
    if (!pendingClientName) return;
    const c = clients.find((x: any) => x.name.toLowerCase() === pendingClientName.toLowerCase());
    if (c) { setSel(c.id); if (pendingProjectQNo) setHighlightedQNo(pendingProjectQNo); }
    setTimeout(() => onPendingClear(), 100);
  }, []);

  const cl = sel ? clients.find((c: any) => c.id === sel) : null;

  // ── one money rule (money.ts) ─────────────────────────────
  const todayStr = today();
  const year = parseInt(todayStr.slice(0, 4));
  const tot = new Map<string, ReturnType<typeof clientTotals>>(clients.map((c: any) => [c.id, clientTotals(c, year, todayStr)]));
  const T = (c: any) => tot.get(c.id)!;
  const count = {
    all:      clients.length,
    progress: clients.filter((c: any) => T(c).inProgress).length,
    quoted:   clients.filter((c: any) => T(c).onlyQuotes).length,
    dormant:  clients.filter((c: any) => T(c).dormant).length,
  };

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    const arr = clients.filter((c: any) => {
      if (q && !c.name.toLowerCase().includes(q) && !String(c.contact || "").toLowerCase().includes(q) && !(c.tags || []).some((t: string) => t.toLowerCase().includes(q))) return false;
      if (typeFilter !== "all" && (c.agency || "Direct") !== typeFilter) return false;
      if (chip === "progress" && !T(c).inProgress) return false;
      if (chip === "quoted" && !T(c).onlyQuotes) return false;
      if (chip === "dormant" && !T(c).dormant) return false;
      return true;
    });
    const openOf = (c: any) => T(c).signed + T(c).owed + T(c).quotes;
    if (sortOrder === "name_az") return [...arr].sort((a: any, b: any) => a.name.localeCompare(b.name));
    if (sortOrder === "revenue") return [...arr].sort((a: any, b: any) => T(b).paidAll - T(a).paidAll);
    if (sortOrder === "open")    return [...arr].sort((a: any, b: any) => openOf(b) - openOf(a));
    return [...arr].sort((a: any, b: any) => T(b).lastActivity.localeCompare(T(a).lastActivity));
  })();

  const addCl = async () => {
    if (!nb.name.trim()) return;
    // one client per brand name — no duplicates
    if ((clientsHook.clients || []).some((c: any) => c.name.trim().toLowerCase() === nb.name.trim().toLowerCase())) return;
    await clientsHook.addClient({ ...nb, name: nb.name.trim() });
    setNb(EMPTY_CLIENT);
    setShowAdd(false);
  };

  // the most urgent license of a client (expired / ending soon)
  const licHint = (c: any) => {
    const ls = c.projects.flatMap((pr: any) => projectLicenses(pr, c)).filter((l: any) => l.alerts && !l.action && (l.state === "expired" || l.state === "expiring"));
    if (!ls.length) return null;
    if (ls.some((l: any) => l.state === "expired")) return { tone: PAL.late, text: "license expired" };
    const d = Math.min(...ls.map((l: any) => l.daysLeft));
    return { tone: PAL.waiting, text: `license ends in ${d} ${d === 1 ? "day" : "days"}` };
  };

  const detail = (mobile: boolean) => (
    <ClientDetail
      cl={cl} clients={clients} isMobile={mobile} settings={settings} rc={rc}
      clientsHook={clientsHook} onGoToCalc={onGoToCalc}
      onRevise={onRevise}
      onAmend={onAmend}
      setSel={setSel}
      highlightedQNo={highlightedQNo}
      onClearHighlight={() => setHighlightedQNo(null)}
      onOpenProject={onOpenProject}
    />
  );

  // ── Mobile: show detail only ──────────────────────────────
  if (cl && isMobile) return detail(true);

  // ── List panel ────────────────────────────────────────────
  const ListPanel = (
    <div style={{
      flex:      cl && !isMobile ? "0 0 42%" : "1 1 100%",
      minWidth:  0,
      overflowY: cl && !isMobile ? "auto" : undefined,
      maxHeight: cl && !isMobile ? "calc(100vh - 80px)" : undefined,
      fontFamily: SANS, color: C.black,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: isMobile ? 22 : TYPE.pageTitle.size, fontWeight: "normal", margin: 0, lineHeight: 1.1 }}>Clients</h2>
        <PillBtn dark onClick={() => setShowAdd(s => !s)}>+ New client</PillBtn>
      </div>
      <SummaryLine dot={count.progress ? PAL.progress.mid : PAL.neutral.mid}>
        {clients.length} client{clients.length === 1 ? "" : "s"} · <Strong>{count.progress} with work in progress</Strong>
      </SummaryLine>

      {/* New client form */}
      {showAdd && (
        <div style={{ border: "1px solid #efebe6", borderRadius: 12, padding: 14, marginTop: 12, background: C.white }}>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>New Client</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <div><Lbl>Brand Name *</Lbl><I value={nb.name} onChange={(e: any) => setNb(p => ({ ...p, name: e.target.value }))} placeholder="Sephora" />
              {nb.name.trim() && (clientsHook.clients || []).some((c: any) => c.name.trim().toLowerCase() === nb.name.trim().toLowerCase()) && (
                <p style={{ fontSize: TYPE.label.size, color: C.amber, margin: "5px 0 0" }}>A client with this name already exists.</p>
              )}
            </div>
            <div><Lbl>Contact</Lbl><I value={nb.contact} onChange={(e: any) => setNb(p => ({ ...p, contact: e.target.value }))} placeholder="Anna Müller" /></div>
            <div><Lbl>Email</Lbl><I value={nb.email} onChange={(e: any) => setNb(p => ({ ...p, email: e.target.value }))} type="email" placeholder="anna@brand.com" /></div>
            <div>
              <Lbl>Agency / Direct</Lbl>
              <S value={nb.agency} onChange={(e: any) => setNb(p => ({ ...p, agency: e.target.value }))}><option>Direct</option><option>Agency</option></S>
            </div>
            <div style={{ gridColumn: "1 / -1" }}><Lbl>Street & Number</Lbl><I value={nb.street} onChange={(e: any) => setNb(p => ({ ...p, street: e.target.value }))} placeholder="Musterstraße 12" /></div>
            <div><Lbl>PLZ</Lbl><I value={nb.plz} onChange={(e: any) => setNb(p => ({ ...p, plz: e.target.value }))} placeholder="10115" /></div>
            <div><Lbl>City</Lbl><I value={nb.city} onChange={(e: any) => setNb(p => ({ ...p, city: e.target.value }))} placeholder="Berlin" /></div>
            <div><Lbl>Country</Lbl><I value={nb.country} onChange={(e: any) => setNb(p => ({ ...p, country: e.target.value }))} placeholder="Germany" /></div>
            <div><Lbl>VAT ID (optional)</Lbl><I value={nb.vatId} onChange={(e: any) => setNb(p => ({ ...p, vatId: e.target.value }))} placeholder="DE123456789" /></div>
            <div>
              <Lbl>Tags</Lbl>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginBottom: 4 }}>
                {nb.tags.map(t => <Tag key={t} onRemove={() => setNb(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))}>{t}</Tag>)}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <I value={tagI} onChange={(e: any) => setTagI(e.target.value)} placeholder="Beauty, Fashion…"
                  onKeyDown={(e: any) => { if (e.key === "Enter" && tagI.trim()) { setNb(p => ({ ...p, tags: [...p.tags, tagI.trim()] })); setTagI(""); } }} />
                <PillBtn onClick={() => { if (tagI.trim()) { setNb(p => ({ ...p, tags: [...p.tags, tagI.trim()] })); setTagI(""); } }}>+</PillBtn>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 9 }}>
            <Lbl>Relationship Notes</Lbl>
            <I value={nb.notes} onChange={(e: any) => setNb(p => ({ ...p, notes: e.target.value }))} placeholder="Fast payer, luxury aesthetic…" />
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
            <PillBtn dark onClick={addCl}>Save client</PillBtn>
            <PillBtn onClick={() => setShowAdd(false)}>Cancel</PillBtn>
          </div>
        </div>
      )}

      <SearchField value={search} onChange={setSearch} placeholder="Search clients, contacts, tags" s={{ marginTop: 12 }} />
      <ChipRow s={{ marginTop: 10 }}>
        <Chip on={chip === "all"} tone={PAL.neutral} dot={false} label="All" count={count.all} onClick={() => setChip("all")} />
        <Chip on={chip === "progress"} tone={PAL.progress} label="In progress" count={count.progress} onClick={() => setChip("progress")} />
        <Chip on={chip === "quoted"} tone={PAL.neutral} label="Quoted" count={count.quoted} onClick={() => setChip("quoted")} />
        <Chip on={chip === "dormant"} tone={PAL.neutral} label="Dormant" count={count.dormant} onClick={() => setChip("dormant")} />
      </ChipRow>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 8 }}>
        <TSelWrap>
          <TSel value={typeFilter} onChange={(e: any) => setTypeFilter(e.target.value)}>
            <option value="all">Type: All</option><option value="Direct">Type: Direct</option><option value="Agency">Type: Agency</option>
          </TSel>
        </TSelWrap>
        <TSelWrap>
          <TSel value={sortOrder} onChange={(e: any) => setSortOrder(e.target.value)}>
            <option value="recent">Sort: Recent</option>
            <option value="open">Sort: Open value</option>
            <option value="revenue">Sort: Revenue</option>
            <option value="name_az">Sort: Name A–Z</option>
          </TSel>
        </TSelWrap>
      </div>

      {filtered.length === 0 && !showAdd && <p style={{ fontSize: 13, color: C.muted, margin: "14px 4px" }}>{clients.length ? "No clients in this view." : "No clients yet."}</p>}

      {filtered.length > 0 && (
        <ListCard s={{ marginTop: 10 }}>
          {filtered.map((c: any, i: number) => {
            const t = T(c);
            const nn = needsName(c);
            const hint = licHint(c);
            const st = t.urgent ? t.urgent.status : null;
            const tone = st ? PAL[STATUS_TONE[st] || "neutral"] : PAL.neutral;
            const value = t.signed + t.owed > 0 ? t.signed + t.owed : t.quotes;
            return (
              <Row key={c.id} first={i === 0} highlight={sel === c.id} onClick={() => setSel(c.id)}
                icon={<span style={{ width: 32, height: 32, borderRadius: "50%", background: nn ? PAL.waiting.wash : PAL.neutral.fill, color: nn ? PAL.waiting.ink : PAL.neutral.ink,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SERIF, fontSize: 15, flexShrink: 0 }}>{nn ? "?" : (c.name.trim()[0] || "?").toUpperCase()}</span>}
                title={c.name}
                meta={<>
                  {nn && <span style={{ color: PAL.waiting.ink }}>Needs a name · </span>}
                  {t.projects ? `${t.projects} project${t.projects === 1 ? "" : "s"}` : `${c.contact ? `${c.contact} · ` : ""}no projects yet`}
                  {t.paidYear > 0 && ` · ${year}: ${fmt(t.paidYear)}`}
                  {hint && <span style={{ color: hint.tone.ink }}> · {hint.text}</span>}
                </>}
                right={st && value > 0
                  ? <><div style={{ fontSize: 14 }}>{fmt(value)}</div><TonedTag tone={tone} s={{ marginTop: 3 }}>{STATUS_NAME[st] || st}</TonedTag></>
                  : t.dormant ? <TonedTag tone={PAL.neutral}>Dormant</TonedTag> : undefined}
              />
            );
          })}
        </ListCard>
      )}
    </div>
  );

  return (
    <div style={{ display: cl && !isMobile ? "flex" : "block", gap: cl && !isMobile ? 28 : 0, alignItems: "flex-start" }}>
      {ListPanel}
      {cl && !isMobile && detail(false)}
    </div>
  );
}
