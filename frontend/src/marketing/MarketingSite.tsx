import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  heroImg, yttImg, payNowQR,
  aerialSoundBathImg, glowYogaImg, handpanImg, cookingImg, yachtImg,
  natureWalkImg, creativeMovementImg, padelImg,
  platformImg1, platformImg2, platformImg3
} from "./assets";
import { BrandLogo } from "../components/BrandLogo";
import { InstagramCommunityGallery } from "../components/InstagramCommunityGallery";
import { LIVE_SITE_SPECIALISTS, type LiveSpecialist } from "./specialists-from-live-site";
import { Menu, X, ChevronRight, ChevronDown, MapPin, Mail, Phone, Instagram, MessageCircle, Star, Check, Building2, Leaf, Bell, Wind, Compass, Moon, BookOpen, Activity, Lock, LogOut, User } from "lucide-react";
import { MemberAuthPanel } from "../components/MemberAuthPanel";
import { MemberAccountModal } from "../components/MemberAccountModal";
import { useMemberAuth } from "../auth/MemberAuthContext";
import { createMemberBooking, confirmMemberBookingReturn, updateMemberProfile, fetchMemberBookings, memberHasActiveBooking } from "../lib/member-api";
import { submitInquiry } from "../lib/inquiries";
import { useSiteContent, type SiteProgram } from "../lib/site-content";
import { programToReserveInfo, programActionLabel, type ReserveInfo } from "../lib/education";
import { sortProgramsForDisplay, sortClassesForDisplay } from "../lib/program-schedule";
import {
  clearPendingStripeBooking,
  isStripeBookingReturn,
  readPendingStripeBooking,
  savePendingStripeBooking,
  type PendingStripeBooking
} from "../lib/stripe-booking";

type Page = "about" | "corporate" | "education" | "events";
type EventsSection = "upcoming-events" | "regular-classes";
type EducationSection = "flagship-program" | "courses-certifications" | "workshops-intensives";

const EVENTS_SUBMENU: { label: string; section: EventsSection }[] = [
  { label: "Upcoming Events", section: "upcoming-events" },
  { label: "Regular Classes", section: "regular-classes" },
];

const EDUCATION_SUBMENU: { label: string; section: EducationSection }[] = [
  { label: "Flagship Program", section: "flagship-program" },
  { label: "Courses & Certifications", section: "courses-certifications" },
  { label: "Workshops & Intensives", section: "workshops-intensives" },
];

const IMAGES = {
  hero: "https://images.unsplash.com/photo-1597151429864-c3b530575201?w=1600&h=900&fit=crop&auto=format",
  community: "https://images.unsplash.com/photo-1658227412301-75d89b92aae0?w=1200&h=700&fit=crop&auto=format",
  yogaClass: "https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800&h=600&fit=crop&auto=format",
  womenGroup: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&h=600&fit=crop&auto=format",
  corporate: "https://images.unsplash.com/photo-1758874384683-0accd9fb26ee?w=1200&h=700&fit=crop&auto=format",
  corporateSection: "https://images.unsplash.com/photo-1758691737584-a8f17fb34475?w=1200&h=700&fit=crop&auto=format",
  soundBowl: "https://images.unsplash.com/photo-1623764211727-5a8278662af0?w=800&h=600&fit=crop&auto=format",
  outdoorMed: "https://images.unsplash.com/photo-1602192509154-0b900ee1f851?w=800&h=600&fit=crop&auto=format",
  soloYoga: "https://images.unsplash.com/photo-1562088287-bde35a1ea917?w=800&h=600&fit=crop&auto=format",
  raisingHands: "https://images.unsplash.com/photo-1608405059861-b21a68ae76a2?w=800&h=600&fit=crop&auto=format",
  yogaExercise: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?w=800&h=600&fit=crop&auto=format",
};

const TESTIMONIALS = [
  { name: "Joanne Lim", role: "Head of HR, FinTech Company", text: "Dharma Space transformed how our 300-person team approaches wellbeing. The ROI is unmeasurable — our sick days dropped 40% in one year.", stars: 5 },
  { name: "Thomas Berg", role: "YTT Graduate 2024", text: "The 200-hour training went far beyond asana. It changed how I live, lead, and teach. Sarah and the team are extraordinary educators.", stars: 5 },
  { name: "Mei Lin Chua", role: "Community Member", text: "I found my tribe here. From the sound baths to the cacao ceremonies — every experience has been intentional, warm, and deeply healing.", stars: 5 },
];

const SERVICES = [
  { title: "Corporate Wellness", Icon: Building2, desc: "Tailored on-site and online programs for teams" },
  { title: "Yoga Teacher Training", Icon: Leaf, desc: "200-hour RYT certified professional trainings" },
  { title: "Sound Healing", Icon: Bell, desc: "Tibetan and crystal bowl immersive journeys" },
  { title: "Breathwork", Icon: Wind, desc: "Transformational somatic breathwork circles" },
  { title: "Aerial Yoga", Icon: Compass, desc: "Gravity-defying movement in silk hammocks for strength and release" },
  { title: "Retreats & Events", Icon: Moon, desc: "Immersive community wellness experiences" },
  { title: "Workshops", Icon: BookOpen, desc: "Skill-building sessions in movement and wellness" },
  { title: "Yoga Classes", Icon: Activity, desc: "Weekly hatha, vinyasa, yin, and aerial classes" },
];

const TEAM_ACTIVITIES = [
  { title: "Aerial Sound Bath", desc: "Immersive Tibetan and crystal bowl experience enjoyed from the comfort of aerial hammocks — deep collective relaxation and reset like no other.", img: aerialSoundBathImg },
  { title: "Glow Yoga", desc: "Yoga in a UV-lit studio with neon body paint — under the lamps, every move glows. A playful, high-energy night you won't forget.", img: glowYogaImg },
  { title: "Learning Handpan Class", desc: "Discover the meditative magic of the handpan together — no experience needed, pure presence required.", img: handpanImg },
  { title: "Nature Walk & Mindfulness", desc: "Guided outdoor walk blending movement, breath, and sensory awareness in Singapore's green spaces.", img: natureWalkImg },
  { title: "Healthy Meals Cooking Classes", desc: "Hands-on cooking class focused on healthy, nourishing meals — learn together, eat well, and bond as a team.", img: cookingImg },
  { title: "Creative Movement", desc: "Freeform expressive dance to music — no steps, just authentic movement, joy, and connection.", img: creativeMovementImg },
  { title: "Corporate Yacht Events", desc: "Exclusive sailing experiences on Singapore's waters — the ultimate backdrop for team connection.", img: yachtImg },
  { title: "Padel Team-Building", desc: "Fast-paced, beginner-friendly padel sessions that spark healthy competition and team spirit.", img: padelImg },
];

const CORP_FORMATS = [
  { title: "Onsite Wellness", desc: "We come to your office — yoga, breathwork, meditation and workshops delivered in your space." },
  { title: "Online Programs", desc: "Live-streamed and on-demand sessions accessible anywhere your team works." },
  { title: "Hybrid Programs", desc: "Flexible blend of onsite and digital touchpoints for distributed teams." },
  { title: "Wellness Retreats", desc: "Full-day or multi-day immersive offsite experiences for leadership and all-hands events." },
  { title: "Wellness Days", desc: "Curated single-day wellness activations for company health days and events." },
  { title: "Long-term Partnerships", desc: "Annual wellness ecosystems with dedicated facilitators, tracking, and reporting." },
];

const COURSES = [
  { title: "YACEP 30h Aerial Yoga Teacher Training", dates: "Coming Soon", price: "SGD 1,150", desc: "Discover the art of suspension yoga with rigging, sequencing, and safety certification.", cta: "Reserve Spot" },
  { title: "Breathwork Facilitator Training", dates: "Coming Soon", price: "SGD 1,500", desc: "Certified facilitator training in somatic and trauma informed breathwork techniques.", cta: "Reserve Spot" },
  { title: "Meditation Teacher Training", dates: "Coming Soon", price: "SGD 2,200", desc: "100-hour MTT certification covering mindfulness, breathwork, and non-dual approaches — equipping you to guide others into lasting inner transformation.", cta: "Reserve Spot" },
  { title: "Sound Healing Certification", dates: "Coming Soon", price: "SGD 1,800", desc: "Tibetan bowls, crystal bowls, and vibrational body contact therapy practitioner certification.", cta: "Reserve Spot" },
  { title: "Barre Instructor Certification", dates: "Coming Soon", price: "SGD 1,750", desc: "Contemporary barre methodology blending ballet, pilates, and strength training.", cta: "Reserve Spot" },
];

const WORKSHOPS = [
  { title: "Arm Balance Intensive", date: "September 17, 2026", instructor: "Vera Pleshakova", price: "SGD 5", location: "Dharma Space Studio" },
  { title: "Yin & Sound Bath", date: "Coming Soon", instructor: "", price: "SGD 75", location: "Dharma Space Studio" },
  { title: "Breathwork Journey", date: "Coming Soon", instructor: "", price: "SGD 85", location: "Dharma Space Studio" },
  { title: "Yoga Alignments Workshop", date: "September 24, 2026", instructor: "Vera Pleshakova", price: "SGD 5", location: "Dharma Space Studio" },
];

const EVENTS = [
  { title: "Cacao Ceremony", date: "Coming Soon", time: "", location: "Dharma Space Studio", facilitator: "Sarah Chen", desc: "A sacred circle of heart-opening cacao, breath, movement, and intention setting for the new season.", img: IMAGES.soundBowl, price: "SGD 88" },
  { title: "Ecstatic Dance", date: "Coming Soon", time: "", location: "Junction Studios, Singapore", facilitator: "Community DJ Collective", desc: "Free-form conscious dance journey — no steps, just pure movement and authentic expression.", img: IMAGES.raisingHands, price: "SGD 35" },
  { title: "Sound Healing Journey", date: "Coming Soon", time: "", location: "Dharma Space Studio", facilitator: "Yana An", desc: "Deep vibrational healing with Tibetan and crystal bowls, gongs, and guided relaxation.", img: IMAGES.outdoorMed, price: "SGD 75" },
  { title: "Breathwork Circle", date: "Coming Soon", time: "", location: "Dharma Space Studio", facilitator: "Oxana Shilina", desc: "Transformational connected breathwork for emotional release, clarity, and nervous system reset.", img: IMAGES.yogaClass, price: "SGD 85" },
  { title: "Full Moon Ceremony", date: "Coming Soon", time: "", location: "Labrador Nature Reserve", facilitator: "Vera Pleshakova", desc: "Outdoor full moon ritual with meditation, singing, sharing circles, and intention weaving.", img: IMAGES.womenGroup, price: "SGD 55" },
  { title: "Glow Yoga", date: "Coming Soon", time: "", location: "Dharma Space Studio", facilitator: "Dharma Space Team", desc: "Yoga in a UV-lit studio with neon body paint — under the lamps, every move glows. A playful, high-energy night you won't forget.", img: glowYogaImg, price: "SGD 45" },
];

const CLASS_SCHEDULE = [
  { day: "Monday", time: "7:00 AM", type: "Hatha Yoga", instructor: "Priya Sharma", level: "All Levels", location: "Studio A" },
  { day: "Monday", time: "6:30 PM", type: "Vinyasa Flow", instructor: "Sarah Chen", level: "Intermediate", location: "Studio A" },
  { day: "Tuesday", time: "7:30 AM", type: "Meditation", instructor: "Ryan Ng", level: "All Levels", location: "Studio B" },
  { day: "Wednesday", time: "7:00 AM", type: "Power Core Yoga", instructor: "Priya Sharma", level: "Intermediate", location: "Studio A" },
  { day: "Wednesday", time: "7:00 PM", type: "Yin Yoga", instructor: "Sarah Chen", level: "All Levels", location: "Studio A" },
  { day: "Thursday", time: "6:30 PM", type: "Aerial Yoga", instructor: "Priya Sharma", level: "Beginner–Int.", location: "Aerial Room" },
  { day: "Friday", time: "7:00 AM", type: "Hatha Yoga", instructor: "Sarah Chen", level: "All Levels", location: "Studio A" },
  { day: "Saturday", time: "9:00 AM", type: "Vinyasa Flow", instructor: "Priya Sharma", level: "All Levels", location: "Studio A" },
  { day: "Saturday", time: "11:00 AM", type: "Breathwork", instructor: "David Lim", level: "All Levels", location: "Studio B" },
  { day: "Sunday", time: "9:00 AM", type: "Yin & Meditation", instructor: "Ryan Ng", level: "All Levels", location: "Studio A" },
];

// ── Navigation ────────────────────────────────────────────────────────────────

function Nav({
  page,
  setPage,
  onContact,
  onAccount,
  onEventsSection,
  onEducationSection
}: {
  page: Page;
  setPage: (p: Page) => void;
  onContact: () => void;
  onAccount: () => void;
  onEventsSection: (section: EventsSection) => void;
  onEducationSection: (section: EducationSection) => void;
}) {
  const { isLoggedIn, member } = useMemberAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileEventsOpen, setMobileEventsOpen] = useState(false);
  const [mobileEducationOpen, setMobileEducationOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("hsos_user");
    if (!stored) {
      setIsAdmin(false);
      return;
    }
    try {
      const user = JSON.parse(stored);
      setIsAdmin(user.role === "SUPER_ADMIN");
    } catch {
      setIsAdmin(false);
    }
  }, [adminOpen]);

  const logoutAdmin = () => {
    localStorage.removeItem("hsos_token");
    localStorage.removeItem("hsos_user");
    setIsAdmin(false);
  };

  const handleAdminSuccess = () => {
    setIsAdmin(true);
    setAdminOpen(false);
    navigate("/admin");
  };

  const links: { label: string; key: Page }[] = [
    { label: "About", key: "about" },
    { label: "Corporate", key: "corporate" },
  ];

  const nav = (p: Page) => {
    setPage(p);
    setMenuOpen(false);
    setMobileEventsOpen(false);
    setMobileEducationOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goEventsSection = (section: EventsSection) => {
    onEventsSection(section);
    setMobileEventsOpen(false);
    setMobileEducationOpen(false);
    setMenuOpen(false);
  };

  const goEducationSection = (section: EducationSection) => {
    onEducationSection(section);
    setMobileEducationOpen(false);
    setMobileEventsOpen(false);
    setMenuOpen(false);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 overflow-visible transition-all duration-500 ${scrolled ? "bg-[#FAF8F3]/95 backdrop-blur-md shadow-sm" : "bg-[#FAF8F3]/95 backdrop-blur-md"}`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between overflow-visible">
        <button onClick={() => nav("about")} className="group">
          <BrandLogo
            textClassName="text-[11px] font-medium uppercase tracking-[0.2em] text-[#2A2825]"
          />
        </button>

        <nav className="hidden md:flex items-center gap-8 overflow-visible">
          {links.map(({ label, key }) => (
            <button
              key={key}
              onClick={() => nav(key)}
              className={`text-[13px] tracking-[0.08em] uppercase transition-all duration-200 relative after:absolute after:bottom-[-4px] after:left-0 after:h-px after:bg-[#C4785A] after:transition-all after:duration-300 ${
                page === key ? "text-[#C4785A] after:w-full" : "text-[#2A2825]/70 hover:text-[#2A2825] after:w-0 hover:after:w-full"
              }`}
              style={{ fontFamily: "var(--font-body)" }}
            >
              {label}
            </button>
          ))}
          <div className="nav-submenu-menu group relative">
            <button
              type="button"
              onClick={() => nav("education")}
              className={`flex items-center gap-1.5 text-[13px] tracking-[0.08em] uppercase transition-all duration-200 relative after:absolute after:bottom-[-4px] after:left-0 after:h-px after:bg-[#C4785A] after:transition-all after:duration-300 ${
                page === "education" ? "text-[#C4785A] after:w-full" : "text-[#2A2825]/70 hover:text-[#2A2825] after:w-0 hover:after:w-full"
              }`}
              style={{ fontFamily: "var(--font-body)" }}
              aria-haspopup="true"
            >
              Education
              <ChevronDown size={14} className="nav-submenu-chevron shrink-0 transition-transform duration-200" />
            </button>
            <div className="nav-submenu-dropdown absolute left-1/2 top-full z-[100] w-[260px] -translate-x-1/2 pt-2">
              <div className="border border-[#2A2825]/10 bg-[#FAF8F3] py-2 shadow-xl">
                {EDUCATION_SUBMENU.map(({ label, section }) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => goEducationSection(section)}
                    className="block w-full px-5 py-2.5 text-left text-[12px] tracking-[0.08em] uppercase text-[#2A2825]/75 transition-colors hover:bg-[#F2EBE0] hover:text-[#C4785A]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="nav-submenu-menu group relative">
            <button
              type="button"
              onClick={() => nav("events")}
              className={`flex items-center gap-1.5 text-[13px] tracking-[0.08em] uppercase transition-all duration-200 relative after:absolute after:bottom-[-4px] after:left-0 after:h-px after:bg-[#C4785A] after:transition-all after:duration-300 ${
                page === "events" ? "text-[#C4785A] after:w-full" : "text-[#2A2825]/70 hover:text-[#2A2825] after:w-0 hover:after:w-full"
              }`}
              style={{ fontFamily: "var(--font-body)" }}
              aria-haspopup="true"
            >
              Events
              <ChevronDown size={14} className="nav-submenu-chevron shrink-0 transition-transform duration-200" />
            </button>
            <div className="nav-submenu-dropdown absolute left-1/2 top-full z-[100] w-[240px] -translate-x-1/2 pt-2">
              <div className="border border-[#2A2825]/10 bg-[#FAF8F3] py-2 shadow-xl">
                {EVENTS_SUBMENU.map(({ label, section }) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => goEventsSection(section)}
                    className="block w-full px-5 py-2.5 text-left text-[12px] tracking-[0.08em] uppercase text-[#2A2825]/75 transition-colors hover:bg-[#F2EBE0] hover:text-[#C4785A]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-3 md:gap-4">
          {isAdmin ? (
            <>
              <Link
                to="/admin/inquiries"
                className="hidden md:block px-5 py-2.5 text-[12px] tracking-[0.12em] uppercase text-[#C4785A] hover:text-[#B86848] transition-all duration-300"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Inquiries
              </Link>
              <button
                type="button"
                onClick={logoutAdmin}
                className="hidden md:flex items-center gap-1.5 px-4 py-2.5 text-[12px] tracking-[0.12em] uppercase text-[#2A2825]/70 hover:text-[#2A2825] transition-all duration-300"
                style={{ fontFamily: "var(--font-body)" }}
              >
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-4 py-2.5 text-[12px] tracking-[0.12em] uppercase text-[#2A2825]/70 hover:text-[#2A2825] transition-all duration-300"
              style={{ fontFamily: "var(--font-body)" }}
            >
              <Lock size={14} /> Admin
            </button>
          )}
          <button
            type="button"
            onClick={onAccount}
            className="hidden md:flex items-center gap-1.5 px-4 py-2.5 text-[12px] tracking-[0.12em] uppercase text-[#2A2825]/70 hover:text-[#2A2825] transition-all duration-300"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <User size={14} /> {isLoggedIn ? (member?.name?.split(" ")[0] || "Account") : "Sign in"}
          </button>
          <button
            onClick={onContact}
            className="hidden md:block px-6 py-2.5 text-[12px] tracking-[0.12em] uppercase border border-[#C4785A] text-[#C4785A] hover:bg-[#C4785A] hover:text-white transition-all duration-300"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Contact Us
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-[#2A2825] p-1">
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-[#FAF8F3] border-t border-[#2A2825]/8 px-6 py-6 flex flex-col gap-5">
          {links.map(({ label, key }) => (
            <button key={key} onClick={() => nav(key)} className={`text-left text-[14px] tracking-[0.1em] uppercase ${page === key ? "text-[#C4785A]" : "text-[#2A2825]/70"}`} style={{ fontFamily: "var(--font-body)" }}>
              {label}
            </button>
          ))}
          <div>
            <button
              type="button"
              onClick={() => setMobileEducationOpen((open) => !open)}
              className={`flex w-full items-center justify-between text-left text-[14px] tracking-[0.1em] uppercase ${page === "education" ? "text-[#C4785A]" : "text-[#2A2825]/70"}`}
              style={{ fontFamily: "var(--font-body)" }}
              aria-expanded={mobileEducationOpen}
            >
              Education
              <ChevronDown size={16} className={`transition-transform duration-200 ${mobileEducationOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileEducationOpen && (
              <div className="mt-3 flex flex-col gap-3 border-l border-[#C4785A]/30 pl-4">
                {EDUCATION_SUBMENU.map(({ label, section }) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => goEducationSection(section)}
                    className="text-left text-[13px] tracking-[0.08em] uppercase text-[#2A2825]/65 hover:text-[#C4785A]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => setMobileEventsOpen((open) => !open)}
              className={`flex w-full items-center justify-between text-left text-[14px] tracking-[0.1em] uppercase ${page === "events" ? "text-[#C4785A]" : "text-[#2A2825]/70"}`}
              style={{ fontFamily: "var(--font-body)" }}
              aria-expanded={mobileEventsOpen}
            >
              Events
              <ChevronDown size={16} className={`transition-transform duration-200 ${mobileEventsOpen ? "rotate-180" : ""}`} />
            </button>
            {mobileEventsOpen && (
              <div className="mt-3 flex flex-col gap-3 border-l border-[#C4785A]/30 pl-4">
                {EVENTS_SUBMENU.map(({ label, section }) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => goEventsSection(section)}
                    className="text-left text-[13px] tracking-[0.08em] uppercase text-[#2A2825]/65 hover:text-[#C4785A]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={() => { onAccount(); setMenuOpen(false); }} className="text-left text-[14px] tracking-[0.1em] uppercase text-[#2A2825]/70 flex items-center gap-2" style={{ fontFamily: "var(--font-body)" }}>
            <User size={14} /> {isLoggedIn ? "My account" : "Sign in"}
          </button>
          <button onClick={() => { onContact(); setMenuOpen(false); }} className="mt-2 px-6 py-3 text-[12px] tracking-[0.12em] uppercase border border-[#C4785A] text-[#C4785A]" style={{ fontFamily: "var(--font-body)" }}>
            Contact Us
          </button>
          {isAdmin ? (
            <>
              <Link to="/admin/inquiries" onClick={() => setMenuOpen(false)} className="text-left text-[14px] tracking-[0.1em] uppercase text-[#C4785A]" style={{ fontFamily: "var(--font-body)" }}>
                Inquiries
              </Link>
              <button type="button" onClick={() => { logoutAdmin(); setMenuOpen(false); }} className="text-left text-[14px] tracking-[0.1em] uppercase text-[#2A2825]/70" style={{ fontFamily: "var(--font-body)" }}>
                Admin Logout
              </button>
            </>
          ) : (
            <button type="button" onClick={() => { setAdminOpen(true); setMenuOpen(false); }} className="text-left text-[14px] tracking-[0.1em] uppercase text-[#2A2825]/70 flex items-center gap-2" style={{ fontFamily: "var(--font-body)" }}>
              <Lock size={14} /> Admin Login
            </button>
          )}
        </div>
      )}

      {adminOpen && <AdminLoginModal onClose={() => setAdminOpen(false)} onSuccess={handleAdminSuccess} />}
    </header>
  );
}

// ── About Page ────────────────────────────────────────────────────────────────

type SpecialistCard = LiveSpecialist;

function AboutPage({ setPage, specialists }: { setPage: (p: Page) => void; specialists: SpecialistCard[] }) {
  return (
    <div>
      {/* Hero */}
      <section className="relative h-screen min-h-[600px] flex items-end pb-20 overflow-hidden bg-[#2A2825]">
        <img src={IMAGES.hero} alt="Wellness community in practice" className="absolute inset-0 w-full h-full object-cover object-center opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1815]/80 via-[#1A1815]/20 to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 w-full">
          <div className="max-w-3xl">
            <p className="text-[#D4B896] text-[11px] tracking-[0.3em] uppercase mb-6" style={{ fontFamily: "var(--font-body)" }}>
              Corporate Wellness · Training · Events
            </p>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-normal text-white leading-[1.1] mb-8" style={{ fontFamily: "var(--font-display)" }}>
              Where Wellness Meets Purpose, and Community Feels Like Home.
            </h1>
            <p className="text-white/70 text-lg leading-relaxed mb-10 max-w-xl" style={{ fontFamily: "var(--font-body)" }}>
              DHARMA SPACE is Singapore&apos;s premier wellness education and corporate wellness provider — uniting mental wellbeing, movement, mindfulness, and holistic human performance.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setPage("corporate")}
                className="px-8 py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center gap-3"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Explore Corporate Wellness <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setPage("education")}
                className="px-8 py-4 border border-white/50 text-white text-[12px] tracking-[0.15em] uppercase hover:border-white hover:bg-white/10 transition-all duration-300"
                style={{ fontFamily: "var(--font-body)" }}
              >
                View Our Courses
              </button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronDown size={20} />
        </div>
      </section>

      {/* About Section */}
      <section className="py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>About Dharma Space</p>
            <h2 className="text-3xl md:text-5xl font-normal text-[#2A2825] leading-[1.15] mb-8" style={{ fontFamily: "var(--font-display)" }}>
              A Space Where Ancient Wisdom Meets Modern Life.
            </h2>
            <p className="text-[#7A7468] leading-[1.9] mb-6" style={{ fontFamily: "var(--font-body)" }}>
              Founded in Singapore, Dharma Space was born from a deep belief that wellness is not a luxury — it is a foundation. We are a wellness education company and corporate wellness provider dedicated to creating transformative experiences through movement, mindfulness, education, and human connection.
            </p>
            <p className="text-[#7A7468] leading-[1.9]" style={{ fontFamily: "var(--font-body)" }}>
              We combine the rigour of modern science with the depth of ancient wellness practices to support physical wellbeing, mental health, stress resilience, conscious community, and sustainable lifestyle transformation.
            </p>
          </div>
          <div className="relative">
            <img src={IMAGES.community} alt="Dharma Space community gathering" className="w-full aspect-[4/3] object-cover" />
            <div className="absolute -bottom-6 -left-6 bg-[#C4785A] text-white p-8 hidden lg:block">
              <div className="text-4xl font-light mb-1" style={{ fontFamily: "var(--font-display)" }}>5+</div>
              <div className="text-[11px] tracking-[0.15em] uppercase opacity-80" style={{ fontFamily: "var(--font-body)" }}>Years in Singapore</div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="bg-[#2A2825] py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Our Philosophy</p>
            <h2 className="text-3xl md:text-5xl font-normal text-white leading-[1.15] max-w-3xl mx-auto" style={{ fontFamily: "var(--font-display)" }}>
              Wellness is not a destination. It is how we live.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-white/8">
            {[
              { title: "Whole-Person Wellbeing", body: "We address mind, body, and spirit together — because lasting transformation requires tending to all three, not just the physical." },
              { title: "Community & Belonging", body: "Healing accelerates in community. We build spaces where people feel genuinely seen, held, and connected to something larger than themselves." },
              { title: "Education as Liberation", body: "When people understand the why behind a practice, they own it for life. Our education approach creates conscious, empowered wellness leaders." },
              { title: "Ancient Meets Modern", body: "We honour thousands of years of wellness wisdom and integrate the latest findings in neuroscience, psychology, and human performance." },
              { title: "Workplace Integration", body: "Wellbeing that lives only outside the office is incomplete. We partner with organisations to weave wellness into the fabric of daily work life." },
              { title: "Sustainable Practice", body: "Quick fixes fade. We design programs that create lasting behavioural change — so wellness becomes a way of being, not a trend to follow." },
            ].map(({ title, body }) => (
              <div key={title} className="bg-[#2A2825] p-10 border border-white/6 hover:bg-[#322F2A] transition-colors duration-300">
                <div className="w-8 h-px bg-[#C4785A] mb-6" />
                <h3 className="text-white text-lg font-normal mb-4" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
                <p className="text-white/50 text-[14px] leading-[1.85]" style={{ fontFamily: "var(--font-body)" }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>What We Offer</p>
          <h2 className="text-3xl md:text-5xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
            Our Services
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map(({ title, Icon, desc }) => (
            <div key={title} className="bg-[#F2EBE0] p-8 group hover:bg-[#C4785A] transition-all duration-400 cursor-default">
              <div className="mb-5 text-[#C4785A] group-hover:text-white transition-colors duration-300"><Icon size={22} strokeWidth={1.5} /></div>
              <h3 className="text-[#2A2825] group-hover:text-white font-medium text-base mb-3 transition-colors duration-300" style={{ fontFamily: "var(--font-body)" }}>{title}</h3>
              <p className="text-[#7A7468] group-hover:text-white/80 text-[13px] leading-[1.75] transition-colors duration-300" style={{ fontFamily: "var(--font-body)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Specialists */}
      <section className="bg-[#F2EBE0] py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Our Team</p>
            <h2 className="text-3xl md:text-5xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
              Meet Our Specialists
            </h2>
          </div>
          <div className="-mx-6 lg:-mx-12 px-6 lg:px-12 overflow-x-auto pb-2 [scrollbar-width:thin]">
            <div className="flex gap-8 min-w-max snap-x snap-mandatory">
            {specialists.map(({ name, role, desc, cert, img, portraitFocus }) => (
              <div key={name} className="group cursor-default w-[260px] sm:w-[280px] flex-shrink-0 snap-start">
                <div className="relative overflow-hidden mb-5 bg-[#D4B896]">
                  <img
                    src={img}
                    alt={name}
                    className={`w-full aspect-[3/4] object-cover group-hover:scale-105 transition-transform duration-700 ${portraitFocus && !img.includes("/api/media/trainers/") ? "object-[center_15%] scale-125" : "object-top"}`}
                  />
                  <div className="absolute inset-0 bg-[#C4785A]/0 group-hover:bg-[#C4785A]/10 transition-all duration-400" />
                </div>
                <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-1.5" style={{ fontFamily: "var(--font-body)" }}>{role}</p>
                <h3 className="text-[#2A2825] text-lg font-normal mb-2" style={{ fontFamily: "var(--font-display)" }}>{name}</h3>
                <p className="text-[#7A7468] text-[13px] leading-[1.75] mb-3" style={{ fontFamily: "var(--font-body)" }}>{desc}</p>
                <p className="text-[11px] text-[#2A2825]/40 tracking-wide" style={{ fontFamily: "var(--font-body)" }}>{cert}</p>
              </div>
            ))}
            <div className="shrink-0 w-6" aria-hidden />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Community Voices</p>
          <h2 className="text-3xl md:text-5xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
            What Our Community Says
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map(({ name, role, text, stars }) => (
            <div key={name} className="bg-[#F2EBE0] p-10">
              <div className="flex gap-1 mb-6">
                {Array(stars).fill(0).map((_, i) => <Star key={i} size={13} fill="#C4785A" className="text-[#C4785A]" />)}
              </div>
              <p className="text-[#2A2825] text-[15px] leading-[1.85] mb-8 italic" style={{ fontFamily: "var(--font-display)" }}>&ldquo;{text}&rdquo;</p>
              <div>
                <p className="font-medium text-[#2A2825] text-sm" style={{ fontFamily: "var(--font-body)" }}>{name}</p>
                <p className="text-[#7A7468] text-[12px]" style={{ fontFamily: "var(--font-body)" }}>{role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Community gallery strip */}
      <section className="pb-28">
        <InstagramCommunityGallery variant="strip" limit={5} showFollowLink={false} />
      </section>
    </div>
  );
}

// ── Corporate Page ─────────────────────────────────────────────────────────────

function CorporatePage({ onContact }: { onContact: () => void }) {
  return (
    <div>
      {/* Hero */}
      <section className="relative h-[80vh] min-h-[560px] flex items-center overflow-hidden bg-[#2A2825]">
        <img src={IMAGES.corporate} alt="Corporate wellness at the office" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1815]/90 to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
          <p className="text-[#D4B896] text-[11px] tracking-[0.3em] uppercase mb-6" style={{ fontFamily: "var(--font-body)" }}>For Organisations</p>
          <h1 className="text-4xl md:text-6xl font-normal text-white leading-[1.1] mb-6 max-w-2xl" style={{ fontFamily: "var(--font-display)" }}>
            Corporate Wellness Reimagined.
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-xl mb-10" style={{ fontFamily: "var(--font-body)" }}>
            Science-backed wellness programs designed to improve employee wellbeing, engagement, productivity, and workplace culture.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={onContact} className="px-8 py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center gap-3" style={{ fontFamily: "var(--font-body)" }}>
              Book Consultation <ChevronRight size={14} />
            </button>
            <button onClick={onContact} className="px-8 py-4 border border-white/50 text-white text-[12px] tracking-[0.15em] uppercase hover:bg-white/10 transition-all duration-300" style={{ fontFamily: "var(--font-body)" }}>
              Request Proposal
            </button>
          </div>
        </div>
      </section>

      {/* Programs */}
      <section className="py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-20 items-start">
          <div>
            <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>What We Offer</p>
            <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15] mb-8" style={{ fontFamily: "var(--font-display)" }}>
              Tailored Wellness Solutions for Modern Organisations.
            </h2>
            <p className="text-[#7A7468] leading-[1.9] mb-8" style={{ fontFamily: "var(--font-body)" }}>
              We design custom corporate wellness ecosystems — from single-session activations to year-long employee wellbeing partnerships. Every program is built around your organisation&apos;s culture, challenges, and goals.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {["Yoga & Movement", "Breathwork", "Mental Health Workshops", "Leadership Coaching", "Nutrition Talks", "Meditation Programs", "Team Bonding Wellness", "Stress Management", "Sound Healing Sessions", "Various Team Building Activities", "Corporate Events Organisation"].map(s => (
                <div key={s} className="flex items-center gap-2.5">
                  <Check size={13} className="text-[#C4785A] flex-shrink-0" />
                  <span className="text-[13px] text-[#2A2825]/80" style={{ fontFamily: "var(--font-body)" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img src={IMAGES.corporateSection} alt="Team wellness session" className="w-full aspect-[3/4] object-cover col-span-2" />
          </div>
        </div>
      </section>

      {/* Why Choose */}
      <section className="bg-[#F2EBE0] py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>The Business Case</p>
            <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
              Why Companies Choose Dharma Space
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { stat: "↓ 40%", label: "Reduction in sick days", desc: "Organisations with active wellness programs report significantly fewer sick day absences." },
              { stat: "↑ 35%", label: "Employee engagement scores", desc: "Teams feel more connected, valued, and engaged when their wellbeing is prioritised." },
              { stat: "↓ 28%", label: "Burnout-related turnover", desc: "Preventive wellness programs reduce costly attrition from executive burnout." },
              { stat: "↑ 24%", label: "Productivity output", desc: "Mindfulness training measurably improves focus, decision quality, and output." },
              { stat: "3×", label: "ROI on wellness investment", desc: "Research shows every $1 spent on employee wellness returns $3 in productivity gains." },
              { stat: "↑ 42%", label: "Leadership effectiveness", desc: "Mindful leaders make better decisions, communicate more clearly, and inspire greater trust." },
            ].map(({ stat, label, desc }) => (
              <div key={label} className="bg-white p-10">
                <div className="text-3xl font-light text-[#C4785A] mb-3" style={{ fontFamily: "Montserrat, sans-serif" }}>{stat}</div>
                <h3 className="font-medium text-[#2A2825] mb-3 text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-body)" }}>{label}</h3>
                <p className="text-[#7A7468] text-[13px] leading-[1.8]" style={{ fontFamily: "var(--font-body)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform */}
      <section className="py-28 bg-[#2A2825]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Digital Platform</p>
              <h2 className="text-3xl md:text-4xl font-normal text-white leading-[1.15] mb-8" style={{ fontFamily: "var(--font-display)" }}>
                A Complete Employee Wellness Engagement Platform.
              </h2>
              <p className="text-white/60 leading-[1.9] mb-8" style={{ fontFamily: "var(--font-body)" }}>
                Our proprietary platform gives HR teams full visibility into wellness engagement — and gives employees a seamless booking and progress experience.
              </p>
              {["Employee session booking & attendance tracking", "Wellness engagement analytics & HR reporting", "Department wellness leaderboards", "Achievement badges & wellness journey levels", "Individual wellness score dashboards", "Automated wellness reminders & nudges"].map(f => (
                <div key={f} className="flex items-center gap-3 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#C4785A] flex-shrink-0" />
                  <span className="text-white/70 text-[14px]" style={{ fontFamily: "var(--font-body)" }}>{f}</span>
                </div>
              ))}
              <a
                href={import.meta.env.PROD ? "https://corporate.dharma-space.com" : "http://corporate.localhost:7011"}
                className="inline-flex items-center gap-2 mt-8 px-6 py-3 border border-[#C4785A] text-[#C4785A] text-[11px] tracking-[0.15em] uppercase hover:bg-[#C4785A] hover:text-white transition-all duration-300"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Client Login <ChevronRight size={14} />
              </a>
            </div>
            {/* Platform Screenshots */}
            <div className="relative flex flex-col gap-3">
              {/* Large top screenshot */}
              <div className="overflow-hidden border border-white/10 shadow-2xl">
                <img src={platformImg1} alt="Platform dashboard" className="w-full object-cover object-top" style={{ maxHeight: "260px" }} />
              </div>
              {/* Two smaller screenshots side by side */}
              <div className="grid grid-cols-2 gap-3">
                <div className="overflow-hidden border border-white/10 shadow-xl">
                  <img src={platformImg2} alt="Platform analytics" className="w-full object-cover object-top" style={{ maxHeight: "160px" }} />
                </div>
                <div className="overflow-hidden border border-white/10 shadow-xl">
                  <img src={platformImg3} alt="Platform employee view" className="w-full object-cover object-top" style={{ maxHeight: "160px" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Program Formats */}
      <section className="py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Program Formats</p>
          <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
            Designed to Fit Your Organisation
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CORP_FORMATS.map(({ title, desc }) => (
            <div key={title} className="border border-[#2A2825]/10 p-10 hover:border-[#C4785A] transition-colors duration-300 group">
              <div className="w-6 h-px bg-[#C4785A] mb-6" />
              <h3 className="text-[#2A2825] font-medium mb-4" style={{ fontFamily: "var(--font-body)" }}>{title}</h3>
              <p className="text-[#7A7468] text-[13px] leading-[1.85]" style={{ fontFamily: "var(--font-body)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Team Building Activities */}
      <section className="py-28 bg-[#F2EBE0] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 mb-14">
          <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Team Building</p>
          <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
            Activities Your Team Will Love
          </h2>
        </div>
        <div
          className="flex gap-4 overflow-x-auto pb-4 px-6 lg:px-12 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {TEAM_ACTIVITIES.map(({ title, desc, img }) => (
            <div
              key={title}
              className="snap-start shrink-0 w-72 h-[420px] relative overflow-hidden group cursor-default"
            >
              <img src={img} alt={title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1815]/85 via-[#1A1815]/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-7">
                <h3 className="text-white text-lg font-normal mb-2 leading-snug" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
                <p className="text-white/70 text-[12px] leading-[1.75] opacity-0 group-hover:opacity-100 transition-opacity duration-400 max-h-0 group-hover:max-h-32 overflow-hidden transition-all" style={{ fontFamily: "var(--font-body)" }}>{desc}</p>
              </div>
            </div>
          ))}
          <div className="shrink-0 w-6" />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#C4785A] py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-normal text-white leading-[1.15] mb-6" style={{ fontFamily: "var(--font-display)" }}>
            Build a Healthier Workplace Culture.
          </h2>
          <p className="text-white/80 text-lg leading-relaxed mb-10" style={{ fontFamily: "var(--font-body)" }}>
            Let&apos;s design a wellness program your team will actually use — and that delivers measurable impact on your organisation&apos;s performance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onContact} className="px-8 py-4 bg-white text-[#C4785A] text-[12px] tracking-[0.15em] uppercase hover:bg-[#FAF8F3] transition-colors duration-300 flex items-center gap-3 justify-center" style={{ fontFamily: "var(--font-body)" }}>
              Book Consultation <ChevronRight size={14} />
            </button>
            <button onClick={onContact} className="px-8 py-4 border border-white/60 text-white text-[12px] tracking-[0.15em] uppercase hover:bg-white/10 transition-all duration-300" style={{ fontFamily: "var(--font-body)" }}>
              Request Proposal
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Education Page ─────────────────────────────────────────────────────────────

function EducationPage({
  onContact,
  onReserve,
  flagship,
  certifications,
  workshops,
  scrollTarget,
  onScrollTargetHandled
}: {
  onContact: () => void;
  onReserve: (info: ReserveInfo) => void;
  flagship: SiteProgram | null;
  certifications: SiteProgram[];
  workshops: SiteProgram[];
  scrollTarget?: EducationSection | null;
  onScrollTargetHandled?: () => void;
}) {
  const curriculum = flagship?.curriculumItems?.length
    ? flagship.curriculumItems
    : ["Yoga Philosophy & History", "Anatomy & Physiology", "Teaching Methodology", "Alignment & Adjustments", "Breathwork (Pranayama)", "Meditation Techniques", "Practicum Teaching Hours", "Ayurvedic Lifestyle"];

  useEffect(() => {
    if (!scrollTarget) return;
    const scroll = () => {
      document.getElementById(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      onScrollTargetHandled?.();
    };
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  }, [scrollTarget, onScrollTargetHandled]);

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[80vh] min-h-[560px] flex items-center overflow-hidden bg-[#2A2825]">
        <img src={heroImg} alt="Yoga teacher training practice" className="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1815]/90 to-transparent" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
          <p className="text-[#D4B896] text-[11px] tracking-[0.3em] uppercase mb-6" style={{ fontFamily: "var(--font-body)" }}>Wellness Education</p>
          <h1 className="text-4xl md:text-6xl font-normal text-white leading-[1.1] mb-6 max-w-2xl" style={{ fontFamily: "var(--font-display)" }}>
            Education That Transforms Practice Into Purpose.
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-xl" style={{ fontFamily: "var(--font-body)" }}>
            Professional wellness education, yoga teacher trainings, certifications, and workshops — designed for students and practitioners.
          </p>
        </div>
      </section>

      {/* Flagship Program */}
      <section id="flagship-program" className="scroll-mt-24 py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-20 items-start">
          <div>
            <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Flagship Program</p>
            <h2 className="text-3xl md:text-5xl font-normal text-[#2A2825] leading-[1.15] mb-6" style={{ fontFamily: "var(--font-display)" }}>
              {flagship?.title || "200-Hour Yoga Teacher Training"}
            </h2>
            <p className="text-[#7A7468] leading-[1.9] mb-8" style={{ fontFamily: "var(--font-body)" }}>
              {flagship?.description || "Our signature 200-hour Yoga Alliance certified teacher training is a comprehensive, immersive journey that prepares you to teach confidently, live purposefully, and lead with wisdom."}
            </p>
            <div className="grid grid-cols-2 gap-4 mb-10">
              {curriculum.map((m) => (
                <div key={m} className="flex items-start gap-2.5">
                  <Check size={13} className="text-[#C4785A] mt-0.5 flex-shrink-0" />
                  <span className="text-[13px] text-[#2A2825]/80" style={{ fontFamily: "var(--font-body)" }}>{m}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#F2EBE0] p-8 mb-8">
              <div className="grid grid-cols-2 gap-y-5">
                {[["Next Intake", flagship?.dates || "Sep 11 – Oct 6, 2026"], ["Duration", flagship?.duration || "8 Weeks"], ["Schedule", flagship?.time || "Thu 7–9PM (Online) · Fri 6:30–9:30PM · Sat & Sun 2–9PM"], ["Investment", flagship?.price || "SGD 3,600"], ["Certification", flagship?.certificationLabel || "Yoga Alliance RYT-200"], ["Class Size", flagship?.classSize || "Maximum 25 Students"]].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-[10px] tracking-[0.2em] text-[#C4785A] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
                    <p className="text-[#2A2825] text-sm font-medium" style={{ fontFamily: "var(--font-body)" }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>
            {(() => {
              const flagshipReserve = flagship ? programToReserveInfo(flagship) : null;
              const flagshipFinished = Boolean(flagshipReserve?.finished);
              return (
            <button
              onClick={() => onReserve(flagshipReserve ?? {
                title: "200-Hour Yoga Teacher Training",
                date: "Sep 11 – Oct 6, 2026",
                time: "Thu 7–9PM (Online) · Fri 6:30–9:30PM · Sat & Sun 2–9PM",
                location: "Dharma Space Studio",
                facilitator: "Sarah Chen",
                price: "SGD 3,600",
                singlePerson: true,
                code: "200TTC",
                depositAmount: "SGD 1,200",
                usePayNow: true,
                category: "FLAGSHIP"
              })}
              disabled={flagshipFinished}
              className={`px-8 py-4 text-[12px] tracking-[0.15em] uppercase transition-colors duration-300 flex items-center gap-3 ${flagshipFinished ? "bg-[#7A7468] text-white cursor-not-allowed" : "bg-[#C4785A] text-white hover:bg-[#B86848]"}`}
              style={{ fontFamily: "var(--font-body)" }}
            >
              {flagshipFinished ? "Finished" : programActionLabel(flagshipReserve ?? { comingSoon: false })} <ChevronRight size={14} />
            </button>
              );
            })()}
          </div>
          <div className="relative lg:sticky lg:top-28">
            <img src={flagship?.imageUrl || yttImg} alt="Yoga teacher training class" className="w-full aspect-[4/5] object-cover" />
            <div className="absolute -bottom-6 -right-6 bg-[#2A2825] text-white p-8 hidden lg:block">
              <div className="text-3xl font-light mb-1" style={{ fontFamily: "var(--font-display)" }}>{flagship?.badgeTitle || "RYT 200"}</div>
              <div className="text-[10px] tracking-[0.15em] uppercase opacity-60" style={{ fontFamily: "var(--font-body)" }}>{flagship?.badgeSubtitle || "Yoga Alliance Certified"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section id="courses-certifications" className="scroll-mt-24 bg-[#F2EBE0] py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-16">
            <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Certifications</p>
            <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
              Other Courses & Certifications
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortProgramsForDisplay(
              certifications.length
                ? certifications
                : COURSES.map((c) => ({
                    id: c.title,
                    title: c.title,
                    description: c.desc,
                    dates: c.dates,
                    price: c.price,
                    time: "",
                    location: "Dharma Space Studio",
                    facilitator: "Dharma Space Team",
                    usePayNow: false,
                    singlePerson: true,
                    category: "CERTIFICATION",
                    comingSoon: c.dates === "Coming Soon"
                  } as SiteProgram))
            ).map((program) => {
              const reserve = programToReserveInfo(program);
              return (
              <div key={program.id || program.title} className="bg-white p-8 flex flex-col">
                <h3 className="text-[#2A2825] text-lg font-normal mb-3" style={{ fontFamily: "var(--font-display)" }}>{program.title}</h3>
                <p className="text-[#7A7468] text-[13px] leading-[1.8] mb-6 flex-1" style={{ fontFamily: "var(--font-body)" }}>{program.description}</p>
                <div className="border-t border-[#2A2825]/8 pt-5 flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[10px] tracking-[0.2em] text-[#C4785A] uppercase mb-0.5" style={{ fontFamily: "var(--font-body)" }}>Dates</p>
                    <p className="text-[#2A2825] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{program.dates}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-[0.2em] text-[#C4785A] uppercase mb-0.5" style={{ fontFamily: "var(--font-body)" }}>Investment</p>
                    <p className="text-[#2A2825] font-medium text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{program.price}</p>
                  </div>
                </div>
                <button
                  onClick={() => onReserve(reserve)}
                  disabled={reserve.finished}
                  className={`w-full py-3 border text-[11px] tracking-[0.15em] uppercase transition-all duration-300 ${reserve.finished ? "border-[#7A7468] text-[#7A7468] cursor-not-allowed" : "border-[#C4785A] text-[#C4785A] hover:bg-[#C4785A] hover:text-white"}`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {programActionLabel(reserve)}
                </button>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workshops */}
      <section id="workshops-intensives" className="scroll-mt-24 py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Upcoming</p>
          <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
            Workshops & Intensives
          </h2>
        </div>
        <div className="space-y-3">
          {sortProgramsForDisplay(
            workshops.length
              ? workshops
              : WORKSHOPS.map((w) => ({
                  id: w.title,
                  title: w.title,
                  dates: w.date,
                  scheduledDate: w.date.includes("2026") ? "2026-09-24" : "",
                  facilitator: w.instructor,
                  price: w.price,
                  location: w.location,
                  time: "",
                  description: "",
                  usePayNow: false,
                  singlePerson: true,
                  category: "WORKSHOP",
                  comingSoon: w.date === "Coming Soon"
                } as SiteProgram))
          ).map((program) => {
            const reserve = programToReserveInfo(program);
            return (
            <div key={program.id || program.title} className="flex flex-col sm:flex-row sm:items-center justify-between p-7 border border-[#2A2825]/8 hover:border-[#C4785A] transition-colors duration-300 group gap-4">
              <div className="flex-1">
                <h3 className="text-[#2A2825] font-medium mb-1" style={{ fontFamily: "var(--font-body)" }}>{program.title}</h3>
                <p className="text-[#7A7468] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{program.dates}{program.facilitator ? ` · ${program.facilitator}` : ""} · {program.location}</p>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-[#2A2825] font-medium" style={{ fontFamily: "var(--font-body)" }}>{program.price}</span>
                <button
                  onClick={() => onReserve(reserve)}
                  disabled={reserve.soldOut || reserve.finished}
                  className={`px-5 py-2.5 text-[11px] tracking-[0.12em] uppercase transition-all duration-300 whitespace-nowrap ${reserve.soldOut || reserve.finished ? "border border-[#7A7468] text-[#7A7468] cursor-not-allowed" : "border border-[#C4785A] text-[#C4785A] hover:bg-[#C4785A] hover:text-white"}`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {programActionLabel(reserve)}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </section>

      {/* Philosophy */}
      <section className="bg-[#2A2825] py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-8" style={{ fontFamily: "var(--font-body)" }}>Education Philosophy</p>
          <h2 className="text-3xl md:text-4xl font-normal text-white leading-[1.4] italic" style={{ fontFamily: "var(--font-display)" }}>
            &ldquo;We combine ancient wisdom with modern science, trauma-awareness with professional rigour — to create wellness leaders who transform not just bodies, but lives.&rdquo;
          </h2>
          <div className="mt-10 w-12 h-px bg-[#C4785A] mx-auto" />
        </div>
      </section>

    </div>
  );
}

// ── Events Page ────────────────────────────────────────────────────────────────

function ClassScheduleNotifyModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", interest: "" });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    try {
      await submitInquiry({
        type: "class_schedule_notify",
        name: form.name,
        email: form.email,
        phone: formatPhone(form.phone),
        notes: form.interest || undefined,
        context: {
          title: "Regular Classes — Weekly Schedule",
          bookingType: "Notify me — schedule interest",
          programCategory: "REGULAR_CLASS",
          location: "Dharma Space Studio"
        }
      });
      setSent(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-0 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#FAF8F3] w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-start justify-between p-8 border-b border-[#2A2825]/8">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>Regular Classes</p>
            <h2 className="text-2xl font-normal text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>Notify me</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[#2A2825]/40 hover:text-[#2A2825] transition-colors p-1 mt-1"><X size={20} /></button>
        </div>

        {sent ? (
          <ConfirmedStep name={form.name} title="Regular Classes" variant="waitlist" />
        ) : (
          <div className="p-8">
            <p className="text-[#7A7468] text-[14px] leading-relaxed mb-6" style={{ fontFamily: "var(--font-body)" }}>
              We&apos;re finalising the weekly class timetable. Share your details and we&apos;ll email you when booking opens.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { label: "Full Name", key: "name", type: "text", placeholder: "Your name" },
                { label: "Email Address", key: "email", type: "email", placeholder: "your@email.com" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    required
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
                    style={{ fontFamily: "var(--font-body)" }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Phone / WhatsApp</label>
                <div className="flex bg-[#EDE5D8] focus-within:ring-1 focus-within:ring-[#C4785A]">
                  <span className="px-4 py-3 text-[14px] text-[#2A2825]/60 select-none border-r border-[#2A2825]/10 shrink-0" style={{ fontFamily: "var(--font-body)" }}>+65</span>
                  <input
                    type="tel"
                    placeholder="···· ····"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/[^0-9 \-]/g, "") }))}
                    className="flex-1 bg-transparent px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none"
                    style={{ fontFamily: "var(--font-body)" }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Class interests (optional)</label>
                <textarea
                  rows={3}
                  placeholder="e.g. morning yoga, meditation, aerial…"
                  value={form.interest}
                  onChange={(e) => setForm((f) => ({ ...f, interest: e.target.value }))}
                  className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A] resize-none"
                  style={{ fontFamily: "var(--font-body)" }}
                />
              </div>

              {submitError && (
                <p className="text-center text-[12px] text-red-500" style={{ fontFamily: "var(--font-body)" }}>{submitError}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {submitting ? "Saving…" : <>Notify me <ChevronRight size={14} /></>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Events Page ───────────────────────────────────────────────────────────────

interface BookingInfo {
  type: string;
  day: string;
  time: string;
  instructor: string;
  level: string;
  location: string;
  code?: string;
  classId?: string;
  stripeLink?: string | null;
  price?: string;
  comingSoon?: boolean;
}

function EventsPage({
  events,
  classSchedule,
  onReserve,
  onBookClass,
  scrollTarget,
  onScrollTargetHandled
}: {
  events: Array<ReserveInfo & { desc: string; img: string }>;
  classSchedule: Array<{ id?: string; day: string; date?: string; time: string; type: string; instructor: string; level: string; location: string; price?: string; stripeLink?: string | null; comingSoon?: boolean }>;
  onReserve: (info: ReserveInfo) => void;
  onBookClass: (info: BookingInfo) => void;
  scrollTarget?: EventsSection | null;
  onScrollTargetHandled?: () => void;
}) {
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const dayKey = (c: (typeof classSchedule)[number]) => c.date || c.day;
  const days = [...new Set(classSchedule.map(dayKey))];
  const filtered = activeDay ? classSchedule.filter((c) => dayKey(c) === activeDay) : classSchedule;
  const schedulePublished = classSchedule.some((c) => !c.comingSoon);
  const showSchedulePreview = classSchedule.length > 0 && !schedulePublished;

  useEffect(() => {
    if (!scrollTarget) return;
    const scroll = () => {
      document.getElementById(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      onScrollTargetHandled?.();
    };
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  }, [scrollTarget, onScrollTargetHandled]);

  return (
    <div>
      {/* Hero */}
      <section className="relative h-[70vh] min-h-[480px] flex items-center overflow-hidden bg-[#2A2825]">
        <img src={IMAGES.raisingHands} alt="Community wellness event" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1A1815]/60 via-transparent to-[#1A1815]/40" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 text-center w-full">
          <p className="text-[#D4B896] text-[11px] tracking-[0.3em] uppercase mb-6" style={{ fontFamily: "var(--font-body)" }}>Events & Classes</p>
          <h1 className="text-4xl md:text-6xl font-normal text-white leading-[1.1] mb-6" style={{ fontFamily: "var(--font-display)" }}>
            Experiences That Bring People Together.
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto" style={{ fontFamily: "var(--font-body)" }}>
            Immersive events, ceremonies, and weekly classes to nourish your practice and grow your community.
          </p>
        </div>
      </section>

      {/* Upcoming Events */}
      <section id="upcoming-events" className="scroll-mt-24 py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>What&apos;s On</p>
          <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
            Upcoming Events
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map((event) => (
            <div key={event.programId || event.title} className="group flex flex-col bg-[#FAF8F3] hover:shadow-lg transition-shadow duration-400 overflow-hidden border border-[#2A2825]/6">
              <div className="relative overflow-hidden bg-[#D4B896]">
                <img src={event.img} alt={event.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute top-4 right-4 bg-[#C4785A] text-white px-3 py-1.5 text-[11px] tracking-wide" style={{ fontFamily: "var(--font-body)" }}>
                  {event.price}
                </div>
              </div>
              <div className="p-7 flex flex-col flex-1">
                <p className="text-[#C4785A] text-[10px] tracking-[0.25em] uppercase mb-2" style={{ fontFamily: "var(--font-body)" }}>
                  {event.date}{event.time ? ` · ${event.time}` : ""}
                </p>
                <h3 className="text-[#2A2825] text-xl font-normal mb-3" style={{ fontFamily: "var(--font-display)" }}>{event.title}</h3>
                <p className="text-[#7A7468] text-[13px] leading-[1.8] mb-5 flex-1" style={{ fontFamily: "var(--font-body)" }}>{event.desc}</p>
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin size={11} className="text-[#C4785A]" />
                  <span className="text-[12px] text-[#7A7468]" style={{ fontFamily: "var(--font-body)" }}>{event.location}</span>
                </div>
                <p className="text-[12px] text-[#7A7468] mb-6" style={{ fontFamily: "var(--font-body)" }}>with {event.facilitator}</p>
                <button onClick={() => onReserve(event)} disabled={event.soldOut || event.finished} className={`w-full py-3 text-[11px] tracking-[0.15em] uppercase transition-colors duration-300 ${event.soldOut || event.finished ? "bg-[#7A7468] text-white cursor-not-allowed" : "bg-[#2A2825] text-white hover:bg-[#C4785A]"}`} style={{ fontFamily: "var(--font-body)" }}>
                  {programActionLabel(event)}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Class Schedule */}
      <section id="regular-classes" className="scroll-mt-24 bg-[#F2EBE0] py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="text-center mb-12">
            <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Regular Classes</p>
            <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
              Weekly Schedule
            </h2>
          </div>
          <div className="relative">
            <div
              className={showSchedulePreview ? "blur-[5px] opacity-45 pointer-events-none select-none" : undefined}
              aria-hidden={showSchedulePreview}
            >
              <div className="flex flex-wrap gap-2 justify-center mb-10">
                <button onClick={() => setActiveDay(null)} className={`px-5 py-2 text-[11px] tracking-[0.15em] uppercase transition-all duration-200 ${!activeDay ? "bg-[#C4785A] text-white" : "bg-white text-[#2A2825]/60 hover:text-[#2A2825]"}`} style={{ fontFamily: "var(--font-body)" }}>
                  All Days
                </button>
                {days.map(d => (
                  <button key={d} onClick={() => setActiveDay(d === activeDay ? null : d)} className={`px-5 py-2 text-[11px] tracking-[0.15em] uppercase transition-all duration-200 ${activeDay === d ? "bg-[#C4785A] text-white" : "bg-white text-[#2A2825]/60 hover:text-[#2A2825]"}`} style={{ fontFamily: "var(--font-body)" }}>
                    {d}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {filtered.map((cls, i) => (
                  <div key={i} className="bg-white flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-3 hover:border-l-2 hover:border-[#C4785A] transition-all duration-200">
                    <div className="flex items-center gap-6">
                      <div className="text-[#C4785A] text-[13px] font-medium w-14" style={{ fontFamily: "var(--font-body)" }}>{cls.time}</div>
                      <div>
                        <span className="text-[#2A2825] font-medium text-sm" style={{ fontFamily: "var(--font-body)" }}>{cls.type}</span>
                        <span className="text-[#7A7468] text-[12px] ml-2" style={{ fontFamily: "var(--font-body)" }}>with {cls.instructor}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 ml-20 sm:ml-0">
                      <span className="text-[11px] text-[#7A7468] tracking-wide" style={{ fontFamily: "var(--font-body)" }}>{cls.date || cls.day}</span>
                      <span className="bg-[#F2EBE0] text-[#2A2825]/60 text-[10px] tracking-wider px-3 py-1 uppercase" style={{ fontFamily: "var(--font-body)" }}>{cls.level}</span>
                      <span className="text-[#7A7468] text-[12px]" style={{ fontFamily: "var(--font-body)" }}>{cls.location}</span>
                      <button onClick={() => onBookClass({
                        type: cls.type,
                        day: cls.comingSoon ? "Coming Soon" : (cls.date || cls.day),
                        time: cls.time,
                        instructor: cls.instructor,
                        level: cls.level,
                        location: cls.location,
                        classId: cls.id,
                        stripeLink: cls.stripeLink || undefined,
                        price: cls.price || "SGD 35",
                        comingSoon: cls.comingSoon
                      })} className="px-4 py-1.5 border border-[#C4785A] text-[#C4785A] text-[10px] tracking-[0.12em] uppercase hover:bg-[#C4785A] hover:text-white transition-all duration-200" style={{ fontFamily: "var(--font-body)" }}>
                        {cls.comingSoon ? "Reserve Spot" : "Book"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {showSchedulePreview && (
              <div className="absolute inset-0 flex items-center justify-center px-6 py-10">
                <div className="bg-[#FAF8F3]/92 backdrop-blur-md border border-[#2A2825]/10 px-8 py-10 sm:px-12 sm:py-12 max-w-lg w-full text-center shadow-[0_24px_64px_rgba(42,40,37,0.12)]">
                  <p className="text-[10px] tracking-[0.3em] text-[#C4785A] uppercase mb-4" style={{ fontFamily: "var(--font-body)" }}>Coming soon</p>
                  <h3 className="text-2xl sm:text-3xl font-normal text-[#2A2825] mb-4 leading-snug" style={{ fontFamily: "var(--font-display)" }}>
                    We&apos;re preparing a schedule for you
                  </h3>
                  <p className="text-[#7A7468] text-[14px] leading-relaxed mb-8" style={{ fontFamily: "var(--font-body)" }}>
                    Our weekly class timetable is almost ready. Leave your details and we&apos;ll let you know as soon as booking opens.
                  </p>
                  <button
                    type="button"
                    onClick={() => setNotifyOpen(true)}
                    className="px-8 py-3.5 bg-[#C4785A] text-white text-[11px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    Notify me
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Community Gallery */}
      <section className="py-28 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <p className="text-[#C4785A] text-[11px] tracking-[0.3em] uppercase mb-5" style={{ fontFamily: "var(--font-body)" }}>Our Community</p>
          <h2 className="text-3xl md:text-4xl font-normal text-[#2A2825] leading-[1.15]" style={{ fontFamily: "var(--font-display)" }}>
            Life at Dharma Space
          </h2>
        </div>
        <InstagramCommunityGallery />
      </section>

      {notifyOpen && <ClassScheduleNotifyModal onClose={() => setNotifyOpen(false)} />}
    </div>
  );
}

// ── PayNow Step (shared) ──────────────────────────────────────────────────────

const PAYNOW_UEN = "202129735K";
const PAYNOW_NAME = "Dharma Space Pte Ltd";
const WHATSAPP_LINK = "https://wa.me/6598664331";

function formatPhone(phone: string) {
  return phone ? `+65 ${phone}` : undefined;
}

function calcDeposit(price: string): string {
  const match = price.match(/[\d,]+/);
  if (!match) return price;
  const full = parseInt(match[0].replace(",", ""));
  const deposit = full <= 50 ? Math.ceil(full * 0.5) : Math.ceil(full * 0.3);
  return `SGD ${deposit}`;
}

function PaymentChoice({ price, code, depositOverride, onChoose }: { price: string; code: string; depositOverride?: string; onChoose: (amount: string, type: "soft" | "full", ref: string) => void }) {
  const deposit = depositOverride ?? calcDeposit(price);
  const softRef = `dpsit${code}`;
  const fullRef = `Full${code}`;
  return (
    <div className="space-y-3 pt-2">
      <p className="text-[11px] tracking-[0.2em] text-[#2A2825]/50 uppercase text-center mb-4" style={{ fontFamily: "var(--font-body)" }}>Choose booking type</p>
      <button
        type="button"
        onClick={() => onChoose(deposit, "soft", softRef)}
        className="w-full border border-[#C4785A] text-[#C4785A] hover:bg-[#C4785A] hover:text-white transition-all duration-300 p-5 text-left group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] tracking-[0.15em] uppercase font-medium" style={{ fontFamily: "var(--font-body)" }}>Soft Booking — Deposit</span>
          <span className="text-lg font-light" style={{ fontFamily: "var(--font-display)" }}>{deposit}</span>
        </div>
        <p className="text-[11px] opacity-70 group-hover:opacity-90" style={{ fontFamily: "var(--font-body)" }}>
          Reserve your spot with a deposit. Remaining balance due 7 days before. Ref: <strong>{softRef}</strong>
        </p>
      </button>
      <button
        type="button"
        onClick={() => onChoose(price, "full", fullRef)}
        className="w-full bg-[#2A2825] text-white hover:bg-[#C4785A] transition-all duration-300 p-5 text-left group"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] tracking-[0.15em] uppercase font-medium" style={{ fontFamily: "var(--font-body)" }}>Full Booking</span>
          <span className="text-lg font-light" style={{ fontFamily: "var(--font-display)" }}>{price}</span>
        </div>
        <p className="text-[11px] opacity-60 group-hover:opacity-80" style={{ fontFamily: "var(--font-body)" }}>
          Pay in full now and secure your place. No further payments needed. Ref: <strong>{fullRef}</strong>
        </p>
      </button>
    </div>
  );
}

interface PayNowStepProps {
  amount: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  title: string;
  bookingType: string;
  date?: string;
  schedule?: string;
  siteProgramId?: string;
  programCategory?: string;
  location?: string;
  facilitator?: string;
  price?: string;
  audienceType?: "student" | "practitioner";
  memberBooking?: boolean;
  onDone: () => void;
}

function PayNowStep({ amount, reference, name, email, phone, notes, title, bookingType, date, schedule, siteProgramId, programCategory, location, facilitator, price, audienceType, memberBooking, onDone }: PayNowStepProps) {
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);

  const handleDone = async () => {
    if (memberBooking) {
      onDone();
      return;
    }
    setSending(true);
    setSendError(false);
    try {
      await submitInquiry({
        type: "booking_payment",
        name,
        email,
        phone: phone || undefined,
        notes: notes || undefined,
        siteProgramId,
        audienceType,
        context: {
          title,
          bookingType,
          date: date || undefined,
          time: schedule || undefined,
          location,
          facilitator,
          price,
          amount,
          reference,
          uen: PAYNOW_UEN,
          programCategory,
          paymentStatus: "NOT_PAID"
        }
      });
      onDone();
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8">
      <div className="text-center mb-8">
        <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-2" style={{ fontFamily: "var(--font-body)" }}>Step 2 of 2</p>
        <h3 className="text-xl font-normal text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>Complete Payment via PayNow</h3>
      </div>

      <div className="bg-[#F2EBE0] p-6 flex flex-col items-center mb-6">
        <img src={payNowQR} alt="PayNow QR Code" className="w-44 h-44 mb-4 object-contain" />
        <p className="text-[11px] tracking-[0.15em] text-[#7A7468] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>Scan with any Singapore banking app</p>
        <p className="text-[#2A2825] font-medium text-sm" style={{ fontFamily: "var(--font-body)" }}>{PAYNOW_NAME}</p>
      </div>

      <div className="space-y-3 mb-6">
        {[
          { label: "PayNow UEN", val: PAYNOW_UEN },
          { label: "Amount", val: amount },
          { label: "Payment Reference", val: reference },
        ].map(({ label, val }) => (
          <div key={label} className="flex justify-between items-center py-2.5 border-b border-[#2A2825]/8">
            <span className="text-[11px] tracking-[0.15em] text-[#7A7468] uppercase" style={{ fontFamily: "var(--font-body)" }}>{label}</span>
            <span className="text-[#2A2825] font-medium text-sm" style={{ fontFamily: "var(--font-body)" }}>{val}</span>
          </div>
        ))}
      </div>

      <div className="bg-[#EDE5D8] p-4 mb-6 flex gap-3">
        <div className="text-[#C4785A] mt-0.5 flex-shrink-0"><Check size={14} /></div>
        <p className="text-[#2A2825]/70 text-[12px] leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
          Include the reference <strong className="text-[#2A2825]">{reference}</strong> in your PayNow transfer so we can match your payment quickly.
        </p>
      </div>

      {sendError && (
        <p className="text-center text-[12px] text-red-500 mb-3" style={{ fontFamily: "var(--font-body)" }}>
          Could not send confirmation email — please WhatsApp us at +65 9866 4331.
        </p>
      )}

      <button onClick={handleDone} disabled={sending} className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontFamily: "var(--font-body)" }}>
        {sending ? "Sending confirmation…" : <>I&apos;ve Completed Payment <ChevronRight size={14} /></>}
      </button>
      <p className="text-center text-[11px] text-[#7A7468] mt-3" style={{ fontFamily: "var(--font-body)" }}>
        Questions? WhatsApp us at +65 9866 4331
      </p>
    </div>
  );
}

function ConfirmedStep({ name, title, variant = "stripe" }: { name: string; title: string; variant?: "stripe" | "paynow" | "waitlist" }) {
  const message =
    variant === "paynow"
      ? <>Thank you, <strong className="text-[#2A2825]">{name || "friend"}</strong>. We&apos;ll verify your PayNow payment for <strong className="text-[#2A2825]">{title}</strong> and send a confirmation to your email within a few hours.</>
      : variant === "waitlist"
        ? <>Thank you, <strong className="text-[#2A2825]">{name || "friend"}</strong>. You&apos;re on the list for <strong className="text-[#2A2825]">{title}</strong>. We&apos;ll email you when dates are announced.</>
        : <>Thank you, <strong className="text-[#2A2825]">{name || "friend"}</strong>. Your booking for <strong className="text-[#2A2825]">{title}</strong> is confirmed — check your email for details.</>;

  return (
    <div className="p-8 text-center py-14">
      <div className="w-14 h-14 rounded-full bg-[#C4785A]/10 flex items-center justify-center mx-auto mb-5">
        <Check size={22} className="text-[#C4785A]" />
      </div>
      <h3 className="text-xl font-normal text-[#2A2825] mb-3" style={{ fontFamily: "var(--font-display)" }}>You&apos;re all set!</h3>
      <p className="text-[#7A7468] text-[14px] leading-relaxed max-w-xs mx-auto" style={{ fontFamily: "var(--font-body)" }}>
        {message}
      </p>
      <p className="text-[#7A7468] text-[12px] mt-4" style={{ fontFamily: "var(--font-body)" }}>
        Need help? WhatsApp +65 9866 4331
      </p>
    </div>
  );
}

function BookingSuccessModal({ booking, onClose }: { booking: PendingStripeBooking; onClose: () => void }) {
  const { token, isLoggedIn } = useMemberAuth();
  const [confirming, setConfirming] = useState(true);
  const [confirmError, setConfirmError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isLoggedIn && token && booking.reference) {
          const sessionId = new URLSearchParams(window.location.search).get("session_id") || undefined;
          await confirmMemberBookingReturn(token, booking.reference, sessionId);
        } else if (booking.email) {
          await submitInquiry({
            type: "booking_confirmed",
            name: booking.name,
            email: booking.email,
            phone: booking.phone,
            notes: booking.notes,
            guests: booking.guests,
            siteProgramId: booking.siteProgramId,
            siteClassId: booking.siteClassId,
            context: {
              title: booking.title,
              date: booking.date,
              time: booking.time,
              location: booking.location,
              facilitator: booking.facilitator,
              price: booking.price,
              bookingType: "Stripe checkout",
              reference: booking.reference,
              programCategory: booking.programCategory,
              paymentStatus: "PAID"
            }
          });
        }
      } catch (err) {
        if (!cancelled) {
          setConfirmError(err instanceof Error ? err.message : "Could not confirm booking.");
        }
      } finally {
        if (!cancelled) setConfirming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [booking, isLoggedIn, token]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-0 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#FAF8F3] w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-start justify-between p-8 border-b border-[#2A2825]/8">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>Booking confirmed</p>
            <h2 className="text-2xl font-normal text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>{booking.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[#2A2825]/40 hover:text-[#2A2825] transition-colors p-1 mt-1"><X size={20} /></button>
        </div>
        {confirming ? (
          <div className="p-8 text-center py-14">
            <p className="text-[#7A7468] text-[14px]" style={{ fontFamily: "var(--font-body)" }}>Sending your confirmation email…</p>
          </div>
        ) : confirmError ? (
          <div className="p-8 text-center py-14">
            <p className="text-red-500 text-[13px] mb-4" style={{ fontFamily: "var(--font-body)" }}>{confirmError}</p>
            <ConfirmedStep name={booking.name} title={booking.title} variant="stripe" />
          </div>
        ) : (
          <ConfirmedStep name={booking.name} title={booking.title} variant="stripe" />
        )}
      </div>
    </div>
  );
}

// ── Reserve Modal ─────────────────────────────────────────────────────────────

function memberPhoneDigits(phone?: string | null) {
  return phone?.replace(/^\+65\s?/, "") ?? "";
}

function ReserveModal({ info, onClose }: { info: ReserveInfo; onClose: () => void }) {
  const { isLoggedIn, member, token, refreshMember } = useMemberAuth();
  const isComingSoon = Boolean(info.comingSoon ?? info.date === "Coming Soon");
  const isFinished = Boolean(info.finished);
  const usePayNow = Boolean(info.usePayNow && !isComingSoon);
  const bookable = !isComingSoon && !isFinished && !info.soldOut;

  type Step = "auth" | "confirm" | "waitlist" | "paynow" | "done";
  const needsAuth = bookable || isComingSoon;
  const [step, setStep] = useState<Step>(() => {
    if (!needsAuth) return "done";
    if (isLoggedIn) return isComingSoon ? "waitlist" : "confirm";
    return "auth";
  });
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState("1");
  const [notes, setNotes] = useState("");
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [payReference, setPayReference] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const code = info.code ?? info.title.replace(/\s+/g, "").slice(0, 8);

  useEffect(() => {
    if (member?.phone) setPhone(memberPhoneDigits(member.phone));
  }, [member]);

  useEffect(() => {
    if (isLoggedIn && step === "auth" && needsAuth) {
      setStep(isComingSoon ? "waitlist" : "confirm");
    }
  }, [isLoggedIn, step, needsAuth, isComingSoon]);

  useEffect(() => {
    if (!token || step !== "confirm" || !info.programId) {
      setAlreadyBooked(false);
      return;
    }
    fetchMemberBookings(token)
      .then(({ bookings }) => setAlreadyBooked(memberHasActiveBooking(bookings, { siteProgramId: info.programId, offeringTitle: info.title })))
      .catch(() => setAlreadyBooked(false));
  }, [token, step, info.programId]);

  const handleWaitlist = async () => {
    if (!member) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      if (token && phone.trim()) {
        await updateMemberProfile(token, { phone: formatPhone(phone) || null });
        await refreshMember();
      }
      await submitInquiry({
        type: "waitlist",
        name: member.name,
        email: member.email,
        phone: formatPhone(phone),
        notes: notes || undefined,
        guests: info.singlePerson ? "1" : guests,
        siteProgramId: info.programId,
        context: {
          title: info.title,
          date: info.date,
          time: info.time,
          location: info.location,
          facilitator: info.facilitator,
          price: info.price,
          bookingType: "Reserve Spot",
          reference: `waitlist-${code}`,
          programCategory: info.category
        }
      });
      setWaitlistSent(true);
      setStep("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBook = async () => {
    if (!token || !member) return;
    if (!info.programId) {
      setSubmitError("Online booking is not available for this session yet. Please contact us.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      if (phone.trim()) {
        await updateMemberProfile(token, { phone: formatPhone(phone) || null });
        await refreshMember();
      }
      const guestCount = info.singlePerson ? 1 : parseInt(guests.replace("+", ""), 10) || 1;
      const result = await createMemberBooking(token, {
        siteProgramId: info.programId,
        guests: guestCount,
        notes: notes || undefined,
        paymentMethod: usePayNow ? "PAYNOW" : "STRIPE"
      });
      if (usePayNow) {
        setPayReference(result.booking.reference);
        setPayAmount(result.payNowAmount || result.booking.price);
        setStep("paynow");
        setSubmitting(false);
        return;
      }
      if (result.checkoutUrl) {
        savePendingStripeBooking({
          name: member.name,
          email: member.email,
          title: info.title,
          date: info.date,
          time: info.time,
          location: info.location,
          facilitator: info.facilitator,
          price: info.price,
          reference: result.booking.reference,
          siteProgramId: info.programId,
          programCategory: info.category,
          phone: formatPhone(phone),
          notes: notes || undefined,
          guests: String(guestCount),
          memberBooking: true
        });
        window.location.href = result.checkoutUrl;
        return;
      }
      setSubmitError("Online payment is not available for this session yet.");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not create booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const sessionDetails = (
    <div className="px-8 pt-6 pb-5 grid grid-cols-2 gap-4 bg-[#F2EBE0]">
      {[{ label: "Date", val: info.date }, { label: "Time", val: info.time }, { label: "Location", val: info.location }, { label: "Facilitator", val: info.facilitator }, { label: "Investment", val: info.price }].map(({ label, val }) => (
        <div key={label}>
          <p className="text-[9px] tracking-[0.2em] text-[#C4785A] uppercase mb-0.5" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
          <p className="text-[#2A2825] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{val}</p>
        </div>
      ))}
    </div>
  );

  const stepLabel =
    step === "paynow" ? "PayNow payment" :
    step === "done" ? "Confirmed" :
    step === "waitlist" ? "Reserve Spot" :
    step === "auth" ? "Sign in" : "Confirm booking";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-0 sm:p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#FAF8F3] w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-start justify-between p-8 border-b border-[#2A2825]/8">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>{stepLabel}</p>
            <h2 className="text-2xl font-normal text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>{info.title}</h2>
          </div>
          <button onClick={onClose} className="text-[#2A2825]/40 hover:text-[#2A2825] transition-colors p-1 mt-1"><X size={20} /></button>
        </div>

        {step === "auth" && needsAuth && (
          <>
            {sessionDetails}
            <MemberAuthPanel compact onSuccess={() => setStep(isComingSoon ? "waitlist" : "confirm")} />
          </>
        )}

        {step === "confirm" && bookable && member && (
          <>
            {sessionDetails}
            <div className="p-8">
              <div className="space-y-5">
                <div className="bg-[#F2EBE0] p-4">
                  <p className="text-[11px] tracking-[0.15em] text-[#7A7468] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>Booking as</p>
                  <p className="text-[#2A2825] text-[15px]" style={{ fontFamily: "var(--font-display)" }}>{member.name}</p>
                  <p className="text-[#7A7468] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{member.email}</p>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Phone / WhatsApp</label>
                  <div className="flex bg-[#EDE5D8] focus-within:ring-1 focus-within:ring-[#C4785A]">
                    <span className="px-4 py-3 text-[14px] text-[#2A2825]/60 select-none border-r border-[#2A2825]/10 shrink-0" style={{ fontFamily: "var(--font-body)" }}>+65</span>
                    <input type="tel" placeholder="···· ····" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9 \-]/g, ""))} className="flex-1 bg-transparent px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none" style={{ fontFamily: "var(--font-body)" }} />
                  </div>
                </div>
                {!info.singlePerson && (
                  <div>
                    <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Number of Guests</label>
                    <select value={guests} onChange={e => setGuests(e.target.value)} className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] focus:outline-none focus:ring-1 focus:ring-[#C4785A]" style={{ fontFamily: "var(--font-body)" }}>
                      {["1", "2", "3", "4", "5+"].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Notes (optional)</label>
                  <textarea rows={3} placeholder="Any questions or special requirements..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A] resize-none" style={{ fontFamily: "var(--font-body)" }} />
                </div>
                {submitError && <p className="text-center text-[12px] text-red-500" style={{ fontFamily: "var(--font-body)" }}>{submitError}</p>}
                {alreadyBooked ? (
                  <div className="flex items-center gap-3 bg-[#F2EBE0] p-4">
                    <Check size={16} className="text-[#7A9A7A] flex-shrink-0" />
                    <p className="text-[#2A2825] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>
                      You already have a booking for this session. Open <strong>My account → My bookings</strong> to view it.
                    </p>
                  </div>
                ) : (
                <button type="button" onClick={handleBook} disabled={submitting} className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontFamily: "var(--font-body)" }}>
                  {submitting ? "Please wait…" : usePayNow ? "Continue to PayNow" : "Book & pay securely"} <ChevronRight size={14} />
                </button>
                )}
              </div>
            </div>
          </>
        )}

        {step === "waitlist" && isComingSoon && member && (
          <>
            {sessionDetails}
            <div className="p-8">
              <div className="space-y-5">
                <div className="bg-[#F2EBE0] p-4">
                  <p className="text-[11px] tracking-[0.15em] text-[#7A7468] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>Reserving as</p>
                  <p className="text-[#2A2825] text-[15px]" style={{ fontFamily: "var(--font-display)" }}>{member.name}</p>
                  <p className="text-[#7A7468] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{member.email}</p>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Phone / WhatsApp</label>
                  <div className="flex bg-[#EDE5D8] focus-within:ring-1 focus-within:ring-[#C4785A]">
                    <span className="px-4 py-3 text-[14px] text-[#2A2825]/60 select-none border-r border-[#2A2825]/10 shrink-0" style={{ fontFamily: "var(--font-body)" }}>+65</span>
                    <input type="tel" placeholder="···· ····" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9 \-]/g, ""))} className="flex-1 bg-transparent px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none" style={{ fontFamily: "var(--font-body)" }} />
                  </div>
                </div>
                {!info.singlePerson && (
                  <div>
                    <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Number of Guests</label>
                    <select value={guests} onChange={e => setGuests(e.target.value)} className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] focus:outline-none focus:ring-1 focus:ring-[#C4785A]" style={{ fontFamily: "var(--font-body)" }}>
                      {["1", "2", "3", "4", "5+"].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Notes (optional)</label>
                  <textarea rows={3} placeholder="Any questions or special requirements..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A] resize-none" style={{ fontFamily: "var(--font-body)" }} />
                </div>
                {submitError && <p className="text-center text-[12px] text-red-500" style={{ fontFamily: "var(--font-body)" }}>{submitError}</p>}
                {isFinished ? (
                  <p className="text-[#2A2825] text-[13px] text-center" style={{ fontFamily: "var(--font-body)" }}>This program has finished and is no longer open for booking.</p>
                ) : info.soldOut ? (
                  <p className="text-[#2A2825] text-[13px] text-center" style={{ fontFamily: "var(--font-body)" }}>This workshop is sold out. Contact us to join a cancellation waitlist.</p>
                ) : (
                  <button type="button" onClick={handleWaitlist} disabled={submitting} className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontFamily: "var(--font-body)" }}>
                    {submitting ? "Saving…" : "Reserve Spot"} <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {step === "paynow" && member && (
          <PayNowStep
            amount={payAmount}
            reference={payReference}
            name={member.name}
            email={member.email}
            phone={formatPhone(phone) || ""}
            notes={notes}
            title={info.title}
            bookingType="PayNow deposit"
            date={info.date}
            schedule={info.time}
            siteProgramId={info.programId}
            programCategory={info.category}
            location={info.location}
            facilitator={info.facilitator}
            price={info.price}
            memberBooking
            onDone={() => setStep("done")}
          />
        )}

        {step === "done" && (
          <ConfirmedStep
            name={member?.name || ""}
            title={info.title}
            variant={waitlistSent ? "waitlist" : usePayNow ? "paynow" : "stripe"}
          />
        )}

        {!bookable && !isComingSoon && (
          <>
            {sessionDetails}
            <div className="p-8 text-center">
              <p className="text-[#2A2825] text-[14px]" style={{ fontFamily: "var(--font-body)" }}>
                {isFinished ? "This program has finished and is no longer open for booking." : "This session is sold out. Contact us to join a cancellation waitlist."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Booking Modal ─────────────────────────────────────────────────────────────

function BookingModal({ info, onClose }: { info: BookingInfo; onClose: () => void }) {
  const { isLoggedIn, member, token, refreshMember } = useMemberAuth();
  const CLASS_PRICE = info.price ?? "SGD 35";
  const isComingSoon = Boolean(info.comingSoon ?? info.day === "Coming Soon");
  const bookable = !isComingSoon;

  type Step = "auth" | "confirm" | "waitlist" | "done";
  const [step, setStep] = useState<Step>(() => {
    if (isLoggedIn) return isComingSoon ? "waitlist" : "confirm";
    return "auth";
  });
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [waitlistSent, setWaitlistSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState(false);
  const code = info.code ?? info.type.replace(/\s+/g, "").slice(0, 8);

  useEffect(() => {
    if (member?.phone) setPhone(memberPhoneDigits(member.phone));
  }, [member]);

  useEffect(() => {
    if (isLoggedIn && step === "auth") {
      setStep(isComingSoon ? "waitlist" : "confirm");
    }
  }, [isLoggedIn, step, isComingSoon]);

  useEffect(() => {
    if (!token || step !== "confirm" || !info.classId) {
      setAlreadyBooked(false);
      return;
    }
    fetchMemberBookings(token)
      .then(({ bookings }) => setAlreadyBooked(memberHasActiveBooking(bookings, { siteClassId: info.classId, offeringTitle: info.type })))
      .catch(() => setAlreadyBooked(false));
  }, [token, step, info.classId]);

  const handleWaitlist = async () => {
    if (!member) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      if (token && phone.trim()) {
        await updateMemberProfile(token, { phone: formatPhone(phone) || null });
        await refreshMember();
      }
      await submitInquiry({
        type: "class_waitlist",
        name: member.name,
        email: member.email,
        phone: formatPhone(phone),
        notes: notes || undefined,
        siteClassId: info.classId,
        context: {
          title: info.type,
          date: info.day,
          time: info.time,
          location: info.location,
          facilitator: info.instructor,
          price: CLASS_PRICE,
          bookingType: "Reserve Spot",
          reference: `waitlist-${code}`,
          programCategory: "REGULAR_CLASS"
        }
      });
      setWaitlistSent(true);
      setStep("done");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBook = async () => {
    if (!token || !member) return;
    if (!info.classId) {
      setSubmitError("Online booking is not available for this class yet. Please contact us.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      if (phone.trim()) {
        await updateMemberProfile(token, { phone: formatPhone(phone) || null });
        await refreshMember();
      }
      const result = await createMemberBooking(token, {
        siteClassId: info.classId,
        notes: notes || undefined,
        paymentMethod: "STRIPE"
      });
      if (result.checkoutUrl) {
        savePendingStripeBooking({
          name: member.name,
          email: member.email,
          title: info.type,
          date: info.day,
          time: info.time,
          location: info.location,
          facilitator: info.instructor,
          price: CLASS_PRICE,
          reference: result.booking.reference,
          siteClassId: info.classId,
          programCategory: "REGULAR_CLASS",
          phone: formatPhone(phone),
          notes: notes || undefined,
          memberBooking: true
        });
        window.location.href = result.checkoutUrl;
        return;
      }
      setSubmitError("Online booking is not available for this class yet.");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not create booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const classDetails = (
    <div className="px-8 pt-6 pb-4 grid grid-cols-2 gap-4 bg-[#F2EBE0]">
      {[{ label: "Day", val: info.day }, { label: "Time", val: info.time }, { label: "Instructor", val: info.instructor }, { label: "Level", val: info.level }, { label: "Location", val: info.location }, { label: "Price", val: CLASS_PRICE }].map(({ label, val }) => (
        <div key={label}>
          <p className="text-[9px] tracking-[0.2em] text-[#C4785A] uppercase mb-0.5" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
          <p className="text-[#2A2825] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{val}</p>
        </div>
      ))}
    </div>
  );

  const stepLabel =
    step === "done" ? "Confirmed" :
    step === "waitlist" ? "Reserve Spot" :
    step === "auth" ? "Sign in" : "Book a Class";

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-0 sm:p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#FAF8F3] w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="flex items-start justify-between p-8 border-b border-[#2A2825]/8">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>{stepLabel}</p>
            <h2 className="text-2xl font-normal text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>{info.type}</h2>
          </div>
          <button onClick={onClose} className="text-[#2A2825]/40 hover:text-[#2A2825] transition-colors p-1 mt-1"><X size={20} /></button>
        </div>

        {step === "auth" && (
          <>
            {classDetails}
            <MemberAuthPanel compact onSuccess={() => setStep(isComingSoon ? "waitlist" : "confirm")} />
          </>
        )}

        {step === "confirm" && bookable && member && (
          <>
            {classDetails}
            <div className="p-8">
              <div className="space-y-5">
                <div className="bg-[#F2EBE0] p-4">
                  <p className="text-[11px] tracking-[0.15em] text-[#7A7468] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>Booking as</p>
                  <p className="text-[#2A2825] text-[15px]" style={{ fontFamily: "var(--font-display)" }}>{member.name}</p>
                  <p className="text-[#7A7468] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{member.email}</p>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Phone / WhatsApp</label>
                  <div className="flex bg-[#EDE5D8] focus-within:ring-1 focus-within:ring-[#C4785A]">
                    <span className="px-4 py-3 text-[14px] text-[#2A2825]/60 select-none border-r border-[#2A2825]/10 shrink-0" style={{ fontFamily: "var(--font-body)" }}>+65</span>
                    <input type="tel" placeholder="···· ····" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9 \-]/g, ""))} className="flex-1 bg-transparent px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none" style={{ fontFamily: "var(--font-body)" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Notes (optional)</label>
                  <textarea rows={3} placeholder="Any injuries, questions, or special requirements..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A] resize-none" style={{ fontFamily: "var(--font-body)" }} />
                </div>
                {submitError && <p className="text-center text-[12px] text-red-500" style={{ fontFamily: "var(--font-body)" }}>{submitError}</p>}
                {alreadyBooked ? (
                  <div className="flex items-center gap-3 bg-[#F2EBE0] p-4">
                    <Check size={16} className="text-[#7A9A7A] flex-shrink-0" />
                    <p className="text-[#2A2825] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>
                      You already have a booking for this class. Open <strong>My account → My bookings</strong> to view it.
                    </p>
                  </div>
                ) : (
                <button type="button" onClick={handleBook} disabled={submitting} className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontFamily: "var(--font-body)" }}>
                  {submitting ? "Please wait…" : "Book a Class — Pay Securely"} <ChevronRight size={14} />
                </button>
                )}
              </div>
            </div>
          </>
        )}

        {step === "waitlist" && isComingSoon && member && (
          <>
            {classDetails}
            <div className="p-8">
              <div className="space-y-5">
                <div className="bg-[#F2EBE0] p-4">
                  <p className="text-[11px] tracking-[0.15em] text-[#7A7468] uppercase mb-1" style={{ fontFamily: "var(--font-body)" }}>Reserving as</p>
                  <p className="text-[#2A2825] text-[15px]" style={{ fontFamily: "var(--font-display)" }}>{member.name}</p>
                  <p className="text-[#7A7468] text-[13px]" style={{ fontFamily: "var(--font-body)" }}>{member.email}</p>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Phone / WhatsApp</label>
                  <div className="flex bg-[#EDE5D8] focus-within:ring-1 focus-within:ring-[#C4785A]">
                    <span className="px-4 py-3 text-[14px] text-[#2A2825]/60 select-none border-r border-[#2A2825]/10 shrink-0" style={{ fontFamily: "var(--font-body)" }}>+65</span>
                    <input type="tel" placeholder="···· ····" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9 \-]/g, ""))} className="flex-1 bg-transparent px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none" style={{ fontFamily: "var(--font-body)" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Notes (optional)</label>
                  <textarea rows={3} placeholder="Any injuries, questions, or special requirements..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A] resize-none" style={{ fontFamily: "var(--font-body)" }} />
                </div>
                {submitError && <p className="text-center text-[12px] text-red-500" style={{ fontFamily: "var(--font-body)" }}>{submitError}</p>}
                <button type="button" onClick={handleWaitlist} disabled={submitting} className="w-full py-4 border border-[#C4785A] text-[#C4785A] text-[12px] tracking-[0.15em] uppercase hover:bg-[#C4785A] hover:text-white transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontFamily: "var(--font-body)" }}>
                  {submitting ? "Saving…" : "Reserve Spot"} <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        {step === "done" && <ConfirmedStep name={member?.name || ""} title={info.type} variant={waitlistSent ? "waitlist" : "stripe"} />}
      </div>
    </div>
  );
}

// ── Contact Modal ─────────────────────────────────────────────────────────────

const WHATSAPP_CONTACT = `https://wa.me/6598664331?text=${encodeURIComponent("Hello Dharma Space! I'd like to learn more about your wellness programs. Please get back to me at your earliest convenience. Thank you!")}`;

function ContactModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendError(false);
    try {
      await submitInquiry({
        type: "contact",
        name: form.name,
        email: form.email,
        subject: form.subject,
        message: form.message
      });
      setSent(true);
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-0 sm:p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="bg-[#FAF8F3] w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-8 border-b border-[#2A2825]/8">
          <div>
            <h2 className="text-2xl font-normal text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>Contact Dharma Space</h2>
            <p className="text-[#7A7468] text-[13px] mt-1" style={{ fontFamily: "var(--font-body)" }}>Let&apos;s create meaningful wellness experiences together.</p>
          </div>
          <button onClick={onClose} className="text-[#2A2825]/40 hover:text-[#2A2825] transition-colors p-1"><X size={20} /></button>
        </div>
        <div className="p-8 grid md:grid-cols-2 gap-10">
          {/* Form */}
          <div>
            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {[
                  { label: "Full Name", key: "name", type: "text", placeholder: "Your name" },
                  { label: "Email Address", key: "email", type: "email", placeholder: "your@email.com" },
                  { label: "Subject", key: "subject", type: "text", placeholder: "Corporate inquiry, event booking..." },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>{label}</label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={form[key as keyof typeof form]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
                      style={{ fontFamily: "var(--font-body)" }}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Message</label>
                  <textarea
                    rows={4}
                    placeholder="Tell us about your wellness goals..."
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] placeholder-[#7A7468]/60 focus:outline-none focus:ring-1 focus:ring-[#C4785A] resize-none"
                    style={{ fontFamily: "var(--font-body)" }}
                  />
                </div>
                {sendError && (
                  <p className="text-center text-[12px] text-red-500" style={{ fontFamily: "var(--font-body)" }}>
                    Could not send your message. Please try again or WhatsApp us at +65 9866 4331.
                  </p>
                )}
                <button type="submit" disabled={sending} className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 flex items-center justify-center gap-2 disabled:opacity-60" style={{ fontFamily: "var(--font-body)" }}>
                  {sending ? "Sending…" : <><span>Send Message</span><ChevronRight size={14} /></>}
                </button>
              </form>
            ) : (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-full bg-[#C4785A]/10 flex items-center justify-center mx-auto mb-5">
                  <Check size={22} className="text-[#C4785A]" />
                </div>
                <h3 className="text-xl font-normal text-[#2A2825] mb-3" style={{ fontFamily: "var(--font-display)" }}>Message Sent!</h3>
                <p className="text-[#7A7468] text-[14px]" style={{ fontFamily: "var(--font-body)" }}>We&apos;ll be in touch within 24 hours.</p>
              </div>
            )}
          </div>
          {/* Contact Info */}
          <div className="space-y-7">
            <div>
              <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-4" style={{ fontFamily: "var(--font-body)" }}>Find Us</p>
              {[
                { icon: <MapPin size={14} />, label: "Location", val: "5 Jln Kilang #03-03, Singapore 159405" },
                { icon: <Mail size={14} />, label: "Email", val: "corporate@dharma-space.com" },
                { icon: <Phone size={14} />, label: "WhatsApp", val: "+65 9866 4331" },
                { icon: <Instagram size={14} />, label: "Instagram", val: "@dharma_space_sg" },
              ].map(({ icon, label, val }) => (
                <div key={label} className="flex items-start gap-4 mb-5">
                  <div className="w-8 h-8 bg-[#F2EBE0] flex items-center justify-center flex-shrink-0 mt-0.5 text-[#C4785A]">{icon}</div>
                  <div>
                    <p className="text-[10px] tracking-[0.2em] text-[#7A7468] uppercase" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
                    <p className="text-[#2A2825] text-[14px]" style={{ fontFamily: "var(--font-body)" }}>{val}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-[#F2EBE0] p-6">
              <p className="text-[11px] tracking-[0.2em] text-[#C4785A] uppercase mb-3" style={{ fontFamily: "var(--font-body)" }}>Quick Enquiries</p>
              <a href={WHATSAPP_CONTACT} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-[#2A2825] text-[14px] hover:text-[#C4785A] transition-colors mb-3" style={{ fontFamily: "var(--font-body)" }}>
                <MessageCircle size={16} className="text-[#7A9A7A]" /> WhatsApp Us
              </a>
              <p className="text-[#7A7468] text-[12px] leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                For corporate consultations, event bookings, and partnership inquiries — we respond within one business day.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────

function Footer({ setPage, onContact }: { setPage: (p: Page) => void; onContact: () => void }) {
  return (
    <footer className="bg-[#2A2825] text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <div className="mb-6">
              <BrandLogo invert textClassName="text-[11px] font-medium uppercase tracking-[0.2em] text-white" />
            </div>
            <p className="text-white/50 text-[14px] leading-[1.9] max-w-sm mb-8" style={{ fontFamily: "var(--font-body)" }}>
              A space where wellness meets education, purpose, and community. Building conscious communities across Singapore and beyond.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-9 h-9 border border-white/20 flex items-center justify-center hover:border-[#C4785A] hover:text-[#C4785A] transition-all duration-300 text-white/60"><Instagram size={14} /></a>
              <a href="#" className="w-9 h-9 border border-white/20 flex items-center justify-center hover:border-[#C4785A] hover:text-[#C4785A] transition-all duration-300 text-white/60"><MessageCircle size={14} /></a>
              <a href="#" className="w-9 h-9 border border-white/20 flex items-center justify-center hover:border-[#C4785A] hover:text-[#C4785A] transition-all duration-300 text-white/60"><Mail size={14} /></a>
            </div>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-6" style={{ fontFamily: "var(--font-body)" }}>Navigate</p>
            {(["about", "corporate", "education", "events"] as Page[]).map(p => (
              <button key={p} onClick={() => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="block text-white/50 hover:text-white text-[14px] mb-3 capitalize transition-colors" style={{ fontFamily: "var(--font-body)" }}>
                {p}
              </button>
            ))}
          </div>
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C4785A] uppercase mb-6" style={{ fontFamily: "var(--font-body)" }}>Connect</p>
            <p className="text-white/50 text-[14px] mb-2" style={{ fontFamily: "var(--font-body)" }}>hello@dharma-space.com</p>
            <p className="text-white/50 text-[14px] mb-6" style={{ fontFamily: "var(--font-body)" }}>dharma-space.com</p>
            <button onClick={onContact} className="px-6 py-3 border border-[#C4785A] text-[#C4785A] text-[11px] tracking-[0.15em] uppercase hover:bg-[#C4785A] hover:text-white transition-all duration-300" style={{ fontFamily: "var(--font-body)" }}>
              Contact Us
            </button>
          </div>
        </div>
        <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-white/25 text-[12px]" style={{ fontFamily: "var(--font-body)" }}>© 2025 Dharma Space Pte. Ltd. · Singapore</p>
          <p className="text-white/25 text-[12px]" style={{ fontFamily: "var(--font-body)" }}>Wellness Education · Corporate Wellness · Community</p>
        </div>
      </div>
    </footer>
  );
}

// ── Admin Login Modal ─────────────────────────────────────────────────────────

function AdminLoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Login failed");
      if (data.user?.role !== "SUPER_ADMIN") throw new Error("Admin access only");
      localStorage.setItem("hsos_token", data.token);
      localStorage.setItem("hsos_user", JSON.stringify(data.user));
      window.location.href = "/admin";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1A1815]/70 backdrop-blur-sm p-6" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-[#FAF8F3] w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-[#2A2825]/8">
          <div>
            <h2 className="text-xl font-normal text-[#2A2825]" style={{ fontFamily: "var(--font-display)" }}>Admin Login</h2>
            <p className="text-[#7A7468] text-[13px] mt-1" style={{ fontFamily: "var(--font-body)" }}>Website form inquiries & backend</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#2A2825]/40 hover:text-[#2A2825] p-1"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>
          <div>
            <label className="block text-[11px] tracking-[0.2em] uppercase text-[#2A2825]/60 mb-2" style={{ fontFamily: "var(--font-body)" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#EDE5D8] px-4 py-3 text-[14px] text-[#2A2825] focus:outline-none focus:ring-1 focus:ring-[#C4785A]"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>
          {error && <p className="text-[12px] text-red-500" style={{ fontFamily: "var(--font-body)" }}>{error}</p>}
          <button type="submit" disabled={sending} className="w-full py-4 bg-[#C4785A] text-white text-[12px] tracking-[0.15em] uppercase hover:bg-[#B86848] transition-colors duration-300 disabled:opacity-60" style={{ fontFamily: "var(--font-body)" }}>
            {sending ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function MarketingSite({ initialPage = "about" }: { initialPage?: Page }) {
  const [page, setPage] = useState<Page>(initialPage);
  const [contactOpen, setContactOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [reserve, setReserve] = useState<ReserveInfo | null>(null);
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [stripeBooking, setStripeBooking] = useState<PendingStripeBooking | null>(null);
  const [eventsScrollTarget, setEventsScrollTarget] = useState<EventsSection | null>(null);
  const [educationScrollTarget, setEducationScrollTarget] = useState<EducationSection | null>(null);
  const site = useSiteContent();

  useEffect(() => {
    setPage(initialPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [initialPage]);

  useEffect(() => {
    if (!isStripeBookingReturn()) return;
    const pending = readPendingStripeBooking();
    if (pending) {
      setStripeBooking(pending);
      clearPendingStripeBooking();
    }
    window.history.replaceState({}, "", "/events");
  }, []);

  const openContact = () => setContactOpen(true);

  const handleEventsSection = (section: EventsSection) => {
    setPage("events");
    setEventsScrollTarget(section);
    window.history.replaceState({}, "", "/events");
  };

  const handleEducationSection = (section: EducationSection) => {
    setPage("education");
    setEducationScrollTarget(section);
    window.history.replaceState({}, "", "/education");
  };

  const specialists: SpecialistCard[] = site?.trainers?.length
    ? site.trainers.map((t) => {
        const fallback = LIVE_SITE_SPECIALISTS.find((s) => s.name === t.name);
        return {
          name: t.name,
          role: t.role,
          desc: t.description,
          cert: t.credentials,
          img: t.imageUrl || fallback?.img || "",
          portraitFocus: fallback?.portraitFocus
        };
      })
    : LIVE_SITE_SPECIALISTS;

  const events = site?.programs?.events?.length
    ? sortProgramsForDisplay(site.programs.events).map((p) => ({
        ...programToReserveInfo(p),
        desc: p.description,
        img: p.imageUrl || IMAGES.soundBowl
      }))
    : sortProgramsForDisplay(
        EVENTS.map((e) => ({
          id: e.title,
          category: "EVENT",
          title: e.title,
          description: e.desc,
          comingSoon: e.date === "Coming Soon",
          scheduledDate: e.date === "Coming Soon" ? "" : e.date,
          dates: e.date,
          time: e.time,
          location: e.location,
          facilitator: e.facilitator,
          price: e.price,
          singlePerson: true,
          usePayNow: false,
          sortOrder: 0
        } as SiteProgram))
      ).map((p) => ({
        ...programToReserveInfo(p),
        desc: p.description,
        img: EVENTS.find((e) => e.title === p.title)?.img || IMAGES.soundBowl
      }));

  const classSchedule = sortClassesForDisplay(
    site?.classes?.length
      ? site.classes.map((c) => ({
          id: c.id,
          day: c.day,
          dayIndex: c.dayIndex,
          startMinutes: c.startMinutes,
          sortOrder: c.sortOrder,
          classDate: c.classDate,
          date: c.classDate
            ? new Date(`${c.classDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
            : undefined,
          time: c.time,
          type: c.classType,
          instructor: c.instructor,
          level: c.level,
          location: c.location,
          price: c.price,
          stripeLink: c.stripeLink,
          comingSoon: c.comingSoon
        }))
      : CLASS_SCHEDULE.map((c) => ({
          ...c,
          id: c.type,
          price: "SGD 35",
          stripeLink: null,
          comingSoon: true,
          sortOrder: 0,
          dayIndex: 0,
          startMinutes: 0,
          classDate: undefined,
          date: undefined
        }))
  );

  const flagship = site?.programs?.flagship?.[0] || site?.programs?.ytt?.[0] || null;
  const certifications = sortProgramsForDisplay(
    site?.programs?.certifications?.length
      ? site.programs.certifications
      : site?.programs?.courses?.length
        ? site.programs.courses
        : []
  );
  const workshops = sortProgramsForDisplay(site?.programs?.workshops?.length ? site.programs.workshops : []);

  return (
    <div className="marketing-site min-h-screen bg-[#FAF8F3]" style={{ fontFamily: "var(--font-body)" }}>
      <Nav
        page={page}
        setPage={setPage}
        onContact={openContact}
        onAccount={() => setAccountOpen(true)}
        onEventsSection={handleEventsSection}
        onEducationSection={handleEducationSection}
      />
      <main>
        {page === "about" && <AboutPage setPage={setPage} specialists={specialists} />}
        {page === "corporate" && <CorporatePage onContact={openContact} />}
        {page === "education" && (
          <EducationPage
            onContact={openContact}
            onReserve={setReserve}
            flagship={flagship}
            certifications={certifications}
            workshops={workshops}
            scrollTarget={educationScrollTarget}
            onScrollTargetHandled={() => setEducationScrollTarget(null)}
          />
        )}
        {page === "events" && (
          <EventsPage
            events={events}
            classSchedule={classSchedule}
            onReserve={setReserve}
            onBookClass={setBooking}
            scrollTarget={eventsScrollTarget}
            onScrollTargetHandled={() => setEventsScrollTarget(null)}
          />
        )}
      </main>
      <Footer setPage={setPage} onContact={openContact} />
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
      {accountOpen && (
        <MemberAccountModal
          onClose={() => setAccountOpen(false)}
          onBookProgram={setReserve}
          onBookClass={setBooking}
        />
      )}
      {reserve && <ReserveModal info={reserve} onClose={() => setReserve(null)} />}
      {booking && <BookingModal info={booking} onClose={() => setBooking(null)} />}
      {stripeBooking && <BookingSuccessModal booking={stripeBooking} onClose={() => setStripeBooking(null)} />}
    </div>
  );
}