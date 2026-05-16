import { Target } from 'lucide-react';

export default function ManagerMyGoals() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Target className="h-6 w-6 text-[#fdb913]" />
          My Goals
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          View and manage your own performance goals
        </p>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
        <Target className="mx-auto h-12 w-12 text-neutral-700" />
        <h2 className="mt-4 text-lg font-semibold text-neutral-300">Manager's Own Goals</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Personal goal management coming soon. This route is shared with the employee goal view and accessible to <span className="text-emerald-400 font-medium">managers</span>.
        </p>
      </div>
    </div>
  );
}
