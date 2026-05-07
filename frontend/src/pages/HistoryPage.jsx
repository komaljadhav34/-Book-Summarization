import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiListBooks, apiDeleteBook } from "../api/client";
import { Spinner } from "../components/Ui";
import { Trash2, ExternalLink, BookOpen, Clock } from "lucide-react";

const srcTag = { file:" File", text:" Text", youtube:" YouTube" };

function BookRow({ book, onDelete }) {
  const navigate      = useNavigate();
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={() => navigate(`/summary/${book.id}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "15px 20px", borderRadius: 14,
        cursor: "pointer", transition: "all .18s",
        background: hov ? "rgba(108,92,231,0.08)" : "rgba(255,255,255,0.025)",
        border: hov ? "1px solid rgba(108,92,231,0.3)" : "1px solid rgba(255,255,255,0.07)",
        transform: hov ? "translateX(3px)" : "none",
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: "rgba(108,92,231,0.1)", border: "1px solid rgba(108,92,231,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem",
      }}>
        {book.source_type === "youtube" ? "" : book.source_type === "text" ? "" : ""}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{
            fontWeight: 700, fontSize: 14, color: "var(--text)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{book.title}</span>
          {book.source_type && (
            <span style={{
              fontSize: 10, padding: "1px 8px", borderRadius: 20, flexShrink: 0,
              background: "rgba(108,92,231,0.12)", color: "var(--accent2)",
              border: "1px solid rgba(108,92,231,0.2)",
            }}>{srcTag[book.source_type] || book.source_type}</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 3, color: "var(--text2)", fontSize: 11 }}>
            <Clock size={10}/> {new Date(book.upload_date).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent2)", fontWeight: 600 }}>
          <ExternalLink size={12}/> Open
        </span>
        <DeleteBtn onDelete={e => onDelete(e, book.id)}/>
      </div>
    </div>
  );
}

function DeleteBtn({ onDelete }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onDelete}
      onMouseEnter={e => { e.stopPropagation(); setHov(true);  }}
      onMouseLeave={e => { e.stopPropagation(); setHov(false); }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 8,
        border: hov ? "1px solid #ff6b6b" : "1px solid rgba(255,107,107,0.15)",
        background: hov ? "rgba(255,107,107,0.1)" : "transparent",
        color: hov ? "#ff6b6b" : "rgba(255,107,107,0.5)",
        cursor: "pointer", transition: "all .15s",
      }}
    >
      <Trash2 size={13}/>
    </button>
  );
}

export default function HistoryPage() {
  const { token }              = useAuth();
  const navigate               = useNavigate();
  const [books,  setBooks]     = useState([]);
  const [loading, setLoading]  = useState(true);
  const [search,  setSearch]   = useState("");

  useEffect(() => {
    apiListBooks(token).then(setBooks).finally(() => setLoading(false));
  }, [token]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this summary?")) return;
    await apiDeleteBook(token, id);
    setBooks(bs => bs.filter(b => b.id !== id));
  };

  const filtered = books.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: "32px 36px", maxWidth: 900, margin: "0 auto" }}>

<div className="fade-in" style={{ marginBottom: 28 }}>
  
  <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
    
    <div>
      <h1 style={{
        fontSize: 22,
        fontWeight: 900,
        color: "var(--text)",
        lineHeight: 1.2
      }}>
        Summary History
      </h1>

      <p style={{
        fontSize: 13,
        color: "var(--text2)",
        marginTop: 2
      }}>
        All your summarized documents in one place.
      </p>
    </div>

    {!loading && (
      <span
        style={{
          marginLeft: "auto",
          padding: "3px 12px",
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          background: "rgba(108,92,231,0.15)",
          color: "var(--accent2)",
          border: "1px solid rgba(108,92,231,0.25)",
        }}
      >
        {books.length} doc{books.length !== 1 ? "s" : ""}
      </span>
    )}

  </div>

  <input
    placeholder="Search by title"
    value={search}
    onChange={e => setSearch(e.target.value)}
    style={{
      maxWidth: 360,
      borderRadius: 10,
      fontSize: 13
    }}
  />

</div>

      {loading && <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner/></div>}

      {!loading && filtered.length === 0 && (
        <div style={{
          textAlign: "center", padding: "60px 20px", borderRadius: 16,
          background: "rgba(255,255,255,0.02)", border: "2px dashed rgba(108,92,231,0.15)",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: 14 }}>{search ? "🔍" : "📭"}</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
            {search ? "No results found" : "No summaries yet"}
          </h3>
          <p style={{ color: "var(--text2)", fontSize: 13, marginBottom: 18 }}>
            {search ? `No documents matching "${search}".` : "Upload a document to get started."}
          </p>
          {!search && (
            <button onClick={() => navigate("/upload")} style={{
              padding: "10px 26px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#6c5ce7,#a29bfe)",
              color: "#fff", fontWeight: 700, fontSize: 14,
              cursor: "pointer", fontFamily: "var(--font)",
            }}> Summarize Something</button>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {filtered.map((book, i) => (
          <div key={book.id} className="fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
            <BookRow book={book} onDelete={handleDelete}/>
          </div>
        ))}
      </div>
    </div>
  );
}