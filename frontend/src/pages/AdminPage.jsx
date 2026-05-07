import { useState, useEffect } from "react";
import {
  Shield, Users, BookOpen, Briefcase, AlertTriangle,
  Trash2, ChevronsUpDown, RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  apiAdminStats, apiAdminUsers, apiAdminBooks,
  apiAdminJobs, apiAdminDeleteUser, apiAdminUpdateRole,
} from "../api/client";
import { Btn, Badge, Spinner, ErrorBox, Empty } from "../components/Ui";

const SECTIONS = ["Overview", "Users", "Books", "Jobs"];

export default function AdminPage() {
  const { token }                 = useAuth();
  const [section, setSection]     = useState("Overview");
  const [stats, setStats]         = useState(null);
  const [users, setUsers]         = useState([]);
  const [books, setBooks]         = useState([]);
  const [jobs, setJobs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const load = async (sec = section) => {
    setLoading(true); setError("");
    try {
      if (sec === "Overview") setStats(await apiAdminStats(token));
      if (sec === "Users")    setUsers(await apiAdminUsers(token));
      if (sec === "Books")    setBooks(await apiAdminBooks(token));
      if (sec === "Jobs")     setJobs(await apiAdminJobs(token));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [section]);

  const deleteUser = async (userId) => {
    if (!confirm("Delete this user and all their content?")) return;
    try { await apiAdminDeleteUser(token, userId); setUsers(u => u.filter(x => x.id !== userId)); }
    catch (e) { setError(e.message); }
  };

  const toggleRole = async (user) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    try {
      await apiAdminUpdateRole(token, user.id, newRole);
      setUsers(us => us.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch (e) { setError(e.message); }
  };

  return (
    <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <Shield size={20} color="#6c5ce7" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#e0e0ff" }}>Admin Panel</h1>
        <button onClick={() => load()} style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
          padding: "6px 12px", borderRadius: 8, border: "1px solid #2d2d4e",
          background: "transparent", color: "#a0a0cc", fontSize: 12, cursor: "pointer",
        }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 22, borderBottom: "1px solid #2d2d4e", paddingBottom: 12 }}>
        {SECTIONS.map(s => (
          <button key={s} onClick={() => setSection(s)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none",
            background: section === s ? "rgba(108,92,231,0.15)" : "transparent",
            color: section === s ? "#a88cff" : "#55556a",
            fontWeight: section === s ? 600 : 400, fontSize: 13, cursor: "pointer",
            borderBottom: section === s ? "2px solid #6c5ce7" : "2px solid transparent",
          }}>
            {s}
          </button>
        ))}
      </div>

      <ErrorBox message={error} />
      {loading && <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Spinner /></div>}

      {/* Overview */}
      {!loading && section === "Overview" && stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
          {[
            { label: "Total Users",    value: stats.total_users,    icon: <Users size={18} />,     color: "#6c5ce7" },
            { label: "Total Books",    value: stats.total_books,    icon: <BookOpen size={18} />,  color: "#00d2a0" },
            { label: "Summaries",      value: stats.total_summaries,icon: <Briefcase size={18} />, color: "#74b9ff" },
            { label: "Completed Jobs", value: stats.completed_jobs, icon: <Shield size={18} />,    color: "#00d2a0" },
            { label: "Failed Jobs",    value: stats.failed_jobs,    icon: <AlertTriangle size={18} />, color: "#ff6b6b" },
            { label: "Pending Jobs",   value: stats.pending_jobs,   icon: <RefreshCw size={18} />, color: "#ffd93d" },
          ].map(({ label, value, icon, color }) => (
            <StatCard key={label} label={label} value={value} icon={icon} color={color} />
          ))}
        </div>
      )}

      {/* Users */}
      {!loading && section === "Users" && (
        users.length === 0 ? <Empty icon="" message="No users found" /> :
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2d2d4e" }}>
              {["ID", "Name", "Email", "Role", "Books", "Actions"].map(h => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid #1e1e3a" }}>
                <Td>{u.id}</Td>
                <Td>{u.name}</Td>
                <Td style={{ color: "#a0a0cc" }}>{u.email}</Td>
                <Td><Badge color={u.role === "admin" ? "#6c5ce7" : "#00d2a0"}>{u.role}</Badge></Td>
                <Td>{u.book_count}</Td>
                <Td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn size="sm" variant="ghost" onClick={() => toggleRole(u)}>
                      <ChevronsUpDown size={11} />
                      {u.role === "admin" ? "Demote" : "Promote"}
                    </Btn>
                    <Btn size="sm" variant="danger" onClick={() => deleteUser(u.id)}>
                      <Trash2 size={11} />
                    </Btn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Books */}
      {!loading && section === "Books" && (
        books.length === 0 ? <Empty icon="" message="No books found" /> :
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2d2d4e" }}>
              {["ID", "Title", "Owner", "Type", "Has Summary", "Uploaded"].map(h => <Th key={h}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {books.map(b => (
              <tr key={b.id} style={{ borderBottom: "1px solid #1e1e3a" }}>
                <Td>{b.id}</Td>
                <Td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</Td>
                <Td style={{ color: "#a0a0cc", fontSize: 12 }}>{b.user_email}</Td>
                <Td><Badge color="#6c5ce7">{b.source_type}</Badge></Td>
                <Td><Badge color={b.has_summary ? "#00d2a0" : "#ff6b6b"}>{b.has_summary ? "Yes" : "No"}</Badge></Td>
                <Td style={{ color: "#55556a", fontSize: 12 }}>{new Date(b.upload_date).toLocaleDateString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Jobs */}
      {!loading && section === "Jobs" && (
        jobs.length === 0 ? <Empty icon="" message="No jobs found" /> :
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2d2d4e" }}>
              {["Job ID", "Book", "Status", "Format", "Role", "Error"].map(h => <Th key={h}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} style={{ borderBottom: "1px solid #1e1e3a" }}>
                <Td style={{ fontSize: 11, color: "#55556a" }}>{j.id.slice(0, 8)}…</Td>
                <Td>{j.book_id}</Td>
                <Td>
                  <Badge color={
                    j.status === "COMPLETED" ? "#00d2a0" :
                    j.status === "FAILED"    ? "#ff6b6b" :
                    j.status === "PROCESSING"? "#ffd93d" : "#a0a0cc"
                  }>{j.status}</Badge>
                </Td>
                <Td style={{ color: "#a0a0cc", fontSize: 12 }}>{j.summary_format}</Td>
                <Td style={{ color: "#a0a0cc", fontSize: 12 }}>{j.summary_role}</Td>
                <Td style={{ color: "#ff6b6b", fontSize: 12 }}>{j.error || "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: "#12121f", border: "1px solid #2d2d4e",
      borderRadius: 12, padding: "16px 18px",
    }}>
      <div style={{ color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#e0e0ff" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#55556a", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const Th = ({ children }) => (
  <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, color: "#55556a",
    fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</th>
);
const Td = ({ children, style }) => (
  <td style={{ padding: "10px 12px", fontSize: 13, color: "#c0c0e0", ...style }}>{children}</td>
);