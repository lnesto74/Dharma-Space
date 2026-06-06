# Dharma Space

Corporate upskilling and wellbeing MVP for the AI era. The implementation follows the Google Stitch UX direction as the visual reference: ivory canvas, deep navy actions, sage recovery signals, warm sand cards, soft shadows, rounded containers, calm dashboards, and professional mindful gamification.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, lucide-react, Recharts, Framer Motion
- Backend: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL (DigitalOcean in production, Docker locally), JWT auth, bcrypt password hashing
- Architecture: npm workspaces with `/frontend` and `/backend`

## Quick Start

```bash
npm install
docker compose up -d db
cp backend/.env.example backend/.env   # then add SMTP secrets
npm run db:push
npm run seed
npm run dev
```

Frontend runs at `http://localhost:7011`.
Backend runs at `http://localhost:7010`.

## Demo Accounts

All demo passwords are:

```text
password123
```

| Role | Email |
|---|---|
| Employee | `employee@demo.com` |
| HR Admin | `hr@demo.com` |
| Trainer | `trainer@demo.com` |
| Corporate Admin | `company@demo.com` |
| Platform Super Admin | `admin@demo.com` |

## Implemented Features

- JWT register, login, logout, session restore, and role-based protected routes.
- Course marketplace with search, category filters, detail pages, enrollment, curriculum modules, certification flags, and premium course cards.
- Employee dashboard with routine, check-ins, progress rings, XP by skill type, recommendations, certificates, and mindful gamification.
- Wellbeing check-in flow with mood, stress, energy, sleep, focus, private note, personal trends, and AI recommendation placeholders.
- HR dashboard with aggregate workforce KPIs, department engagement, anonymous wellbeing trends, burnout risk indicators, ROI signals, and privacy-safe data handling.
- Trainer dashboard with course, learner, session, revenue, feedback, and course-builder surfaces.
- Corporate admin dashboard with seats, subscriptions, invoices, SSO placeholder, invitations, and permissions-oriented UI.
- Super admin dashboard with platform companies, users, trainers, courses, subscriptions, and revenue metrics.
- Certification display with certificate number, verification status, download/LinkedIn placeholders.
- Seeded data for companies, departments, users, trainers, courses, modules, sessions, attendance, wellbeing check-ins, challenges, badges, enrollments, certificates, and invoices.

## API Highlights

The backend exposes the requested REST surface under `/api`, including:

- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- Courses: `/api/courses`, `/api/courses/:id`
- Enrollments: `/api/enrollments`, `/api/enrollments/me`
- Wellbeing: `/api/wellbeing/checkin`, `/api/wellbeing/me`, `/api/wellbeing/company-aggregate`
- HR: `/api/hr/dashboard`, `/api/hr/departments`, `/api/hr/analytics`, `/api/hr/reports`
- Trainer: `/api/trainer/dashboard`, `/api/trainer/courses`, `/api/trainer/participants`
- Challenges: `/api/challenges`
- Certificates: `/api/certificates/me`, `/api/certificates/issue`
- Admin: `/api/admin/dashboard`, `/api/admin/companies`, `/api/admin/users`

## DigitalOcean deployment (backend)

The backend is configured for **PostgreSQL** on App Platform:

1. Attach a **Dev database** (Postgres 17) in the App Platform UI.
2. Set `DATABASE_URL` to `${your-db-name.DATABASE_URL}` (DigitalOcean injects the connection string).
3. Set `JWT_SECRET`, SMTP variables, and `FRONTEND_URL` as encrypted env vars.
4. **Build command:** `npm install && npm run build -w backend`
5. **Run command:** `npm run start:prod -w backend`
6. **HTTP port:** `8080` (App Platform default; the server reads `PORT` automatically).

On first boot the API runs `prisma db push` against Postgres, then seeds marketing site content if the database is empty.

See `.do/app.yaml` for a starter App Platform spec.

## Future Improvements

- Replace AI placeholders with model-backed recommendations and burnout risk analysis.
- Add file-backed certificate PDF export and real LinkedIn sharing.
- Add SSO/SAML/OIDC integration and invitation email delivery.
- Expand trainer course builder into a full multi-step editor.
- Add Prisma migrations, tests, and a full deployment pipeline.
