import { useEffect, useState } from "react";

export type SiteTrainer = {
  id: string;
  name: string;
  role: string;
  description: string;
  credentials: string;
  imageUrl: string;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  linkedinUrl?: string | null;
  galleryUrls?: string[];
  mediaLinks?: Array<{ type: string; url: string; caption?: string; thumbnailUrl?: string }>;
};

export type SiteProgram = {
  id: string;
  category: string;
  title: string;
  description: string;
  comingSoon?: boolean;
  scheduledDate?: string;
  startMinutes?: number;
  dates: string;
  duration?: string;
  time: string;
  location: string;
  facilitator: string;
  price: string;
  certificationLabel?: string;
  classSize?: string;
  curriculumItems?: string[];
  badgeTitle?: string;
  badgeSubtitle?: string;
  imageUrl?: string;
  stripeLink?: string | null;
  usePayNow: boolean;
  code?: string | null;
  depositAmount?: string | null;
  singlePerson: boolean;
  bookingCount?: number;
  capacity?: number | null;
  spotsRemaining?: number | null;
  soldOut?: boolean;
  finished?: boolean;
  sortOrder?: number;
  status?: "COMING_SOON" | "SCHEDULED" | "FINISHED";
};

export type SiteTeamActivity = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
};

export type SiteContent = {
  trainers: SiteTrainer[];
  classes: Array<{
    id: string;
    classDate?: string;
    day: string;
    dayIndex?: number;
    startMinutes?: number;
    sortOrder?: number;
    time: string;
    classType: string;
    instructor: string;
    level: string;
    location: string;
    price: string;
    stripeLink?: string | null;
    comingSoon: boolean;
  }>;
  programs: {
    flagship: SiteProgram[];
    certifications: SiteProgram[];
    workshops: SiteProgram[];
    events: SiteProgram[];
    ytt: SiteProgram[];
    courses: SiteProgram[];
  };
  teamActivities?: SiteTeamActivity[];
};

export function useSiteContent() {
  const [site, setSite] = useState<SiteContent | null>(null);
  useEffect(() => {
    fetch("/api/site/content")
      .then((r) => r.json())
      .then(setSite)
      .catch(() => setSite(null));
  }, []);
  return site;
}
