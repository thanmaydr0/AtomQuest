import { useState } from 'react';
import { Sparkles, Loader2, Target, TrendingUp, AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Goal } from '@/types';
import toast from 'react-hot-toast';

interface WhatIfSimulatorProps {
  goal: Goal;
  cyclePhase: string;
  onClose: () => void;
}

interface SimulationResult {
  predicted_score: number;
  completion_probability: number;
  escalation_risk: number;
  insight: string;
}

export function WhatIfSimulator({ goal, cyclePhase, onClose }: WhatIfSimulatorProps) {
  const [proposedWeightage, setProposedWeightage] = useState(goal.weightage);
  const [proposedTarget, setProposedTarget] = useState<string>(
    goal.target_value ? String(goal.target_value) : ''
  );
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const isTimelineOrZero = goal.uom_type === 'timeline' || goal.uom_type === 'zero';

  async function handleSimulate() {
    setLoading(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const numTarget = proposedTarget ? Number(proposedTarget) : null;
      if (!isTimelineOrZero && isNaN(numTarget as number)) {
        toast.error('Invalid target value');
        setLoading(false);
        return;
      }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: 'simulate',
          cycle_phase: cyclePhase,
          goal: {
            title: goal.title,
            target_value: goal.target_value,
            uom_type: goal.uom_type,
            weightage: goal.weightage,
            thrust_area: goal.thrust_area
          },
          proposed_goal: {
            target_value: isTimelineOrZero ? null : numTarget,
            weightage: proposedWeightage
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Simulation failed: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      setResult(json.result);
      
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-[#0a0d14] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/50">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <Sparkles className="h-5 w-5 text-[#fdb913]" />
              What-If Simulator
            </h2>
            <p className="text-xs text-neutral-400 mt-1 truncate max-w-[300px]">
              {goal.title}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          
          <div className="space-y-6">
            
            {/* Parameters */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-neutral-300">Tweak Parameters</h3>
              
              <div>
                <label className="flex justify-between text-xs font-medium text-neutral-400 mb-2">
                  <span>Weightage</span>
                  <span className={proposedWeightage !== goal.weightage ? "text-[#fdb913]" : "text-white"}>
                    {proposedWeightage}%
                  </span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={proposedWeightage}
                  onChange={(e) => setProposedWeightage(Number(e.target.value))}
                  className="w-full accent-[#fdb913] h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {!isTimelineOrZero && (
                <div>
                  <label className="flex justify-between text-xs font-medium text-neutral-400 mb-2">
                    <span>Target ({goal.uom_type.toUpperCase()})</span>
                  </label>
                  <input
                    type="number"
                    value={proposedTarget}
                    onChange={(e) => setProposedTarget(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-white outline-none focus:border-[#fdb913] focus:ring-1 focus:ring-[#fdb913]/50 transition-colors"
                    placeholder="Enter new target value"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleSimulate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#fdb913] px-4 py-2.5 text-sm font-bold text-black transition-all hover:bg-[#e5a710] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-5px_rgba(253,185,19,0.4)]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              {loading ? 'Simulating Impact...' : 'Simulate Impact'}
            </button>

            {/* Results */}
            {result && (
              <div className="mt-6 pt-6 border-t border-neutral-800 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <h3 className="text-sm font-semibold text-white mb-4">Predicted Outcomes</h3>
                
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800 flex flex-col items-center text-center">
                    <Target className="h-4 w-4 text-emerald-400 mb-2" />
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">Completion</span>
                    <span className="text-lg font-bold text-white mt-0.5">{result.completion_probability}%</span>
                  </div>
                  
                  <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800 flex flex-col items-center text-center">
                    <TrendingUp className="h-4 w-4 text-blue-400 mb-2" />
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">Exp. Score</span>
                    <span className="text-lg font-bold text-white mt-0.5">{result.predicted_score}</span>
                  </div>

                  <div className="bg-neutral-900/80 rounded-xl p-3 border border-neutral-800 flex flex-col items-center text-center">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mb-2" />
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">Escalation</span>
                    <span className="text-lg font-bold text-white mt-0.5">{result.escalation_risk}%</span>
                  </div>
                </div>

                <div className="bg-[#fdb913]/10 border border-[#fdb913]/20 rounded-xl p-4">
                  <span className="text-xs font-bold text-[#fdb913] uppercase tracking-wider mb-1 block">
                    Strategic Insight
                  </span>
                  <p className="text-sm text-neutral-200 leading-relaxed">
                    {result.insight}
                  </p>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
