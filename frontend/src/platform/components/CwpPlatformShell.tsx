import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Building2, LogOut, Menu, X } from "lucide-react";
import { BrandLogo } from "../../components/BrandLogo";
import { getMarketingSiteUrl } from "../../lib/education";
import { navForRole, type PlatformRole } from "../nav-config";
import { goToMarketingSite, platformLogout } from "../platform-session";
import { useSelectedCompany } from "../selected-company";
import { MessengerWidget } from "./MessengerWidget";

const API_URL = import.meta.env.VITE_API_URL || "";

function CompanySwitcher() {
  const { company, select } = useSelectedCompany();
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("hsos_token") || "";
    fetch(`${API_URL}/api/admin/cwp/form-options`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed"))))
      .then((data) => {
        if (active) setCompanies(Array.isArray(data?.companies) ? data.companies : []);
      })
      .catch(() => active && setCompanies([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mb-5 rounded-2xl border border-[var(--cwp-border)] bg-[var(--cwp-surface)] p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--cwp-text-muted)]">
        <Building2 size={13} strokeWidth={1.75} />
        Viewing company
      </div>
      <select
        value={company?.id || ""}
        disabled={loading}
        onChange={(event) => {
          const id = event.target.value;
          if (!id) {
            select(null);
            return;
          }
          const match = companies.find((c) => c.id === id);
          select(match ? { id: match.id, name: match.name } : null);
        }}
        className="w-full rounded-xl border border-[var(--cwp-border)] bg-[var(--cwp-bg)] px-3 py-2 text-sm font-medium text-[var(--cwp-charcoal)] outline-none focus:border-[var(--cwp-olive)]"
      >
        <option value="">All companies</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

type Props = {
  role: PlatformRole;
  userLabel?: string;
  children: ReactNode;
};

export function CwpPlatformShell({ role, userLabel = "User", children }: Props) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navForRole(role);
  const marketingUrl = getMarketingSiteUrl();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navLinkClass = (active: boolean) =>
    [
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      active
        ? "bg-[var(--cwp-army-muted)] text-[var(--cwp-olive)]"
        : "text-[var(--cwp-text-muted)] hover:bg-[var(--cwp-bg)] hover:text-[var(--cwp-charcoal)]"
    ].join(" ");

  const sidebar = (
    <>
      <div className="mb-6 px-2">
        <BrandLogo
          className="flex items-center gap-2"
          iconClassName="h-10 w-10 object-contain"
          textClassName="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--cwp-charcoal)]"
        />
        <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-[var(--cwp-text-muted)]">Corporate Wellness</p>
        <p className="mt-1 truncate text-sm font-medium text-[var(--cwp-charcoal)]">{userLabel}</p>
      </div>

      {role === "SUPER_ADMIN" && (
        <div className="px-2">
          <CompanySwitcher />
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {items.map(({ label, to, icon: Icon }) => (
          <Link key={to} to={to} className={navLinkClass(location.pathname === to)}>
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 space-y-1 border-t border-[var(--cwp-border)] pt-4">
        <a
          href={marketingUrl}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--cwp-text-muted)] transition-colors hover:bg-[var(--cwp-bg)] hover:text-[var(--cwp-charcoal)]"
        >
          <ArrowLeft size={18} strokeWidth={1.75} />
          Back to Dharma Space
        </a>
        <button
          type="button"
          onClick={platformLogout}
          className="cwp-logout flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--cwp-error)] transition-colors"
        >
          <LogOut size={18} strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="cwp-page min-h-screen">
      <aside className="cwp-sidebar hidden md:flex">{sidebar}</aside>

      <div className="md:pl-[var(--cwp-sidebar-width)]">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--cwp-border)] bg-[var(--cwp-surface)] px-4 py-3 md:hidden">
          <Link to={items[0]?.to || "/app/dashboard"} className="font-medium text-[var(--cwp-charcoal)]">
            CWP
          </Link>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full border border-[var(--cwp-border)]"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button type="button" className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-label="Close menu" />
            <aside className="cwp-sidebar absolute left-0 top-0 flex h-full w-[min(100%,280px)] flex-col shadow-xl">
              {sidebar}
            </aside>
          </div>
        )}

        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>

      <MessengerWidget />
    </div>
  );
}

export { goToMarketingSite, platformLogout };
