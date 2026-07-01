import { useState, useCallback, useEffect, useRef } from "react";

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app: { fontFamily: "'Segoe UI',system-ui,sans-serif", background: "#0f0f0f", minHeight: "100vh", color: "#e8e0d0" },
  header: { background: "linear-gradient(135deg,#1a1200,#2d1f00)", borderBottom: "2px solid #c9a227", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 },
  headerTitle: { margin: 0, fontSize: 22, color: "#c9a227", fontWeight: 700 },
  headerSub: { margin: 0, fontSize: 12, color: "#9a7a3a" },
  tabs: { display: "flex", background: "#1a1a1a", borderBottom: "1px solid #333" },
  tab: (active) => ({ padding: "12px 24px", cursor: "pointer", fontSize: 14, fontWeight: 600, color: active ? "#c9a227" : "#888", background: "none", border: "none", borderBottom: active ? "2px solid #c9a227" : "2px solid transparent" }),
  body: { maxWidth: 900, margin: "0 auto", padding: 20 },
  card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 12, padding: 20, marginBottom: 16 },
  btn: (color="#c9a227") => ({ background: color, color: color==="#c9a227"?"#000":"#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
  btnSm: (color="#444") => ({ background: color, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }),
  input: { background: "#111", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", color: "#e8e0d0", fontSize: 14, width: "100%", boxSizing: "border-box" },
  label: { fontSize: 12, color: "#888", marginBottom: 4, display: "block" },
  impactBadge: (i) => ({ fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 700, background: i==="High"?"#4a1010":i==="Medium"?"#2a2a00":"#0a2a0a", color: i==="High"?"#ff6b6b":i==="Medium"?"#ffd700":"#6bff6b" }),
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#c9a227", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  statCard: (color) => ({ background: "#111", border: `1px solid ${color}33`, borderRadius: 10, padding: 16, textAlign: "center" }),
  statVal: (color) => ({ fontSize: 28, fontWeight: 800, color }),
  statLabel: { fontSize: 11, color: "#666", marginTop: 2 },
  tag: (c) => ({ display:"inline-block", background:`${c}22`, color:c, border:`1px solid ${c}44`, borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:600, marginRight:4, marginBottom:4 }),
  ebayBar: { background:"#111", borderRadius:8, padding:16, border:"1px solid #1a3a1a" },
  priceRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid #1a1a1a", fontSize:13 },
  histogram: { display:"flex", alignItems:"flex-end", gap:2, height:60, marginTop:8 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => n != null ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

// Downscale + re-encode the photo on the client before upload. Vercel caps
// serverless request bodies at ~4.5 MB and raw phone photos easily exceed that
// once base64-encoded; a 1280px JPEG keeps us well under the limit and cuts the
// model's image-token cost without hurting identification accuracy.
//
// We return TWO things: the analysis-quality `base64` (large — sent to the model
// and then discarded), and a tiny `preview` thumbnail (a few KB, for on-screen
// display only). Keeping the on-screen copy small is what keeps memory flat no
// matter how many coins pass through the app.
function fileToResizedBase64(file, maxDim = 1280, quality = 0.85, thumbDim = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        const longest = Math.max(width, height);
        if (longest > maxDim) {
          const scale = maxDim / longest;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        // Small thumbnail for display only — never sent anywhere, never logged.
        const tScale = Math.min(1, thumbDim / Math.max(width, height));
        const tw = Math.max(1, Math.round(width * tScale));
        const th = Math.max(1, Math.round(height * tScale));
        const thumb = document.createElement("canvas");
        thumb.width = tw;
        thumb.height = th;
        thumb.getContext("2d").drawImage(canvas, 0, 0, tw, th);
        const preview = thumb.toDataURL("image/jpeg", 0.6);

        resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg", preview });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── eBay Market Panel ─────────────────────────────────────────────────────────
function EbayPanel({ query, ebayData, ebayLoading, ebayError, onFetch }) {
  if (!query) return null;

  return (
    <div style={S.section}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={S.sectionTitle}>📈 Live Market Data (eBay Sold)</span>
        <button style={S.btnSm("#1a3a1a")} onClick={onFetch} disabled={ebayLoading}>
          {ebayLoading ? "Fetching…" : ebayData ? "Refresh" : "Fetch Prices"}
        </button>
      </div>

      {ebayError && <p style={{ color:"#ff6b6b", fontSize:13 }}>{ebayError}</p>}

      {!ebayData && !ebayLoading && !ebayError && (
        <div style={{ ...S.ebayBar, color:"#666", fontSize:13 }}>
          Click "Fetch Prices" to pull real sold listings from eBay for: <em style={{color:"#888"}}>"{query}"</em>
        </div>
      )}

      {ebayLoading && (
        <div style={{ ...S.ebayBar, color:"#888", fontSize:13 }}>Searching eBay sold listings…</div>
      )}

      {ebayData && ebayData.count === 0 && (
        <div style={{ ...S.ebayBar, color:"#888", fontSize:13 }}>
          No sold listings found for "{query}". Try editing the search term below and refetching.
        </div>
      )}

      {ebayData && ebayData.count > 0 && (
        <div style={S.ebayBar}>
          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
            {[
              { label:"Median", val:fmt(ebayData.median), color:"#6bff6b" },
              { label:"Average", val:fmt(ebayData.avg), color:"#c9a227" },
              { label:"Low", val:fmt(ebayData.low), color:"#88aaff" },
              { label:"High", val:fmt(ebayData.high), color:"#ff6b6b" },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign:"center", background:"#0a0a0a", borderRadius:8, padding:"10px 4px" }}>
                <div style={{ fontSize:16, fontWeight:800, color }}>{val}</div>
                <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{label} ({ebayData.count} sales)</div>
              </div>
            ))}
          </div>

          {/* Mini price histogram */}
          {ebayData.prices.length > 3 && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>Price distribution</div>
              <Histogram prices={ebayData.prices} />
            </div>
          )}

          {/* Recent sales */}
          {ebayData.recent_sales.length > 0 && (
            <div>
              <div style={{ fontSize:11, color:"#555", marginBottom:6 }}>Recent sold listings</div>
              {ebayData.recent_sales.map((s, i) => (
                <div key={i} style={S.priceRow}>
                  <span style={{ color:"#aaa", maxWidth:"75%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.title}</span>
                  <span style={{ color:"#6bff6b", fontWeight:700, marginLeft:8 }}>{fmt(s.price)}</span>
                </div>
              ))}
            </div>
          )}

          <a href={ebayData.ebay_url} target="_blank" rel="noreferrer" style={{ display:"block", marginTop:12, fontSize:12, color:"#4a8fff", textDecoration:"none" }}>
            → View all sold listings on eBay ↗
          </a>
        </div>
      )}
    </div>
  );
}

function Histogram({ prices }) {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const buckets = 10;
  const bucketSize = (max - min) / buckets || 1;
  const counts = Array(buckets).fill(0);
  prices.forEach(p => {
    const i = Math.min(Math.floor((p - min) / bucketSize), buckets - 1);
    counts[i]++;
  });
  const maxCount = Math.max(...counts);
  return (
    <div style={S.histogram}>
      {counts.map((c, i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end" }}>
          <div style={{ width:"100%", background: c > 0 ? "#c9a227" : "#222", height: maxCount ? `${(c/maxCount)*100}%` : "4px", borderRadius:"2px 2px 0 0", minHeight: c>0?4:1 }} title={`$${(min+i*bucketSize).toFixed(0)}–$${(min+(i+1)*bucketSize).toFixed(0)}: ${c} sales`} />
        </div>
      ))}
    </div>
  );
}

// ── Analyze Tab ───────────────────────────────────────────────────────────────
function AnalyzeTab({ log, setLog, onAuthExpired }) {
  const [front, setFront] = useState(null); // { base64, mediaType, preview }
  const [back, setBack] = useState(null);   // { base64, mediaType, preview }
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [ebayQuery, setEbayQuery] = useState("");
  const [ebayData, setEbayData] = useState(null);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayError, setEbayError] = useState(null);

  const handleFile = useCallback(async (slot, file) => {
    if (!file) return;
    setError(null);
    try {
      const img = await fileToResizedBase64(file);
      (slot === "front" ? setFront : setBack)(img);
      setResult(null);
      setSaved(false);
      setEbayData(null);
      setEbayQuery("");
    } catch {
      setError("Could not read that image. Please try a different photo.");
    }
  }, []);

  const analyze = async () => {
    const images = [front, back]
      .filter((i) => i && i.base64)
      .map((i) => ({ data: i.base64, mediaType: i.mediaType }));
    if (images.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    setEbayData(null);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      if (r.status === 401) { onAuthExpired?.(); throw new Error("Your session expired. Please log in again."); }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      setEbayQuery(data.ebay_search_query || data.name || "");
      // Forget the picture: identification is done, so drop the heavy base64
      // payloads and keep only the tiny thumbnail for display. This is what
      // stops memory from piling up photo after photo.
      setFront((f) => (f ? { ...f, base64: null } : f));
      setBack((b) => (b ? { ...b, base64: null } : b));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEbay = async () => {
    if (!ebayQuery) return;
    setEbayLoading(true);
    setEbayError(null);
    try {
      const r = await fetch(`/api/ebay/sold?q=${encodeURIComponent(ebayQuery)}`);
      if (r.status === 401) { onAuthExpired?.(); throw new Error("Your session expired. Please log in again."); }
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "eBay fetch failed");
      setEbayData(data);
    } catch (e) {
      setEbayError(e.message);
    } finally {
      setEbayLoading(false);
    }
  };

  const saveToLog = () => {
    if (!result) return;
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      name: result.name,
      country: result.country,
      year: result.year,
      grade: result.grade_estimate,
      valueMin: result.estimated_value?.low,
      valueMax: result.estimated_value?.high,
      confidence: result.confidence,
      status: "Unchecked",
      notes,
      // Deliberately no image is stored — the coin is logged by its data and
      // `id` only, so the collection log stays tiny and never runs the browser
      // out of memory.
      ebayMedian: ebayData?.median ?? null,
      ebayAvg: ebayData?.avg ?? null,
      ebayCount: ebayData?.count ?? null,
      ebayUrl: ebayData?.ebay_url ?? null,
    };
    setLog(prev => [entry, ...prev]);
    setSaved(true);
  };

  return (
    <div style={S.body}>
      {/* Upload */}
      <div style={S.card}>
        <div style={S.sectionTitle}>📷 Upload Coin Photos</div>
        <div style={{ fontSize:12, color:"#777", marginBottom:10 }}>
          Add the front (obverse) and back (reverse) for the most accurate identification. The back is optional but strongly recommended.
        </div>
        <div style={S.grid2}>
          {[
            ["front", "Front (Obverse)", front],
            ["back", "Back (Reverse)", back],
          ].map(([slot, label, img]) => (
            <label key={slot} style={{ display:"block", cursor:"pointer" }}>
              <div style={{ fontSize:11, color:"#888", marginBottom:4 }}>{label}</div>
              <input type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                onChange={e => handleFile(slot, e.target.files[0])} />
              <div style={{ border:"2px dashed #333", borderRadius:10, padding:12, textAlign:"center", background:"#111", color:"#888", fontSize:13, minHeight:130, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {img
                  ? <img src={img.preview} alt={label} style={{ maxHeight:160, maxWidth:"100%", borderRadius:8, objectFit:"contain" }} />
                  : "📁 Tap to add photo"}
              </div>
            </label>
          ))}
        </div>
        <button style={{ ...S.btn(), marginTop:12, width:"100%", opacity: loading||!(front||back)?0.6:1 }}
          onClick={analyze} disabled={loading || !(front || back)}>
          {loading ? "Analyzing…" : "🔍 Identify & Value Coin"}
        </button>
        {error && <p style={{ color:"#ff6b6b", fontSize:13, marginTop:8 }}>{error}</p>}
      </div>

      {result && (
        <>
          {/* Identity card */}
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:20, fontWeight:800, color:"#c9a227", marginBottom:4 }}>{result.name}</div>
                <div style={{ fontSize:13, color:"#888" }}>{result.country} · {result.year} · {result.denomination}</div>
              </div>
              <span style={{ ...S.impactBadge(result.confidence), fontSize:12, padding:"4px 10px" }}>{result.confidence} confidence</span>
            </div>

            <div style={{ ...S.grid2, marginTop:16 }}>
              {[
                ["Composition", result.composition],
                ["Mint Mark", result.mint_mark || "None"],
                ["Grade Est.", result.grade_estimate],
                ["Weight", result.weight_g ? `${result.weight_g}g` : "—"],
                ["Diameter", result.diameter_mm ? `${result.diameter_mm}mm` : "—"],
                ["Series", result.series],
              ].map(([k, v]) => (
                <div key={k} style={{ background:"#111", borderRadius:8, padding:"10px 12px" }}>
                  <div style={S.label}>{k}</div>
                  <div style={{ fontSize:14, fontWeight:600 }}>{v || "—"}</div>
                </div>
              ))}
            </div>

            {/* AI value estimate */}
            <div style={{ background:"#1a1200", border:"1px solid #3a2800", borderRadius:10, padding:16, marginTop:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, color:"#9a7a3a", marginBottom:2 }}>AI Value Estimate</div>
                <div style={{ fontSize:22, fontWeight:800, color:"#c9a227" }}>
                  {fmt(result.estimated_value?.low)} – {fmt(result.estimated_value?.high)}
                </div>
              </div>
              <div style={{ fontSize:11, color:"#666", textAlign:"right", maxWidth:160 }}>
                Based on grade estimate and historical data. See live eBay data below for market reality.
              </div>
            </div>
          </div>

          {/* eBay Market Data */}
          <div style={S.card}>
            <div style={S.section}>
              <div style={S.sectionTitle}>🔎 eBay Search Query</div>
              <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...S.input, flex:1 }} value={ebayQuery}
                  onChange={e => setEbayQuery(e.target.value)}
                  placeholder="Edit search query if needed…" />
              </div>
              <div style={{ fontSize:11, color:"#555", marginTop:4 }}>
                Auto-generated by AI. Edit to narrow by grade, mint mark, etc.
              </div>
            </div>
            <EbayPanel
              query={ebayQuery}
              ebayData={ebayData}
              ebayLoading={ebayLoading}
              ebayError={ebayError}
              onFetch={fetchEbay}
            />
          </div>

          {/* Inspection Checklist */}
          <div style={S.card}>
            <div style={S.sectionTitle}>🔬 Inspection Checklist</div>
            {result.checklist?.map((item, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"10px 0", borderBottom:"1px solid #1a1a1a" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>{item.item}</div>
                  <div style={{ fontSize:12, color:"#777" }}>{item.detail}</div>
                </div>
                <span style={{ ...S.impactBadge(item.impact), marginLeft:12, whiteSpace:"nowrap" }}>{item.impact}</span>
              </div>
            ))}
          </div>

          {/* Error Varieties */}
          {result.error_varieties?.length > 0 && (
            <div style={S.card}>
              <div style={S.sectionTitle}>⚡ Error Varieties to Check</div>
              {result.error_varieties.map((v, i) => (
                <div key={i} style={S.tag("#ff9500")}>{v}</div>
              ))}
            </div>
          )}

          {/* Red Flags & Pro Tips */}
          <div style={{ ...S.grid2 }}>
            <div style={S.card}>
              <div style={S.sectionTitle}>🚨 Red Flags</div>
              {result.red_flags?.map((f, i) => (
                <div key={i} style={{ fontSize:13, color:"#ff6b6b", padding:"4px 0", borderBottom:"1px solid #1a1a1a" }}>• {f}</div>
              ))}
            </div>
            <div style={S.card}>
              <div style={S.sectionTitle}>💡 Pro Tips</div>
              {result.pro_tips?.map((t, i) => (
                <div key={i} style={{ fontSize:13, color:"#aaa", padding:"4px 0", borderBottom:"1px solid #1a1a1a" }}>• {t}</div>
              ))}
            </div>
          </div>

          {/* Grading Recommendation */}
          <div style={{ ...S.card, background:"#0a1a0a", border:"1px solid #1a3a1a" }}>
            <div style={S.sectionTitle}>🏅 Grading Recommendation</div>
            <p style={{ fontSize:14, color:"#aaa", margin:0 }}>{result.grading_recommendation}</p>
          </div>

          {/* Notes & Save */}
          <div style={S.card}>
            <div style={S.sectionTitle}>📝 Notes</div>
            <textarea style={{ ...S.input, minHeight:80, resize:"vertical" }}
              placeholder="Add your inspection notes…"
              value={notes} onChange={e => setNotes(e.target.value)} />
            <button style={{ ...S.btn(saved?"#1a3a1a":"#c9a227"), marginTop:12, width:"100%", color: saved?"#6bff6b":"#000" }}
              onClick={saveToLog} disabled={saved}>
              {saved ? "✓ Saved to Collection Log" : "💾 Save to Collection Log"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Collection Log Tab ────────────────────────────────────────────────────────
const STATUSES = ["Unchecked", "Checked", "Sent for Grading", "Sold"];
const STATUS_COLORS = { "Unchecked":"#888", "Checked":"#c9a227", "Sent for Grading":"#4a8fff", "Sold":"#6bff6b" };

function LogTab({ log, setLog }) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [editId, setEditId] = useState(null);
  const [editNote, setEditNote] = useState("");

  const filtered = log.filter(e =>
    (filterStatus === "All" || e.status === filterStatus) &&
    (e.name?.toLowerCase().includes(search.toLowerCase()) || e.country?.toLowerCase().includes(search.toLowerCase()))
  );

  const updateStatus = (id, status) => setLog(prev => prev.map(e => e.id === id ? { ...e, status } : e));
  const saveNote = (id) => { setLog(prev => prev.map(e => e.id === id ? { ...e, notes: editNote } : e)); setEditId(null); };
  const remove = (id) => setLog(prev => prev.filter(e => e.id !== id));

  const exportCSV = () => {
    const headers = ["Coin ID","Date","Name","Country","Year","Grade","Value Low","Value High","eBay Median","eBay Avg","eBay Sales","Status","Notes"];
    const rows = log.map(e => [e.id,e.date,e.name,e.country,e.year,e.grade,e.valueMin,e.valueMax,e.ebayMedian??'',e.ebayAvg??'',e.ebayCount??'',e.status,`"${(e.notes||'').replace(/"/g,'""')}"`]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv])); a.download = "coin-collection.csv"; a.click();
  };

  return (
    <div style={S.body}>
      <div style={S.card}>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
          <input style={{ ...S.input, flex:1, minWidth:160 }} placeholder="Search coins…" value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...S.input, width:"auto" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option>All</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <button style={S.btnSm("#1a3a1a")} onClick={exportCSV}>⬇ CSV</button>
          <button style={S.btnSm("#1a1a2a")} onClick={() => window.print()}>🖨 Print</button>
        </div>

        {filtered.length === 0 ? (
          <p style={{ color:"#555", fontSize:14, textAlign:"center", padding:40 }}>
            {log.length === 0 ? "No coins logged yet. Analyze a coin and save it here." : "No coins match your filter."}
          </p>
        ) : filtered.map(e => (
          <div key={e.id} style={{ background:"#111", border:"1px solid #222", borderRadius:10, padding:14, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:"#e8e0d0" }}>{e.name}</div>
                <div style={{ fontSize:12, color:"#666" }}>{e.date} · {e.country} · {e.grade}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:2 }}>Coin ID: {e.id}</div>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                <select style={{ background:"#1a1a1a", border:"1px solid #333", borderRadius:6, color: STATUS_COLORS[e.status], fontSize:12, padding:"4px 8px", fontWeight:700 }}
                  value={e.status} onChange={ev => updateStatus(e.id, ev.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button style={S.btnSm("#1a1a1a")} onClick={() => { setEditId(e.id); setEditNote(e.notes||""); }}>✏</button>
                <button style={S.btnSm("#2a0000")} onClick={() => remove(e.id)}>✕</button>
              </div>
            </div>

            {/* Value row */}
            <div style={{ display:"flex", gap:12, marginTop:10, flexWrap:"wrap" }}>
              <div style={{ background:"#1a1200", borderRadius:6, padding:"6px 12px", fontSize:13 }}>
                <span style={{ color:"#666" }}>AI Est: </span>
                <span style={{ color:"#c9a227", fontWeight:700 }}>{fmt(e.valueMin)}–{fmt(e.valueMax)}</span>
              </div>
              {e.ebayMedian != null && (
                <div style={{ background:"#0a1a0a", borderRadius:6, padding:"6px 12px", fontSize:13 }}>
                  <span style={{ color:"#666" }}>eBay Median: </span>
                  <span style={{ color:"#6bff6b", fontWeight:700 }}>{fmt(e.ebayMedian)}</span>
                  {e.ebayCount && <span style={{ color:"#444", fontSize:11 }}> ({e.ebayCount} sales)</span>}
                  {e.ebayUrl && <a href={e.ebayUrl} target="_blank" rel="noreferrer" style={{ color:"#4a8fff", fontSize:11, marginLeft:6 }}>→eBay</a>}
                </div>
              )}
            </div>

            {editId === e.id ? (
              <div style={{ marginTop:8 }}>
                <textarea style={{ ...S.input, minHeight:60, resize:"vertical" }} value={editNote} onChange={ev => setEditNote(ev.target.value)} />
                <div style={{ display:"flex", gap:8, marginTop:6 }}>
                  <button style={S.btnSm("#c9a227")} onClick={() => saveNote(e.id)}>Save</button>
                  <button style={S.btnSm()} onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : e.notes && (
              <div style={{ marginTop:8, fontSize:12, color:"#777", fontStyle:"italic" }}>"{e.notes}"</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Summary Tab ───────────────────────────────────────────────────────────────
function SummaryTab({ log }) {
  const total = log.length;
  const aiLow = log.reduce((s, e) => s + (e.valueMin || 0), 0);
  const aiHigh = log.reduce((s, e) => s + (e.valueMax || 0), 0);
  const ebayTotal = log.reduce((s, e) => s + (e.ebayMedian || 0), 0);
  const ebayCount = log.filter(e => e.ebayMedian != null).length;
  const statusCounts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: log.filter(e => e.status === s).length }), {});
  const countries = [...new Set(log.map(e => e.country).filter(Boolean))];
  const topByValue = [...log].sort((a, b) => (b.ebayMedian || b.valueMax || 0) - (a.ebayMedian || a.valueMax || 0)).slice(0, 5);
  const needGrading = log.filter(e => e.valueMax > 100 && e.status === "Unchecked");

  return (
    <div style={S.body}>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:16 }}>
        <div style={S.statCard("#c9a227")}><div style={S.statVal("#c9a227")}>{total}</div><div style={S.statLabel}>Total Coins</div></div>
        <div style={S.statCard("#6bff6b")}><div style={S.statVal("#6bff6b")}>{fmt(aiLow)}–{fmt(aiHigh)}</div><div style={S.statLabel}>AI Value Range</div></div>
        <div style={S.statCard("#4a8fff")}><div style={S.statVal("#4a8fff")}>{ebayCount > 0 ? fmt(ebayTotal) : "—"}</div><div style={S.statLabel}>eBay Median Total ({ebayCount} priced)</div></div>
        <div style={S.statCard("#ff9500")}><div style={S.statVal("#ff9500")}>{countries.length}</div><div style={S.statLabel}>Countries</div></div>
      </div>

      {/* Status breakdown */}
      <div style={S.card}>
        <div style={S.sectionTitle}>Status Breakdown</div>
        {STATUSES.map(s => (
          <div key={s} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <div style={{ width:90, fontSize:12, color: STATUS_COLORS[s], fontWeight:600 }}>{s}</div>
            <div style={{ flex:1, background:"#111", borderRadius:4, height:16, overflow:"hidden" }}>
              <div style={{ width: total ? `${(statusCounts[s]/total)*100}%` : "0%", background: STATUS_COLORS[s], height:"100%", borderRadius:4, transition:"width 0.3s" }} />
            </div>
            <div style={{ fontSize:13, fontWeight:700, color: STATUS_COLORS[s], width:24, textAlign:"right" }}>{statusCounts[s]}</div>
          </div>
        ))}
      </div>

      {/* Top coins by value */}
      {topByValue.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionTitle}>🏆 Top Coins by Value</div>
          {topByValue.map((e, i) => (
            <div key={e.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #1a1a1a" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <span style={{ fontSize:16, color:"#c9a227", fontWeight:800 }}>#{i+1}</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{e.name}</div>
                  <div style={{ fontSize:11, color:"#666" }}>{e.grade}</div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                {e.ebayMedian != null
                  ? <div style={{ color:"#6bff6b", fontWeight:700, fontSize:14 }}>{fmt(e.ebayMedian)} <span style={{ fontSize:10, color:"#444" }}>eBay</span></div>
                  : <div style={{ color:"#c9a227", fontWeight:700, fontSize:14 }}>{fmt(e.valueMax)} <span style={{ fontSize:10, color:"#444" }}>est.</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grading flags */}
      {needGrading.length > 0 && (
        <div style={{ ...S.card, background:"#0a1a0a", border:"1px solid #1a3a1a" }}>
          <div style={S.sectionTitle}>🏅 Consider Professional Grading</div>
          <p style={{ fontSize:12, color:"#666", margin:"0 0 10px" }}>These unchecked coins have AI estimates above $100 and may benefit from PCGS/NGC grading.</p>
          {needGrading.map(e => (
            <div key={e.id} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"4px 0", borderBottom:"1px solid #1a1a1a" }}>
              <span>{e.name}</span>
              <span style={{ color:"#6bff6b" }}>up to {fmt(e.valueMax)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onAuthed }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Login failed");
      onAuthed();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <form onSubmit={submit} style={{ ...S.card, width:"100%", maxWidth:360, marginBottom:0 }}>
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <div style={{ fontSize:40 }}>🪙</div>
          <h1 style={{ ...S.headerTitle, fontSize:20, marginTop:6 }}>Coin Collection Analyzer</h1>
          <p style={{ ...S.headerSub, marginTop:4 }}>Enter the password to continue</p>
        </div>
        <label style={S.label} htmlFor="pw">Password</label>
        <input id="pw" type="password" autoFocus value={password}
          onChange={e => setPassword(e.target.value)} style={S.input} placeholder="••••••••" />
        {error && <p style={{ color:"#ff6b6b", fontSize:13, marginTop:10, marginBottom:0 }}>{error}</p>}
        <button type="submit" disabled={busy || !password}
          style={{ ...S.btn(), marginTop:16, width:"100%", opacity: busy||!password?0.6:1 }}>
          {busy ? "Signing in…" : "🔓 Sign In"}
        </button>
      </form>
    </div>
  );
}

// Strip the (unused-in-list) base64 thumbnail before persisting so the stored
// collection stays small.
const stripPreviews = (items) => items.map(({ preview, ...rest }) => rest);

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("analyze");
  const [log, setLog] = useState([]);
  // auth.status: "loading" | "needsLogin" | "ready"
  const [auth, setAuth] = useState({ status: "loading", loginConfigured: false });
  const [persistMode, setPersistMode] = useState("local"); // "server" | "local"
  const hydrated = useRef(false);

  // Check auth state on load.
  useEffect(() => {
    fetch("/api/me")
      .then(r => r.json())
      .then(d => setAuth({ status: d.authed ? "ready" : "needsLogin", loginConfigured: d.loginConfigured }))
      .catch(() => setAuth({ status: "ready", loginConfigured: false })); // fail open — never lock out on a network blip
  }, []);

  // Load the saved collection once authenticated (server if configured, else localStorage).
  useEffect(() => {
    if (auth.status !== "ready") return;
    let cancelled = false;
    const loadLocal = () => {
      try { return JSON.parse(localStorage.getItem("coin-collection") || "[]"); }
      catch { return []; }
    };
    (async () => {
      try {
        const r = await fetch("/api/collection");
        if (r.status === 401) { if (!cancelled) setAuth(a => ({ ...a, status: "needsLogin" })); return; }
        const d = await r.json();
        if (cancelled) return;
        if (d.persisted && Array.isArray(d.items)) { setLog(d.items); setPersistMode("server"); }
        else { setLog(loadLocal()); setPersistMode("local"); }
      } catch {
        if (!cancelled) { setLog(loadLocal()); setPersistMode("local"); }
      } finally {
        if (!cancelled) hydrated.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, [auth.status]);

  // Persist the collection whenever it changes (after the initial load).
  useEffect(() => {
    if (auth.status !== "ready" || !hydrated.current) return;
    const payload = stripPreviews(log);
    try { localStorage.setItem("coin-collection", JSON.stringify(payload)); } catch { /* quota */ }
    if (persistMode === "server") {
      fetch("/api/collection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      }).then(r => { if (r.status === 401) setAuth(a => ({ ...a, status: "needsLogin" })); }).catch(() => {});
    }
  }, [log, auth.status, persistMode]);

  const logout = async () => {
    try { await fetch("/api/logout", { method: "POST" }); } catch { /* ignore */ }
    hydrated.current = false;
    setLog([]);
    setAuth(a => ({ ...a, status: "needsLogin" }));
  };

  const onAuthed = () => {
    hydrated.current = false;
    setAuth(a => ({ ...a, status: "ready" }));
  };

  if (auth.status === "loading") {
    return (
      <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", color:"#888" }}>
        Loading…
      </div>
    );
  }
  if (auth.status === "needsLogin") {
    return <LoginScreen onAuthed={onAuthed} />;
  }

  return (
    <div style={S.app}>
      <div style={{ ...S.header, justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:28 }}>🪙</span>
          <div>
            <h1 style={S.headerTitle}>Coin Collection Analyzer</h1>
            <p style={S.headerSub}>AI Identification · Live eBay Market Prices · Collection Management</p>
          </div>
        </div>
        {auth.loginConfigured && (
          <button style={S.btnSm("#2a2a2a")} onClick={logout} title="Sign out">⎋ Log out</button>
        )}
      </div>

      <div style={S.tabs}>
        {[["analyze","🔍 Analyze"],["log",`📋 Log (${log.length})`],["summary","📊 Summary"]].map(([id,label]) => (
          <button key={id} style={S.tab(tab===id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "analyze" && <AnalyzeTab log={log} setLog={setLog} onAuthExpired={() => setAuth(a => ({ ...a, status: "needsLogin" }))} />}
      {tab === "log" && <LogTab log={log} setLog={setLog} />}
      {tab === "summary" && <SummaryTab log={log} />}
    </div>
  );
}
