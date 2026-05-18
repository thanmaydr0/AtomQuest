<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/zap.svg" alt="AtomQuest Logo" width="80" height="80">
  <h1 align="center">AtomQuest</h1>
  <p align="center">
    <strong>Next-Generation Goal Performance & OKR Management Portal</strong>
  </p>
  <p align="center">
    Built for the Hackathon 2026 — Demonstrating a production-ready, highly-scalable, and secure enterprise OKR system.
  </p>
  
  <div align="center">
    <a href="https://www.teser.in"><img src="https://img.shields.io/badge/Live_Demo-🚀-fdb913?style=for-the-badge&logoColor=white" alt="Live Demo"></a>
    <a href="https://react.dev"><img src="https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 18"></a>
    <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase"></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  </div>
</div>

<br />

> **Note:** If you are a Hackathon Judge, please jump to the [Demo Credentials](#-judge-demo-credentials) section below to start testing the platform instantly.

---

## ✨ Why AtomQuest?

AtomQuest goes beyond a simple CRUD application. It is engineered as a **distributed, highly-concurrent, and secure** enterprise platform designed to support 10,000+ Daily Active Users (DAU). 

### 🏆 Key Innovations
- **Event-Driven Architecture (Outbox Pattern)**: Uses atomic database transactions paired with Edge Function Webhooks to guarantee 100% reliable delivery of asynchronous notifications (Email/Teams), even under sudden traffic spikes.
- **Server-Is-Truth Security**: Implements strict PostgreSQL Row-Level Security (RLS) policies, server-side trigger enforcements for role management, and tamper-proof server timestamping to prevent client-side manipulation and IDOR vulnerabilities.
- **AI-Powered Analytics Engine**: Features an integrated `ai-coach` Edge Function for querying organizational performance data using natural language, safeguarded against prompt injection and rate-abuse.
- **Google Sheets Live Sync**: Allows one-click seamless synchronization of live organizational data to external Google Sheets.
- **Guided Onboarding Tour**: Includes a built-in `react-joyride` product tour for judges and new users, seamlessly bridging states between the Employee, Manager, and Admin workflows.

---

## 📸 Platform Sneak Peek

*(Add your actual screenshots below in the repository to replace these placeholders)*

<details>
  <summary><b>🖼️ View Dashboard Screenshots</b></summary>
  <br/>
  
  **Employee Dashboard:** *Real-time weightage calculation and goal submission.*
  > `<img src="docs/employee-dashboard.png" width="100%" alt="Employee Dashboard Placeholder">`
  
  **Manager Review Panel:** *Approve/Return workflows with inline commenting.*
  > `<img src="docs/manager-review.png" width="100%" alt="Manager Dashboard Placeholder">`
  
  **Admin Analytics:** *Company-wide goal distribution and completion heatmaps.*
  > `<img src="docs/admin-analytics.png" width="100%" alt="Admin Analytics Placeholder">`
</details>

---

## 🎯 Role-Based Workflows

AtomQuest is strictly segregated into three distinct organizational personas:

### 🧑‍💻 Employee
- Craft up to 8 goals per performance cycle.
- Manage weighted scoring with a dynamic 100% capacity meter.
- Submit goals to managers for approval.
- Execute quarterly check-ins (Not Started → On Track → Completed).

### 👔 Manager
- Comprehensive team dashboard showing sheet statuses (Draft, Submitted, Approved).
- Return goals with actionable feedback or securely lock them upon approval.
- Review and grade employee check-ins in real-time.

### 👑 System Admin
- Manage goal cycles (Active, Closed) and push organization-wide "Shared Goals".
- Full access to the **AI Analytics Panel** and Google Sheets Export integrations.
- Access system-wide Audit Logs and automated Escalation tracking.

---

## 🏗️ Architecture & Tech Stack

**Frontend layer:**
- **React 18 & TypeScript:** Strict typing for enterprise reliability.
- **Vite:** Lightning-fast HMR and optimized chunk splitting.
- **Zustand:** Ultra-lightweight state management avoiding Redux boilerplate.
- **Tailwind CSS & Lucide Icons:** Modern, glassmorphism-inspired UI with custom Atomberg design tokens.

**Backend layer (Supabase Ecosystem):**
- **PostgreSQL Database:** Relational data with heavily optimized indexes.
- **Supabase Auth:** Integrated SSO with Microsoft Azure AD (Optional).
- **Edge Functions (Deno):** Handles Outbox event processing and OpenAI natural language interactions.
- **Row-Level Security (RLS):** Military-grade data scoping ensuring users only see their own reports.

---

## 🧑‍⚖️ Judge Demo Credentials

To test the application, you can use the live demo link and log in with the seeded Judge accounts. 
*Note: `judge-employee` is configured to report directly to `judge-manager`.*

| Role | Email | Password |
|------|-------|----------|
| **👑 Admin** | `judge-admin@atomquest.com` | `judge2026` |
| **👔 Manager** | `judge-manager@atomquest.com` | `judge2026` |
| **🧑‍💻 Employee** | `judge-employee@atomquest.com` | `judge2026` |

> **💡 Pro Tip for Judges:** On the Login Screen, click the **"Start Hackathon Demo"** button to be taken on a guided, interactive tour across all three roles automatically!

---

## 🚀 Running Locally

If you'd like to run the portal locally, follow these steps:

### 1. Clone & Install
```bash
git clone https://github.com/your-org/atomquest-portal.git
cd atomquest-portal
npm install
```

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_AZURE_CLIENT_ID=your-azure-app-client-id  (Optional)
```

### 3. Database Migration
In your Supabase project, navigate to the **SQL Editor** and execute the migration files in this order:
1. `supabase_schema.sql` (Base tables)
2. `supabase_security_migration.sql` (Hardened RLS & Triggers)
3. `supabase_outbox_migration.sql` (Event-driven architecture)
4. `supabase_rls_fix.sql` (Recursion patches)
5. `supabase_demo_users.sql` & `supabase_more_demo_users.sql` (Seeding accounts)
6. `fix_judge_roles.sql` (Final role enforcements)

### 4. Start the Application
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

---

<div align="center">
  <p>Built with ❤️ by Thanmay Dambekodi</p>
  <p><i>Internal Hackathon Project — 2026</i></p>
</div>
