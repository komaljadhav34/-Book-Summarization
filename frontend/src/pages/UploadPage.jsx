import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, Youtube, Sparkles } from "lucide-react";
import { useAuth }           from "../context/AuthContext";
import { useSummaryOptions } from "../context/SummaryOptionsContext";
import { apiUploadFiles, apiUploadText, apiUploadYouTube } from "../api/client";
import { ErrorBox } from "../components/Ui";

const TABS = [
  { id:"file",    label:"Upload File", Icon:Upload },
  { id:"text",    label:"Paste Text",  Icon:FileText },
  { id:"youtube", label:"YouTube URL", Icon:Youtube },
];

export default function UploadPage() {
  const navigate         = useNavigate();
  const { token }        = useAuth();
  const { format, role } = useSummaryOptions();
  const [tab, setTab]    = useState("file");
  const [text,  setText] = useState("");
  const [title, setTitle]= useState("");
  const [url,   setUrl]  = useState("");
  const [drag,  setDrag] = useState(false);
  const [loading,setLoad]= useState(false);
  const [error, setError]= useState("");
  const fileRef          = useRef();

  const goProcess = (result, docTitle) =>
    navigate("/processing", { state: { jobId: result.job_id, bookId: result.book_id, title: docTitle || "Document" } });

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setError(""); setLoad(true);
    try {
      const results = await apiUploadFiles(token, Array.from(files), format, role);
      goProcess(results[0], files[0]?.name);
    } catch (e) { setError(e.message); }
    finally { setLoad(false); }
  };

  const handleText = async () => {
    setError(""); setLoad(true);
    try { goProcess(await apiUploadText(token, text, title, format, role), title || "Pasted Text"); }
    catch (e) { setError(e.message); }
    finally { setLoad(false); }
  };

  const handleYT = async () => {
    setError(""); setLoad(true);
    try { goProcess(await apiUploadYouTube(token, url, format, role), "YouTube Video"); }
    catch (e) {
      const raw = e.message || "";
      setError(raw.toLowerCase().includes("transcript") || raw.toLowerCase().includes("caption")
        ? "This video has no captions enabled. Only videos with auto-generated or manual subtitles can be transcribed. Try a different video, or paste the transcript in 'Paste Text'."
        : raw);
    }
    finally { setLoad(false); }
  };

  const canSubmit = tab === "text" ? text.trim().split(/\s+/).filter(Boolean).length >= 20
    : tab === "youtube" ? url.trim().length >= 10
    : false;

  return (
    <div style={{ padding:"36px 40px", maxWidth:920, margin:"0 auto" }}>

      {/* ── Hero ── */}
      <div className="fade-in" style={{ textAlign:"center", marginBottom:36 }}>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:7, padding:"4px 14px",
          borderRadius:20, background:"rgba(108,92,231,0.12)", border:"1px solid rgba(108,92,231,0.3)",
          fontSize:11, color:"#a29bfe", fontWeight:700, marginBottom:14, letterSpacing:.6,
        }}>✨ AI-POWERED SUMMARIZATION</div>
        <h1 style={{
          fontSize:30, fontWeight:900, lineHeight:1.2, marginBottom:10,
          background:"linear-gradient(130deg,#eef0ff 20%,#a29bfe 80%)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        }}>What do you want to summarize?</h1>
        <p style={{ fontSize:14, color:"var(--text2)", maxWidth:420, margin:"0 auto" }}>
          Upload a file, paste text, or drop a YouTube link. Format &amp; role are set in the sidebar.
        </p>
        {/* Active selections pill */}
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:14 }}>
          <span style={{ padding:"3px 12px", borderRadius:20, fontSize:12, fontWeight:700,
            background:"rgba(108,92,231,0.15)", color:"#a29bfe",
            border:"1px solid rgba(108,92,231,0.3)" }}>
            {format === "CONCISE" ? "⚡ Concise" : format === "DETAILED" ? "📖 Detailed" : "• Bullets"}
          </span>
          <span style={{ padding:"3px 12px", borderRadius:20, fontSize:12, fontWeight:700,
            background:"rgba(0,210,160,0.1)", color:"#00d2a0",
            border:"1px solid rgba(0,210,160,0.25)" }}>
            {role.charAt(0) + role.slice(1).toLowerCase()}
          </span>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:22 }}>

        {/* ── INPUT ── */}
        <div className="fade-in" style={{ animationDelay:".07s" }}>
          <Panel>
            <SectionLabel>Input Source</SectionLabel>

            {/* Tabs */}
            <div style={{ display:"flex", gap:5, marginBottom:18 }}>
              {TABS.map(({ id, label, Icon }) => (
                <button key={id} onClick={()=>{ setTab(id); setError(""); }} style={{
                  flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:5,
                  padding:"8px 6px", borderRadius:9, border:"1px solid",
                  borderColor: tab===id?"var(--accent)":"rgba(255,255,255,0.07)",
                  background: tab===id?"rgba(108,92,231,0.14)":"transparent",
                  color: tab===id?"#a29bfe":"var(--text2)",
                  fontWeight: tab===id?700:400, fontSize:12, cursor:"pointer", transition:"all .15s",
                  fontFamily:"var(--font)",
                }}>
                  <Icon size={12}/> {label}
                </button>
              ))}
            </div>

            {/* File */}
            {tab==="file" && (
              <div
                onDragOver={e=>{e.preventDefault();setDrag(true)}}
                onDragLeave={()=>setDrag(false)}
                onDrop={e=>{e.preventDefault();setDrag(false);handleFiles(e.dataTransfer.files)}}
                onClick={()=>fileRef.current?.click()}
                style={{
                  border:`2px dashed ${drag?"var(--accent)":"rgba(255,255,255,0.1)"}`,
                  borderRadius:12, padding:"38px 20px", textAlign:"center", cursor:"pointer",
                  background:drag?"rgba(108,92,231,0.07)":"transparent", transition:"all .2s",
                  minHeight:190,
                }}
              >
                <div style={{ fontSize:"2.2rem", marginBottom:10 }}></div>
                <p style={{ color:"var(--text)", fontSize:14, fontWeight:600, marginBottom:5 }}>
                  Drop files here or <span style={{ color:"var(--accent2)" }}>browse</span>
                </p>
                <p style={{ color:"var(--text2)", fontSize:12 }}>PDF, TXT, DOCX — up to 200 MB</p>
                <input ref={fileRef} type="file" multiple hidden accept=".pdf,.txt,.docx"
                  onChange={e=>handleFiles(e.target.files)} />
              </div>
            )}

            {/* Text */}
            {tab==="text" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <input placeholder="Title (optional)" value={title} onChange={e=>setTitle(e.target.value)}
                  style={{ borderRadius:8 }} />
                <textarea placeholder="Paste your text here… (min 20 words)"
                  value={text} onChange={e=>setText(e.target.value)}
                  style={{ minHeight:150, resize:"vertical", borderRadius:8 }} />
                <span style={{ fontSize:11, color:"var(--text2)", alignSelf:"flex-end" }}>
                  {text.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
            )}

            {/* YouTube */}
            {tab==="youtube" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{
                  display:"flex", alignItems:"center", gap:10, padding:"11px 14px",
                  background:"rgba(255,60,60,0.06)", border:"1px solid rgba(255,80,80,0.18)",
                  borderRadius:10,
                }}>
                  <span style={{ fontSize:"1.3rem", flexShrink:0 }}></span>
                  <input placeholder="https://youtu.be/... or youtube.com/watch?v=..."
                    value={url} onChange={e=>setUrl(e.target.value)}
                    style={{ border:"none", background:"transparent", padding:0, fontSize:13 }} />
                </div>
                <p style={{ fontSize:11, color:"var(--text2)" }}>
                  Requires auto-generated or manual captions on the video.
                </p>
              </div>
            )}

            {error && <div style={{ marginTop:12 }}><ErrorBox message={error}/></div>}
          </Panel>
        </div>

      </div>

      {/* ── CTA ── */}
      <div className="fade-in" style={{ animationDelay:".22s", marginTop:26, textAlign:"center" }}>
        <button
          onClick={tab==="text"?handleText:tab==="youtube"?handleYT:undefined}
          disabled={loading || (tab!=="file" && !canSubmit)}
          style={{
            display:"inline-flex", alignItems:"center", gap:10,
            padding:"14px 48px", borderRadius:14, border:"none",
            background: (loading||(tab!=="file"&&!canSubmit))
              ? "rgba(108,92,231,0.25)" : "linear-gradient(135deg,#6c5ce7,#a29bfe)",
            color:"#fff", fontWeight:800, fontSize:16, fontFamily:"var(--font)",
            cursor:(loading||(tab!=="file"&&!canSubmit))?"not-allowed":"pointer",
            opacity:(loading||(tab!=="file"&&!canSubmit))?0.55:1,
            boxShadow:(loading||(tab!=="file"&&!canSubmit))?"none":"0 8px 32px rgba(108,92,231,0.4)",
            transition:"all .2s",
          }}
          onMouseEnter={e=>{ if(!loading&&canSubmit) e.currentTarget.style.transform="translateY(-2px)"; }}
          onMouseLeave={e=>{ e.currentTarget.style.transform="none"; }}
        >
          {loading
            ? <><Spin/> Uploading…</>
            : tab==="file"
              ? <> Click or Drop a File Above</>
              : <><Sparkles size={16}/> Summarize Now</>}
        </button>
      </div>
    </div>
  );
}

function Panel({ children }) {
  return (
    <div style={{
      background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)",
      borderRadius:16, padding:20,
    }}>{children}</div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize:10, fontWeight:800, color:"var(--text2)", letterSpacing:1.2,
      textTransform:"uppercase", marginBottom:14 }}>{children}</p>
  );
}

function Spin() {
  return <div style={{ width:15, height:15, borderRadius:"50%",
    border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff",
    animation:"spin .7s linear infinite" }}/>;
}