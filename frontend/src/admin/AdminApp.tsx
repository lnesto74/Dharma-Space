import "./admin.css";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  AdminInquiriesPage,
  AdminOverviewPage
} from "./SiteAdminPages";
import { AdminSiteProgramsPage } from "./AdminProgramsPage";
import { AdminSiteTrainersPage } from "./AdminTrainersPage";
import { AdminSiteClassesPage } from "./AdminClassesPage";

export default function AdminApp() {
  const auth = useAuth();
  if (!auth.user) return <Navigate to="/" replace />;
  if (auth.user.role !== "SUPER_ADMIN") return <Navigate to="/" replace />;

  return (
    <Routes>
      <Route index element={<AdminOverviewPage auth={auth} />} />
      <Route path="inquiries" element={<AdminInquiriesPage auth={auth} />} />
      <Route path="site/trainers" element={<AdminSiteTrainersPage auth={auth} />} />
      <Route path="site/classes" element={<AdminSiteClassesPage auth={auth} />} />
      <Route path="site/programs" element={<AdminSiteProgramsPage auth={auth} />} />
      <Route path="dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
