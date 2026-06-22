import { Navigate, Route, Routes } from "react-router-dom";
import AdminApp from "./admin/AdminApp";
import { MemberAuthProvider } from "./auth/MemberAuthContext";
import MarketingSite from "./marketing/MarketingSite";
import PlatformApp from "./platform/PlatformApp";

export default function App() {
  return (
    <MemberAuthProvider>
    <Routes>
      <Route path="/" element={<MarketingSite initialPage="about" />} />
      <Route path="/about" element={<Navigate to="/" replace />} />
      <Route path="/corporate" element={<Navigate to="/" replace />} />
      <Route path="/education" element={<Navigate to="/" replace />} />
      <Route path="/events" element={<Navigate to="/" replace />} />
      <Route path="/booking/success" element={<MarketingSite initialPage="events" />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/pricing" element={<PlatformApp />} />
      <Route path="/courses" element={<PlatformApp />} />
      <Route path="/course/:id" element={<PlatformApp />} />
      <Route path="/app/*" element={<PlatformApp />} />
      <Route path="/hr/*" element={<PlatformApp />} />
      <Route path="/trainer/*" element={<PlatformApp />} />
      <Route path="/company/*" element={<PlatformApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </MemberAuthProvider>
  );
}
