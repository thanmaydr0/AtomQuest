import { useState } from 'react';
import { Sparkles, Loader2, Star, ArrowRight, Lightbulb } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SuggestResult {
  thrust_area: string; title: string; description: string;
  uom_type: string; target_value: number | null;
  deadline_date: string | null; weightage: number; reasoning: string;
}

interface ScoreResult {
  scores: { specific: number; measurable: number; achievable: number; relevant: number; timeBound: number };
  overall: number; tips: string[]; improved_title: string;
}

interface AICoachPanelProps {
  onSuggest: (data: SuggestResult) => void;
  goalData?: { title: string; description: string; thrust_area: string; uom_type: string; target_value: number | null } | null;
}

export function AICoachPanel({ onSuggest, goalData }: AICoachPanelProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'suggest' | 'score'>('suggest');
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [error, setError] = useState('');

  async function handleSuggest() {
    if (!input.trim()) return;
    setLoading(true); setError(''); setSuggestion(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-coach', {
        body: { mode: 'suggest', naturalText: input.trim() },
      });
      if (fnError) throw fnError;
      setSuggestion(data.result as SuggestResult);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  async function handleScore() {
    if (!goalData?.title) return;
    setLoading(true); setError(''); setScore(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-coach', {
        body: { mode: 'score', goal: goalData },
      });
      if (fnError) throw fnError;
      setScore(data.result as ScoreResult);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  const starColor = (v: number) => v >= 4 ? 'text-emerald-400' : v >= 3 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-semibold text-purple-300">AtomAI Coach</span>
        <div className="ml-auto flex gap-1">
          <button type="button" onClick={() => { setMode('suggest'); setScore(null); }}
            className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${mode === 'suggest' ? 'bg-purple-500/20 text-purple-300' : 'text-neutral-500 hover:text-neutral-300'}`}>
            Generate
          </button>
          <button type="button" onClick={() => { setMode('score'); setSuggestion(null); }}
            className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors ${mode === 'score' ? 'bg-purple-500/20 text-purple-300' : 'text-neutral-500 hover:text-neutral-300'}`}>
            Score
          </button>
        </div>
      </div>

      {mode === 'suggest' && (
        <>
          <div className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSuggest(); } }}
              placeholder="Describe your goal in plain English…"
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-purple-500" />
            <button type="button" onClick={handleSuggest} disabled={loading || !input.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-purple-500/20 px-3 py-2 text-xs font-medium text-purple-300 hover:bg-purple-500/30 disabled:opacity-40">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate
            </button>
          </div>
          {suggestion && (
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-purple-500/10 bg-neutral-900/60 p-3 text-xs">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="rounded-full bg-[#fdb913]/10 px-2 py-0.5 text-[10px] text-[#fdb913]">{suggestion.thrust_area}</span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 uppercase">{suggestion.uom_type}</span>
                  {suggestion.target_value != null && <span className="text-neutral-400">Target: {suggestion.target_value}</span>}
                  <span className="text-neutral-400">Weight: {suggestion.weightage}%</span>
                </div>
                <p className="font-medium text-white mb-1">{suggestion.title}</p>
                <p className="text-neutral-400">{suggestion.description}</p>
                <p className="mt-2 text-purple-400 italic">{suggestion.reasoning}</p>
              </div>
              <button type="button" onClick={() => onSuggest(suggestion)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-500/15 px-3 py-2 text-xs font-medium text-purple-300 hover:bg-purple-500/25 transition-colors">
                <ArrowRight className="h-3.5 w-3.5" /> Apply to form
              </button>
            </div>
          )}
        </>
      )}

      {mode === 'score' && (
        <>
          <button type="button" onClick={handleScore} disabled={loading || !goalData?.title}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-500/15 px-3 py-2 text-xs font-medium text-purple-300 hover:bg-purple-500/25 disabled:opacity-40">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
            {goalData?.title ? 'Score this goal' : 'Fill in the goal first'}
          </button>
          {score && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-400">Overall SMART Score</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={`h-4 w-4 ${i <= score.overall ? 'fill-current ' + starColor(score.overall) : 'text-neutral-700'}`} />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {Object.entries(score.scores).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <div className={`text-lg font-bold ${starColor(v)}`}>{v}</div>
                    <div className="text-[9px] text-neutral-500 capitalize">{k === 'timeBound' ? 'Time' : k}</div>
                  </div>
                ))}
              </div>
              {score.tips.length > 0 && (
                <div className="space-y-1">
                  {score.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-neutral-400">
                      <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-amber-400" />
                      {tip}
                    </div>
                  ))}
                </div>
              )}
              {score.improved_title !== goalData?.title && (
                <button type="button" onClick={() => onSuggest({ thrust_area: goalData?.thrust_area ?? '', title: score.improved_title, description: goalData?.description ?? '', uom_type: goalData?.uom_type ?? 'max', target_value: goalData?.target_value ?? null, deadline_date: null, weightage: 0, reasoning: '' })}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-purple-500/20 px-3 py-2 text-[11px] text-purple-300 hover:bg-purple-500/10">
                  <Sparkles className="h-3 w-3" /> Use improved title: "{score.improved_title}"
                </button>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
