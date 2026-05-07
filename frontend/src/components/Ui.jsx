/**
 * Ui.jsx — shared primitive components
 * Button, Card, Input, Spinner, Badge, Tag, Modal backdrop
 */

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, variant = "primary", size = "md", loading, disabled, style, ...props }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 8, border: "none", fontWeight: 600, cursor: disabled || loading ? "not-allowed" : "pointer",
    transition: "all .18s", fontFamily: "inherit", opacity: disabled || loading ? 0.6 : 1,
  };
  const sizes = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "10px 18px", fontSize: 14 }, lg: { padding: "13px 24px", fontSize: 15 } };
  const variants = {
    primary:  { background: "#6c5ce7", color: "#fff" },
    secondary:{ background: "#1e1e3a", color: "#a0a0cc", border: "1px solid #2d2d4e" },
    danger:   { background: "rgba(255,107,107,0.15)", color: "#ff6b6b", border: "1px solid #ff6b6b" },
    ghost:    { background: "transparent", color: "#a0a0cc", border: "1px solid #2d2d4e" },
    success:  { background: "rgba(0,210,160,0.15)", color: "#00d2a0", border: "1px solid #00d2a0" },
  };
  return (
    <button style={{ ...base, ...sizes[size], ...variants[variant], ...style }} disabled={disabled || loading} {...props}>
      {loading ? <Spinner size={14} /> : children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style, className }) {
  return (
    <div className={className} style={{
      background: "#12121f", border: "1px solid #2d2d4e",
      borderRadius: 12, padding: 20, ...style,
    }}>
      {children}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, color = "#6c5ce7" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid #2d2d4e`, borderTopColor: color,
      animation: "spin 0.7s linear infinite", flexShrink: 0,
    }} />
  );
}

// ── Badge / Tag ───────────────────────────────────────────────────────────────
export function Badge({ children, color = "#6c5ce7" }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      background: `${color}22`, color, border: `1px solid ${color}44`,
      fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
    }}>
      {children}
    </span>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
export function SectionTitle({ children, style }) {
  return (
    <h2 style={{ fontSize: 16, fontWeight: 700, color: "#e0e0ff", marginBottom: 14, ...style }}>
      {children}
    </h2>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ icon, message }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "#55556a" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}

// ── Error box ─────────────────────────────────────────────────────────────────
export function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: "rgba(255,107,107,0.1)", border: "1px solid #ff6b6b44",
      borderRadius: 8, padding: "10px 14px", color: "#ff6b6b", fontSize: 13,
    }}>
      {message}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ style }) {
  return <div style={{ height: 1, background: "#2d2d4e", margin: "16px 0", ...style }} />;
}