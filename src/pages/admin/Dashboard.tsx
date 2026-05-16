import { BarChart3 } from 'lucide-react';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-[#fdb913]" />
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          System overview and administration
        </p>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
        <BarChart3 className="mx-auto h-12 w-12 text-neutral-700" />
        <h2 className="mt-4 text-lg font-semibold text-neutral-300">Admin Dashboard</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Admin analytics coming soon. This route is accessible to <span className="text-[#fdb913] font-medium">admins</span> only.
        </p>
      </div>
    </div>
  );
}
