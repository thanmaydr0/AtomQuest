import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';
import type { Role } from '@/types';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

function getRoleHome(role: Role): string {
  if (role === 'admin') return '/admin';
  if (role === 'manager') return '/manager';
  return '/dashboard';
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuthStore();

  // Still checking auth status
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#fdb913]" />
          <p className="text-sm text-neutral-400">Loading…</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user || !role) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but wrong role
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getRoleHome(role)} replace />;
  }

  return <Outlet />;
}
