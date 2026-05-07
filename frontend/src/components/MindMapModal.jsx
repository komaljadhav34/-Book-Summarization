/**
 * MindMapModal.jsx
 * Full-screen modal that renders a Mermaid flowchart.
 * • Auto-fits the diagram to the viewport on open
 * • Mouse-wheel zoom  (Ctrl+scroll or pinch)
 * • Click-drag to pan
 * • Toolbar: zoom in/out, fit, reset, download PNG, fullscreen, close
 * • Esc to close
 */
import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "/api";

// ─── tiny icon helpers ────────────────────────────────────────────────────────
const SvgIcon = ({ d, size = 16, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d)
      ? d.map((p, i) => <path key={i} d={p} />)
      : <path d={d} />}
  </svg>
);

const IC = {
  plus:     "M12 5v14M5 12h14",
  minus:    "M5 12h14",
  fit:      ["M15 3h6v6","M9 21H3v-6","M21 3l-7 7","M3 21l7-7"],
  reset:    "M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15",
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","M7 10l5 5 5-5","M12 15V3"],
  expand:   ["M8 3H5a2 2 0 0 0-2 2v3","M21 8V5a2 2 0 0 0-2-2h-3","M3 16v3a2 2 0 0 0 2 2h3","M16 21h3a2 2 0 0 0 2-2v-3"],
  shrink:   ["M4 14h6v6","M20 10h-6V4","M14 10l7-7","M3 21l7-7"],
  x:        "M18 6L6 18M6 6l12 12",
  network:  ["M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z","M12 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4z","M4.93 4.93a2 2 0 1 1 0 4 2 2 0 0 1 0-4z","M19.07 4.93a2 2 0 1 1 0 4 2 2 0 0 1 0-4z","M12 6v12","M6.34 7.76l11.32 8.48","M17.66 7.76L6.34 16.24"],
};

// ─── Mermaid loader (singleton) ───────────────────────────────────────────────
let _mermaidState = "idle"; // idle | loading | ready | error
let _mermaidCallbacks = [];

async function ensureMermaid() {
  if (_mermaidState === "ready") return true;
  if (_mermaidState === "error") return false;

  return new Promise((resolve) => {
    _mermaidCallbacks.push(resolve);
    if (_mermaidState === "loading") return;

    _mermaidState = "loading";
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";
    s.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
          // Dark theme colours
          primaryColor:        "#6c5ce7",
          primaryTextColor:    "#ffffff",
          primaryBorderColor:  "#a29bfe",
          lineColor:           "#a29bfe",
          secondaryColor:      "#1a1a2e",
          tertiaryColor:       "#0b0d17",
          background:          "#0b0d17",
          mainBkg:             "#1e1b4b",
          nodeBorder:          "#a29bfe",
          clusterBkg:          "#1a1a2e",
          titleColor:          "#e0e0ff",
          edgeLabelBackground: "#0b0d17",
          fontFamily:          "Outfit, sans-serif",
          fontSize:            "14px",
        },
        flowchart: {
          htmlLabels:    true,
          curve:         "basis",
          padding:       28,
          nodeSpacing:   55,
          rankSpacing:   70,
          useMaxWidth:   false,  // CRITICAL: let SVG grow naturally
        },
        securityLevel: "loose",
      });
      _mermaidState = "ready";
      _mermaidCallbacks.forEach(cb => cb(true));
      _mermaidCallbacks = [];
    };
    s.onerror = () => {
      _mermaidState = "error";
      _mermaidCallbacks.forEach(cb => cb(false));
      _mermaidCallbacks = [];
    };
    document.head.appendChild(s);
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MindMapModal({ bookId, bookTitle, apiToken, onClose }) {
  const [status,   setStatus]   = useState("loading"); // loading | rendering | ready | error
  const [errMsg,   setErrMsg]   = useState("");
  const [zoom,     setZoom]     = useState(1);
  const [pan,      setPan]      = useState({ x: 0, y: 0 });
  const [maxed,    setMaxed]    = useState(false);
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef(null);  // outer scroll/pan area
  const stageRef     = useRef(null);  // transformed inner div
  const svgWrapRef   = useRef(null);  // where mermaid injects SVG
  const dragStart    = useRef(null);
  const svgSize      = useRef({ w: 0, h: 0 });

  // ── close on Escape ──────────────────────────────────────────────────────
  useEffect(() => {
    const h = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // ── fetch + render ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. fetch Mermaid code from backend
        const res = await fetch(`${API_BASE}/books/mindmap/${bookId}`, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const json = await res.json();
        const code = json.mermaid || json.flowchart || "";
        if (!code.trim()) throw new Error("Backend returned empty diagram data");

        // 2. load Mermaid library
        setStatus("rendering");
        const ok = await ensureMermaid();
        if (!ok) throw new Error("Failed to load Mermaid library");
        if (cancelled) return;

        // 3. render
        const id = `mm_${Date.now()}`;
        let svg;
        try {
          ({ svg } = await window.mermaid.render(id, code));
        } catch (renderErr) {
          // Try a minimal fallback diagram so the user sees *something*
          const fallback = buildFallbackMermaid(bookTitle, json);
          ({ svg } = await window.mermaid.render(id + "_fb", fallback));
        }

        if (cancelled) return;

        // 4. inject SVG & measure
        const wrap = svgWrapRef.current;
        if (!wrap) return;
        wrap.innerHTML = svg;
        const svgEl = wrap.querySelector("svg");
        if (svgEl) {
          svgEl.style.display = "block";
          svgEl.style.maxWidth = "none";
          svgEl.style.overflow = "visible";

          // Resolve real pixel dimensions
          const vb = svgEl.viewBox?.baseVal;
          const pw = svgEl.width?.baseVal?.value;
          const ph = svgEl.height?.baseVal?.value;
          const w = (vb && vb.width  > 10) ? vb.width  : (pw  > 10 ? pw  : 1200);
          const h = (vb && vb.height > 10) ? vb.height : (ph > 10 ? ph : 700);

          svgEl.setAttribute("width",  w);
          svgEl.setAttribute("height", h);
          svgEl.style.width  = w + "px";
          svgEl.style.height = h + "px";
          svgSize.current = { w, h };
        }

        setStatus("ready");

        // 5. Auto-fit after paint
        requestAnimationFrame(() => requestAnimationFrame(() => fitToScreen(true)));

      } catch (err) {
        if (!cancelled) {
          setErrMsg(err.message);
          setStatus("error");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [bookId, apiToken, bookTitle]);

  // ── fit-to-screen ────────────────────────────────────────────────────────
  const fitToScreen = useCallback((centerAfter = false) => {
    const c = containerRef.current;
    if (!c || !svgSize.current.w) return;

    const cW = c.clientWidth  - 80;  // padding
    const cH = c.clientHeight - 80;
    const sW = svgSize.current.w;
    const sH = svgSize.current.h;

    const fit = Math.min(cW / sW, cH / sH, 1.5); // never zoom in beyond 150%
    const newZoom = Math.max(0.1, fit);
    const cx = (cW - sW * newZoom) / 2 + 40;
    const cy = (cH - sH * newZoom) / 2 + 40;

    setZoom(newZoom);
    setPan({ x: cx, y: cy });
  }, []);

  // ── zoom controls ────────────────────────────────────────────────────────
  const changeZoom = useCallback((delta) => {
    setZoom(prev => {
      const next = Math.min(4, Math.max(0.1, prev + delta));
      return next;
    });
  }, []);

  // ── wheel zoom (centred on cursor) ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.12 : -0.12;
      setZoom(prev => Math.min(4, Math.max(0.1, prev + factor)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [status]);

  // ── drag to pan ──────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging || !dragStart.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setPan({ x: dragStart.current.px + dx, y: dragStart.current.py + dy });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  // ── download PNG ─────────────────────────────────────────────────────────
  const downloadPng = () => {
    const svgEl = svgWrapRef.current?.querySelector("svg");
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true);
    // white-ish dark bg so PNG looks good standalone
    clone.style.background = "#0b0d17";
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const scale  = 2;
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth  * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.fillStyle = "#0b0d17";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const a = document.createElement("a");
      a.download = `${bookTitle || "mindmap"}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const modalStyle = maxed
    ? { position: "fixed", inset: 0, borderRadius: 0 }
    : { position: "fixed", top: "3vh", left: "3vw", right: "3vw", bottom: "3vh", borderRadius: 20 };

  return (
    <>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(12px)",
        }}
      />

      {/* modal window */}
      <div style={{
        ...modalStyle,
        zIndex: 9999,
        background: "linear-gradient(135deg,#0e0e1e 0%,#0b0d17 100%)",
        border: "1px solid rgba(108,92,231,0.35)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(108,92,231,0.15)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        transition: "top .25s,left .25s,right .25s,bottom .25s,border-radius .25s",
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px", flexShrink: 0,
          background: "linear-gradient(90deg,rgba(108,92,231,0.15) 0%,transparent 100%)",
          borderBottom: "1px solid rgba(108,92,231,0.2)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "linear-gradient(135deg,#6c5ce7,#a29bfe)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(108,92,231,0.4)",
              color: "#fff",
            }}>
              <SvgIcon d={IC.network} size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#e0e0ff" }}>
                Mind Map
              </div>
              <div style={{ fontSize: 11, color: "#a29bfe", fontWeight: 600, marginTop: 1 }}>
                {bookTitle}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* zoom % */}
            <span style={{
              fontSize: 12, fontWeight: 700, color: "#555",
              minWidth: 42, textAlign: "right", marginRight: 4,
            }}>
              {Math.round(zoom * 100)}%
            </span>
            <Tb onClick={() => changeZoom(+0.15)} title="Zoom in"><SvgIcon d={IC.plus} size={14}/></Tb>
            <Tb onClick={() => changeZoom(-0.15)} title="Zoom out"><SvgIcon d={IC.minus} size={14}/></Tb>
            <Tb onClick={() => fitToScreen()} title="Fit to screen"><SvgIcon d={IC.fit} size={14}/></Tb>
            <Tb onClick={() => { setZoom(1); setPan({ x: 40, y: 40 }); }} title="Reset zoom"><SvgIcon d={IC.reset} size={14}/></Tb>
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 3px" }}/>
            <Tb onClick={downloadPng} title="Download PNG"><SvgIcon d={IC.download} size={14}/></Tb>
            <Tb onClick={() => setMaxed(m => !m)} title={maxed ? "Restore" : "Fullscreen"}>
              <SvgIcon d={maxed ? IC.shrink : IC.expand} size={14}/>
            </Tb>
            <Tb onClick={onClose} danger title="Close"><SvgIcon d={IC.x} size={16}/></Tb>
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div
          ref={containerRef}
          onMouseDown={onMouseDown}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            cursor: dragging ? "grabbing" : "grab",
            // subtle dot grid
            backgroundImage: "radial-gradient(circle, rgba(108,92,231,0.18) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            backgroundPosition: "0 0",
          }}
        >
          {/* Loading */}
          {(status === "loading" || status === "rendering") && (
            <Centred>
              <Spin />
              <div style={{ color: "#a29bfe", fontSize: 14, fontWeight: 600, marginTop: 14 }}>
                {status === "loading" ? "Generating mind map…" : "Rendering diagram…"}
              </div>
              <div style={{ color: "#555", fontSize: 12, marginTop: 6 }}>
                This may take a few seconds
              </div>
            </Centred>
          )}

          {/* Error */}
          {status === "error" && (
            <Centred>
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>😕</div>
              <div style={{ color: "#ff6b6b", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                Could not generate mind map
              </div>
              <div style={{
                color: "#888", fontSize: 12, maxWidth: 380, textAlign: "center",
                lineHeight: 1.6, padding: "10px 16px",
                background: "rgba(255,107,107,0.07)",
                border: "1px solid rgba(255,107,107,0.2)", borderRadius: 10,
              }}>
                {errMsg}
              </div>
              <button onClick={onClose} style={{
                marginTop: 18, padding: "8px 22px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent", color: "#a0a0cc",
                fontFamily: "inherit", fontSize: 13, cursor: "pointer",
              }}>Close</button>
            </Centred>
          )}

          {/* SVG stage */}
          <div
            ref={stageRef}
            style={{
              position: "absolute",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              transition: dragging ? "none" : "transform .18s ease",
              willChange: "transform",
            }}
          >
            <div
              ref={svgWrapRef}
              style={{
                display: "inline-block",
                // Force dark node backgrounds via CSS
                "--node-bg": "#1e1b4b",
                "--node-border": "#a29bfe",
              }}
            />
          </div>
        </div>

        {/* ── Footer hint ── */}
        <div style={{
          padding: "6px 18px",
          borderTop: "1px solid rgba(108,92,231,0.12)",
          background: "rgba(0,0,0,0.3)",
          flexShrink: 0,
          display: "flex", gap: 18, fontSize: 11, color: "#444",
        }}>
          <span>🖱 Drag to pan</span>
          <span>⌨ Scroll to zoom</span>
          <span>⊡ Fit button to auto-fit</span>
          <span>Esc to close</span>
        </div>
      </div>

      {/* Global SVG styles injected once */}
      <style>{`
        .mindmap-svg-wrap svg { overflow: visible !important; }
        .mindmap-svg-wrap .node rect,
        .mindmap-svg-wrap .node circle,
        .mindmap-svg-wrap .node polygon,
        .mindmap-svg-wrap .node path {
          fill: #1e1b4b !important;
          stroke: #a29bfe !important;
          stroke-width: 1.5px !important;
        }
        .mindmap-svg-wrap .node.root rect { fill: #6c5ce7 !important; stroke: #a29bfe !important; }
        .mindmap-svg-wrap .edgePath .path { stroke: #a29bfe !important; stroke-width: 1.5px !important; }
        .mindmap-svg-wrap .edgeLabel { color: #c0c0e0 !important; font-size: 11px !important; }
        .mindmap-svg-wrap .label { color: #e0e0ff !important; font-family: 'Outfit', sans-serif !important; }
        .mindmap-svg-wrap .cluster rect { fill: #0f0f20 !important; stroke: #2d2d4e !important; }
      `}</style>
    </>
  );
}

// ─── Toolbar button ───────────────────────────────────────────────────────────
function Tb({ onClick, title, danger, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 7, border: "none",
        background: "rgba(255,255,255,0.05)",
        color: danger ? "#ff6b6b" : "#8080aa",
        cursor: "pointer", transition: "all .15s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger
          ? "rgba(255,107,107,0.18)" : "rgba(108,92,231,0.25)";
        e.currentTarget.style.color = danger ? "#ff6b6b" : "#e0e0ff";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.color = danger ? "#ff6b6b" : "#8080aa";
      }}
    >
      {children}
    </button>
  );
}

// ─── Centred overlay ──────────────────────────────────────────────────────────
function Centred({ children }) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 6,
    }}>
      {children}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spin() {
  return (
    <>
      <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: "3px solid rgba(108,92,231,0.2)",
        borderTopColor: "#a29bfe",
        animation: "_spin .8s linear infinite",
      }} />
    </>
  );
}

// ─── Minimal fallback diagram when Mermaid parsing fails ─────────────────────
function buildFallbackMermaid(title, json) {
  const t = (title || "Summary").replace(/['"<>{}[\]]/g, "").slice(0, 40);
  const branches = (json.branches || []).slice(0, 6);
  if (branches.length === 0) {
    return `flowchart LR\n    ROOT["${t}"]\n    ROOT --> A["Could not parse diagram"]\n    ROOT --> B["Try regenerating"]`;
  }
  const lines = [`flowchart LR`, `    ROOT["${t}"]`];
  branches.forEach((b, i) => {
    const label = (b.label || `Topic ${i+1}`).replace(/['"<>{}[\]]/g, "").slice(0, 40);
    lines.push(`    ROOT --> B${i}["${label}"]`);
  });
  return lines.join("\n");
}