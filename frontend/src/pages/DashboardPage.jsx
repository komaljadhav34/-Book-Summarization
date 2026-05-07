import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { apiListBooks, apiJobStatus } from "../api/client";
import UploadPanel from "../components/UploadPanel";
import SummaryCard from "../components/SummaryCard";
import { Spinner } from "../components/Ui";
import { Search, ChevronDown, ChevronUp, X } from "lucide-react";

const POLL_INTERVAL = 3000;

export default function DashboardPage({ options }) {
  const { token }                 = useAuth();
  const [books, setBooks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeJobs, setJobs]     = useState({});
  const [search, setSearch]       = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const pollRef                   = useRef(null);
  const searchRef                 = useRef(null);

  useEffect(() => {
    apiListBooks(token).then(setBooks).finally(() => setLoading(false));
  }, [token]);

  const pollJobs = useCallback(async () => {
    if (!Object.keys(activeJobs).length) return;
    for (const [jobId] of Object.entries(activeJobs)) {
      try {
        const status = await apiJobStatus(token, jobId);
        if (status.status === "COMPLETED") {
          const updated = await apiListBooks(token);
          setBooks(updated);
          setJobs(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        } else if (status.status === "FAILED") {
          setJobs(prev => { const n = { ...prev }; delete n[jobId]; return n; });
        }
      } catch {}
    }
  }, [activeJobs, token]);

  useEffect(() => {
    if (!Object.keys(activeJobs).length) return;
    pollRef.current = setInterval(pollJobs, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [activeJobs, pollJobs]);

  const handleJobStarted = (result) => {
    setJobs(prev => ({ ...prev, [result.job_id]: { bookId: result.book_id } }));
  };
  const handleDeleted = (bookId) => setBooks(prev => prev.filter(b => b.id !== bookId));

  // filtered list
  const q = search.trim().toLowerCase();
  const filtered = q
    ? books.filter(b =>
        b.title?.toLowerCase().includes(q) ||
        b.author?.toLowerCase().includes(q) ||
        b.source_type?.toLowerCase().includes(q)
      )
    : books;

  const pendingCount = Object.keys(activeJobs).length;

  // Ctrl+F / Cmd+F focuses the search bar
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f" && searchRef.current) {
        e.preventDefault();
        setCollapsed(false);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 960 }}>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg,#6c5ce7,#a29bfe)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(108,92,231,0.35)", fontSize: "1.4rem",
          }}>📤</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "var(--text)", lineHeight: 1.2 }}>
              Upload &amp; Summarize
            </h1>
            <p style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>
              Choose your input, pick a role and format, then let AI do the magic.
            </p>
          </div>
          {pendingCount > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 7, marginLeft: "auto",
              padding: "7px 16px", borderRadius: 24,
              background: "rgba(108,92,231,0.15)", border: "1px solid rgba(108,92,231,0.4)",
              color: "var(--accent2)", fontSize: 13, fontWeight: 600,
            }}>
              <Spinner size={13} /> {pendingCount} summarizing…
            </div>
          )}
        </div>
      </div>

      {/* Upload panel */}
      <UploadPanel options={options} onJobStarted={handleJobStarted} />

      {/* Processing banner */}
      {pendingCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 12, marginBottom: 20,
          background: "rgba(108,92,231,0.08)", border: "1px solid rgba(108,92,231,0.3)",
          fontSize: 13, color: "var(--accent2)",
        }}>
          <Spinner size={14} />
          <span>
            Processing {pendingCount} document{pendingCount > 1 ? "s" : ""}…&nbsp;
            <span style={{ color: "var(--text2)" }}>This usually takes 5–10 seconds.</span>
          </span>
        </div>
      )}

      {/* Documents section */}
      <div style={{ marginTop: 28 }}>

        {/* ── Collapsible header bar ── */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "13px 18px",
            background: collapsed
              ? "rgba(255,255,255,0.025)"
              : "linear-gradient(90deg,rgba(108,92,231,0.12) 0%,rgba(255,255,255,0.025) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: collapsed ? 14 : "14px 14px 0 0",
            cursor: "pointer", fontFamily: "var(--font)",
            transition: "all .22s ease",
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(108,92,231,0.35)"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}
        >
          {/* folder icon */}
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "rgba(108,92,231,0.18)", border: "1px solid rgba(108,92,231,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
          }}>🗂️</div>

          <span style={{
            fontSize: 12, fontWeight: 800, color: "var(--text2)",
            textTransform: "uppercase", letterSpacing: 1.1, flex: 1, textAlign: "left",
          }}>
            Your Documents
          </span>

          {/* count */}
          {!loading && books.length > 0 && (
            <span style={{
              padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: "rgba(108,92,231,0.18)", color: "var(--accent2)",
              border: "1px solid rgba(108,92,231,0.28)",
            }}>{books.length}</span>
          )}

          {/* chevron */}
          <span style={{ color: "var(--text2)", flexShrink: 0, display: "flex", alignItems: "center" }}>
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </span>
        </button>

        {/* ── Collapsible body ── */}
        <div style={{
          display: collapsed ? "none" : "block",
          border: "1px solid rgba(255,255,255,0.07)",
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.008)",
        }}>

          {/* ── Search bar ── */}
          {!loading && books.length > 0 && (
            <div style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(0,0,0,0.15)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "9px 14px", borderRadius: 10,
                background: "rgba(0,0,0,0.3)",
                border: `1px solid ${search ? "rgba(108,92,231,0.55)" : "rgba(255,255,255,0.08)"}`,
                boxShadow: search ? "0 0 0 3px rgba(108,92,231,0.08)" : "none",
                transition: "border-color .18s, box-shadow .18s",
              }}>
                <Search
                  size={14}
                  style={{
                    color: search ? "var(--accent2)" : "#444",
                    flexShrink: 0, transition: "color .18s",
                  }}
                />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${books.length} document${books.length !== 1 ? "s" : ""} by title, author or type…`}
                  style={{
                    flex: 1, background: "none", border: "none", outline: "none",
                    fontSize: 13, color: "var(--text)", fontFamily: "var(--font)",
                    caretColor: "var(--accent2)",
                  }}
                />
                {/* clear button */}
                {search && (
                  <button
                    onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                    style={{
                      background: "rgba(255,255,255,0.07)", border: "none",
                      width: 20, height: 20, borderRadius: "50%", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#888", flexShrink: 0, transition: "all .15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,107,107,0.2)"; e.currentTarget.style.color = "#ff6b6b"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#888"; }}
                    title="Clear search"
                  >
                    <X size={11} />
                  </button>
                )}
                {/* keyboard hint */}
                {!search && (
                  <kbd style={{
                    fontSize: 10, color: "#333", fontWeight: 600, flexShrink: 0,
                    padding: "2px 6px", borderRadius: 5,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.04)",
                    fontFamily: "monospace",
                  }}>⌘F</kbd>
                )}
              </div>

              {/* result count */}
              {q && (
                <p style={{ fontSize: 11, color: "var(--text2)", marginTop: 7, paddingLeft: 2 }}>
                  {filtered.length === 0
                    ? <>No results for <strong style={{ color: "var(--text)" }}>"{search}"</strong></>
                    : <><strong style={{ color: "var(--accent2)" }}>{filtered.length}</strong> of {books.length} documents match</>}
                </p>
              )}
            </div>
          )}

          {/* ── Content area ── */}
          <div style={{ padding: books.length > 0 ? "14px 14px 14px" : 0 }}>

            {loading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                <Spinner />
              </div>
            )}

            {/* empty state */}
            {!loading && books.length === 0 && (
              <div style={{
                textAlign: "center", padding: "52px 20px",
                background: "rgba(255,255,255,0.02)", borderRadius: 12,
                border: "2px dashed rgba(108,92,231,0.18)", margin: 14,
              }}>
                <div style={{ fontSize: "2.6rem", marginBottom: 14 }}>📄</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                  No documents yet
                </h3>
                <p style={{ color: "var(--text2)", fontSize: 13, maxWidth: 320, margin: "0 auto" }}>
                  Upload a file, paste text, or add a YouTube URL above to get your first AI summary.
                </p>
              </div>
            )}

            {/* no-search-results state */}
            {!loading && books.length > 0 && q && filtered.length === 0 && (
              <div style={{
                textAlign: "center", padding: "36px 20px", borderRadius: 12,
                background: "rgba(255,255,255,0.015)",
                border: "1px dashed rgba(255,255,255,0.08)",
              }}>
                <div style={{ fontSize: "2rem", marginBottom: 10 }}>🔍</div>
                <p style={{ color: "var(--text2)", fontSize: 13 }}>
                  Nothing matches <strong style={{ color: "var(--text)" }}>"{search}"</strong>
                </p>
                <button
                  onClick={() => setSearch("")}
                  style={{
                    marginTop: 12, padding: "6px 18px", borderRadius: 8,
                    border: "1px solid rgba(108,92,231,0.35)",
                    background: "rgba(108,92,231,0.09)", color: "var(--accent2)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)",
                  }}
                >Clear search</button>
              </div>
            )}

            {/* cards */}
            {!loading && filtered.map(book => (
              <SummaryCard key={book.id} book={book} onDeleted={handleDeleted} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
