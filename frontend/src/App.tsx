import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminApp from "./admin/AdminApp";
import { MemberAuthProvider } from "./auth/MemberAuthContext";
import CorporatePortal from "./corporate/CorporatePortal";
import MarketingSite from "./marketing/MarketingSite";
import PlatformApp from "./platform/PlatformApp";

// The CWP platform (PlatformApp) defines absolute routes (e.g. "/hr/dashboard").
// React Router won't match those if PlatformApp is mounted as a descendant under
// a splat route, so on the shared domain we render it at the router root for any
// platform path instead. AdminApp uses relative paths, so it stays under /admin/*.
const PLATFORM_PREFIXES = ["/app", "/hr", "/trainer", "/company", "/pricing", "/courses", "/course"];

function isPlatformPath(pathname: string) {
  return PLATFORM_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function App() {
  const { pathname } = useLocation();
  const isPortal = pathname === "/portal" || pathname.startsWith("/portal/");

  return (
    <MemberAuthProvider>
      {isPortal ? (
        // Same-origin CWP login entry (employees, HR, trainers, Dharma Admin).
        <CorporatePortal />
      ) : isPlatformPath(pathname) ? (
        <PlatformApp />
      ) : (
        <Routes>
          <Route path="/" element={<MarketingSite initialPage="about" />} />
          <Route path="/about" element={<Navigate to="/" replace />} />
          <Route path="/corporate" element={<Navigate to="/" replace />} />
          <Route path="/education" element={<Navigate to="/" replace />} />
          <Route path="/events" element={<Navigate to="/" replace />} />
          <Route path="/booking/success" element={<MarketingSite initialPage="events" />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </MemberAuthProvider>
  );
}
