import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiJobStatus } from "../api/client";

const FACTS = [
  " The average reader reads about 200–250 words per minute.",
  " Reading 20 minutes a day exposes you to ~1.8 million words per year.",
  " GPT-class models can process your entire text in under a second.",
  " The longest novel ever written is 'In Search of Lost Time' — 1.5 million words.",
  " AI summarization reduces reading time by up to 90%.",
  " Over 130 million books have been published in human history.",
  " Active reading improves retention by 3–5× compared to passive skimming.",
  " The Feynman Technique: summarize to truly understand.",
  " A typical research paper takes 40+ mins to read — we do it in seconds.",
  " Students who summarize retain 50% more knowledge after 1 week.",
  " Your brain forms new neural connections while reading.",
  " The average person spends 17 minutes daily reading for pleasure.",
];

const STAGES = [
  { pct: 5,  label: "Just started…",             sub: "Uploading and parsing your content" },
  { pct: 25, label: "Reading through it…",       sub: "Breaking your text into chunks" },
  { pct: 50, label: "Identifying key ideas…",    sub: "Finding the most important passages" },
  { pct: 72, label: "Weaving the summary…",      sub: "Crafting a cohesive narrative" },
  { pct: 90, label: "Almost there!",             sub: "Polishing and formatting" },
  { pct: 99, label: "Wrapping up…",              sub: "Just a moment more" },
];

function getStage(pct) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (pct >= STAGES[i].pct) return STAGES[i];
  }
  return STAGES[0];
}

// Nerd SVG character — animated reading pose
function NerdCharacter({ blink }) {
  return (
    <svg viewBox="0 0 140 160" width="140" height="160" style={{ filter:"drop-shadow(0 8px 24px rgba(108,92,231,0.3))" }}>
      {/* Body */}
      <ellipse cx="70" cy="130" rx="36" ry="22" fill="#2d2560" opacity="0.7"/>
      {/* Shirt */}
      <rect x="46" y="100" width="48" height="38" rx="8" fill="#6c5ce7"/>
      {/* Collar */}
      <path d="M62 100 L70 112 L78 100" fill="#a29bfe" opacity="0.7"/>
      {/* Shirt pocket */}
      <rect x="72" y="108" width="14" height="10" rx="3" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      {/* Pen in pocket */}
      <line x1="76" y1="108" x2="76" y2="103" stroke="#ffd93d" strokeWidth="2" strokeLinecap="round"/>
      {/* Neck */}
      <rect x="63" y="90" width="14" height="14" rx="5" fill="#f4c4a0"/>
      {/* Head */}
      <ellipse cx="70" cy="70" rx="28" ry="30" fill="#f5c9a5"/>
      {/* Hair */}
      <ellipse cx="70" cy="43" rx="28" ry="14" fill="#3d2b1f"/>
      <rect x="42" y="43" width="56" height="12" rx="0" fill="#3d2b1f"/>
      {/* Ears */}
      <ellipse cx="42" cy="70" rx="5" ry="7" fill="#f5c9a5"/>
      <ellipse cx="98" cy="70" rx="5" ry="7" fill="#f5c9a5"/>
      {/* Eyes with blink */}
      {blink ? (
        <>
          <line x1="59" y1="68" x2="66" y2="68" stroke="#3d2b1f" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="74" y1="68" x2="81" y2="68" stroke="#3d2b1f" strokeWidth="2.5" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <ellipse cx="62" cy="68" rx="6" ry="6.5" fill="#fff"/>
          <ellipse cx="78" cy="68" rx="6" ry="6.5" fill="#fff"/>
          <ellipse cx="63" cy="68" rx="3" ry="3.5" fill="#3d2b1f"/>
          <ellipse cx="79" cy="68" rx="3" ry="3.5" fill="#3d2b1f"/>
          {/* Eye shine */}
          <circle cx="64.5" cy="66.5" r="1" fill="#fff"/>
          <circle cx="80.5" cy="66.5" r="1" fill="#fff"/>
        </>
      )}
      {/* Glasses */}
      <rect x="54" y="62" width="16" height="12" rx="5" fill="none" stroke="#4a4a6a" strokeWidth="2"/>
      <rect x="70" y="62" width="16" height="12" rx="5" fill="none" stroke="#4a4a6a" strokeWidth="2"/>
      <line x1="70" y1="68" x2="70" y2="68" stroke="#4a4a6a" strokeWidth="2"/>
      <line x1="54" y1="68" x2="48" y2="70" stroke="#4a4a6a" strokeWidth="1.5"/>
      <line x1="86" y1="68" x2="92" y2="70" stroke="#4a4a6a" strokeWidth="1.5"/>
      {/* Nose */}
      <ellipse cx="70" cy="75" rx="3" ry="2" fill="#e8a882"/>
      {/* Smile */}
      <path d="M62 83 Q70 90 78 83" fill="none" stroke="#c0845c" strokeWidth="2" strokeLinecap="round"/>
      {/* Left arm holding book */}
      <rect x="28" y="100" width="20" height="12" rx="6" fill="#6c5ce7"
        transform="rotate(-25,38,106)"/>
      {/* Right arm */}
      <rect x="92" y="100" width="20" height="12" rx="6" fill="#6c5ce7"
        transform="rotate(25,102,106)"/>
      {/* Book */}
      <rect x="22" y="112" width="36" height="26" rx="4" fill="#fd79a8"/>
      <rect x="24" y="114" width="32" height="22" rx="3" fill="#ff95be"/>
      <line x1="40" y1="114" x2="40" y2="136" stroke="#e0607a" strokeWidth="1.5"/>
      {/* Book lines */}
      <line x1="26" y1="120" x2="38" y2="120" stroke="#e0607a" strokeWidth="1"/>
      <line x1="26" y1="124" x2="38" y2="124" stroke="#e0607a" strokeWidth="1"/>
      <line x1="26" y1="128" x2="38" y2="128" stroke="#e0607a" strokeWidth="1"/>
      {/* Graduation cap */}
      <rect x="52" y="41" width="36" height="7" rx="2" fill="#2d2560"/>
      <polygon points="70,30 90,42 70,44 50,42" fill="#2d2560"/>
      <line x1="90" y1="42" x2="94" y2="52" stroke="#ffd93d" strokeWidth="2"/>
      <circle cx="94" cy="54" r="3" fill="#ffd93d"/>
      {/* Sweat drop (thinking) */}
      <ellipse cx="100" cy="55" rx="5" ry="7" fill="#74b9ff" opacity="0.7"/>
      <path d="M100 48 L96 55 L100 62 L104 55Z" fill="#74b9ff" opacity="0.5"/>
    </svg>
  );
}

export default function ProcessingPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { token } = useAuth();

  const { jobId, bookId, title } = location.state || {};
  const [progress, setProgress]  = useState(5);
  const [factIdx, setFactIdx]    = useState(0);
  const [blink,   setBlink]      = useState(false);
  const [done,    setDone]       = useState(false);
  const [failed,  setFailed]     = useState("");
  const pollRef  = useRef(null);
  const startRef = useRef(Date.now());

  // Cycle facts every 4s
  useEffect(() => {
    const t = setInterval(() => setFactIdx(i => (i+1) % FACTS.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Blink eyes every 3–5s
  useEffect(() => {
    const blink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    };
    const t = setInterval(blink, 3000 + Math.random()*2000);
    return () => clearInterval(t);
  }, []);

  // Smoothly advance progress bar even without real data
  useEffect(() => {
    const t = setInterval(() => {
      setProgress(p => {
        if (p >= 92) return p; // hold just before 100 until real completion
        return Math.min(92, p + (95 - p) * 0.04);
      });
    }, 400);
    return () => clearInterval(t);
  }, []);

  // Poll job status
  useEffect(() => {
    if (!jobId || !bookId) { navigate("/upload"); return; }

    const poll = async () => {
      try {
        const status = await apiJobStatus(token, jobId);
        if (status.status === "COMPLETED") {
          clearInterval(pollRef.current);
          setProgress(100);
          setDone(true);
          setTimeout(() => navigate(`/summary/${bookId}`), 900);
        } else if (status.status === "FAILED") {
          clearInterval(pollRef.current);
          setFailed(status.error || "Summarization failed. Please try again.");
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => clearInterval(pollRef.current);
  }, [jobId, bookId, token, navigate]);

  const stage = getStage(progress);

  if (!jobId) return null;

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"transparent", padding:24,
    }}>
      <div className="fade-in" style={{
        display:"flex", flexDirection:"column", alignItems:"center",
        maxWidth:560, width:"100%", textAlign:"center",
      }}>

        {/* Nerd character */}
        <div className="bob" style={{ marginBottom:24, position:"relative" }}>
          <NerdCharacter blink={blink} />
          {/* Floating thought bubbles */}
          {[
            { x:120, y:20, size:28,  delay:0 },
            { x:-20,  y:10, size:22, delay:.6 },
            { x:130, y:60, size:18,  delay:1.1 },
          ].map((b,i) => (
            <div key={i} style={{
              position:"absolute", top:b.y, left:b.x, width:b.size, height:b.size,
              borderRadius:"50%", background:"rgba(108,92,231,0.15)",
              border:"1px solid rgba(108,92,231,0.3)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:b.size*0.45,
              animation:`gentleBob ${2.5+i*0.4}s ease-in-out ${b.delay}s infinite`,
            }}>{b.emoji}</div>
          ))}
        </div>

        {/* Title */}
        <div style={{
          fontSize:12, fontWeight:700, color:"var(--accent2)", letterSpacing:1,
          textTransform:"uppercase", marginBottom:10,
        }}>Summarizing</div>
        <h2 style={{
          fontSize:22, fontWeight:900, color:"var(--text)", marginBottom:6,
          maxWidth:380, lineHeight:1.3,
        }}>"{title}"</h2>

        {/* Stage label */}
        <div style={{
          display:"flex", alignItems:"center", gap:8, marginBottom:28,
          padding:"6px 16px", borderRadius:20,
          background:"rgba(108,92,231,0.1)", border:"1px solid rgba(108,92,231,0.2)",
        }}>
          <span style={{ fontSize:"1.1rem" }}>{done?"":stage.emoji}</span>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--accent2)" }}>
            {done ? "Summary ready!" : stage.label}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ width:"100%", marginBottom:8 }}>
          <div style={{
            width:"100%", height:8, borderRadius:8,
            background:"rgba(255,255,255,0.07)", overflow:"hidden",
          }}>
            <div style={{
              height:"100%", borderRadius:8, transition:"width .5s ease",
              width:`${Math.round(progress)}%`,
              background: done
                ? "linear-gradient(90deg,#00d2a0,#00e5b0)"
                : "linear-gradient(90deg,#6c5ce7,#a29bfe,#fd79a8)",
              boxShadow: done ? "0 0 12px rgba(0,210,160,0.6)" : "0 0 12px rgba(108,92,231,0.5)",
            }}/>
          </div>
          <div style={{
            display:"flex", justifyContent:"space-between", marginTop:6,
            fontSize:11, color:"var(--text2)",
          }}>
            <span>{stage.sub}</span>
            <span style={{ fontWeight:700, color:done?"var(--green)":"var(--accent2)" }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Steps indicator */}
        <div style={{ display:"flex", gap:6, marginBottom:32, marginTop:8 }}>
          {STAGES.map((s,i) => (
            <div key={i} style={{
              height:3, flex:1, borderRadius:3, transition:"background .4s",
              background: progress >= s.pct
                ? (done?"var(--green)":"var(--accent)")
                : "rgba(255,255,255,0.1)",
            }}/>
          ))}
        </div>

        {/* Fun fact card */}
        <div style={{
          width:"100%", padding:"16px 20px", borderRadius:14,
          background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)",
          transition:"all .3s",
        }}>
          <div style={{ fontSize:11, color:"var(--text2)", fontWeight:700, letterSpacing:.8,
            textTransform:"uppercase", marginBottom:7 }}>Did you know?</div>
          <p key={factIdx} className="fade-in" style={{ fontSize:13.5, color:"var(--text)", lineHeight:1.65 }}>
            {FACTS[factIdx]}
          </p>
        </div>

        {/* Error state */}
        {failed && (
          <div style={{
            marginTop:20, padding:"14px 18px", borderRadius:12,
            background:"rgba(255,107,107,0.1)", border:"1px solid rgba(255,107,107,0.3)",
            color:"#ff6b6b", fontSize:13,
          }}>
            <strong>Oops! </strong>{failed}
            <div style={{ marginTop:10 }}>
              <button onClick={()=>navigate("/upload")} style={{
                padding:"7px 18px", borderRadius:8, border:"1px solid #ff6b6b",
                background:"transparent", color:"#ff6b6b", cursor:"pointer",
                fontFamily:"var(--font)", fontWeight:600, fontSize:13,
              }}>← Go back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}