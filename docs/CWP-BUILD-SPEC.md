# CWP Feature Build Spec & Implementation Status

> Full build prompt for the Corporate Wellness Platform (CWP).  
> **Architecture reference:** [ARCHITECTURE.md](../ARCHITECTURE.md) → [CORPORATE-WELLNESS-PLATFORM.md](CORPORATE-WELLNESS-PLATFORM.md)

**Last updated:** 2026-05-31

---

## Phase status

| Phase | Scope | Status |
|-------|--------|--------|
| **1** | Prisma: `WellnessEvent`, `WellnessBooking`, `WellnessAttendance`, `ScheduleRequest`, `WellnessEventCategory`; `User.totalWellnessScore`, `User.totalSteps` | ✅ Done |
| **2** | Backend: `wellness-routes.ts`, `badges.ts`, `wellness-level.ts`, seed categories/badges/demo events | ✅ Done |
| **3** | Shared UI components in `frontend/src/platform/components/wellness/` | ✅ Done |
| **4** | Employee dashboard (`CwpEmployeeDashboard.tsx`) wired to `/app/dashboard` | ✅ Done |
| **5** | Trainer dashboard (create event, mark attendance) | 🔲 Pending |
| **6** | HR dashboard (analytics, schedule request DnD, history) | 🔲 Pending |
| **7** | Super Admin CWP management (`CorporateCWPManager.tsx`) | 🔲 Pending |
| **8** | `WellnessJourney` standalone (embedded in employee dashboard sidebar) | ✅ Done |
| **9** | Wellness certificates + PDF download | 🔲 Pending |

---

## Marketing → CWP entry

**Corporate → CWP Platform** in the marketing nav redirects to:

- Production: `https://corporate.dharma-space.com`
- Local: `http://corporate.localhost:7011`

Implemented via `getCorporatePortalUrl()` in `frontend/src/lib/education.ts`.

---

## Design system

CSS variables and components: `frontend/src/styles/platform.css`

Fonts (Google): Cormorant Garamond, DM Sans, JetBrains Mono — added in `frontend/index.html`.

---

## New backend files

| File | Purpose |
|------|---------|
| `backend/src/wellness-routes.ts` | All `/api/wellness/*` routes |
| `backend/src/badges.ts` | CWP badge unlock rules (uses existing `Badge` model, category `CWP`) |
| `backend/src/wellness-level.ts` | Zen Sloth → Corporate Dragon levels |

### Wellness API endpoints (implemented)

```
GET    /api/wellness/categories
GET    /api/wellness/events?upcoming=true&categoryId=
GET    /api/wellness/events/:id
POST   /api/wellness/events
PATCH  /api/wellness/events/:id
DELETE /api/wellness/events/:id
GET    /api/wellness/events/:id/bookings
GET    /api/wellness/bookings/me
POST   /api/wellness/bookings
DELETE /api/wellness/bookings/:id
POST   /api/wellness/attendance
GET    /api/wellness/attendance/history
GET    /api/wellness/leaderboard
GET    /api/wellness/stats/me
GET    /api/wellness/leaderboard/departments
POST   /api/wellness/schedule-requests
GET    /api/wellness/schedule-requests
PATCH  /api/wellness/schedule-requests/:id  (SUPER_ADMIN, approve → bulk create events)
```

---

## New frontend files

| File | Purpose |
|------|---------|
| `frontend/src/types/wellness.ts` | TypeScript types |
| `frontend/src/lib/wellness-api.ts` | API client |
| `frontend/src/styles/platform.css` | CWP design tokens |
| `frontend/src/platform/app/CwpEmployeeDashboard.tsx` | Employee dashboard |
| `frontend/src/platform/components/wellness/*` | Shared components |

---

## Demo / local testing

1. `npm run db:push && npm run seed` (seeds categories, CWP badges, 2 demo wellness events for Asteria Group)
2. Marketing site: **Corporate → CWP Platform** → corporate portal
3. Sign in: `employee@demo.com` / `password123` (or Google if configured)
4. Dashboard: `/app/dashboard` on corporate host

---

## Conventions (from original spec)

- Reuse `hsos_token` / `hsos_user` — no new auth system
- Company scoping via JWT on backend — frontend never sends `companyId`
- Do **not** change: `MemberAuthContext`, `site-bookings.ts`, `MarketingSite` pages (except CWP nav link), Google OAuth in `CorporatePortal.tsx`
- Uses existing `Badge` + `UserBadge` models (not separate `BadgeDefinition`)

---

## Next implementation order

1. Trainer dashboard — create events, view attendees, mark attendance
2. HR dashboard — clickable leaderboard, Recharts analytics, schedule request UI
3. Super Admin — corporate CWP manager in `AdminApp`
4. Certificates — PDF via pdfkit on attendance

See the full original prompt in chat history / agent transcript for detailed UI specs per phase.
