# Project Context

- App: AtomQuest Portal
- Primary shell: role-based React app with auth, employee, manager, and admin routes
- Current login surface: `src/pages/auth/LoginPage.tsx`
- Ambient animation already present: `src/components/shared/LightRays.tsx`
- Layout shell for authenticated areas: `src/components/layout/AppShell.tsx`
- Core stack: React 19, Vite, TypeScript, Tailwind, Framer Motion, lucide-react

## Constraints

- Keep the existing `LightRays` effect alive on the login page.
- Do not disturb authenticated routes or the app shell.
- Preserve current auth behavior: email/password, Azure SSO, redirect-by-role.
- The login page should be the only surface that gets the new brutalist treatment.

