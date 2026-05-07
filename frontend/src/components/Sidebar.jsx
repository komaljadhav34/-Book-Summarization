import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen, Shield, LogOut, History, Upload,
  ChevronDown, AlignLeft, AlignJustify, List,
  User, Briefcase, Wrench, GraduationCap, FlaskConical,
  Scale, Palette, Stethoscope, BarChart2, School,
  Sun, Moon,
} from "lucide-react";
import { useAuth }           from "../context/AuthContext";
import { useSummaryOptions } from "../context/SummaryOptionsContext";
import { useTheme }          from "../context/ThemeContext";

/* ── Formats & Roles ─────────────────────────────────────────────────────── */
const FORMATS = [
  { value:"CONCISE",  label:"Concise",  Icon:AlignLeft,    desc:"Short & focused" },
  { value:"DETAILED", label:"Detailed", Icon:AlignJustify, desc:"In-depth coverage" },
  { value:"BULLETS",  label:"Bullets",  Icon:List,         desc:"Scannable bullet points" },
];

const ROLES = [
  { value:"GENERAL",    label:"General",    Icon:User,          color:"#a29bfe" },
  { value:"EXECUTIVE",  label:"Executive",  Icon:Briefcase,     color:"#ffd93d" },
  { value:"TECHNICAL",  label:"Technical",  Icon:Wrench,        color:"#00d2a0" },
  { value:"STUDENT",    label:"Student",    Icon:GraduationCap, color:"#fd79a8" },
  { value:"RESEARCHER", label:"Researcher", Icon:FlaskConical,  color:"#74b9ff" },
  { value:"LEGAL",      label:"Legal",      Icon:Scale,         color:"#fdcb6e" },
  { value:"CREATIVE",   label:"Creative",   Icon:Palette,       color:"#e17055" },
  { value:"MEDICAL",    label:"Medical",    Icon:Stethoscope,   color:"#55efc4" },
  { value:"ANALYST",    label:"Analyst",    Icon:BarChart2,     color:"#c5b3ff" },
  { value:"EDUCATOR",   label:"Educator",   Icon:School,        color:"#81ecec" },
];

/* ── NLP facts — from published research ─────────────────────────────────── */
const FACTS = [
  {
    title:"Groq LPU Speed",
    body:"Groq's LPU runs LLaMA 3 70B at 800+ tokens/sec — the fastest publicly available LLM inference as of 2024.",
    src:"Groq benchmark report, 2024",
  },
  {
     title:"LLaMA 3.3 70B",
    body:"Meta's LLaMA 3.3 70B (Dec 2024) matches GPT-4o on many benchmarks while being fully open-source.",
    src:"Meta AI blog, December 2024",
  },
  {
     title:"1M Token Context",
    body:"Gemini 1.5 Pro (2024) reached a 1 million token context window — enough to summarise an entire codebase in one shot.",
    src:"Google DeepMind, Gemini 1.5 report (2024)",
  },
  {
    title:"RAG is Now Standard",
    body:"Retrieval-Augmented Generation became the default architecture for document Q&A in 2023-24, replacing fine-tuning for most use cases.",
    src:"LangChain State of AI Report, 2024",
  },
  {
    title:"LLM-as-Judge",
    body:"ROUGE scores are being replaced by LLM-as-judge evaluation, which better captures readability and faithfulness of summaries.",
    src:"Guo et al., ACL 2024",
  },
  {
     title:"Hallucination Rate",
    body:"HaluEval 2 (2024) found frontier models still hallucinate in ~15% of long-document summaries — the top open research problem.",
    src:"Li et al., HaluEval 2, 2024",
  },
  {
    title:"Compression Sweet Spot",
    body:"2024 research found 10-15% compression retains the highest information density — compress further and key details are consistently lost.",
    src:"SummHay benchmark, Laban et al. 2024",
  },
  {
    title:"Chain-of-Thought",
    body:"Adding 'think step by step' to prompts improves summary accuracy by up to 22% on complex documents.",
    src:"Wei et al. (2022), production analysis 2024",
  },
  {
    title:"Embeddings 2024",
    body:"text-embedding-3-large (OpenAI, Jan 2024) cut embedding costs 5x vs 2023 models while improving retrieval accuracy.",
    src:"OpenAI embedding model release, 2024",
  },
  {
    title:"On-Device LLMs",
    body:"Apple Intelligence (2025) runs a 3B summarisation model entirely on-device — private, instant, and no internet needed.",
    src:"Apple WWDC 2024; Apple Intelligence whitepaper",
  },
  {
    title:"Mixture of Experts",
    body:"Mixtral 8x7B (2024) activates only 2 of 8 expert layers per token — GPT-3.5 quality at a fraction of the compute.",
    src:"Mistral AI, Mixtral paper, January 2024",
  },
  {
    title:"Multilingual Leap",
    body:"LLMs in 2024-25 summarise documents in 100+ languages with near-native quality — 2022 models degraded sharply past 10 languages.",
    src:"FLORES-200 evals; Meta AI, 2024",
  },
];

function NerdyGuy({ blink }) {
  return (
    <svg viewBox="0 0 100 115" width="88" height="101"
      style={{
        filter:"drop-shadow(0 3px 10px rgba(108,92,231,0.35))",
        animation:"gentleBob 3s ease-in-out infinite",
        flexShrink:0,
      }}
    >
      {/* shadow */}
      <ellipse cx="50" cy="112" rx="20" ry="3.5" fill="#6c5ce7" opacity="0.15"/>

      {/* body */}
      <rect x="28" y="74" width="44" height="32" rx="8" fill="#6c5ce7"/>
      <rect x="44" y="74" width="12" height="32" rx="0" fill="rgba(255,255,255,0.07)"/>
      <path d="M41 74 L50 84 L59 74" fill="#a29bfe" opacity="0.7"/>
      <rect x="57" y="82" width="10" height="8" rx="2" fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.25)" strokeWidth="0.8"/>
      <line x1="62" y1="82" x2="62" y2="77" stroke="#ffd93d" strokeWidth="1.8" strokeLinecap="round"/>

      {/* neck */}
      <rect x="43" y="64" width="14" height="13" rx="5" fill="#fddbb8"/>

      {/* head */}
      <ellipse cx="50" cy="44" rx="26" ry="27" fill="#fddbb8"/>

      {/* hair */}
      <ellipse cx="50" cy="20" rx="26" ry="10" fill="#2c1f14"/>
      <rect x="24" y="20" width="52" height="9" fill="#2c1f14"/>
      <ellipse cx="40" cy="20" rx="8" ry="3" fill="#3d2b1f" opacity="0.5"/>

      {/* ears */}
      <ellipse cx="24" cy="44" rx="4" ry="5.5" fill="#fddbb8"/>
      <ellipse cx="24" cy="44" rx="2" ry="3.5" fill="#f0a882" opacity="0.4"/>
      <ellipse cx="76" cy="44" rx="4" ry="5.5" fill="#fddbb8"/>
      <ellipse cx="76" cy="44" rx="2" ry="3.5" fill="#f0a882" opacity="0.4"/>

      {/* cheeks */}
      <ellipse cx="33" cy="52" rx="7" ry="5" fill="#ffb3c6" opacity="0.42"/>
      <ellipse cx="67" cy="52" rx="7" ry="5" fill="#ffb3c6" opacity="0.42"/>

      {/* eyes */}
      {blink ? (
        <>
          <path d="M36 43 Q41 39 46 43" fill="none" stroke="#2c1f14" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M54 43 Q59 39 64 43" fill="none" stroke="#2c1f14" strokeWidth="2.5" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <ellipse cx="41" cy="43" rx="7"   ry="7.5" fill="white"/>
          <ellipse cx="59" cy="43" rx="7"   ry="7.5" fill="white"/>
          <ellipse cx="41" cy="44" rx="4.5" ry="5"   fill="#5c4ad4"/>
          <ellipse cx="59" cy="44" rx="4.5" ry="5"   fill="#5c4ad4"/>
          <ellipse cx="42" cy="44.5" rx="2.5" ry="2.8" fill="#1a0e40"/>
          <ellipse cx="60" cy="44.5" rx="2.5" ry="2.8" fill="#1a0e40"/>
          <circle cx="39" cy="41" r="1.6" fill="white"/>
          <circle cx="57" cy="41" r="1.6" fill="white"/>
          <circle cx="43" cy="47" r="0.7" fill="rgba(255,255,255,0.55)"/>
          <circle cx="61" cy="47" r="0.7" fill="rgba(255,255,255,0.55)"/>
          <line x1="34" y1="39" x2="33" y2="36" stroke="#2c1f14" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="38" y1="37" x2="37" y2="34" stroke="#2c1f14" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="45" y1="37" x2="46" y2="34" stroke="#2c1f14" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="55" y1="37" x2="54" y2="34" stroke="#2c1f14" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="62" y1="37" x2="63" y2="34" stroke="#2c1f14" strokeWidth="1.2" strokeLinecap="round"/>
          <line x1="66" y1="39" x2="68" y2="36" stroke="#2c1f14" strokeWidth="1.2" strokeLinecap="round"/>
        </>
      )}

      {/* glasses */}
      <rect x="31" y="37" width="18" height="14" rx="6" fill="none" stroke="#3d3080" strokeWidth="1.8"/>
      <rect x="51" y="37" width="18" height="14" rx="6" fill="none" stroke="#3d3080" strokeWidth="1.8"/>
      <line x1="49" y1="44" x2="51" y2="44" stroke="#3d3080" strokeWidth="1.8"/>
      <line x1="31" y1="44" x2="27" y2="46" stroke="#3d3080" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="69" y1="44" x2="73" y2="46" stroke="#3d3080" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M34 39 Q38 36 46 38" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M54 39 Q58 36 66 38" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" strokeLinecap="round"/>

      {/* nose */}
      <ellipse cx="50" cy="53" rx="2.8" ry="2" fill="#e8a070" opacity="0.7"/>

      {/* smile */}
      <path d="M38 60 Q50 72 62 60" fill="#ff8fa3" stroke="#d06070" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M40 61 Q50 69 60 61" fill="white" opacity="0.9"/>
      <line x1="50" y1="61" x2="50" y2="68" stroke="rgba(180,150,150,0.2)" strokeWidth="0.8"/>
      <circle cx="35" cy="60" r="2" fill="#ffb3c6" opacity="0.55"/>
      <circle cx="65" cy="60" r="2" fill="#ffb3c6" opacity="0.55"/>

      {/* arms */}
      <path d="M28 82 Q16 90 12 102" stroke="#6c5ce7" strokeWidth="11" strokeLinecap="round" fill="none"/>
      <ellipse cx="11" cy="103" rx="7.5" ry="7" fill="#fddbb8"/>
      <path d="M72 82 Q84 90 88 102" stroke="#6c5ce7" strokeWidth="11" strokeLinecap="round" fill="none"/>
      <ellipse cx="89" cy="103" rx="7.5" ry="7" fill="#fddbb8"/>

      {/* sparkles */}
      <text x="6"  y="42" fontSize="8" fill="#ffd93d" opacity="0.7">✦</text>
      <text x="85" y="38" fontSize="6" fill="#a29bfe" opacity="0.65">✦</text>
      <text x="80" y="22" fontSize="5" fill="#fd79a8" opacity="0.6">✦</text>
    </svg>
  );
}

/* ── Accordion helper ────────────────────────────────────────────────────── */
function Accordion({ label, icon, open, onToggle, children }) {
  return (
    <div>
      <button onClick={onToggle} style={{
        width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"9px 14px", background:"none", border:"none",
        color:"var(--sb-text2)", cursor:"pointer",
        fontSize:11, fontWeight:800, letterSpacing:1.1, textTransform:"uppercase",
        fontFamily:"var(--font)",
      }}>
        <span style={{ display:"flex", alignItems:"center", gap:7 }}>{icon} {label}</span>
        <ChevronDown size={13} style={{ transform:open?"rotate(180deg)":"none", transition:"transform .2s", color:"var(--sb-text2)", flexShrink:0 }}/>
      </button>
      <div style={{ maxHeight:open?600:0, overflow:"hidden", transition:"max-height .3s ease" }}>
        <div style={{ padding:"2px 10px 10px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Main Sidebar ─────────────────────────────────────────────────────────── */
export default function Sidebar() {
  const { user, isAdmin, logout }    = useAuth();
  const { format, setFormat, role, setRole } = useSummaryOptions();
  const { dark, toggle: toggleTheme } = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [fmtOpen,  setFmtOpen]  = useState(true);
  const [roleOpen, setRoleOpen] = useState(false);
  const [factIdx,  setFactIdx]  = useState(() => Math.floor(Math.random() * FACTS.length));
  const [visible,  setVisible]  = useState(true);
  const [blink,    setBlink]    = useState(false);
  const [pop,      setPop]      = useState(false);

  // Facts rotate every 8s
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false); setPop(true);
      setTimeout(() => setPop(false), 400);
      setTimeout(() => { setFactIdx(i => (i + 1) % FACTS.length); setVisible(true); }, 320);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  // Blink
  useEffect(() => {
    const tick = () => { setBlink(true); setTimeout(() => setBlink(false), 150); };
    const t = setInterval(tick, 2800 + Math.random() * 1800);
    return () => clearInterval(t);
  }, []);

  const fact = FACTS[factIdx];

  const NAV = [
    { path:"/upload",  label:"New Summary", Icon:Upload  },
    { path:"/history", label:"History",     Icon:History },
    ...(isAdmin ? [{ path:"/admin", label:"Admin Panel", Icon:Shield }] : []),
  ];

  return (
    <aside style={{
      width:265,
      background: dark ? "#0b0d17" : "#f4f2ff",
      borderRight: dark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(108,92,231,0.15)",
      display:"flex", flexDirection:"column",
      height:"100vh", position:"sticky", top:0, flexShrink:0,
      // CSS custom props scoped to sidebar for dark/light
      "--sb-text":  dark?"#eef0ff":"#1a1035",
      "--sb-text2": dark?"#7a7a9a":"#6b6490",
      "--sb-surface": dark?"rgba(255,255,255,0.04)":"rgba(108,92,231,0.06)",
      "--sb-border":  dark?"rgba(255,255,255,0.07)":"rgba(108,92,231,0.12)",
      "--sb-active-bg": dark?"rgba(108,92,231,0.15)":"rgba(108,92,231,0.1)",
    }}>

      {/* ── Logo + theme toggle ── */}
      <div style={{ padding:"16px 14px 12px", borderBottom:`1px solid var(--sb-border)`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10,
            background:"linear-gradient(135deg,#6c5ce7,#a29bfe)",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
            boxShadow:"0 4px 14px rgba(108,92,231,0.4)" }}>
            <img 
  src="/favicon.png"
  alt="BookSumAI Logo"
  style={{
    width: 22,
    height: 22,
    objectFit: "contain"
  }}
/>
          </div>
          <div>
            <div style={{ fontWeight:900, fontSize:15, color:"var(--sb-text)", letterSpacing:-.3, lineHeight:1.1 }}>SynopsAI</div>
            <div style={{ fontSize:11, color:"var(--sb-text2)", fontWeight:500, marginTop:1 }}>{isAdmin?"Admin":"User"}</div>
          </div>
        </div>

        {/* Light/dark toggle */}
        <button onClick={toggleTheme} title={dark?"Switch to light mode":"Switch to dark mode"} style={{
          width:34, height:34, borderRadius:9, border:"none",
          background: dark?"rgba(255,255,255,0.07)":"rgba(108,92,231,0.1)",
          color: dark?"#ffd93d":"#6c5ce7",
          display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"pointer", transition:"all .2s", flexShrink:0,
        }}
          onMouseEnter={e=>{e.currentTarget.style.background=dark?"rgba(255,255,255,0.12)":"rgba(108,92,231,0.18)";}}
          onMouseLeave={e=>{e.currentTarget.style.background=dark?"rgba(255,255,255,0.07)":"rgba(108,92,231,0.1)";}}
        >
          {dark ? <Sun size={16}/> : <Moon size={16}/>}
        </button>
      </div>

      {/* ── Small nav ── */}
      <nav style={{ padding:"10px 8px 6px", borderBottom:`1px solid var(--sb-border)` }}>
        {NAV.map(({ path, label, Icon }) => {
          const active = location.pathname===path || (path==="/history" && location.pathname.startsWith("/summary"));
          return (
            <button key={path} onClick={()=>navigate(path)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:9,
              padding:"8px 12px", borderRadius:9, border:"none",
              background: active?"var(--sb-active-bg)":"transparent",
              color: active?"#a29bfe":"var(--sb-text2)",
              fontWeight:active?700:500, fontSize:13.5,
              cursor:"pointer", transition:"all .15s", fontFamily:"var(--font)",
              borderLeft: active?"2.5px solid #6c5ce7":"2.5px solid transparent",
              marginBottom:2,
            }}
              onMouseEnter={e=>{ if(!active){e.currentTarget.style.background="var(--sb-surface)"; e.currentTarget.style.color="var(--sb-text)";} }}
              onMouseLeave={e=>{ if(!active){e.currentTarget.style.background="transparent"; e.currentTarget.style.color="var(--sb-text2)";} }}
            ><Icon size={15}/> {label}</button>
          );
        })}
      </nav>

      {/* ── Format + Role accordions ── */}
      <div style={{ borderBottom:`1px solid var(--sb-border)` }}>
        {/* Summary Format */}
        <Accordion label="Summary Format" icon={<AlignLeft size={13}/>} open={fmtOpen} onToggle={()=>setFmtOpen(o=>!o)}>
          {FORMATS.map(({ value, label, Icon, desc }) => (
            <button key={value} onClick={()=>setFormat(value)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:10,
              padding:"9px 10px", borderRadius:9, border:"none",
              background: format===value ? "rgba(108,92,231,0.15)" : "transparent",
              borderLeft: format===value ? "2.5px solid #6c5ce7" : "2.5px solid transparent",
              cursor:"pointer", transition:"all .15s", fontFamily:"var(--font)",
              marginBottom:2,
            }}>
              <Icon size={14} color={format===value?"#a29bfe":"var(--sb-text2)"} style={{flexShrink:0}}/>
              <div style={{ textAlign:"left", flex:1 }}>
                <div style={{ fontSize:13, fontWeight:format===value?700:500, color:format===value?"#a29bfe":"var(--sb-text)" }}>{label}</div>
                <div style={{ fontSize:11, color:"var(--sb-text2)", marginTop:1 }}>{desc}</div>
              </div>
              {format===value && <div style={{ width:16, height:16, borderRadius:"50%", background:"#6c5ce7", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>}
            </button>
          ))}
        </Accordion>

        {/* Role-Based Summary */}
        <Accordion label="Role-Based Summary" icon={<User size={13}/>} open={roleOpen} onToggle={()=>setRoleOpen(o=>!o)}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
            {ROLES.map(({ value, label, Icon, color }) => (
              <button key={value} onClick={()=>setRole(value)} style={{
                display:"flex", alignItems:"center", gap:6, padding:"7px 9px", borderRadius:8,
                border:`1px solid ${role===value?color+"55":"var(--sb-border)"}`,
                background: role===value?color+"18":"transparent",
                cursor:"pointer", transition:"all .15s", fontFamily:"var(--font)",
              }}>
                <Icon size={12} color={role===value?color:"var(--sb-text2)"} style={{flexShrink:0}}/>
                <span style={{ fontSize:12, fontWeight:role===value?700:400, color:role===value?color:"var(--sb-text2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </Accordion>
      </div>

      {/* ── Nerd facts panel ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"12px 10px 8px", gap:10, overflowY:"auto", minHeight:0 }}>
        {/* "Did you know?" label */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:5, height:5, borderRadius:"50%", background:"#6c5ce7", boxShadow:"0 0 7px #6c5ce7" }}/>
          <span style={{ fontSize:10, fontWeight:800, color:"var(--sb-text2)", letterSpacing:1, textTransform:"uppercase" }}>Did you know?</span>
        </div>

        {/* Character + speech bubble */}
        <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
          <NerdyGuy blink={blink}/>
          <div style={{
            flex:1, padding:"9px 11px",
            background: dark?"rgba(108,92,231,0.12)":"rgba(108,92,231,0.08)",
            border: dark?"1px solid rgba(108,92,231,0.3)":"1px solid rgba(108,92,231,0.2)",
            borderRadius:"14px 14px 14px 3px",
            transform:pop?"scale(1.05)":"scale(1)", transition:"transform .3s ease",
          }}>
            <span style={{ fontSize:12, color:"#a29bfe", fontWeight:800, display:"block", lineHeight:1.3 }}>
              {fact.emoji} {fact.title}
            </span>
          </div>
        </div>

        {/* Fact card */}
        <div style={{
          opacity:visible?1:0, transition:"opacity .3s ease",
          padding:"12px 13px",
          background: dark?"rgba(255,255,255,0.03)":"rgba(108,92,231,0.04)",
          border: dark?"1px solid rgba(255,255,255,0.07)":"1px solid rgba(108,92,231,0.12)",
          borderRadius:12,
          borderLeft:"3px solid rgba(108,92,231,0.6)",
        }}>
          <p style={{ fontSize:12.5, color:"var(--sb-text)", lineHeight:1.65, marginBottom:8, fontFamily:"Georgia,'Times New Roman',serif" }}>
            {fact.body}
          </p>
          <p style={{ fontSize:10, color:"var(--sb-text2)", lineHeight:1.4, fontStyle:"italic", borderTop:`1px solid var(--sb-border)`, paddingTop:6 }}>
            📎 {fact.src}
          </p>
        </div>

        {/* Progress dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:3 }}>
          {FACTS.map((_,i)=>(
            <button key={i}
              onClick={()=>{ setVisible(false); setTimeout(()=>{ setFactIdx(i); setVisible(true); },200); }}
              style={{ width:i===factIdx?16:5, height:5, borderRadius:3, border:"none", padding:0,
                background:i===factIdx?"#6c5ce7":"rgba(128,128,160,0.25)",
                cursor:"pointer", transition:"all .3s ease" }}
            />
          ))}
        </div>
      </div>

      {/* ── User + Logout ── */}
      <div style={{ padding:"12px 14px", borderTop:`1px solid var(--sb-border)` }}>
        <div style={{ fontSize:12, color:"var(--sb-text2)", marginBottom:4,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {user?.email}
        </div>
        <button onClick={()=>{ logout(); navigate("/"); }} style={{
          display:"flex", alignItems:"center", gap:6,
          background:"none", border:"none", color:"#ff6b6b",
          fontSize:13.5, cursor:"pointer", padding:"6px 0",
          fontWeight:600, fontFamily:"var(--font)",
        }}>
          <LogOut size={14}/> Sign out
        </button>
      </div>
    </aside>
  );
}
