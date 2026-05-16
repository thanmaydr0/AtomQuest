# AtomQuest — Goal Performance Portal

> **Atomberg's internal goal-setting, tracking, and performance management platform.**
> Built for the hackathon to demonstrate a production-ready OKR system with real-time scoring, escalation automation, and role-based dashboards.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript, Vite 6, React Router 7 |
| **State** | Zustand (lightweight, no boilerplate) |
| **Styling** | Tailwind CSS 4 + custom Atomberg design tokens |
| **Forms** | React Hook Form + Zod validation |
| **Charts** | Recharts |
| **Backend** | Supabase (Postgres + Auth + RLS + Edge Functions) |
| **Auth** | Supabase Auth with Microsoft Azure AD SSO |

### Why these choices?

- **Vite** → Sub-second HMR, optimised production builds with chunk splitting
- **Supabase Free Tier** → Zero-cost Postgres with RLS = no backend server needed, no idle cost
- **Zustand** → 1KB state management vs Redux's 7KB, perfect for this scope
- **Serverless Architecture** → No server to manage, scales automatically, judges can test instantly

---

## 📋 Features

### Employee Portal
- Create up to 8 goals per cycle with weighted scoring
- Real-time weightage meter (must total 100%)
- Submit goal sheets for manager approval
- Log quarterly check-ins with live score computation
- Shared goals (pushed by admin) with locked fields

### Manager Portal
- Review and approve/return team goal sheets
- Inline editing of targets and weightage
- Review team check-ins and add comments
- Team performance dashboard

### Admin Portal
- Cycle management (create, edit, close)
- User management (roles, departments, managers)
- Push shared goals to selected employees
- Achievement reports with CSV export
- Completion dashboards with progress bars
- Goal distribution charts (by thrust area, UoM, status)
- Escalation engine with automated alerts
- Full audit log with diff viewer

---

## ⚙️ Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AZURE_CLIENT_ID=your-azure-app-client-id      # Optional: for Microsoft SSO
VITE_AZURE_TENANT_ID=common                         # Optional: 'common' for multi-tenant
VITE_DEMO_MODE=true                                 # Optional: enables role-switch button
```

---

## 🏃 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env
# Fill in your Supabase URL and Anon Key

# 3. Start dev server
npm run dev
# → Opens at http://localhost:5173
```

---

## 🗄️ Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run these files in order:
   - `supabase_schema.sql` — Tables, RLS policies, triggers, seed data
   - `supabase_rls_fix.sql` — Additional RLS policies for goal submission
   - `supabase_seed_fix.sql` — Proper auth.users seed with identity records
   - `supabase_auth_trigger.sql` — Auto-provision public profile on SSO signup
   - `supabase_sso_fix.sql` — RLS policies for SSO self-provisioning
   - `supabase_escalation.sql` — Escalation engine (stored function + pg_cron)
3. Go to **Authentication → URL Configuration** and set:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: `http://localhost:5173`

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@atomquest.local` | `password123` |
| **Manager** | `manager@atomquest.local` | `password123` |
| **Employee** | `employee@atomquest.local` | `password123` |

> **Tip:** Set `VITE_DEMO_MODE=true` to enable a floating "Switch Role" button for judges.

---

## 📁 Project Structure

```
src/
├── components/
│   ├── employee/       # GoalCard, GoalFormModal
│   ├── layout/         # AppShell, ProtectedRoute
│   ├── manager/        # GoalReviewPanel
│   └── shared/         # ConfirmDialog, ErrorBoundary, Skeletons, DataTable
├── lib/
│   ├── constants.ts    # App-wide constants
│   ├── scoring.ts      # Pure scoring functions
│   └── supabase.ts     # Supabase client
├── pages/
│   ├── admin/          # Dashboard, Cycles, Users, Reports, etc.
│   ├── auth/           # LoginPage
│   ├── employee/       # Dashboard, Checkins
│   └── manager/        # Dashboard, Approvals, CheckinReview, MyGoals
├── stores/
│   ├── authStore.ts    # Authentication state
│   └── goalStore.ts    # Goal cycle state
└── types/              # TypeScript interfaces
```

---

## 📄 License

Internal hackathon project — Atomberg Technologies.
