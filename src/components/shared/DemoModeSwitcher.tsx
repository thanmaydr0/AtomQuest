import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Shuffle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const DEMO_ACCOUNTS = [
  { label: 'Employee', email: 'employee@atomquest.local', password: 'password123', path: '/dashboard' },
  { label: 'Manager', email: 'manager@atomquest.local', password: 'password123', path: '/manager' },
  { label: 'Admin', email: 'admin@atomquest.local', password: 'password123', path: '/admin' },
];

export function DemoModeSwitcher() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const currentRole = useAuthStore((s) => s.role);

  if (!isDemoMode) return null;

  async function switchTo(account: typeof DEMO_ACCOUNTS[number]) {
    setSwitching(true);
    try {
      // Sign out current session
      await supabase.auth.signOut();

      // Sign in as the new role
      const { error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });

      if (error) {
        toast.error(`Switch failed: ${error.message}`);
        setSwitching(false);
        return;
      }

      // Wait for auth store to update
      await new Promise((r) => setTimeout(r, 300));
      await useAuthStore.getState().initialize();

      toast.success(`Switched to ${account.label}`);
      navigate(account.path, { replace: true });
      setOpen(false);
    } catch {
      toast.error('Switch failed');
    }
    setSwitching(false);
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded-full bg-[#fdb913] px-4 py-2.5 text-sm font-bold text-black shadow-lg shadow-[#fdb913]/25 hover:bg-[#e5a710] transition-all hover:scale-105"
      >
        <Shuffle className="h-4 w-4" />
        Demo: {currentRole ?? '…'}
      </button>

      {/* Role switcher panel */}
      {open && (
        <div className="fixed bottom-16 right-5 z-[9999] w-64 rounded-2xl border border-neutral-800 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-lg">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Switch Role</h3>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-800">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.label}
                onClick={() => switchTo(acc)}
                disabled={switching || currentRole === acc.label.toLowerCase()}
                className={`w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-all ${
                  currentRole === acc.label.toLowerCase()
                    ? 'bg-[#fdb913]/15 text-[#fdb913] border border-[#fdb913]/30 cursor-default'
                    : 'text-neutral-300 hover:bg-neutral-800 border border-transparent'
                } disabled:opacity-50`}
              >
                <div className="font-semibold">{acc.label}</div>
                <div className="text-[10px] text-neutral-500">{acc.email}</div>
              </button>
            ))}
          </div>
          {switching && (
            <div className="mt-3 text-center text-xs text-neutral-500">Switching…</div>
          )}
        </div>
      )}
    </>
  );
}
