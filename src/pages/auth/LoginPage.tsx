import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, LogIn, Zap, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { useTourStore } from '@/stores/tourStore';
import { supabase } from '@/lib/supabase';
import { LightRays } from '@/components/shared/LightRays';
import { CreepyButton } from '@/components/shared/CreepyButton';
import { JellySqueeze } from '@/components/shared/JellySqueeze';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, role, user, loading: authLoading } = useAuthStore();
  const { startTour } = useTourStore();
  const [showPassword, setShowPassword] = useState(false);
  const [demoStarting, setDemoStarting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const redirectByRole = useCallback(
    (r: string) => {
      if (r === 'admin') navigate('/admin', { replace: true });
      else if (r === 'manager') navigate('/manager', { replace: true });
      else navigate('/dashboard', { replace: true });
    },
    [navigate]
  );

  useEffect(() => {
    if (user && role && !authLoading) {
      redirectByRole(role);
    }
  }, [user, role, authLoading, redirectByRole]);

  async function onSubmit(values: LoginForm) {
    try {
      await signIn(values.email, values.password);
      toast.success('Welcome back!');
      const currentRole = useAuthStore.getState().role;
      if (currentRole) redirectByRole(currentRole);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      toast.error(message);
    }
  }

  const azureClientId = import.meta.env.VITE_AZURE_CLIENT_ID;
  const azureTenantId = import.meta.env.VITE_AZURE_TENANT_ID;
  const hasAzureConfig = Boolean(azureClientId && azureTenantId);

  async function handleAzureSSO() {
    if (!azureTenantId) return;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid profile email',
        redirectTo: window.location.origin,
        queryParams: {
          tenant: azureTenantId,
        },
      },
    });

    if (error) toast.error(error.message);
  }

  async function handleStartDemo() {
    setDemoStarting(true);
    try {
      startTour();
      await signIn('demo-employee@atomquest.com', 'judge2026');
      const currentRole = useAuthStore.getState().role;
      if (currentRole) {
        redirectByRole(currentRole);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(`Demo failed: ${err.message}`);
      useTourStore.getState().exitTour();
    } finally {
      setDemoStarting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#fdb913] border-t-transparent" />
          <p className="text-sm text-neutral-400">Signing in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(253,185,19,0.18),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_28%),linear-gradient(135deg,#05060a_0%,#0a0d14_45%,#05060a_100%)]" />
      <LightRays
        raysOrigin="top-center"
        raysColor="#fdb913"
        raysSpeed={1.15}
        lightSpread={1.08}
        rayLength={1.7}
        pulsating
        followMouse
        mouseInfluence={0.12}
        noiseAmount={0.025}
        distortion={0.06}
        className="opacity-85 mix-blend-screen"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,6,10,0.2),rgba(5,6,10,0.75))]" />

      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-10 px-4 py-6 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:gap-12 lg:px-10 xl:px-16">
        <section className="hidden max-w-xl lg:block">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-neutral-400">
              <Zap className="h-3.5 w-3.5 text-[#fdb913]" />
              AtomQuest
            </div>

            <div className="space-y-4">
              <h1 className="max-w-lg text-5xl font-semibold tracking-[-0.05em] text-white xl:text-6xl">
                Goal performance portal
              </h1>
              <p className="max-w-md text-base leading-8 text-neutral-400 xl:text-lg">
                Internal goal-setting, tracking, and performance management for employees,
                managers, and admins.
              </p>
            </div>

            <div className="grid max-w-lg grid-cols-2 gap-3">
              <div className="border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                  Goals
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Weighted objectives and cycle tracking.
                </p>
              </div>
              <div className="border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                  Approvals
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Review and return workflows for managers.
                </p>
              </div>
              <div className="border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                  Reports
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Performance and completion trends.
                </p>
              </div>
              <div className="border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-white">
                  Escalations
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Automated alerts for overdue work.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-10 w-full max-w-[440px] rounded-[36px] bg-[#b1b3c0] shadow-[0_0_60px_-15px_rgba(255,255,255,0.15)] relative overflow-hidden ring-1 ring-white/10 mx-auto lg:mx-0">
             <div className="p-8 pb-2 h-full">
               <JellySqueeze title="Need a moment? Squeeze the jelly." />
             </div>
          </div>
        </section>

        <div className="flex justify-end">
          <div className="w-full max-w-[600px] rounded-[28px] border border-white/10 bg-neutral-950/80 p-7 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdb913] shadow-lg shadow-[#fdb913]/25">
                <Zap className="h-7 w-7 text-black" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Atom<span className="text-[#fdb913]">Quest</span>
              </h1>
              <p className="mt-1 text-sm text-neutral-400">Goal performance portal</p>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="mb-1 text-lg font-semibold text-white">Sign in</h2>
                <p className="text-sm text-neutral-400">
                  Enter your credentials to access the portal.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-300">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@atomberg.com"
                    className={`w-full rounded-lg border bg-neutral-800/60 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition-colors focus:border-[#fdb913] focus:ring-1 focus:ring-[#fdb913]/50 ${
                      errors.email ? 'border-red-500' : 'border-neutral-700'
                    }`}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-1.5 block text-sm font-medium text-neutral-300"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={`w-full rounded-lg border bg-neutral-800/60 px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-neutral-500 outline-none transition-colors focus:border-[#fdb913] focus:ring-1 focus:ring-[#fdb913]/50 ${
                        errors.password ? 'border-red-500' : 'border-neutral-700'
                      }`}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-neutral-300"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>

                <CreepyButton
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  <span className="flex items-center justify-center gap-2">
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <LogIn className="h-4 w-4" />
                    )}
                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                  </span>
                </CreepyButton>
              </form>

              {hasAzureConfig && (
                <>
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-neutral-800" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-neutral-950 px-2 text-neutral-500">or</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAzureSSO}
                    className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-700 bg-neutral-800/40 px-4 py-2.5 text-sm font-medium text-neutral-200 transition-all hover:bg-neutral-800 hover:border-neutral-600"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 23 23" fill="none" aria-hidden="true">
                      <path d="M11 0H0v11h11V0z" fill="#f25022" />
                      <path d="M23 0H12v11h11V0z" fill="#7fba00" />
                      <path d="M11 12H0v11h11V12z" fill="#00a4ef" />
                      <path d="M23 12H12v11h11V12z" fill="#ffb900" />
                    </svg>
                    Continue with Microsoft
                  </button>
                </>
              )}
              
              <div className="mt-8 border-t border-white/10 pt-6">
                <button
                  type="button"
                  onClick={handleStartDemo}
                  disabled={demoStarting}
                  className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-neutral-900 px-4 py-3.5 text-sm font-bold text-white shadow-[0_0_40px_-10px_rgba(253,185,19,0.3)] transition-all hover:scale-[1.02] hover:bg-neutral-800 hover:shadow-[0_0_60px_-15px_rgba(253,185,19,0.5)] border border-[#fdb913]/30 disabled:opacity-50"
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <div className="h-[1px] w-[200px] bg-gradient-to-r from-transparent via-[#fdb913] to-transparent shadow-[0_0_20px_rgba(253,185,19,1)]" />
                  </div>
                  {demoStarting ? <Loader2 className="h-5 w-5 text-[#fdb913] animate-spin" /> : <Sparkles className="h-5 w-5 text-[#fdb913]" />}
                  <span>{demoStarting ? 'Starting Demo...' : 'Start Hackathon Judge Demo'}</span>
                </button>
                <p className="mt-3 text-center text-xs text-neutral-500">
                  One-click guided tour. No password required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
