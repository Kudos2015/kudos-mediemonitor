import { useState, useEffect } from "react";
import Nav from "./Nav";
import { supabase } from "./supabase";

const PROXY = import.meta.env.DEV ? "http://localhost:3001/rss" : "/api/rss";

async function searchMediaList(query, sources, fromDate, toDate) {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const sourcesWithRSS = sources.filter(s => s.rss_url);
  const results = [];
  const from = fromDate ? new Date(fromDate) : null;
  const to = toDate ? new Date(toDate + "T23:59:59") : null;

  for (const source of sourcesWithRSS) {
    try {
      const res = await fetch(`${PROXY}?url=${encodeURIComponent(source.rss_url)}`);
      if (!res.ok) continue;
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, "application/xml");
      [...xml.querySelectorAll("item")].forEach(item => {
        const get = tag => item.querySelector(tag)?.textContent?.trim() || "";
        const title = get("title");
        const snippet = get("description").replace(/<[^>]+>/g, "").slice(0, 200);
        const combined = (title + " " + snippet).toLowerCase();
        if (!keywords.every(k => combined.includes(k))) return;
        const d = new Date(get("pubDate"));
        if (from && d < from) return;
        if (to && d > to) return;
        results.push({
          external_id: get("guid") || get("link"),
          title,
          snippet,
          url: get("link"),
          date: get("pubDate") || new Date().toISOString(),
          source: source.name,
          country: source.country || "dk",
        });
      });
    } catch (e) { /* skip */ }
  }

  const seen = new Set();
  return results.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function Chip({ active, onClick, children }) {
  return <button onClick={onClick} style={{ padding: "4px 11px", borderRadius: 16, border: `1px solid ${active ? "#0f172a" : "#e2e8f0"}`, background: active ? "#0f172a" : "transparent", color: active ? "#fff" : "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{children}</button>;
}

function Badge({ children, color = "gray" }) {
  const t = { gray: ["#f1f5f9","#475569","#e2e8f0"], blue: ["#eff6ff","#1d4ed8","#bfdbfe"] }[color] || ["#f1f5f9","#475569","#e2e8f0"];
  return <span style={{ fontSize: 11, background: t[0], color: t[1], border: `1px solid ${t[2]}`, padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>{children}</span>;
}

const FLAG = { dk: "🇩🇰", se: "🇸🇪", no: "🇳🇴", fr: "🇫🇷", eu: "🌍" };

function ArticleCard({ a }) {
  const d = new Date(a.date);
  const dateStr = isNaN(d) ? "" : d.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
  return (
    <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 10, padding: "13px 16px", marginBottom: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={a.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", textDecoration: "none", display: "block", marginBottom: 5 }}
          onMouseEnter={e => e.target.style.textDecoration = "underline"}
          onMouseLeave={e => e.target.style.textDecoration = "none"}>
          {a.title}
        </a>
        {a.snippet && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.5 }}>{a.snippet}</div>}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Badge color="blue">{FLAG[a.country] || ""} {a.source}</Badge>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{dateStr}</span>
        </div>
      </div>
    </div>
  );
}

function ClientManager({ clients, onAdd, onDelete }) {
  const [name, setName] = useState("");
  const [keywords, setKeywords] = useState("");
  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#0f172a" }}>Tilføj klient</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Firmanavn" style={{ flex: 1, padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }} />
          <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="Søgeord (kommasepareret)" style={{ flex: 2, padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit" }} />
          <button onClick={() => { if (name) { onAdd(name, keywords); setName(""); setKeywords(""); } }} style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#0f172a", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Tilføj</button>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 12, padding: "4px 20px 16px" }}>
        {clients.map(c => (
          <div key={c.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{(c.keywords || []).join(", ")}</div>
            </div>
            <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "1px solid #fee2e2", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, color: "#dc2626", fontFamily: "inherit" }}>Slet</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesView({ sources }) {
  const [filter, setFilter] = useState("all");
  const COUNTRIES = [{ code: "all", label: "Alle" }, { code: "dk", label: "🇩🇰 DK" }, { code: "se", label: "🇸🇪 SE" }, { code: "no", label: "🇳🇴 NO" }, { code: "fr", label: "🇫🇷 FR" }, { code: "eu", label: "🌍 EU" }];
  const filtered = filter === "all" ? sources : sources.filter(s => s.country === filter);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {COUNTRIES.map(c => <Chip key={c.code} active={filter === c.code} onClick={() => setFilter(c.code)}>{c.label}</Chip>)}
      </div>
      <div style={{ background: "#fff", border: "1px solid #e8edf3", borderRadius: 12, padding: "4px 20px 16px" }}>
        <div style={{ fontSize: 11, color: "#94a3b8", padding: "10px 0 6px", fontWeight: 600 }}>{filtered.length} MEDIER</div>
        {filtered.map(s => (
          <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{FLAG[s.country] || ""} {s.name}</div>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#1d4ed8", textDecoration: "none" }}>{s.url.replace(/https?:\/\/(www\.)?/, "")}</a>}
            </div>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{s.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [sources, setSources] = useState([]);
  const [clients, setClients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterCountry, setFilterCountry] = useState("dk");
  const [tab, setTab] = useState("search");
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    supabase.from("sources").select("*").eq("active", true).order("name").then(({ data }) => setSources(data || []));
    supabase.from("clients").select("*").order("name").then(({ data }) => setClients(data || []));
  }, []);

  const filteredSources = filterCountry === "all" ? sources : sources.filter(s => s.country === filterCountry);

  async function runSearch(query, sourcesToSearch) {
    if (!query.trim() || sourcesToSearch.length === 0) return;
    setLoading(true);
    setArticles([]);
    setProgress(`Søger i ${sourcesToSearch.length} medier...`);
    const results = await searchMediaList(query, sourcesToSearch, fromDate, toDate);
    setArticles(results);
    setProgress("");
    setLoading(false);
  }

  const COUNTRIES = [{ code: "dk", label: "🇩🇰 DK" }, { code: "se", label: "🇸🇪 SE" }, { code: "no", label: "🇳🇴 NO" }, { code: "all", label: "Alle" }];

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", background: "#f6f8fb", minHeight: "100vh", paddingBottom: 60, paddingTop: 40 }}>
      <Nav active="mediemonitor" />
      <div style={{ background: "#fff", borderBottom: "1px solid #e8edf3", padding: "13px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>kudos <span style={{ color: "#94a3b8", fontWeight: 400 }}>/ mediemonitor</span></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {[{ id: "search", label: "Søg" }, { id: "clients", label: `Klienter (${clients.length})` }, { id: "sources", label: `Medier (${sources.length})` }].map(t => (
            <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Chip>
          ))}
        </div>
      </div>

      {tab === "search" && <>
        <div style={{ background: "#fff", borderBottom: "1px solid #e8edf3", padding: "12px 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="text" placeholder="Søgeord eller emne..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch(searchQuery, filteredSources)}
            style={{ flex: 1, minWidth: 200, padding: "7px 14px", borderRadius: 20, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: "7px 10px", borderRadius: 20, border: "1px solid #e2e8f0", fontSize: 12, fontFamily: "inherit" }} />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>→</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: "7px 10px", borderRadius: 20, border: "1px solid #e2e8f0", fontSize: 12, fontFamily: "inherit" }} />
          <div style={{ width: 1, height: 24, background: "#e2e8f0" }} />
          {COUNTRIES.map(c => <Chip key={c.code} active={filterCountry === c.code} onClick={() => setFilterCountry(c.code)}>{c.label}</Chip>)}
          <button onClick={() => runSearch(searchQuery, filteredSources)} disabled={loading || !searchQuery.trim()}
            style={{ padding: "7px 20px", borderRadius: 20, border: "none", background: loading ? "#f1f5f9" : "#0f172a", color: loading ? "#94a3b8" : "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {loading ? progress || "Søger..." : "Søg"}
          </button>
        </div>

        <div style={{ maxWidth: 820, margin: "20px auto", padding: "0 20px" }}>
          {clients.length > 0 && (
            <div style={{ marginBottom: 20, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em" }}>KLIENTER</span>
              {clients.map(c => (
                <button key={c.id} onClick={() => { setSelectedClient(c); setSearchQuery((c.keywords || []).join(" ")); runSearch((c.keywords || []).join(" OR "), filteredSources); }}
                  style={{ padding: "4px 12px", borderRadius: 16, border: `1px solid ${selectedClient?.id === c.id ? "#0f172a" : "#e2e8f0"}`, background: selectedClient?.id === c.id ? "#0f172a" : "transparent", color: selectedClient?.id === c.id ? "#fff" : "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {articles.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontSize: 14 }}>Søg på et emne eller vælg en klient</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Søger i {filteredSources.length} medier</div>
            </div>
          )}
          {articles.length > 0 && <div style={{ marginBottom: 12, fontSize: 12, color: "#64748b" }}>{articles.length} resultater · {filteredSources.length} medier søgt</div>}
          {articles.map((a, i) => <ArticleCard key={a.external_id || i} a={a} />)}
        </div>
      </>}

      {tab === "clients" && (
        <div style={{ maxWidth: 820, margin: "20px auto", padding: "0 20px" }}>
          <ClientManager clients={clients} onAdd={async (name, keywords) => {
            await supabase.from("clients").insert({ name, keywords: keywords.split(",").map(k => k.trim()).filter(Boolean) });
            const { data } = await supabase.from("clients").select("*").order("name");
            setClients(data || []);
          }} onDelete={async (id) => {
            await supabase.from("clients").delete().eq("id", id);
            const { data } = await supabase.from("clients").select("*").order("name");
            setClients(data || []);
          }} />
        </div>
      )}

      {tab === "sources" && (
        <div style={{ maxWidth: 820, margin: "20px auto", padding: "0 20px" }}>
          <SourcesView sources={sources} />
        </div>
      )}
    </div>
  );
}
