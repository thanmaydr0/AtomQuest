import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, Eye, EyeOff, Loader2, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, role, user, loading: authLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // If already authenticated, redirect
  useEffect(() => {
    if (user && role && !authLoading) {
      redirectByRole(role);
    }
  }, [user, role, authLoading]);

  function redirectByRole(r: string) {
    if (r === 'admin') navigate('/admin', { replace: true });
    else if (r === 'manager') navigate('/manager', { replace: true });
    else navigate('/dashboard', { replace: true });
  }

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
    // Use Supabase's built-in Azure AD provider
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'openid profile email',
        redirectTo: window.location.origin,
        queryParams: {
          // Pass tenant for multi-tenant Azure AD
          tenant: azureTenantId,
        },
      },
    });
    if (error) toast.error(error.message);
  }

  // Show spinner while auth is processing (e.g. OAuth callback token exchange)
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#fdb913] border-t-transparent" />
          <p className="text-sm text-neutral-400">Signing in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 px-4">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full bg-[#fdb913]/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdb913] shadow-lg shadow-[#fdb913]/25">
            <Zap className="h-7 w-7 text-black" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Atom<span className="text-[#fdb913]">Quest</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-400">Goal Performance Portal</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-1 text-lg font-semibold text-white">Sign in</h2>
          <p className="mb-6 text-sm text-neutral-400">
            Enter your credentials to access the portal
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
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

            {/* Password */}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#fdb913] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:bg-[#fdb913]/90 hover:shadow-lg hover:shadow-[#fdb913]/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Azure AD SSO — shows only when env vars are configured */}
          {hasAzureConfig && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-neutral-900 px-2 text-neutral-500">or</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAzureSSO}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-700 bg-neutral-800/40 px-4 py-2.5 text-sm font-medium text-neutral-200 transition-all hover:bg-neutral-800 hover:border-neutral-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 23 23" fill="none">
                  <path d="M11 0H0v11h11V0z" fill="#f25022" />
                  <path d="M23 0H12v11h11V0z" fill="#7fba00" />
                  <path d="M11 12H0v11h11V12z" fill="#00a4ef" />
                  <path d="M23 12H12v11h11V12z" fill="#ffb900" />
                </svg>
                Continue with Microsoft
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-neutral-600">
          © {new Date().getFullYear()} Atomberg Technologies. All rights reserved.
        </p>
      </div>
    </div>
  );
}
