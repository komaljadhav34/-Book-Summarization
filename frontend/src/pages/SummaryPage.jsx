import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  apiGetSummary, apiSubmitFeedback,
  apiGenerateQuiz, apiGetQuiz, apiSubmitAnswer, apiExportUrl,
  apiAskDocument, apiExplainText, apiGetInsights,
} from "../api/client";
import MindMapModal from "../components/MindMapModal";
import { Spinner, ErrorBox, Badge } from "../components/Ui";
import { Download, ArrowLeft, ThumbsUp, ThumbsDown, BrainCircuit, BookOpen, X, Send, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
function md(text) {
  if (!text) return "";
  return text.split("\n").map(line => {
    if (line.startsWith("### ")) return `<h3 style="font-size:14px;font-weight:700;color:#c0b0ff;margin:14px 0 5px">${line.slice(4)}</h3>`;
    if (line.startsWith("## "))  return `<h2 style="font-size:16px;font-weight:800;color:#a29bfe;margin:16px 0 6px">${line.slice(3)}</h2>`;
    if (line.startsWith("# "))   return `<h1 style="font-size:18px;font-weight:900;color:#a29bfe;margin:18px 0 8px">${line.slice(2)}</h1>`;
    if (/^[•\-\*] /.test(line)) return `<div style="display:flex;gap:8px;margin:4px 0"><span style="color:#a29bfe;flex-shrink:0;margin-top:3px">•</span><span>${inl(line.slice(2))}</span></div>`;
    const nm = line.match(/^(\d+)\.\s(.+)/);
    if (nm) return `<div style="display:flex;gap:8px;margin:4px 0"><span style="color:#a29bfe;flex-shrink:0;font-weight:700;min-width:18px">${nm[1]}.</span><span>${inl(nm[2])}</span></div>`;
    if (!line.trim()) return `<div style="height:7px"></div>`;
    return `<p style="margin:4px 0">${inl(line)}</p>`;
  }).join("");
}
function inl(t) {
  return t
    .replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#e8e8ff;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/`(.+?)`/g,'<code style="background:rgba(108,92,231,0.15);padding:1px 6px;border-radius:4px;font-size:.9em;color:#a29bfe">$1</code>');
}

// ─── Evaluation Tab ────────────────────────────────────────────────────────────
function EvaluateTab({ bookId, token }) {
  const [reference, setReference] = useState("");
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const evaluate = async () => {
    if(!reference.trim()) return;
    setLoading(true); setError(""); setScores(null);
    try {
      const res = await fetch(`/api/books/${bookId}/evaluate`, {
        method:"POST", headers:{"Content-Type":"application/json", Authorization:`Bearer ${token}`},
        body: JSON.stringify({ reference_summary: reference })
      });
      if(!res.ok) throw new Error("Evaluation failed.");
      setScores(await res.json());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fade-in" style={{ padding:"20px", background:"rgba(255,255,255,0.025)", borderRadius:16, border:"1px solid rgba(255,255,255,0.07)" }}>
      <h3 style={{ fontSize:16, fontWeight:800, marginBottom:10 }}>Evaluate Summary Quality</h3>
      <p style={{ fontSize:13, color:"var(--text2)", marginBottom:16 }}>Paste a reference summary (e.g. from Goodreads or an expert) to calculate ROUGE scores.</p>
      <textarea value={reference} onChange={e=>setReference(e.target.value)} placeholder="Reference summary..." style={{ width:"100%", height:120, padding:14, borderRadius:12, background:"rgba(0,0,0,0.2)", border:"1px solid rgba(255,255,255,0.1)", color:"var(--text)", fontSize:13, fontFamily:"var(--font)", resize:"vertical", outline:"none", marginBottom:12 }} />
      <button onClick={evaluate} disabled={loading||!reference.trim()} style={{ padding:"10px 24px", borderRadius:10, border:"none", background:"var(--accent)", color:"#fff", fontWeight:700, cursor:loading?"not-allowed":"pointer", opacity:loading||!reference.trim()?0.6:1, fontFamily:"var(--font)" }}>{loading?"Evaluating...":"Run Evaluation"}</button>
      {error && <div style={{ marginTop:14 }}><ErrorBox message={error}/></div>}
      {scores && (
        <div style={{ display:"flex", gap:16, marginTop:24, flexWrap:"wrap" }}>
          {[ {label:"ROUGE-1", val:scores.rouge1}, {label:"ROUGE-2", val:scores.rouge2}, {label:"ROUGE-L", val:scores.rougeL} ].map(s => (
            <div key={s.label} className="fade-in" style={{ flex:1, minWidth:120, padding:"16px", borderRadius:12, background:"rgba(0,210,160,0.08)", border:"1px solid rgba(0,210,160,0.2)", textAlign:"center" }}>
              <div style={{ fontSize:12, color:"var(--text2)", fontWeight:700, marginBottom:8 }}>{s.label}</div>
              <div style={{ fontSize:24, fontWeight:900, color:"#00d2a0" }}>{(s.val*100).toFixed(1)}<span style={{fontSize:14,color:"var(--text2)"}}>%</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sentiment Timeline ───────────────────────────────────────────────────────
function SentimentTimeline({ bookId, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/books/${bookId}/sentiment`, { headers:{ Authorization:`Bearer ${token}` }})
      .then(r=>r.json()).then(d=>{
        const chartData = (d.sentiment_timeline||[]).map((c, i) => ({
          name: `Sec ${i+1}`,
          sentiment: c.sentiment,
          emotion: c.emotion,
          score: c.sentiment === "positive" ? c.confidence : c.sentiment === "negative" ? -c.confidence : 0,
          color: c.sentiment === "positive" ? "#00d2a0" : c.sentiment === "negative" ? "#ff6b6b" : "#ffd93d"
        }));
        setData(chartData);
        setLoading(false);
      }).catch(()=>setLoading(false));
  }, [bookId, token]);

  if(loading || !data || data.length === 0) return null;

  return (
    <div className="fade-in" style={{ padding:"20px", background:"rgba(255,255,255,0.025)", borderRadius:16, border:"1px solid rgba(255,255,255,0.07)", marginBottom:16 }}>
      <h3 style={{ fontSize:15, fontWeight:800, marginBottom:4 }}>Sentiment & Emotion Timeline</h3>
      <p style={{ fontSize:12, color:"var(--text2)", marginBottom:20 }}>Emotional arc across document sections.</p>
      <div style={{ height:180, width:"100%" }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top:5, right:5, bottom:5, left:-20 }}>
            <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#888" fontSize={11} tickLine={false} axisLine={false} domain={[-1, 1]} ticks={[-1, 0, 1]} tickFormatter={v=>v===1?"Pos":v===-1?"Neg":"Neu"} />
            <RechartsTooltip 
              cursor={{fill:"rgba(255,255,255,0.05)"}}
              content={({active, payload}) => {
                if(active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div style={{ background:"#1a1a2e", padding:"8px 12px", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, fontSize:12, boxShadow:"0 4px 12px rgba(0,0,0,0.5)" }}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>{p.name}</div>
                      <div style={{ color:p.color, textTransform:"capitalize", fontWeight:600 }}>{p.sentiment} <span style={{opacity:0.8, fontWeight:400}}>({p.emotion})</span></div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="score" radius={[4,4,4,4]}>
              {data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Key Insights ─────────────────────────────────────────────────────────────
function InsightsBar({ bookId, token }) {
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);

  const load = async () => {
    if (insights || loading) { setOpen(o => !o); return; }
    setLoading(true); setOpen(true);
    try { setInsights(await apiGetInsights(token, bookId)); }
    catch { setInsights({ insights: [] }); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ marginBottom:16 }}>
      <button onClick={load} style={{
        display:"flex", alignItems:"center", gap:7, padding:"8px 16px", borderRadius:10,
        border:"1px solid rgba(255,217,61,0.35)",
        background: open ? "rgba(255,217,61,0.08)" : "transparent",
        color:"#ffd93d", fontSize:13, fontWeight:600, cursor:"pointer",
        transition:"all .15s", fontFamily:"var(--font)",
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>
        Key Insights {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="fade-in" style={{
          marginTop:10, padding:"16px 18px", borderRadius:14,
          background:"rgba(255,217,61,0.05)", border:"1px solid rgba(255,217,61,0.2)",
        }}>
          {loading && <div style={{ display:"flex", gap:8, alignItems:"center", color:"var(--text2)", fontSize:13 }}><Spinner size={14}/> Extracting insights…</div>}
          {!loading && insights?.insights?.length > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ fontSize:10, fontWeight:800, color:"#ffd93d", letterSpacing:1, textTransform:"uppercase", marginBottom:4 }}>✦ Key Insights</div>
              {insights.insights.map((ins, i) => (
                <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                  <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center",
                    width:22, height:22, borderRadius:"50%", flexShrink:0,
                    background:"rgba(255,217,61,0.2)", color:"#ffd93d", fontSize:11, fontWeight:800 }}>{i+1}</span>
                  <p style={{ fontSize:13.5, color:"var(--text)", lineHeight:1.6, flex:1 }}>{ins}</p>
                </div>
              ))}
            </div>
          )}
          {!loading && !insights?.insights?.length && (
            <p style={{ fontSize:13, color:"var(--text2)" }}>No insights extracted.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Explain popup ────────────────────────────────────────────────────────────
function ExplainPopup({ text, bookId, token, onClose }) {
  const [mode,    setMode]    = useState("explain");
  const [result,  setResult]  = useState("");
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState("");

  const MODES = [
    { id:"explain",  label:"Explain",  color:"#a29bfe" },
    { id:"simplify", label:"Simplify", color:"#00d2a0" },
    { id:"example",  label:"Example",  color:"#ffd93d" },
    { id:"eli5",     label:"ELI5",     color:"#fd79a8" },
  ];

  const run = useRef(null);
  run.current = async (m) => {
    if (!bookId || !token) { setErrMsg("Missing document context."); return; }
    setMode(m); setLoading(true); setResult(""); setErrMsg("");
    try {
      const r = await apiExplainText(token, bookId, text, m);
      if (r?.explanation) setResult(r.explanation);
      else setErrMsg("The AI returned an empty response. Please try again.");
    } catch(e) {
      setErrMsg(e.message || "Failed to reach the explain endpoint.");
    } finally { setLoading(false); }
  };

  useEffect(() => { run.current("explain"); }, []);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9990,
      background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{
        width:"100%", maxWidth:540,
        background:"#0e0e1e", border:"1px solid rgba(108,92,231,0.35)",
        borderRadius:18, padding:24, boxShadow:"0 24px 80px rgba(0,0,0,0.8)",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
          <span style={{ fontSize:13, fontWeight:700, color:"var(--accent2)" }}>🔬 AI Explanation</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#555", cursor:"pointer" }}><X size={16}/></button>
        </div>
        <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:16,
          background:"rgba(108,92,231,0.08)", border:"1px solid rgba(108,92,231,0.2)",
          borderLeft:"3px solid var(--accent)", fontSize:13, color:"#c8c8e8",
          lineHeight:1.6, fontStyle:"italic" }}>
          "{text.length > 200 ? text.slice(0,200) + "…" : text}"
        </div>
        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => run.current(m.id)} style={{
              padding:"6px 14px", borderRadius:8,
              border:`1px solid ${mode===m.id ? m.color : "rgba(255,255,255,0.1)"}`,
              background: mode===m.id ? `${m.color}18` : "transparent",
              color: mode===m.id ? m.color : "var(--text2)",
              fontSize:12, fontWeight:mode===m.id?700:400,
              cursor:"pointer", transition:"all .15s", fontFamily:"var(--font)",
            }}>{m.label}</button>
          ))}
        </div>
        <div style={{ minHeight:80, padding:"14px 16px", borderRadius:12,
          background: errMsg ? "rgba(255,107,107,0.06)" : "rgba(255,255,255,0.03)",
          border: errMsg ? "1px solid rgba(255,107,107,0.25)" : "1px solid rgba(255,255,255,0.07)",
          fontSize:14, lineHeight:1.75, color:"var(--text)" }}>
          {loading
            ? <div style={{ display:"flex", gap:8, alignItems:"center", color:"var(--text2)" }}><Spinner size={14}/> Thinking…</div>
            : errMsg
              ? <span style={{ color:"#ff9999", fontSize:13 }}>⚠ {errMsg}</span>
              : result || <span style={{ color:"var(--text2)" }}>Loading explanation…</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Clickable summary sentences ──────────────────────────────────────────────
function SentenceSpan({ s, i, isHovered, onEnter, onLeave, onExplain }) {
  return (
    <span
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position:"relative", cursor:"pointer", paddingBottom:1, borderRadius:2,
        borderBottom: isHovered ? "2px solid #a29bfe" : "1px dashed rgba(162,155,254,0.25)",
        color: isHovered ? "#d0c8ff" : "inherit", transition:"color .1s, border-bottom .1s",
      }}
    >
      {s}
      {isHovered && (
        <button
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onClick={(e) => { e.stopPropagation(); onExplain(s.trim()); }}
          style={{
            position:"absolute", top:-30, right:0,
            padding:"4px 11px", borderRadius:7, zIndex:20,
            background:"linear-gradient(135deg,#6c5ce7,#a29bfe)",
            border:"none", color:"#fff", fontSize:11, fontWeight:700,
            cursor:"pointer", whiteSpace:"nowrap", fontFamily:"var(--font)",
            boxShadow:"0 4px 14px rgba(108,92,231,0.5)",
            display:"flex", alignItems:"center", gap:5,
          }}
        >
          🔬 Explain
        </button>
      )}
    </span>
  );
}

function SummaryText({ text, onExplain }) {
  const sentences = text.match(/[^.!?\n]+[.!?]+\s*/g) || [text];
  const [hovered, setHovered] = useState(null);
  const leaveTimer = useRef(null);

  const handleEnter = (i) => { clearTimeout(leaveTimer.current); setHovered(i); };
  const handleLeave = () => { leaveTimer.current = setTimeout(() => setHovered(null), 200); };

  return (
    <div style={{ fontSize:14, lineHeight:1.9, color:"#c8c8e8" }}>
      {sentences.map((s, i) => (
        <SentenceSpan
          key={i} s={s} i={i}
          isHovered={hovered === i}
          onEnter={() => handleEnter(i)}
          onLeave={handleLeave}
          onExplain={onExplain}
        />
      ))}
    </div>
  );
}

// ─── Passage drawer ───────────────────────────────────────────────────────────
// Opens as a fixed right panel when a source tag is clicked in Ask AI.
function PassageDrawer({ passage, onClose }) {
  // passage = { label: "Passage 3", text: "..." }
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <>
      {/* Subtle backdrop — doesn't block the chat */}
      <div
        onClick={onClose}
        style={{
          position:"fixed", inset:0, zIndex:8998,
          background:"rgba(0,0,0,0.25)",
        }}
      />

      {/* Drawer */}
      <div
        className="fade-in"
        style={{
          position:"fixed", right:0, top:0, bottom:0, width:400,
          background:"#0e0e1e",
          borderLeft:"1px solid rgba(108,92,231,0.35)",
          boxShadow:"-8px 0 40px rgba(0,0,0,0.6)",
          zIndex:8999,
          display:"flex", flexDirection:"column",
          animation:"slideIn .2s ease",
        }}
      >
        {/* Header */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"16px 20px",
          borderBottom:"1px solid rgba(108,92,231,0.2)",
          background:"linear-gradient(90deg,rgba(108,92,231,0.12) 0%,transparent 100%)",
          flexShrink:0,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{
              width:28, height:28, borderRadius:8, flexShrink:0,
              background:"linear-gradient(135deg,#6c5ce7,#a29bfe)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13,
            }}>📎</div>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:"var(--accent2)" }}>
                {passage.label}
              </div>
              <div style={{ fontSize:10, color:"var(--text2)", marginTop:1 }}>
                Source passage from document
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
              color:"#888", cursor:"pointer", borderRadius:7,
              width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,107,107,0.15)"; e.currentTarget.style.color="#ff6b6b"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color="#888"; }}
          >
            <X size={14}/>
          </button>
        </div>

        {/* Passage text */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px" }}>
          <div style={{
            fontSize:13, lineHeight:1.9, color:"var(--text)",
            background:"rgba(108,92,231,0.05)",
            border:"1px solid rgba(108,92,231,0.15)",
            borderLeft:"3px solid var(--accent)",
            padding:"16px 18px", borderRadius:12,
            whiteSpace:"pre-wrap",
          }}>
            {passage.text}
          </div>
          {passage.text.length >= 600 && (
            <p style={{ fontSize:11, color:"var(--text2)", marginTop:10, fontStyle:"italic" }}>
              Showing first 600 characters of this passage.
            </p>
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding:"12px 20px",
          borderTop:"1px solid rgba(255,255,255,0.05)",
          fontSize:11, color:"var(--text2)", flexShrink:0,
        }}>
          Press Esc or click outside to close
        </div>
      </div>
    </>
  );
}

// ─── Ask AI tab ───────────────────────────────────────────────────────────────
function AskAITab({ bookId, token, bookTitle }) {
  const [messages, setMessages] = useState([
    { role:"assistant", content:`Hi! I've read **${bookTitle || "this document"}** thoroughly. Ask me anything — key arguments, specific passages, comparisons, or examples.` }
  ]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [activePassage,  setActivePassage]  = useState(null); // { label, text }
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(m => [...m, { role:"user", content:q }]);
    setLoading(true);
    try {
      const r = await apiAskDocument(token, bookId, q);
      // r.sources is now [{ label, text }]
      setMessages(m => [...m, { role:"assistant", content:r.answer, sources:r.sources || [] }]);
    } catch {
      setMessages(m => [...m, { role:"assistant", content:"Sorry, couldn't answer that. Please try again." }]);
    } finally { setLoading(false); }
  };

  const SUGGESTIONS = [
    "What are the main arguments?",
    "Give me key examples from the document",
    "What conclusions does the author reach?",
    "Summarize the most important section",
  ];

  return (
    <div className="fade-in" style={{ display:"flex", flexDirection:"column", height:520, position:"relative" }}>

      {/* Passage drawer rendered at page level via portal alternative */}
      {activePassage && (
        <PassageDrawer passage={activePassage} onClose={() => setActivePassage(null)} />
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"12px 0", display:"flex", flexDirection:"column", gap:12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display:"flex", gap:10, flexDirection:m.role==="user"?"row-reverse":"row", alignItems:"flex-end" }}>
            <div style={{
              width:28, height:28, borderRadius:"50%", flexShrink:0,
              display:"flex", alignItems:"center", justifyContent:"center",
              background: m.role==="user" ? "linear-gradient(135deg,#6c5ce7,#a29bfe)" : "rgba(0,210,160,0.15)",
              fontSize:12,
            }}>
              {m.role === "user" ? "👤" : "🤖"}
            </div>
            <div style={{ maxWidth:"75%" }}>
              <div style={{
                padding:"11px 15px",
                borderRadius: m.role==="user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.role==="user" ? "linear-gradient(135deg,#6c5ce7,#7c6ef0)" : "rgba(255,255,255,0.04)",
                border: m.role==="user" ? "none" : "1px solid rgba(255,255,255,0.07)",
                fontSize:13.5, lineHeight:1.7, color: m.role==="user" ? "#fff" : "var(--text)",
              }} dangerouslySetInnerHTML={{ __html: md(m.content) }}/>

              {/* Source tags — clickable, open passage drawer */}
              {m.sources?.length > 0 && (
                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginTop:5 }}>
                  {m.sources.map((s, si) => (
                    <button
                      key={si}
                      onClick={() => setActivePassage(s)}
                      title="Click to view this passage"
                      style={{
                        display:"inline-flex", alignItems:"center", gap:4,
                        padding:"3px 10px", borderRadius:20, fontSize:10,
                        background:"rgba(0,210,160,0.1)", color:"#00d2a0",
                        border:"1px solid rgba(0,210,160,0.25)", fontWeight:600,
                        cursor:"pointer", transition:"all .15s", fontFamily:"var(--font)",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background="rgba(0,210,160,0.2)";
                        e.currentTarget.style.borderColor="#00d2a0";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background="rgba(0,210,160,0.1)";
                        e.currentTarget.style.borderColor="rgba(0,210,160,0.25)";
                      }}
                    >
                      📎 {s.label} <ChevronRight size={9}/>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
            <div style={{ width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,210,160,0.15)", fontSize:12 }}>🤖</div>
            <div style={{ padding:"12px 16px", borderRadius:"16px 16px 16px 4px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:5, alignItems:"center" }}>
              {[0,1,2].map(n => <div key={n} style={{ width:7, height:7, borderRadius:"50%", background:"#a29bfe", opacity:0.6, animation:`pulse 1.2s ${n*0.2}s infinite` }}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {messages.length === 1 && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setInput(s)} style={{
              padding:"5px 12px", borderRadius:20, fontSize:12,
              border:"1px solid rgba(108,92,231,0.3)", background:"rgba(108,92,231,0.07)",
              color:"var(--accent2)", cursor:"pointer", transition:"all .15s", fontFamily:"var(--font)",
            }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:8, padding:"10px 12px", borderRadius:14, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)" }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==="Enter" && !e.shiftKey && send()}
          placeholder="Ask anything about this document…"
          style={{ flex:1, background:"transparent", border:"none", color:"var(--text)", fontSize:14, outline:"none", fontFamily:"var(--font)" }}
        />
        <button onClick={send} disabled={!input.trim()||loading} style={{
          width:36, height:36, borderRadius:9, border:"none", flexShrink:0,
          background: input.trim()&&!loading ? "var(--accent)" : "rgba(108,92,231,0.25)",
          color:"#fff", cursor: input.trim()&&!loading ? "pointer" : "not-allowed",
          display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s",
        }}><Send size={14}/></button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SummaryPage() {
  const { bookId }   = useParams();
  const navigate     = useNavigate();
  const { token }    = useAuth();
  const [summary, setSummary] = useState(null);
  const [book,    setBook]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("summary");
  const [quizData,setQuiz]    = useState(null);
  const [quizLoad,setQL]      = useState(false);
  const [answers, setAns]     = useState({});
  const [feedback,setFeed]    = useState(null);
  const [error,   setError]   = useState("");
  const [mapOpen, setMap]     = useState(false);
  const [explain, setExplain] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const sum = await apiGetSummary(token, bookId);
        setSummary(sum);
        const res = await fetch("/api/books/", { headers:{ Authorization:`Bearer ${token}` }});
        if (res.ok) { const bs = await res.json(); setBook(bs.find(b=>String(b.id)===String(bookId))); }
      } catch(e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [bookId, token]);

  const handleFeedback = async(r) => {
    if (!summary || feedback===r) return;
    try { await apiSubmitFeedback(token, summary.summary_id, r, ""); setFeed(r); } catch{}
  };
  const handleExport = (fmt) => {
    fetch(apiExportUrl(bookId,fmt),{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.blob()).then(blob=>{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${book?.title||"summary"}.${fmt}`;a.click();});
  };
  const handleQuiz = async() => {
    setQL(true); setError("");
    try { const{quiz_id}=await apiGenerateQuiz(token,bookId,10); setQuiz(await apiGetQuiz(token,quiz_id)); setTab("quiz"); }
    catch(e){ setError(e.message); }
    finally{ setQL(false); }
  };
  const handleAnswer = async(qId,answer) => {
    try{ const r=await apiSubmitAnswer(token,qId,answer); setAns(p=>({...p,[qId]:r})); }catch{}
  };

  const pct = summary?.original_word_count>0 ? Math.round((1-summary.summary_word_count/summary.original_word_count)*100) : 0;
  const srcTag = {file:" File",text:" Text",youtube:" YouTube"};
  const TABS = [
    {id:"summary", label:"Summary"},
    {id:"ask",     label:"Chat Assistant"},
    {id:"evaluate",label:"Evaluate"},
    {id:"quiz",    label:"Quiz"},
    {id:"mindmap", label:"Mind Map"},
  ];

  return (
    <div style={{ padding:"28px 36px", maxWidth:1200, margin:"0 auto" }}>
      <button onClick={()=>navigate("/upload")} style={{
        display:"inline-flex",alignItems:"center",gap:7,background:"none",
        border:"1px solid rgba(255,255,255,0.08)",color:"var(--text2)",padding:"7px 14px",
        borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:"var(--font)",marginBottom:22,transition:"all .15s",
      }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="#a29bfe";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="var(--text2)";}}>
        <ArrowLeft size={14}/> New Summary
      </button>

      {loading && <div style={{display:"flex",justifyContent:"center",padding:80}}><Spinner/></div>}
      {!loading && error && <ErrorBox message={error}/>}

      {!loading && summary && (<>
        {/* Header */}
        <div className="fade-in" style={{ padding:"22px 24px",borderRadius:18,marginBottom:16,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden",position:"relative" }}>
          <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#6c5ce7,#a29bfe,#fd79a8,#ffd93d)" }}/>
          <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,flexWrap:"wrap" }}>
            <div>
              <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:8 }}>
                {book?.source_type&&<Badge color="#6c5ce7">{srcTag[book.source_type]||book.source_type}</Badge>}
                {summary.summary_format&&<Badge color="#00d2a0">{summary.summary_format}</Badge>}
                {summary.summary_role&&summary.summary_role!=="GENERAL"&&<Badge color="#a29bfe">{summary.summary_role}</Badge>}
                {pct>0&&<span style={{ padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,background:"rgba(0,210,160,0.12)",color:"var(--green)",border:"1px solid rgba(0,210,160,0.25)",display:"inline-flex",alignItems:"center",gap:3 }}>↓ {pct}% shorter</span>}
              </div>
              <h1 style={{ fontSize:21,fontWeight:900,color:"var(--text)",marginBottom:5 }}>{book?.title||"Summary"}</h1>
              <p style={{ fontSize:12,color:"var(--text2)",display:"flex",gap:14,flexWrap:"wrap" }}>
                {summary.original_word_count&&<span> {summary.original_word_count.toLocaleString()} → {summary.summary_word_count.toLocaleString()} words</span>}
                {book?.upload_date&&<span> {new Date(book.upload_date).toLocaleDateString()}</span>}
              </p>
            </div>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8 }}>
              <p style={{ fontSize:11,color:"var(--text2)",fontWeight:600 }}>Rate this summary</p>
              <div style={{ display:"flex",gap:8 }}>
                {[{v:"up",icon:<ThumbsUp size={13}/>,label:"Helpful",c:"#00d2a0"},{v:"down",icon:<ThumbsDown size={13}/>,label:"Not great",c:"#ff6b6b"}].map(f=>(
                  <button key={f.v} onClick={()=>handleFeedback(f.v)} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 13px",borderRadius:9,border:`1px solid ${feedback===f.v?f.c:"rgba(255,255,255,0.1)"}`,background:feedback===f.v?`${f.c}18`:"transparent",color:feedback===f.v?f.c:"var(--text2)",fontWeight:feedback===f.v?700:400,fontSize:12,cursor:"pointer",transition:"all .15s",fontFamily:"var(--font)" }}
                    onMouseEnter={e=>{if(feedback!==f.v){e.currentTarget.style.borderColor=f.c;e.currentTarget.style.color=f.c;}}}
                    onMouseLeave={e=>{if(feedback!==f.v){e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color="var(--text2)";}}}
                  >{f.icon} {f.label}</button>
                ))}
              </div>
              {feedback&&<span style={{ fontSize:11,color:feedback==="up"?"var(--green)":"var(--red)" }}>{feedback==="up"?"✓ Thanks for the feedback!":"✓ We'll work to improve."}</span>}
            </div>
          </div>
          {summary.topics?.length>0&&(
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginTop:14 }}>
              {summary.topics.map(t=><span key={t} style={{ padding:"2px 10px",borderRadius:20,fontSize:11,background:"rgba(253,121,168,0.1)",color:"#fd79a8",border:"1px solid rgba(253,121,168,0.2)" }}>{t}</span>)}
            </div>
          )}
        </div>

        {/* Export row */}
        <div style={{ display:"flex",gap:7,marginBottom:14,flexWrap:"wrap",alignItems:"center" }}>
          {["txt","docx","pdf"].map(fmt=>(
            <button key={fmt} onClick={()=>handleExport(fmt)} style={{ display:"flex",alignItems:"center",gap:5,padding:"6px 11px",borderRadius:8,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"var(--text2)",fontSize:12,cursor:"pointer",transition:"all .15s",fontFamily:"var(--font)" }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.color="#a29bfe";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="var(--text2)";}}>
              <Download size={12}/> {fmt.toUpperCase()}
            </button>
          ))}
          <button onClick={()=>setMap(true)} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 13px",borderRadius:8,border:"1px solid rgba(108,92,231,0.35)",background:"rgba(108,92,231,0.08)",color:"#a29bfe",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s",fontFamily:"var(--font)" }}><BrainCircuit size={12}/> Mind Map</button>
          <button onClick={handleQuiz} disabled={quizLoad} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 13px",borderRadius:8,border:`1px solid ${quizData?"rgba(255,217,61,0.4)":"rgba(0,210,160,0.35)"}`,background:quizData?"rgba(255,217,61,0.07)":"rgba(0,210,160,0.07)",color:quizData?"#ffd93d":"#00d2a0",fontSize:12,fontWeight:600,cursor:quizLoad?"not-allowed":"pointer",opacity:quizLoad?0.6:1,transition:"all .15s",fontFamily:"var(--font)" }}>{quizLoad?"⏳ Generating…":quizData?"🔁 Regenerate":"🧪 Generate Quiz"}</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",gap:4,marginBottom:18,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:5,width:"fit-content",flexWrap:"wrap" }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 15px",borderRadius:9,border:"none",cursor:"pointer",fontFamily:"var(--font)",transition:"all .2s",background:tab===t.id?"rgba(108,92,231,0.2)":"transparent",color:tab===t.id?"#a29bfe":"var(--text2)",fontWeight:tab===t.id?700:400,fontSize:13 }}>{t.label}</button>
          ))}
        </div>

        {error&&<div style={{ marginBottom:14 }}><ErrorBox message={error}/></div>}

        {tab==="summary"&&(
          <div className="fade-in">
            <SentimentTimeline bookId={bookId} token={token}/>
            <InsightsBar bookId={bookId} token={token}/>
            <div style={{ padding:"20px 22px",borderRadius:16,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize:10,fontWeight:800,color:"var(--text2)",letterSpacing:.9,textTransform:"uppercase",marginBottom:14,display:"flex",alignItems:"center",gap:7 }}>
                <BookOpen size={11}/> Summary
                <span style={{ fontWeight:400,color:"rgba(255,255,255,0.2)",fontSize:10 }}>— hover any sentence → Explain</span>
              </div>
              <SummaryText text={summary.summary} onExplain={text=>setExplain(text)}/>
            </div>
          </div>
        )}

        {tab==="ask"&&<AskAITab bookId={bookId} token={token} bookTitle={book?.title}/>}
        {tab==="evaluate"&&<EvaluateTab bookId={bookId} token={token}/>}

        {tab==="quiz"&&(
          <div className="fade-in">
            {!quizData?(
              <div style={{ textAlign:"center",padding:"60px 20px",borderRadius:16,background:"rgba(255,255,255,0.025)",border:"2px dashed rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize:"3rem",marginBottom:14 }}>🧪</div>
                <h3 style={{ fontSize:17,fontWeight:800,color:"var(--text)",marginBottom:8 }}>Test Your Understanding</h3>
                <p style={{ color:"var(--text2)",fontSize:13,marginBottom:22 }}>10 questions about "{book?.title||"this document"}" with difficulty labels.</p>
                <button onClick={handleQuiz} disabled={quizLoad} style={{ padding:"12px 32px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#00d2a0,#00b38a)",color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"var(--font)",opacity:quizLoad?0.6:1 }}>{quizLoad?" Generating…":" Generate Quiz"}</button>
              </div>
            ):(<QuizView quiz={quizData} answers={answers} onAnswer={handleAnswer}/>)}
          </div>
        )}

        {tab==="mindmap"&&(
          <div className="fade-in" style={{ textAlign:"center",padding:"60px 20px",borderRadius:16,background:"rgba(255,255,255,0.025)",border:"2px dashed rgba(108,92,231,0.2)" }}>
            <div style={{ fontSize:"3rem",marginBottom:14 }}>🕸️</div>
            <h3 style={{ fontSize:17,fontWeight:800,color:"var(--text)",marginBottom:8 }}>Mind Map</h3>
            <p style={{ color:"var(--text2)",fontSize:13,marginBottom:22 }}>Visualize key concepts and their relationships.</p>
            <button onClick={()=>setMap(true)} style={{ padding:"12px 32px",borderRadius:12,border:"1px solid var(--accent)",background:"rgba(108,92,231,0.12)",color:"#a29bfe",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"var(--font)" }}><BrainCircuit size={14} style={{ marginRight:7,verticalAlign:"middle" }}/>Open Mind Map</button>
          </div>
        )}

      </>)}

      {mapOpen&&<MindMapModal bookId={bookId} bookTitle={book?.title||"Document"} apiToken={token} onClose={()=>setMap(false)}/>}
      {explain&&<ExplainPopup text={explain} bookId={bookId} token={token} onClose={()=>setExplain(null)}/>}
    </div>
  );
}

// ─── Quiz components ───────────────────────────────────────────────────────────
function QuizView({quiz,answers,onAnswer}) {
  const correct  = Object.values(answers).filter(a=>a.is_correct).length;
  const answered = Object.keys(answers).length;
  const total    = quiz.questions.length;
  return (
    <div>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px",borderRadius:12,marginBottom:16,background:"rgba(108,92,231,0.08)",border:"1px solid rgba(108,92,231,0.2)" }}>
        <span style={{ fontWeight:700,color:"#a29bfe",fontSize:14 }}> Quiz — {total} Questions</span>
        {answered>0&&<div style={{ display:"flex",gap:14,fontSize:13 }}><span style={{ color:"var(--green)" }}>✓ {correct}</span><span style={{ color:"var(--red)" }}>✗ {answered-correct}</span><span style={{ color:"var(--text2)" }}>{total-answered} left</span></div>}
      </div>
      {answered>0&&<div style={{ height:4,borderRadius:4,background:"rgba(255,255,255,0.07)",marginBottom:16,overflow:"hidden" }}><div style={{ height:"100%",borderRadius:4,width:`${(correct/total)*100}%`,background:"linear-gradient(90deg,var(--green),#00e5b0)",transition:"width .4s" }}/></div>}
      {quiz.questions.map((q,i)=><QuizQ key={q.id} q={q} index={i} result={answers[q.id]} onAnswer={onAnswer}/>)}
    </div>
  );
}

function QuizQ({q,index,result,onAnswer}) {
  // Difficulty badge colour
  const diffColor = { easy:"#00d2a0", medium:"#ffd93d", hard:"#ff6b6b" }[q.difficulty||"medium"] || "#ffd93d";

  return (
    <div style={{ marginBottom:13,padding:17,borderRadius:13,background:"rgba(255,255,255,0.025)",border:`1px solid ${result?(result.is_correct?"rgba(0,210,160,0.25)":"rgba(255,107,107,0.2)"):"rgba(255,255,255,0.06)"}`,transition:"border-color .2s" }}>
      <div style={{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:11 }}>
        <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:27,height:27,borderRadius:"50%",flexShrink:0,background:"linear-gradient(135deg,var(--accent),#7c3aed)",color:"#fff",fontWeight:800,fontSize:12 }}>{index+1}</span>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:13.5,fontWeight:600,color:"var(--text)",lineHeight:1.5,marginBottom:6 }}>{q.question_text}</p>
          {/* Difficulty badge */}
          {q.difficulty && (
            <span style={{
              fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10,
              background:`${diffColor}18`, color:diffColor,
              border:`1px solid ${diffColor}44`, textTransform:"uppercase", letterSpacing:.5,
            }}>
              {q.difficulty}
            </span>
          )}
        </div>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:6,paddingLeft:37 }}>
        {(q.options||[]).map((opt,j)=>{
          const chosen  = result?.user_answer===opt;
          const correct = result&&result.correct_answer===opt;
          let bg="rgba(255,255,255,0.03)",border="rgba(255,255,255,0.08)",color="var(--text2)";
          if(result){
            if(correct)      {bg="rgba(0,210,160,0.1)"; border="#00d2a0"; color="#00d2a0";}
            else if(chosen)  {bg="rgba(255,107,107,0.08)"; border="#ff6b6b"; color="#ff6b6b";}
          }
          return <button key={j} disabled={!!result} onClick={()=>onAnswer(q.id,opt)}
            style={{ padding:"9px 13px",borderRadius:9,border:`1px solid ${border}`,background:bg,color,fontSize:13,textAlign:"left",cursor:result?"default":"pointer",transition:"all .15s",fontFamily:"var(--font)" }}
            onMouseEnter={e=>{if(!result){e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.background="rgba(108,92,231,0.08)";e.currentTarget.style.color="#c0b0ff";}}}
            onMouseLeave={e=>{if(!result){e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.color="var(--text2)";}}}
          >{correct&&"✓ "}{chosen&&!result?.is_correct&&"✗ "}{opt}</button>;
        })}
      </div>
      {result&&<div style={{ marginTop:9,marginLeft:37,padding:"9px 13px",borderRadius:8,background:result.is_correct?"rgba(0,210,160,0.06)":"rgba(255,107,107,0.05)",borderLeft:`3px solid ${result.is_correct?"var(--green)":"var(--red)"}`,fontSize:12,lineHeight:1.6,color:"var(--text2)" }}>
        <span style={{ fontWeight:700,color:result.is_correct?"var(--green)":"var(--red)" }}>{result.is_correct?"✓ Correct!":`✗ Correct: "${result.correct_answer}"`}</span>
        {result.explanation&&<span style={{ display:"block",marginTop:4 }}>{result.explanation}</span>}
      </div>}
    </div>
  );
}