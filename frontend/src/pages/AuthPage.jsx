import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiLogin, apiRegister, apiMe } from "../api/client";
import { ErrorBox } from "../components/Ui";

// ── Typewriter ────────────────────────────────────────────────────────────────
function Typewriter() {
  const [text, setText] = useState("");
  const phrases = [
    "AI-powered summaries in seconds.",
    "Role-based intelligence at your fingertips.",
    "Flowcharts, quizzes & exports.",
    "From PDFs to YouTube — we got you.",
  ];
  const state = useRef({ idx: 0, char: 0, deleting: false });

  useEffect(() => {
    let timer;
    const tick = () => {
      const s = state.current;
      const phrase = phrases[s.idx];
      if (!s.deleting) {
        s.char++;
        setText(phrase.substring(0, s.char));
        if (s.char === phrase.length) {
          s.deleting = true;
          timer = setTimeout(tick, 2000);
          return;
        }
      } else {
        s.char--;
        setText(phrase.substring(0, s.char));
        if (s.char === 0) {
          s.deleting = false;
          s.idx = (s.idx + 1) % phrases.length;
        }
      }
      timer = setTimeout(tick, s.deleting ? 28 : 75);
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <p style={{
      fontSize: "1.25rem", color: "var(--accent2)", fontWeight: 500,
      minHeight: "2rem", marginBottom: "0.5rem",
    }}>
      {text}<span style={{ animation: "pulse 1s infinite", opacity: 0.8 }}>|</span>
    </p>
  );
}

// ── Nerd SVG characters ───────────────────────────────────────────────────────
function Nerd1() {
  return (
    <svg viewBox="0 0 120 140" width="100" height="116">
      <circle cx="60" cy="50" r="38" fill="#6c5ce7" opacity="0.13"/>
      <circle cx="60" cy="50" r="30" fill="#2d1b69"/>
      <rect x="38" y="42" width="18" height="14" rx="3" fill="#a29bfe" opacity="0.9"/>
      <rect x="64" y="42" width="18" height="14" rx="3" fill="#a29bfe" opacity="0.9"/>
      <circle cx="47" cy="49" r="4" fill="#fff"/><circle cx="73" cy="49" r="4" fill="#fff"/>
      <circle cx="48" cy="48" r="2" fill="#2d1b69"/><circle cx="74" cy="48" r="2" fill="#2d1b69"/>
      <line x1="56" y1="46" x2="64" y2="46" stroke="#a29bfe" strokeWidth="2.5"/>
      <path d="M50 62 Q60 70 70 62" stroke="#fd79a8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <rect x="40" y="80" width="40" height="45" rx="8" fill="#6c5ce7"/>
      <rect x="82" y="90" width="22" height="28" rx="3" fill="#00d2a0" opacity="0.8"/>
    </svg>
  );
}
function Nerd2() {
  return (
    <svg viewBox="0 0 120 140" width="80" height="93">
      <circle cx="60" cy="50" r="38" fill="#00d2a0" opacity="0.1"/>
      <circle cx="60" cy="50" r="30" fill="#0a3d2e"/>
      <rect x="36" y="40" width="20" height="16" rx="4" fill="#00d2a0" opacity="0.9"/>
      <rect x="64" y="40" width="20" height="16" rx="4" fill="#00d2a0" opacity="0.9"/>
      <circle cx="46" cy="48" r="5" fill="#fff"/><circle cx="74" cy="48" r="5" fill="#fff"/>
      <circle cx="47" cy="47" r="2.5" fill="#0a3d2e"/><circle cx="75" cy="47" r="2.5" fill="#0a3d2e"/>
      <path d="M52 64 Q60 68 68 64" stroke="#ffd93d" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <rect x="42" y="80" width="36" height="42" rx="7" fill="#00b894"/>
    </svg>
  );
}
function Nerd3() {
  return (
    <svg viewBox="0 0 100 120" width="70" height="84">
      <circle cx="50" cy="45" r="28" fill="#fd79a8" opacity="0.1"/>
      <circle cx="50" cy="45" r="22" fill="#4a1942"/>
      <rect x="32" y="38" width="15" height="12" rx="3" fill="#fd79a8" opacity="0.85"/>
      <rect x="53" y="38" width="15" height="12" rx="3" fill="#fd79a8" opacity="0.85"/>
      <circle cx="39.5" cy="44" r="3.5" fill="#fff"/><circle cx="60.5" cy="44" r="3.5" fill="#fff"/>
      <path d="M44 56 Q50 60 56 56" stroke="#ffd93d" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <rect x="36" y="70" width="28" height="35" rx="6" fill="#e84393"/>
    </svg>
  );
}

// ── Feature cards ──────────────────────────────────────────────────────────────
// SVG icon components for feature cards
const FeatIcons = {
  upload: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  roles: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  chart: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/>
      <circle cx="19" cy="19" r="2"/>
      <line x1="12" y1="7" x2="5" y2="17"/>
      <line x1="12" y1="7" x2="19" y2="17"/>
    </svg>
  ),
  quiz: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
};

const FEATURES = [
  { iconKey: "upload", title: "Multi-Format", desc: "PDF, DOCX, TXT & YouTube", color: "#a29bfe" },
  { iconKey: "roles",  title: "10 Roles",     desc: "Executive to Medical lens", color: "#00d2a0" },
  { iconKey: "chart",  title: "Flowcharts",   desc: "Visual knowledge maps",     color: "#fd79a8" },
  { iconKey: "quiz",   title: "Quizzes",      desc: "Test comprehension",        color: "#ffd93d" },
];

// ── Auth form ─────────────────────────────────────────────────────────────────
function AuthForm({ onSuccess }) {
  const [mode, setMode]     = useState("login");
  const [form, setForm]     = useState({ name: "", email: "", password: "", role: "user" });
  const [error, setError]   = useState("");
  const [loading, setLoad]  = useState(false);
  const { login }           = useAuth();
  const navigate            = useNavigate();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoad(true);
    try {
      if (mode === "register") {
        await apiRegister(form);
        setMode("login"); setError("");
        return;
      }
      const { access_token } = await apiLogin(form);
      const user = await apiMe(access_token);
      login(access_token, user);
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) { setError(err.message); }
    finally { setLoad(false); }
  };

  return (
    <div className="glass-card" style={{ padding: "28px 32px", maxWidth: 420, width: "100%" }}>
      {/* Toggle */}
      <div style={{ display:"flex", background:"rgba(0,0,0,0.25)", borderRadius:10, padding:3, marginBottom:22 }}>
        {["login","register"].map(m => (
          <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
            flex:1, padding:"9px 0", borderRadius:8, border:"none",
            background: mode===m ? "var(--accent)" : "transparent",
            color: mode===m ? "#fff" : "var(--text2)",
            fontFamily:"var(--font)", fontWeight:600, fontSize:14, cursor:"pointer", transition:"all .2s",
          }}>
            {m === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {mode === "register" && (
          <div>
            <label style={lbl}>👤 Full Name</label>
            <input placeholder="Your name" value={form.name} onChange={set("name")} required />
          </div>
        )}
        <div>
          <label style={lbl}> Email</label>
          <input type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
        </div>
        <div>
          <label style={lbl}> Password</label>
          <input type="password" placeholder="••••••••" value={form.password} onChange={set("password")} required />
        </div>
        {mode === "register" && (
          <div>
            <label style={lbl}> Account Type</label>
            <select value={form.role} onChange={set("role")}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        )}

        <ErrorBox message={error} />

        <button type="submit" className="btn-primary" disabled={loading} style={{ width:"100%", marginTop:4, fontSize:16, padding:"12px 0" }}>
          {loading
            ? <span style={{ display:"flex",alignItems:"center",gap:8 }}><span style={{ width:16,height:16,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",display:"inline-block" }} />Please wait…</span>
            : mode === "login" ? "Sign In →" : "Create Account →"
          }
        </button>
      </form>
    </div>
  );
}

const lbl = { display:"block", fontSize:12, fontWeight:600, color:"var(--text2)", marginBottom:5 };

// ── Main page: landing → auth ─────────────────────────────────────────────────
export default function AuthPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"2rem", textAlign:"center", position:"relative" }}>

      {/* Nerd decorations */}
      {!showAuth && (
        <>
          <div className="bob" style={{ position:"absolute", top:"15%", left:"5%", animationDelay:"0s" }}><Nerd1 /></div>
          <div className="bob" style={{ position:"absolute", top:"20%", right:"5%", animationDelay:"1s" }}><Nerd2 /></div>
          <div className="bob" style={{ position:"absolute", bottom:"20%", left:"8%", animationDelay:"2s" }}><Nerd3 /></div>
        </>
      )}


      {/* ── Features flashcard modal ── */}
      {showFeatures && (
        <div style={{ position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}
          onClick={e=>e.target===e.currentTarget&&setShowFeatures(false)}>
          <div className="fade-in" style={{ width:"100%",maxWidth:560,background:"#0e0e1e",border:"1px solid rgba(108,92,231,0.4)",borderRadius:22,padding:32,boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <img src="/favicon.png" alt="" style={{ width:32,height:32,borderRadius:8 }}/>
                <span style={{ fontSize:18,fontWeight:900,color:"var(--text)" }}>Synops<span style={{ color:"var(--accent2)" }}>AI</span></span>
              </div>
              <button onClick={()=>setShowFeatures(false)} style={{ background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:18 }}>✕</button>
            </div>
            <p style={{ fontSize:13,color:"var(--text2)",marginBottom:20 }}>Everything you need to understand any document instantly.</p>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              {[
                {title:"AI Summaries",desc:"Concise, detailed or bullet — powered by LLaMA 3.3 70B via Groq."},
                {title:"Role-Based",desc:"10 roles: Student, Researcher, Legal, Medical and more."},
                {title:"Ask AI",desc:"Chat with your document. Ask anything, get grounded answers."},
                {title:"Smart Quiz",desc:"Auto-generated MCQs to test your understanding."},
                {title:"Mind Map",desc:"Visual flowchart of key concepts, auto-generated."},
                {title:"Key Insights",desc:"AI extracts 3-5 core takeaways from any document instantly"},
                {title:"Explain Mode",desc:"Hover any sentence → get plain-English explanations."},
                {title:"Export",desc:"Download summaries as TXT, DOCX or PDF instantly."},
              ].map(f=>(
                <div key={f.title} style={{ padding:"12px 14px",borderRadius:12,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize:"1.3rem",marginBottom:4 }}>{f.icon}</div>
                  <div style={{ fontSize:13,fontWeight:700,color:"var(--text)",marginBottom:3 }}>{f.title}</div>
                  <div style={{ fontSize:11.5,color:"var(--text2)",lineHeight:1.5 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>{setShowFeatures(false);setShowAuth(true);}} style={{ marginTop:22,width:"100%",padding:"13px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#6c5ce7,#a29bfe)",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"var(--font)" }}>
              Get Started →
            </button>
          </div>
        </div>
      )}

      {!showAuth ? (
        /* ── LANDING ── */
        <div className="fade-in" style={{ maxWidth:780, position:"relative", zIndex:2 }}>
          <div className="hero-badge"> AI-Powered Intelligence</div>

          <h1 className="hero-title">
            <span className="title-white">Summarize</span>
            <span className="title-gradient">Intelligently</span>
          </h1>

          <Typewriter />

          <p style={{ fontSize:"1.1rem", color:"var(--text2)", maxWidth:580, margin:"0 auto 2rem", lineHeight:1.65 }}>
            Upload PDFs, DOCX, TXT files, paste text, or YouTube links — get role-specific summaries with flowcharts &amp; quizzes.
          </p>

          <div style={{ display:"flex", gap:"1rem", justifyContent:"center", marginBottom:"3rem", flexWrap:"wrap" }}>
            <button
              className="btn-primary"
              style={{ fontSize:"1.1rem", padding:"13px 32px" }}
              onClick={() => setShowAuth(true)}
            >
              Get Started <span style={{ marginLeft:4 }}>→</span>
            </button>
            <button
              className="btn-secondary"
              style={{ fontSize:"1.1rem", padding:"13px 32px" }}
              onClick={() => setShowFeatures(true)}
            >
              Learn More 
            </button>
          </div>

          <div id="features" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem" }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} className="feature-card" style={{
                animationDelay: `${0.1 + i * 0.1}s`,
                display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center",
                borderTop: `3px solid ${f.color}`,
              }}>
                <div style={{
                  width:52, height:52, borderRadius:14, marginBottom:14,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  background:`${f.color}18`, color:f.color,
                  border:`1px solid ${f.color}33`,
                }}>
                  {FeatIcons[f.iconKey]}
                </div>
                <h3 style={{ fontSize:"1rem", fontWeight:800, marginBottom:"0.3rem", color:"var(--text)" }}>{f.title}</h3>
                <p style={{ fontSize:"0.82rem", color:"var(--text2)", lineHeight:1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── AUTH FORM ── */
        <div className="fade-in" style={{ zIndex:2 }}>
          <div style={{ textAlign:"center", marginBottom:28 }}>
            <div style={{
              display:"inline-flex", alignItems:"center", justifyContent:"center",
              width:60, height:60, borderRadius:16,
              background:"linear-gradient(135deg,var(--accent),#7c3aed)",
              marginBottom:12, boxShadow:"0 4px 20px rgba(108,92,231,0.4)",
            }}>
              <img src="/favicon.png" alt="SynopsAI" style={{ width:36,height:36,borderRadius:8 }}/>
            </div>
            <h1 style={{ fontSize:"2rem", fontWeight:900 }}>
              Synops<span style={{ color:"var(--accent2)" }}>AI</span>
            </h1>
            <p style={{ color:"var(--text2)", fontSize:"0.95rem", marginTop:4 }}>
              AI-Powered Document Intelligence
            </p>
            <button
              onClick={() => setShowAuth(false)}
              style={{ marginTop:8, background:"transparent", border:"none", color:"var(--accent2)", fontSize:13, cursor:"pointer" }}
            >
              ← Back to home
            </button>
          </div>
          <AuthForm />
        </div>
      )}
    </div>
  );
}