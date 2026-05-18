import { useEffect, useState } from 'react';
import { Sparkles, AlertTriangle, ChevronDown, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Goal } from '@/types';

interface RiskData {
  riskLevel: 'low' | 'medium' | 'high';
  delayProbability: number;
  escalationRisk: number;
  flags: string[];
  recommendation: string;
}

interface PredictiveRiskBadgeProps {
  goal: Goal;
  cyclePhase: string;
  checkins: any[];
}

export function PredictiveRiskBadge({ goal, cyclePhase, checkins }: PredictiveRiskBadgeProps) {
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchRisk() {
      // Check session cache first
      const cacheKey = `risk_${goal.goal_id}_${checkins.length}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          setRiskData(JSON.parse(cached));
          return;
        } catch (e) {
          // ignore cache parse error
        }
      }

      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            mode: 'predict_risk',
            cycle_phase: cyclePhase,
            goal: {
              title: goal.title,
              target_value: goal.target_value,
              uom_type: goal.uom_type,
              weightage: goal.weightage,
              thrust_area: goal.thrust_area
            },
            checkins: checkins.map(c => ({
              phase: c.phase,
              actual_achievement: c.actual_achievement,
              computed_score: c.computed_score
            }))
          })
        });

        if (res.ok) {
          const json = await res.json();
          if (json.result) {
            setRiskData(json.result);
            sessionStorage.setItem(cacheKey, JSON.stringify(json.result));
          }
        }
      } catch (err) {
        console.error('Failed to fetch risk score', err);
      } finally {
        setLoading(false);
      }
    }

    if (goal.status !== 'draft' && goal.status !== 'returned') {
      fetchRisk();
    }
  }, [goal.goal_id, checkins.length, cyclePhase, goal]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs text-neutral-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Analyzing Risk...
      </div>
    );
  }

  if (!riskData) return null;

  const getStyle = () => {
    switch (riskData.riskLevel) {
      case 'high': return { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', icon: <AlertTriangle className="h-3 w-3" /> };
      case 'medium': return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: <AlertCircle className="h-3 w-3" /> };
      default: return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: <CheckCircle2 className="h-3 w-3" /> };
    }
  };

  const style = getStyle();

  return (
    <div className="relative">
      <button 
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider transition-colors border ${style.bg} ${style.border} ${style.text} hover:bg-opacity-20`}
      >
        <Sparkles className="h-3 w-3" />
        {riskData.riskLevel} Risk
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-4 border-b border-neutral-800 bg-neutral-950">
            <h4 className="flex items-center gap-2 font-semibold text-white text-sm mb-3">
              <Sparkles className="h-4 w-4 text-[#fdb913]" /> AI Risk Prediction
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-neutral-900 rounded p-2 border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase">Delay Prob.</div>
                <div className="text-lg font-bold text-white">{riskData.delayProbability}%</div>
              </div>
              <div className="bg-neutral-900 rounded p-2 border border-neutral-800">
                <div className="text-[10px] text-neutral-500 uppercase">Escalation</div>
                <div className="text-lg font-bold text-white">{riskData.escalationRisk}%</div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-neutral-900">
            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold text-neutral-300 mb-1 block">Risk Flags:</span>
                <ul className="space-y-1.5">
                  {riskData.flags.map((flag, idx) => (
                    <li key={idx} className="text-xs text-neutral-400 flex items-start gap-1.5">
                      <span className="text-rose-400 mt-0.5">•</span> {flag}
                    </li>
                  ))}
                  {riskData.flags.length === 0 && (
                    <li className="text-xs text-neutral-500">No flags detected.</li>
                  )}
                </ul>
              </div>
              <div className="pt-2 border-t border-neutral-800">
                <span className="text-xs font-semibold text-[#fdb913] mb-1 block">Recommendation:</span>
                <p className="text-xs text-neutral-400 leading-relaxed">{riskData.recommendation}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
