import { Navigate, Route, Routes } from "react-router-dom";
import AdminApp from "./admin/AdminApp";
import MarketingSite from "./marketing/MarketingSite";
import PlatformApp from "./platform/PlatformApp";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MarketingSite initialPage="about" />} />
      <Route path="/about" element={<Navigate to="/" replace />} />
      <Route path="/corporate" element={<MarketingSite initialPage="corporate" />} />
      <Route path="/education" element={<MarketingSite initialPage="education" />} />
      <Route path="/events" element={<MarketingSite initialPage="events" />} />
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
  );
}
