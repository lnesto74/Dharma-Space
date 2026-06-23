import type { SiteProgram } from "./site-content";
import { isProgramFinished, programDisplayDate, programDisplayTime } from "./program-schedule";

export type ReserveInfo = {
  programId?: string;
  title: string;
  date: string;
  time: string;
  location: string;
  facilitator: string;
  price: string;
  comingSoon?: boolean;
  soldOut?: boolean;
  finished?: boolean;
  singlePerson?: boolean;
  code?: string;
  depositAmount?: string;
  usePayNow?: boolean;
  stripeLink?: string;
  category?: string;
};

export function programToReserveInfo(program: SiteProgram): ReserveInfo {
  return {
    programId: program.id,
    title: program.title,
    date: programDisplayDate(program),
    time: programDisplayTime(program) || "",
    location: program.location || "Dharma Space Studio",
    facilitator: program.facilitator || "Dharma Space Team",
    price: program.price || "",
    comingSoon: program.comingSoon ?? programDisplayDate(program) === "Coming Soon",
    soldOut: Boolean(program.soldOut),
    finished: isProgramFinished(program),
    singlePerson: program.singlePerson ?? true,
    code: program.code || undefined,
    depositAmount: program.depositAmount || undefined,
    usePayNow: program.usePayNow ?? false,
    stripeLink: program.stripeLink || undefined,
    category: program.category
  };
}

export function isCorporateHost(hostname = window.location.hostname) {
  return hostname.startsWith("corporate.") || hostname === "corporate.dharma-space.com";
}

export function getCorporatePortalUrl() {
  return import.meta.env.PROD ? "https://corporate.dharma-space.com" : "http://corporate.localhost:7011";
}

export function getMarketingSiteUrl() {
  return import.meta.env.PROD ? "https://dharma-space.com" : "http://localhost:7011";
}

export function isMarketingHost(hostname = window.location.hostname) {
  return !isCorporateHost(hostname);
}

export function programActionLabel(info: { comingSoon?: boolean; finished?: boolean; soldOut?: boolean }): string {
  if (info.finished) return "Finished";
  if (info.soldOut) return "Sold out";
  if (info.comingSoon) return "Reserve Spot";
  return "Book";
}
