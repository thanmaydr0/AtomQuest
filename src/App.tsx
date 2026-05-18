import { useEffect } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// Layout
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';

// Auth
import { LoginPage } from '@/pages/auth/LoginPage';
import { JudgeTourOverlay } from '@/components/JudgeTourOverlay';

// Employee pages
import EmployeeDashboard from '@/pages/employee/Dashboard';
import EmployeeCheckins from '@/pages/employee/Checkins';

// Manager pages
import ManagerTeamDashboard from '@/pages/manager/Dashboard';
import ManagerApprovals from '@/pages/manager/Approvals';
import ManagerCheckinReview from '@/pages/manager/CheckinReview';
import ManagerMyGoals from '@/pages/manager/MyGoals';

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard';
import AdminCycles from '@/pages/admin/Cycles';
import AdminOrgGraph from '@/pages/admin/OrgGraph';
import AdminUsers from '@/pages/admin/Users';
import AdminSharedGoals from '@/pages/admin/SharedGoals';
import AdminReports from '@/pages/admin/Reports';
import AdminAuditLog from '@/pages/admin/AuditLog';
import AdminEscalations from '@/pages/admin/Escalations';

// Wrap each page in error boundary
function E({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

function CatchAllRedirect() {
  const { role, loading } = useAuthStore();

  // While auth is initializing (e.g. processing OAuth tokens from URL hash),
  // show a spinner instead of redirecting — otherwise the redirect strips the tokens.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#fdb913] border-t-transparent" />
          <p className="text-sm text-neutral-400">Signing in…</p>
        </div>
      </div>
    );
  }

  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'manager') return <Navigate to="/manager" replace />;
  if (role) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function RootLayout() {
  return (
    <>
      <Outlet />
      <JudgeTourOverlay />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },

  // Employee routes
  {
    element: <ProtectedRoute allowedRoles={['employee', 'manager', 'admin']} />,
    children: [{
      element: <AppShell />,
      children: [
        { path: '/dashboard', element: <E><EmployeeDashboard /></E> },
        { path: '/checkins', element: <E><EmployeeCheckins /></E> },
      ],
    }],
  },

  // Manager routes
  {
    element: <ProtectedRoute allowedRoles={['manager', 'admin']} />,
    children: [{
      element: <AppShell />,
      children: [
        { path: '/manager', element: <E><ManagerTeamDashboard /></E> },
        { path: '/manager/approvals', element: <E><ManagerApprovals /></E> },
        { path: '/manager/checkins', element: <E><ManagerCheckinReview /></E> },
        { path: '/manager/my-goals', element: <E><ManagerMyGoals /></E> },
      ],
    }],
  },

  // Admin routes
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [{
      element: <AppShell />,
      children: [
        { path: '/admin', element: <E><AdminDashboard /></E> },
        { path: '/admin/cycles', element: <E><AdminCycles /></E> },
        { path: '/admin/org-graph', element: <E><AdminOrgGraph /></E> },
        { path: '/admin/users', element: <E><AdminUsers /></E> },
        { path: '/admin/shared-goals', element: <E><AdminSharedGoals /></E> },
        { path: '/admin/reports', element: <E><AdminReports /></E> },
        { path: '/admin/escalations', element: <E><AdminEscalations /></E> },
        { path: '/admin/audit', element: <E><AdminAuditLog /></E> },
      ],
    }],
  },

      { path: '/', element: <CatchAllRedirect /> },
      { path: '*', element: <CatchAllRedirect /> },
    ],
  },
]);

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => { initialize(); }, [initialize]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#171717',
            color: '#e5e5e5',
            border: '1px solid #262626',
            fontSize: '14px',
          },
        }}
      />
    </>
  );
}
