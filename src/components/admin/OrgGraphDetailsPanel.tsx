import { useState, useEffect } from 'react';
import { X, Loader2, Target, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { WorkflowTimeline } from '@/components/shared/WorkflowTimeline';
import type { Goal } from '@/types';

interface OrgGraphDetailsPanelProps {
  userId: string;
  onClose: () => void;
}

export function OrgGraphDetailsPanel({ userId, onClose }: OrgGraphDetailsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch active cycle
        const { data: cycle } = await supabase
          .from('goal_cycles')
          .select('cycle_id')
          .eq('status', 'active')
          .limit(1)
          .single();
        
        if (cycle) setActiveCycleId(cycle.cycle_id);

        // Fetch user
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', userId)
          .single();
        setUser(userData);

        // Fetch goals
        const { data: goalsData } = await supabase
          .from('goals')
          .select('*')
          .eq('owner_id', userId);
        setGoals(goalsData || []);

        // Fetch escalations
        const { data: escData } = await supabase
          .from('escalation_logs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5);
        setEscalations(escData || []);
      } catch (err) {
        console.error('Error loading panel data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  if (loading) {
    return (
      <div className="absolute right-0 top-0 z-50 flex h-full w-[400px] items-center justify-center border-l border-neutral-800 bg-[#0a0d14] shadow-2xl animate-in slide-in-from-right duration-300">
        <Loader2 className="h-6 w-6 animate-spin text-[#fdb913]" />
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-0 z-50 flex h-full w-[450px] flex-col border-l border-neutral-800 bg-[#0a0d14] shadow-2xl animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/50 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-white">{user?.name}</h2>
          <p className="text-xs text-neutral-400 capitalize">
            {user?.role} {user?.department ? `• ${user?.department}` : ''}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
        
        {/* Quick Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-emerald-400">
              <Target className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Total Goals</span>
            </div>
            <p className="text-2xl font-bold text-white">{goals.length}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Escalations</span>
            </div>
            <p className="text-2xl font-bold text-white">{escalations.length}</p>
          </div>
        </div>

        {/* Goals List (Abbreviated) */}
        {goals.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-neutral-300">Active Goals</h3>
            <div className="space-y-2">
              {goals.map(goal => (
                <div key={goal.goal_id} className="rounded-lg border border-neutral-800 bg-neutral-900/30 p-3">
                  <p className="text-sm font-medium text-white line-clamp-1">{goal.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                    <span className="uppercase text-[#fdb913]">{goal.status}</span>
                    <span>•</span>
                    <span>{goal.thrust_area}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Escalations */}
        {escalations.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-3 text-sm font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Recent Escalations
            </h3>
            <div className="space-y-3">
              {escalations.map(esc => (
                <div key={esc.escalation_id} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-xs font-semibold uppercase text-red-400">{esc.escalation_type}</p>
                  {esc.message && <p className="mt-1 text-sm text-neutral-300">{esc.message}</p>}
                  <p className="mt-2 text-xs text-neutral-500">{new Date(esc.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Timeline */}
        {activeCycleId && (
          <div>
            <h3 className="mb-3 text-sm font-semibold text-neutral-300">Activity Timeline</h3>
            <div className="-mx-6">
              <WorkflowTimeline userId={userId} cycleId={activeCycleId} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
