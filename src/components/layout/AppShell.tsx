import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Target,
  ClipboardCheck,
  Users,
  CheckSquare,
  BarChart3,
  Calendar,
  UserCog,
  Share2,
  FileText,
  Shield,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { DemoModeSwitcher } from '@/components/shared/DemoModeSwitcher';
import toast from 'react-hot-toast';
import type { Role } from '@/types';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

function getNavItems(role: Role): NavItem[] {
  switch (role) {
    case 'employee':
      return [
        { label: 'My Goals', to: '/dashboard', icon: <Target className="h-4 w-4" /> },
        { label: 'Check-ins', to: '/checkins', icon: <ClipboardCheck className="h-4 w-4" /> },
      ];
    case 'manager':
      return [
        { label: 'My Team', to: '/manager', icon: <Users className="h-4 w-4" /> },
        { label: 'Approvals', to: '/manager/approvals', icon: <CheckSquare className="h-4 w-4" /> },
        { label: 'Check-in Review', to: '/manager/checkins', icon: <ClipboardCheck className="h-4 w-4" /> },
        { label: 'My Goals', to: '/manager/my-goals', icon: <Target className="h-4 w-4" /> },
      ];
    case 'admin':
      return [
        { label: 'Dashboard', to: '/admin', icon: <BarChart3 className="h-4 w-4" /> },
        { label: 'Cycles', to: '/admin/cycles', icon: <Calendar className="h-4 w-4" /> },
        { label: 'Users', to: '/admin/users', icon: <UserCog className="h-4 w-4" /> },
        { label: 'Shared Goals', to: '/admin/shared-goals', icon: <Share2 className="h-4 w-4" /> },
        { label: 'Reports', to: '/admin/reports', icon: <FileText className="h-4 w-4" /> },
        { label: 'Escalations', to: '/admin/escalations', icon: <AlertTriangle className="h-4 w-4" /> },
        { label: 'Audit Log', to: '/admin/audit', icon: <Shield className="h-4 w-4" /> },
      ];
    default:
      return [];
  }
}

const roleBadgeColors: Record<Role, string> = {
  employee: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  manager: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  admin: 'bg-[#fdb913]/15 text-[#fdb913] border-[#fdb913]/20',
};

export function AppShell() {
  const { user, role, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user || !role) return null;

  const navItems = getNavItems(role);

  async function handleLogout() {
    await signOut();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-neutral-800 bg-black transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-neutral-800 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fdb913]">
            <Zap className="h-4 w-4 text-black" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            Atom<span className="text-[#fdb913]">Quest</span>
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto text-neutral-400 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            Navigation
          </div>
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/dashboard' || item.to === '/manager' || item.to === '/admin'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#fdb913] text-black shadow-sm shadow-[#fdb913]/20'
                        : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={isActive ? 'text-black' : 'text-neutral-500 group-hover:text-neutral-300'}>
                        {item.icon}
                      </span>
                      <span className="flex-1">{item.label}</span>
                      {isActive && <ChevronRight className="h-3.5 w-3.5 text-black/40" />}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar footer — user info */}
        <div className="border-t border-neutral-800 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-neutral-300">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-200">{user.name}</p>
              <p className="truncate text-xs text-neutral-500">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-neutral-800 bg-neutral-950/80 px-4 backdrop-blur-sm lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-neutral-400 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          {/* Role badge */}
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${roleBadgeColors[role]}`}
          >
            {role}
          </span>

          {/* User name */}
          <span className="hidden text-sm font-medium text-neutral-300 sm:inline">
            {user.name}
          </span>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-neutral-950 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Demo mode floating role switcher */}
      <DemoModeSwitcher />
    </div>
  );
}
