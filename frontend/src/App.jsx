import { useEffect, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider }          from "./context/ThemeContext";
import { SummaryOptionsProvider } from "./context/SummaryOptionsContext";
import Sidebar        from "./components/Sidebar";
import AuthPage       from "./pages/AuthPage";
import UploadPage     from "./pages/UploadPage";
import ProcessingPage from "./pages/ProcessingPage";
import SummaryPage    from "./pages/SummaryPage";
import HistoryPage    from "./pages/HistoryPage";
import AdminPage      from "./pages/AdminPage";

function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    const dots = Array.from({ length:55 }, ()=>({ x:Math.random()*w, y:Math.random()*h, vx:(Math.random()-.5)*.45, vy:(Math.random()-.5)*.45, r:Math.random()*1.8+.4 }));
    let raf;
    const draw = () => {
      ctx.clearRect(0,0,w,h);
      for (let i=0;i<dots.length;i++) for (let j=i+1;j<dots.length;j++) {
        const dx=dots[i].x-dots[j].x, dy=dots[i].y-dots[j].y, dist=Math.sqrt(dx*dx+dy*dy);
        if (dist<130) { ctx.beginPath(); ctx.moveTo(dots[i].x,dots[i].y); ctx.lineTo(dots[j].x,dots[j].y); ctx.strokeStyle=`rgba(108,92,231,${.12*(1-dist/130)})`; ctx.stroke(); }
      }
      dots.forEach(d => {
        d.x+=d.vx; d.y+=d.vy;
        if(d.x<0||d.x>w)d.vx*=-1; if(d.y<0||d.y>h)d.vy*=-1;
        ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
        ctx.fillStyle="rgba(108,92,231,0.28)"; ctx.fill();
      });
      raf=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("resize",onResize); };
  }, []);
  return <canvas ref={canvasRef} id="particle-canvas"/>;
}

function BgBlobs() {
  return <><div className="bg-blob blob-1"/><div className="bg-blob blob-2"/><div className="bg-blob blob-3"/></>;
}

function RequireAuth({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/" replace/>;
}
function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/upload" replace/>;
}

function AppShell() {
  return (
    <div style={{ display:"flex", height:"100vh", overflow:"hidden", position:"relative", zIndex:1 }}>
      <Sidebar/>
      <main style={{ flex:1, overflowY:"auto", background:"transparent" }}>
        <Routes>
          <Route path="/upload"          element={<UploadPage/>}/>
          <Route path="/summary/:bookId" element={<SummaryPage/>}/>
          <Route path="/history"         element={<HistoryPage/>}/>
          <Route path="/admin"           element={<RequireAdmin><AdminPage/></RequireAdmin>}/>
          <Route path="*"                element={<Navigate to="/upload" replace/>}/>
        </Routes>
      </main>
    </div>
  );
}

function ProcessingShell() {
  return (
    <div style={{ position:"relative", zIndex:1, minHeight:"100vh" }}>
      <ProcessingPage/>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SummaryOptionsProvider>
        <AuthProvider>
          <ParticleCanvas/>
          <BgBlobs/>
          <div style={{ position:"relative", zIndex:1 }}>
            <Routes>
              <Route path="/"           element={<AuthPage/>}/>
              <Route path="/dashboard"  element={<Navigate to="/upload" replace/>}/>
              <Route path="/processing" element={<RequireAuth><ProcessingShell/></RequireAuth>}/>
              <Route path="/*"          element={<RequireAuth><AppShell/></RequireAuth>}/>
            </Routes>
          </div>
        </AuthProvider>
      </SummaryOptionsProvider>
    </ThemeProvider>
  );
}