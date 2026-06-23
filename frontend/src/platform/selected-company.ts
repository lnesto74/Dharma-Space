import { useEffect, useState } from "react";

// Dharma Admin (SUPER_ADMIN) can scope the CWP platform views to a single
// company. The selection is shared across the app via localStorage + a custom
// event so the sidebar switcher and the pages stay in sync within one tab.

export type SelectedCompany = { id: string; name: string } | null;

const STORAGE_KEY = "cwp_admin_company";
const EVENT_NAME = "cwp-company-change";

export function getSelectedCompany(): SelectedCompany {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectedCompany;
    if (parsed && parsed.id) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function setSelectedCompany(company: SelectedCompany) {
  if (company && company.id) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(company));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function useSelectedCompany() {
  const [company, setCompany] = useState<SelectedCompany>(() => getSelectedCompany());

  useEffect(() => {
    const handler = () => setCompany(getSelectedCompany());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return {
    company,
    select: (next: SelectedCompany) => setSelectedCompany(next)
  };
}
