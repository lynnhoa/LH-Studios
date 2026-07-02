// ─────────────────────────────────────────────────────────────
// ClientList — orchestrates left panel (list) + right panel (detail)
// Mobile: shows one at a time. Desktop/iPad: split view.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, SANS, SERIF, TYPE } from "./constants";
import { fmt, fmtD, addM, uid, today } from "./formatters";
import { I, S, B, Lbl, Tag, UBadge } from "./atoms";
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
}

function usageEnd(pr: any): string | null {
  if (!pr.deliveryDate || !pr.qd) return null;
  const ul = (pr.qd?.lines || []).find((l: any) => l.usageLabel);
  const hasRenewals = (pr.renewals || []).length > 0;
  if (!ul?.usageLabel && !hasRenewals) return null;
  if (pr.usageEndOverride) return pr.usageEndOverride;
  if (!ul?.usageLabel) return null;
  const m = ul.usageLabel.match(/(\d+)\s*month/i);
  const mo = m ? parseInt(m[1]) : null;
  return mo ? addM(pr.deliveryDate, mo) : null;
}

const scol = (s: string) => ({
  invoiced: C.amber, contracted: C.muted, quoted: C.light,
  revised: "#b8a090", production: "#8fa89a", paid: C.green, lead: C.light,
}[s] ?? C.light);

export default function ClientList({
  clients, isMobile, settings, rc, selReset, onSelChange,
  pendingClientName, pendingProjectQNo, onPendingClear,
  onGoToCalc, onRevise, onAmend, goTo, clientsHook,
}: ClientListProps) {

  const [sel,            setSel_]          = useState<string | null>(null);
  const [highlightedQNo, setHighlightedQNo]= useState<string | null>(null);
  const [search,         setSearch]        = useState("");
  const [statusFilter,   setStatusFilter]  = useState("all");
  const [typeFilter,     setTypeFilter]    = useState("all");
  const [sortOrder,      setSortOrder]     = useState("recent");
  const [showAdd,        setShowAdd]       = useState(false);
  const [tagI,           setTagI]          = useState("");
  const [nb,             setNb]            = useState({
    name: "", contact: "", email: "", agency: "Direct",
    country: "Germany", tags: [] as string[], notes: "",
  });

  const setSel = (v: string | null) => { setSel_(v); onSelChange(v); };

  useEffect(() => { setSel(null); }, [selReset]);

  useEffect(() => {
    if (!pendingClientName) return;
    const c = clients.find((x: any) => x.name.toLowerCase() === pendingClientName.toLowerCase());
    if (c) { setSel(c.id); if (pendingProjectQNo) setHighlightedQNo(pendingProjectQNo); }
    setTimeout(() => onPendingClear(), 100);
  }, []);

  const cl = sel ? clients.find((c: any) => c.id === sel) : null;

  // ── Filter + sort ─────────────────────────────────────────
  const STATUS_PRI: Record<string,number> = { invoiced:0, production:1, contracted:2, revised:3, quoted:4, lead:5, paid:6 };
  const bestPri   = (c: any) => c.projects.length ? Math.min(...c.projects.map((pr: any) => STATUS_PRI[pr.paid ? "paid" : pr.status] ?? 99)) : 99;
  const latestDate= (c: any) => c.projects.reduce((d: string,pr: any) => pr.date > d ? pr.date : d, "");
  const totalRev  = (c: any) => c.projects.filter((pr: any) => pr.paid).reduce((s: number,pr: any) => s + pr.amount, 0);

  const filtered = (() => {
    const arr = clients.filter((c: any) => {
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !(c.tags||[]).some((t: string) => t.toLowerCase().includes(q))) return false;
      if (typeFilter !== "all" && c.agency !== typeFilter) return false;
      if (statusFilter !== "all") {
        const match = statusFilter === "paid"
          ? c.projects.some((pr: any) => pr.paid)
          : c.projects.some((pr: any) => pr.status === statusFilter && !pr.paid);
        if (!match) return false;
      }
      return true;
    });
    if (sortOrder === "status")     return [...arr].sort((a: any,b: any) => bestPri(a) - bestPri(b));
    if (sortOrder === "name_az")    return [...arr].sort((a: any,b: any) => a.name.localeCompare(b.name));
    if (sortOrder === "revenue_hi") return [...arr].sort((a: any,b: any) => totalRev(b) - totalRev(a));
    if (sortOrder === "revenue_lo") return [...arr].sort((a: any,b: any) => totalRev(a) - totalRev(b));
    return [...arr].sort((a: any,b: any) => latestDate(b).localeCompare(latestDate(a)));
  })();

  const flagged = clients.filter((c: any) => {
    if (!c.projects.length) return false;
    if (c.projects.some((pr: any) => pr.status === "invoiced" || pr.status === "paid")) return false;
    const lat = c.projects.reduce((a: any,b: any) => a.date > b.date ? a : b);
    return (new Date().getTime() - new Date(lat.date).getTime()) / 864e5 > 90;
  });

  const addCl = async () => {
    if (!nb.name.trim()) return;
    await clientsHook.addClient({ ...nb });
    setNb({ name: "", contact: "", email: "", agency: "Direct", country: "Germany", tags: [], notes: "" });
    setShowAdd(false);
  };

  // ── Mobile: show detail only ──────────────────────────────
  if (cl && isMobile) {
    return (
      <ClientDetail
        cl={cl} clients={clients} isMobile={isMobile} settings={settings} rc={rc}
        clientsHook={clientsHook} onGoToCalc={onGoToCalc}
        onRevise={onRevise}
        onAmend={onAmend}
        setSel={setSel}
        highlightedQNo={highlightedQNo}
        onClearHighlight={() => setHighlightedQNo(null)}
      />
    );
  }

  // ── List panel ────────────────────────────────────────────
  const ListPanel = (
    <div style={{
      flex:      cl && !isMobile ? "0 0 42%" : "1 1 100%",
      minWidth:  0,
      overflowY: cl && !isMobile ? "auto" : undefined,
      maxHeight: cl && !isMobile ? "calc(100vh - 80px)" : undefined,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ fontFamily: SERIF, fontSize: TYPE.pageTitle.size, fontWeight: "normal", margin: 0 }}>Clients</h2>
        <B onClick={() => setShowAdd(s => !s)}>+ New Client</B>
      </div>

      {/* Flagged banner */}
      {flagged.length > 0 && (
        <div style={{ background: "#fdf6ee", border: `1px solid ${C.amber}`, borderRadius: 2, padding: "9px 13px", marginBottom: 10 }}>
          <p style={{ fontSize: TYPE.label.size, color: C.amber, margin: 0 }}>⚠ {flagged.length} client{flagged.length > 1 ? "s" : ""} — no activity 3+ months</p>
        </div>
      )}

      {/* Search */}
      <I placeholder="Search clients, tags…" value={search} onChange={(e: any) => setSearch(e.target.value)} s={{ marginBottom: 8 }} />

      {/* Filter + sort */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 7, marginBottom: 11 }}>
        <select
          value={typeFilter !== "all" ? typeFilter.toLowerCase() : statusFilter}
          onChange={(e: any) => { const v = e.target.value; if (v === "direct" || v === "agency") { setTypeFilter(v === "direct" ? "Direct" : "Agency"); setStatusFilter("all"); } else { setStatusFilter(v); setTypeFilter("all"); } }}
          style={{ fontSize: TYPE.micro.size, fontFamily: SANS, color: C.muted, background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "4px 8px", cursor: "pointer", outline: "none" }}
        >
          <option value="all">Filter: All</option>
          <optgroup label="Status">
            {["lead","quoted","revised","contracted","production","invoiced","paid"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
          </optgroup>
          <optgroup label="Type">
            <option value="direct">Direct</option>
            <option value="agency">Agency</option>
          </optgroup>
        </select>
        <select
          value={sortOrder} onChange={(e: any) => setSortOrder(e.target.value)}
          style={{ fontSize: TYPE.micro.size, fontFamily: SANS, color: C.muted, background: C.bg, border: `1px solid ${C.rule}`, borderRadius: 2, padding: "4px 8px", cursor: "pointer", outline: "none" }}
        >
          <option value="recent">Sort: Most Recent</option>
          <option value="status">Sort: Status Priority</option>
          <option value="name_az">Sort: Name A → Z</option>
          <option value="revenue_hi">Sort: Revenue ↓</option>
          <option value="revenue_lo">Sort: Revenue ↑</option>
        </select>
      </div>

      {/* New client form */}
      {showAdd && (
        <div style={{ border: `1px solid ${C.rule}`, borderRadius: 2, padding: 14, marginBottom: 12, background: C.white }}>
          <p style={{ fontSize: TYPE.micro.size, color: C.muted, letterSpacing: "0.07em", textTransform: "uppercase" as const, margin: "0 0 10px" }}>New Client</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <div><Lbl>Brand Name *</Lbl><I value={nb.name} onChange={(e: any) => setNb(p => ({ ...p, name: e.target.value }))} placeholder="Sephora" /></div>
            <div><Lbl>Contact</Lbl><I value={nb.contact} onChange={(e: any) => setNb(p => ({ ...p, contact: e.target.value }))} placeholder="Anna Müller" /></div>
            <div><Lbl>Email</Lbl><I value={nb.email} onChange={(e: any) => setNb(p => ({ ...p, email: e.target.value }))} type="email" placeholder="anna@brand.com" /></div>
            <div>
              <Lbl>Agency / Direct</Lbl>
              <S value={nb.agency} onChange={(e: any) => setNb(p => ({ ...p, agency: e.target.value }))}><option>Direct</option><option>Agency</option></S>
            </div>
            <div><Lbl>Country</Lbl><I value={nb.country} onChange={(e: any) => setNb(p => ({ ...p, country: e.target.value }))} placeholder="Germany" /></div>
            <div>
              <Lbl>Tags</Lbl>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const, marginBottom: 4 }}>
                {nb.tags.map(t => <Tag key={t} onRemove={() => setNb(p => ({ ...p, tags: p.tags.filter(x => x !== t) }))}>{t}</Tag>)}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <I value={tagI} onChange={(e: any) => setTagI(e.target.value)} placeholder="Beauty, Fashion…"
                  onKeyDown={(e: any) => { if (e.key === "Enter" && tagI.trim()) { setNb(p => ({ ...p, tags: [...p.tags, tagI.trim()] })); setTagI(""); } }} />
                <B v="sec" onClick={() => { if (tagI.trim()) { setNb(p => ({ ...p, tags: [...p.tags, tagI.trim()] })); setTagI(""); } }} s={{ fontSize: TYPE.micro.size }}>+</B>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 9 }}>
            <Lbl>Relationship Notes</Lbl>
            <I value={nb.notes} onChange={(e: any) => setNb(p => ({ ...p, notes: e.target.value }))} placeholder="Fast payer, luxury aesthetic…" />
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
            <B onClick={addCl}>Save Client</B>
            <B v="sec" onClick={() => setShowAdd(false)}>Cancel</B>
          </div>
        </div>
      )}

      {filtered.length === 0 && !showAdd && <p style={{ fontSize: TYPE.label.size, color: C.muted }}>No clients yet.</p>}

      {/* Client rows */}
      {filtered.map((c: any) => {
        const active = c.projects[0];
        const allRights = c.projects.flatMap((pr: any) => {
          const items: { prName: string; end: string; label: string }[] = [];
          const ue = usageEnd(pr);
          if (ue) items.push({ prName: pr.name, end: ue, label: "Usage" });
          (pr.renewals || []).filter((r: any) => r.type === "excl" && r.endDate).forEach((r: any) => items.push({ prName: pr.name, end: r.endDate, label: "Excl." }));
          return items;
        });
        const multiProj = new Set(allRights.map((r: any) => r.prName)).size > 1;
        return (
          <div
            key={c.id}
            onClick={() => setSel(c.id)}
            style={{ border: `1px solid ${sel === c.id ? C.light : C.rule}`, borderRadius: 2, padding: isMobile ? "14px 16px" : "11px 13px", marginBottom: isMobile ? 10 : 8, cursor: "pointer", background: sel === c.id ? "rgba(26,26,26,0.03)" : undefined }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: isMobile ? TYPE.sectionHeading.size : TYPE.body.size, color: C.black, margin: `0 0 ${isMobile ? 3 : 2}px`, fontWeight: "500" }}>{c.name}</p>
                <p style={{ fontSize: isMobile ? TYPE.subtext.size : TYPE.label.size, color: C.muted, margin: 0 }}>{c.contact}{c.email && !isMobile ? ` · ${c.email}` : ""}</p>
                {(c.tags || []).length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: isMobile ? 6 : 4, flexWrap: "wrap" as const }}>
                    {c.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}
                  </div>
                )}
                {active && <p style={{ fontSize: isMobile ? TYPE.subtext.size : TYPE.label.size, color: C.muted, margin: `${isMobile ? 5 : 4}px 0 0` }}>{active.name}</p>}
              </div>
              {active && (
                <div style={{ textAlign: "right" as const, flexShrink: 0, marginLeft: 12 }}>
                  <p style={{ fontFamily: SERIF, fontSize: isMobile ? TYPE.sectionHeading.size : TYPE.subtext.size, color: C.black, margin: `0 0 ${isMobile ? 5 : 3}px` }}>{fmt(active.amount)}</p>
                  <span style={{ fontSize: isMobile ? TYPE.label.size : TYPE.micro.size, color: scol(active.paid ? "paid" : active.status), border: `1px solid ${scol(active.paid ? "paid" : active.status)}`, padding: isMobile ? "3px 10px" : "2px 8px", borderRadius: 2, letterSpacing: "0.07em", textTransform: "uppercase" as const }}>
                    {active.paid ? "Paid" : active.status}
                  </span>
                </div>
              )}
            </div>
            {allRights.length > 0 && (
              <div style={{ marginTop: isMobile ? 9 : 7, paddingTop: isMobile ? 9 : 7, borderTop: `1px solid ${C.rule}`, display: "flex", flexDirection: "column" as const, gap: isMobile ? 6 : 4 }}>
                {allRights.map((r: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                    {multiProj && <span style={{ fontSize: TYPE.micro.size, color: C.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 140 }}>{r.prName}</span>}
                    <UBadge end={r.end} label={r.label} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: cl && !isMobile ? "flex" : "block", gap: cl && !isMobile ? 28 : 0, alignItems: "flex-start" }}>
      {ListPanel}
      {cl && !isMobile && (
        <ClientDetail
          cl={cl} clients={clients} isMobile={false} settings={settings} rc={rc}
          clientsHook={clientsHook} onGoToCalc={onGoToCalc}
          onRevise={onRevise}
          onAmend={onAmend}
          setSel={setSel}
          highlightedQNo={highlightedQNo}
          onClearHighlight={() => setHighlightedQNo(null)}
        />
      )}
    </div>
  );
}
