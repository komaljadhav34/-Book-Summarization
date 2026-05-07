import { useState, useRef } from "react";
import { Upload, FileText, Youtube, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiUploadFiles, apiUploadText, apiUploadYouTube } from "../api/client";
import { Btn, ErrorBox } from "./Ui";

const TABS = [
  { id: "file",    label: "Upload File", Icon: Upload },
  { id: "text",    label: "Paste Text",  Icon: FileText },
  { id: "youtube", label: "YouTube URL", Icon: Youtube },
];

export default function UploadPanel({ options, onJobStarted }) {
  const [tab, setTab]         = useState("file");
  const [text, setText]       = useState("");
  const [title, setTitle]     = useState("");
  const [url, setUrl]         = useState("");
  const [dragging, setDrag]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const fileRef               = useRef();
  const { token }             = useAuth();

  const fmt  = options?.format || "CONCISE";
  const role = options?.role   || "GENERAL";

  const handleFiles = async (files) => {
    if (!files?.length) return;
    setError(""); setLoading(true);
    try {
      const results = await apiUploadFiles(token, Array.from(files), fmt, role);
      results.forEach(r => onJobStarted?.(r));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleText = async () => {
    setError(""); setLoading(true);
    try {
      const r = await apiUploadText(token, text, title, fmt, role);
      onJobStarted?.(r);
      setText(""); setTitle("");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleYT = async () => {
    setError(""); setLoading(true);
    try {
      const r = await apiUploadYouTube(token, url, fmt, role);
      onJobStarted?.(r);
      setUrl("");
    } catch (e) {
      const raw = e.message || "";
      if (raw.toLowerCase().includes("transcript") || raw.toLowerCase().includes("subtitle") || raw.toLowerCase().includes("caption")) {
        setError("This video has no captions enabled. YouTube transcripts only work on videos with auto-generated or manual subtitles. Try a different video, or use the Paste Text tab to paste the transcript manually.");
      } else {
        setError(raw);
      }
    }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      background: "#12121f", border: "1px solid #2d2d4e",
      borderRadius: 14, padding: 22, marginBottom: 20,
    }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => { setTab(id); setError(""); }} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, border: "1px solid",
            borderColor: tab === id ? "#6c5ce7" : "#2d2d4e",
            background: tab === id ? "rgba(108,92,231,0.15)" : "transparent",
            color: tab === id ? "#a88cff" : "#55556a",
            fontWeight: tab === id ? 600 : 400, fontSize: 13, cursor: "pointer",
            transition: "all .15s",
          }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* File drop zone */}
      {tab === "file" && (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? "#6c5ce7" : "#2d2d4e"}`,
            borderRadius: 12, padding: "36px 20px", textAlign: "center",
            cursor: "pointer", transition: "all .2s",
            background: dragging ? "rgba(108,92,231,0.07)" : "transparent",
          }}
        >
          <Upload size={28} color={dragging ? "#6c5ce7" : "#2d2d4e"} style={{ marginBottom: 10 }} />
          <p style={{ color: "#a0a0cc", fontSize: 14, fontWeight: 500 }}>
            Drop files here or <span style={{ color: "#6c5ce7" }}>browse</span>
          </p>
          <p style={{ color: "#55556a", fontSize: 12, marginTop: 6 }}>PDF, TXT, DOCX — up to 200 MB</p>
          <input
            ref={fileRef} type="file" multiple hidden
            accept=".pdf,.txt,.docx"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Paste text */}
      {tab === "text" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            placeholder="Document title (optional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            placeholder="Paste your text here… (10 – 10,000 words)"
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ minHeight: 150, resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#55556a" }}>{text.split(/\s+/).filter(Boolean).length} words</span>
            <Btn onClick={handleText} loading={loading} disabled={text.trim().length < 20}>
              Summarize
            </Btn>
          </div>
        </div>
      )}

      {/* YouTube */}
      {tab === "youtube" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:"1.6rem", flexShrink:0 }}>▶️</span>
            <input
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{ flex:1 }}
            />
          </div>
          <p style={{ fontSize:12, color:"var(--text2)", marginTop:-4 }}>
            Paste a YouTube video URL — we extract the transcript automatically
          </p>
          <div style={{ textAlign: "right" }}>
            <Btn onClick={handleYT} loading={loading} disabled={url.trim().length < 10}>
              <Youtube size={14} /> Extract & Summarize
            </Btn>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, color: "#a0a0cc", fontSize: 13 }}>
          <Loader2 size={15} style={{ animation: "spin .7s linear infinite" }} />
          Uploading and starting summarization…
        </div>
      )}

      <ErrorBox message={error} />
    </div>
  );
}