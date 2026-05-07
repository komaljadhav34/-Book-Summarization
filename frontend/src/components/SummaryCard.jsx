import { useState, useEffect } from "react";
import {
  FileText, Download, BrainCircuit, Trash2,
  ThumbsUp, ThumbsDown, ChevronDown, ChevronUp,
  BookOpen, Clock, Hash, Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  apiGetSummary, apiDeleteBook, apiSubmitFeedback,
  apiGenerateQuiz, apiGetQuiz, apiSubmitAnswer,
  apiExportUrl,
} from "../api/client";
import { Btn, Badge, Spinner, ErrorBox } from "./Ui";
import MindMapModal from "./MindMapModal";

// ── Simple markdown renderer ─────────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return "";
  return text
    .split("\n")
    .map((line, i) => {
      // h3
      if (line.startsWith("### ")) return `<h3 style="font-size:14px;font-weight:700;color:#c0b0ff;margin:14px 0 6px">${line.slice(4)}</h3>`;
      // h2
      if (line.startsWith("## "))  return `<h2 style="font-size:16px;font-weight:800;color:#a29bfe;margin:16px 0 6px">${line.slice(3)}</h2>`;
      // h1
      if (line.startsWith("# "))   return `<h1 style="font-size:18px;font-weight:900;color:#a29bfe;margin:18px 0 8px">${line.slice(2)}</h1>`;
      // bullet
      if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
        const content = inlineMarkdown(line.slice(2));
        return `<div style="display:flex;gap:8px;margin:4px 0"><span style="color:var(--accent2);flex-shrink:0;margin-top:2px">•</span><span>${content}</span></div>`;
      }
      // numbered list
      const numMatch = line.match(/^(\d+)\.\s(.+)/);
      if (numMatch) {
        return `<div style="display:flex;gap:8px;margin:4px 0"><span style="color:var(--accent2);flex-shrink:0;font-weight:700;min-width:18px">${numMatch[1]}.</span><span>${inlineMarkdown(numMatch[2])}</span></div>`;
      }
      // blank line
      if (!line.trim()) return `<div style="height:8px"></div>`;
      return `<p style="margin:4px 0">${inlineMarkdown(line)}</p>`;
    })
    .join("");
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong style="color:#e0e0ff;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/`(.+?)`/g,           '<code style="background:rgba(108,92,231,0.15);padding:1px 6px;border-radius:4px;font-size:0.9em;color:#a29bfe">$1</code>');
}

// ── Main card ─────────────────────────────────────────────────────────────────
export default function SummaryCard({ book, onDeleted }) {
  const { token }                  = useAuth();
  const [summary, setSummary]      = useState(null);
  const [loading, setLoading]      = useState(true);
  const [expanded, setExpanded]    = useState(true);
  const [mapOpen, setMapOpen]      = useState(false);
  const [quizData, setQuizData]    = useState(null);
  const [quizLoading, setQLoading] = useState(false);
  const [answers, setAnswers]      = useState({});
  const [feedback, setFeedback]    = useState(null);
  const [error, setError]          = useState("");

  useEffect(() => {
    apiGetSummary(token, book.id)
      .then(setSummary).catch(() => {}).finally(() => setLoading(false));
  }, [book.id, token]);

  const handleDelete = async () => {
    if (!confirm(`Delete "${book.title}"?`)) return;
    await apiDeleteBook(token, book.id);
    onDeleted?.(book.id);
  };

  const handleFeedback = async (rating) => {
    if (!summary) return;
    try { await apiSubmitFeedback(token, summary.summary_id, rating, ""); setFeedback(rating); } catch {}
  };

  const handleExport = (fmt) => {
    const url = apiExportUrl(book.id, fmt);
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${book.title}_summary.${fmt}`;
        link.click();
      });
  };

  const handleGenerateQuiz = async () => {
    setQLoading(true); setError("");
    try {
      const { quiz_id } = await apiGenerateQuiz(token, book.id, 10);
      const quiz = await apiGetQuiz(token, quiz_id);
      setQuizData(quiz);
    } catch (e) { setError(e.message); }
    finally { setQLoading(false); }
  };

  const handleAnswer = async (questionId, answer) => {
    try {
      const result = await apiSubmitAnswer(token, questionId, answer);
      setAnswers(prev => ({ ...prev, [questionId]: result }));
    } catch {}
  };

  const sourceTag  = { file: " File", text: "Text", youtube: "YouTube" };
  const roleColor  = { GENERAL:"#a29bfe", EXECUTIVE:"#ffd93d", TECHNICAL:"#00d2a0", STUDENT:"#fd79a8",
                       RESEARCHER:"#74b9ff", LEGAL:"#fdcb6e", CREATIVE:"#e17055", MEDICAL:"#55efc4", ANALYST:"#a29bfe", EDUCATOR:"#81ecec" };

  // Compression ratio
  const pct = summary?.original_word_count > 0
    ? Math.round((1 - summary.summary_word_count / summary.original_word_count) * 100) : 0;

  return (
    <div className="fade-in" style={{
      background:"linear-gradient(135deg,rgba(17,19,39,0.95) 0%,rgba(14,14,28,0.98) 100%)",
      border:"1px solid rgba(108,92,231,0.2)",
      borderRadius:16, overflow:"hidden", marginBottom:18,
      boxShadow:"0 4px 24px rgba(0,0,0,0.3)",
      transition:"box-shadow .2s",
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow="0 8px 40px rgba(108,92,231,0.15)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow="0 4px 24px rgba(0,0,0,0.3)"}
    >
      {/* ── Accent top bar ── */}
      <div style={{
        height:3,
        background:`linear-gradient(90deg,${roleColor[summary?.summary_role] || "#6c5ce7"},#fd79a8,#ffd93d)`,
      }} />

      {/* ── Header ── */}
      <div style={{ padding:"16px 20px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:6 }}>
            <span style={{ fontWeight:800, fontSize:16, color:"#eef0ff", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {book.title}
            </span>
            {book.source_type && <Badge color="#6c5ce7">{sourceTag[book.source_type] || book.source_type}</Badge>}
            {summary?.summary_format && <Badge color="#00d2a0">{summary.summary_format}</Badge>}
            {summary?.summary_role && summary.summary_role !== "GENERAL" && (
              <Badge color={roleColor[summary.summary_role] || "#a29bfe"}>{summary.summary_role}</Badge>
            )}
          </div>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
            {book.author && <Meta icon={<BookOpen size={11}/>} text={book.author} />}
            <Meta icon={<Clock size={11}/>} text={new Date(book.upload_date).toLocaleDateString()} />
            {summary && (
              <Meta icon={<Hash size={11}/>}
                text={`${summary.original_word_count?.toLocaleString()} → ${summary.summary_word_count?.toLocaleString()} words`} />
            )}
            {pct > 0 && (
              <span style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"1px 9px", borderRadius:20, fontSize:11, fontWeight:700,
                background:"rgba(0,210,160,0.12)", color:"#00d2a0",
                border:"1px solid rgba(0,210,160,0.25)",
              }}>
                ↓ {pct}% shorter
              </span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          <IBtn onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </IBtn>
          <IBtn onClick={handleDelete} danger><Trash2 size={14}/></IBtn>
        </div>
      </div>

      {/* ── Body ── */}
      {expanded && (
        <div style={{ padding:"0 20px 20px", borderTop:"1px solid rgba(108,92,231,0.1)" }}>

          {loading && <div style={{ padding:"24px 0", display:"flex", justifyContent:"center" }}><Spinner /></div>}

          {!loading && summary && (
            <>
              {/* Topics */}
              {summary.topics?.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:14 }}>
                  {summary.topics.map(t => (
                    <span key={t} style={{
                      padding:"2px 10px", borderRadius:20, fontSize:11,
                      background:"rgba(253,121,168,0.1)", color:"#fd79a8",
                      border:"1px solid rgba(253,121,168,0.2)",
                    }}>{t}</span>
                  ))}
                </div>
              )}

              {/* Summary text — rendered markdown */}
              <div
                style={{
                  marginTop:14, padding:"16px 18px",
                  background:"rgba(0,0,0,0.25)",
                  borderRadius:12, fontSize:14, lineHeight:1.8,
                  color:"#c8c8e8",
                  border:"1px solid rgba(108,92,231,0.1)",
                }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(summary.summary) }}
              />

              {/* Action row */}
              <div style={{ marginTop:14, display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
                {/* Mind map */}
                <button onClick={() => setMapOpen(true)} style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"7px 14px", borderRadius:8,
                  border:"1px solid rgba(108,92,231,0.4)", background:"rgba(108,92,231,0.08)",
                  color:"#a29bfe", fontSize:13, fontWeight:600, cursor:"pointer",
                  transition:"all .15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.background="#6c5ce7"; e.currentTarget.style.color="#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.background="rgba(108,92,231,0.08)"; e.currentTarget.style.color="#a29bfe"; }}
                >
                  <BrainCircuit size={13}/> Mind Map
                </button>

                {/* Exports */}
                {["txt","docx","pdf"].map(fmt => (
                  <button key={fmt} onClick={() => handleExport(fmt)} style={{
                    display:"flex", alignItems:"center", gap:5,
                    padding:"7px 12px", borderRadius:8,
                    border:"1px solid rgba(255,255,255,0.08)", background:"transparent",
                    color:"#8080aa", fontSize:12, cursor:"pointer",
                    transition:"all .15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,0.06)"; e.currentTarget.style.color="#e0e0ff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#8080aa"; }}
                  >
                    <Download size={12}/> {fmt.toUpperCase()}
                  </button>
                ))}

                {/* Quiz */}
                <button onClick={handleGenerateQuiz} disabled={quizLoading} style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"7px 14px", borderRadius:8,
                  border:`1px solid ${quizData ? "rgba(255,217,61,0.4)" : "rgba(0,210,160,0.4)"}`,
                  background: quizData ? "rgba(255,217,61,0.08)" : "rgba(0,210,160,0.08)",
                  color: quizData ? "#ffd93d" : "#00d2a0",
                  fontSize:13, fontWeight:600, cursor:quizLoading?"not-allowed":"pointer",
                  opacity:quizLoading?0.6:1,
                  transition:"all .15s",
                }}>
                  {quizLoading ? " Generating…" : quizData ? "Regenerate Quiz" : "Generate Quiz"}
                </button>

                {/* Feedback */}
                <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                  <IBtn onClick={() => handleFeedback("up")} active={feedback==="up"} activeColor="#00d2a0">
                    <ThumbsUp size={13}/>
                  </IBtn>
                  <IBtn onClick={() => handleFeedback("down")} active={feedback==="down"} activeColor="#ff6b6b">
                    <ThumbsDown size={13}/>
                  </IBtn>
                </div>
              </div>

              <ErrorBox message={error} />

              {quizData && (
                <QuizSection quiz={quizData} answers={answers} onAnswer={handleAnswer} />
              )}
            </>
          )}

          {!loading && !summary && (
            <p style={{ color:"#55556a", fontSize:13, padding:"14px 0" }}>Summary not yet available.</p>
          )}
        </div>
      )}

      {mapOpen && (
        <MindMapModal bookId={book.id} bookTitle={book.title} apiToken={token} onClose={() => setMapOpen(false)} />
      )}
    </div>
  );
}

// ── Quiz ───────────────────────────────────────────────────────────────────────
function QuizSection({ quiz, answers, onAnswer }) {
  const score = Object.values(answers).filter(r => r.is_correct).length;
  const total = quiz.questions.length;
  const answered = Object.keys(answers).length;

  return (
    <div style={{ marginTop:20 }}>
      {/* Quiz header */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:16, padding:"12px 16px",
        background:"rgba(108,92,231,0.08)", borderRadius:10,
        border:"1px solid rgba(108,92,231,0.2)",
      }}>
        <span style={{ fontWeight:700, color:"#a29bfe", fontSize:14 }}>
           Quiz — {total} Questions
        </span>
        {answered > 0 && (
          <span style={{
            padding:"3px 12px", borderRadius:20, fontWeight:700, fontSize:13,
            background: score === answered ? "rgba(0,210,160,0.15)" : "rgba(255,107,107,0.15)",
            color: score === answered ? "#00d2a0" : "#ff6b6b",
            border:`1px solid ${score === answered ? "rgba(0,210,160,0.3)" : "rgba(255,107,107,0.3)"}`,
          }}>
            {score}/{answered} correct
          </span>
        )}
      </div>

      {quiz.questions.map((q, i) => (
        <QuizQuestion key={q.id} q={q} index={i} result={answers[q.id]} onAnswer={onAnswer} />
      ))}
    </div>
  );
}

function QuizQuestion({ q, index, result, onAnswer }) {
  return (
    <div style={{
      marginBottom:12, padding:16,
      background:"rgba(0,0,0,0.2)", borderRadius:12,
      border:`1px solid ${result ? (result.is_correct ? "rgba(0,210,160,0.25)" : "rgba(255,107,107,0.25)") : "rgba(255,255,255,0.06)"}`,
      transition:"border-color .2s",
    }}>
      {/* Question header */}
      <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:12 }}>
        <span style={{
          display:"inline-flex", alignItems:"center", justifyContent:"center",
          width:28, height:28, borderRadius:"50%", flexShrink:0,
          background:"linear-gradient(135deg,var(--accent),#7c3aed)",
          color:"#fff", fontWeight:800, fontSize:12,
        }}>{index+1}</span>
        <p style={{ fontSize:14, fontWeight:600, color:"#d0d0f0", lineHeight:1.5, flex:1 }}>
          {q.question_text}
        </p>
      </div>

      {/* Options */}
      <div style={{ display:"flex", flexDirection:"column", gap:7, paddingLeft:38 }}>
        {(q.options || []).map((opt, j) => {
          const wasChosen = result?.user_answer === opt;
          const isCorrect = result && result.correct_answer === opt;
          let bg = "rgba(255,255,255,0.03)", border = "rgba(255,255,255,0.08)", color = "#9090b8";
          if (result) {
            if (isCorrect)                  { bg="rgba(0,210,160,0.12)"; border="#00d2a0"; color="#00d2a0"; }
            else if (wasChosen)             { bg="rgba(255,107,107,0.1)"; border="#ff6b6b"; color="#ff6b6b"; }
          }
          return (
            <button key={j} disabled={!!result} onClick={() => onAnswer(q.id, opt)} style={{
              padding:"9px 14px", borderRadius:8, border:`1px solid ${border}`,
              background:bg, color, fontSize:13, textAlign:"left",
              cursor:result?"default":"pointer", transition:"all .15s", fontFamily:"var(--font)",
            }}
              onMouseEnter={e => { if (!result) { e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.background="rgba(108,92,231,0.1)"; e.currentTarget.style.color="#c0b0ff"; }}}
              onMouseLeave={e => { if (!result) { e.currentTarget.style.borderColor="rgba(255,255,255,0.08)"; e.currentTarget.style.background="rgba(255,255,255,0.03)"; e.currentTarget.style.color="#9090b8"; }}}
            >
              {isCorrect && "✓ "}{wasChosen && !result?.is_correct && "✗ "}{opt}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {result && (
        <div style={{
          marginTop:10, marginLeft:38, padding:"10px 14px",
          borderRadius:8, fontSize:12, lineHeight:1.6,
          background: result.is_correct ? "rgba(0,210,160,0.06)" : "rgba(255,107,107,0.06)",
          borderLeft:`3px solid ${result.is_correct ? "#00d2a0" : "#ff6b6b"}`,
          color:"#a0a0cc",
        }}>
          <span style={{ fontWeight:700, color: result.is_correct ? "#00d2a0" : "#ff6b6b" }}>
            {result.is_correct ? "✓ Correct!" : `✗ Correct: "${result.correct_answer}"`}
          </span>
          {result.explanation && <span style={{ display:"block", marginTop:4 }}>{result.explanation}</span>}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Meta({ icon, text }) {
  if (!text) return null;
  return (
    <span style={{ display:"flex", alignItems:"center", gap:4, color:"#55556a", fontSize:11 }}>
      {icon} {text}
    </span>
  );
}

function IBtn({ onClick, danger, active, activeColor, children }) {
  const base = {
    display:"flex", alignItems:"center", justifyContent:"center",
    width:30, height:30, borderRadius:7,
    border:`1px solid ${active ? (activeColor || "#6c5ce7") : "rgba(255,255,255,0.08)"}`,
    background: active ? `${(activeColor||"#6c5ce7")}22` : "transparent",
    color: active ? (activeColor||"#a29bfe") : danger ? "#ff6b6b" : "#55556a",
    cursor:"pointer", transition:"all .15s",
  };
  return (
    <button style={base} onClick={onClick}
      onMouseEnter={e => { e.currentTarget.style.background="rgba(108,92,231,0.15)"; e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="#a29bfe"; }}
      onMouseLeave={e => { e.currentTarget.style.background = active?`${(activeColor||"#6c5ce7")}22`:"transparent"; e.currentTarget.style.borderColor = active?(activeColor||"#6c5ce7"):"rgba(255,255,255,0.08)"; e.currentTarget.style.color = active?(activeColor||"#a29bfe"):danger?"#ff6b6b":"#55556a"; }}
    >{children}</button>
  );
}