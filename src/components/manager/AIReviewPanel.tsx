import { useState } from 'react';
import { Sparkles, Loader2, ThumbsUp, AlertTriangle, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ReviewResult {
  summary: string;
  strengths: string[];
  concerns: string[];
  thrust_coverage: string;
  weightage_balance: string;
  recommendation: string;
  suggested_comment: string;
}

interface AIReviewPanelProps {
  employeeName: string;
  goals: { title: string; thrust_area: string; uom_type: string; weightage: number; status: string }[];
  onUseComment?: (comment: string) => void;
}

export function AIReviewPanel({ employeeName, goals, onUseComment }: AIReviewPanelProps) {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [error, setError] = useState('');

  async function handleReview() {
    setLoading(true); setError(''); setReview(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-coach', {
        body: { mode: 'review', goals, employeeName },
      });
      if (fnError) throw fnError;
      setReview(data.result as ReviewResult);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  const recColor = (r: string) => {
    if (r === 'approve') return 'text-emerald-400 bg-emerald-500/10';
    if (r === 'return_for_rework') return 'text-red-400 bg-red-500/10';
    return 'text-amber-400 bg-amber-500/10';
  };

  if (goals.length === 0) return null;

  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-semibold text-purple-300">AtomAI Review</span>
      </div>

      {!review && (
        <button type="button" onClick={handleReview} disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-500/15 px-3 py-2.5 text-xs font-medium text-purple-300 hover:bg-purple-500/25 disabled:opacity-40 transition-colors">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Analyze {employeeName}'s goal sheet
        </button>
      )}

      {review && (
        <div className="space-y-3">
          {/* Recommendation badge */}
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${recColor(review.recommendation)}`}>
            {review.recommendation === 'approve' ? <ThumbsUp className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {review.recommendation.replace(/_/g, ' ').toUpperCase()}
          </div>

          {/* Summary */}
          <p className="text-xs text-neutral-300 leading-relaxed">{review.summary}</p>

          {/* Strengths */}
          {review.strengths.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-1">Strengths</p>
              {review.strengths.map((s, i) => (
                <p key={i} className="text-xs text-neutral-400 flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">✓</span> {s}
                </p>
              ))}
            </div>
          )}

          {/* Concerns */}
          {review.concerns.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 mb-1">Concerns</p>
              {review.concerns.map((c, i) => (
                <p key={i} className="text-xs text-neutral-400 flex items-start gap-1.5">
                  <span className="text-amber-500 mt-0.5">!</span> {c}
                </p>
              ))}
            </div>
          )}

          {/* Coverage + balance */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-neutral-900/60 p-2">
              <p className="text-neutral-500 font-medium mb-0.5">Thrust Coverage</p>
              <p className="text-neutral-300">{review.thrust_coverage}</p>
            </div>
            <div className="rounded-lg bg-neutral-900/60 p-2">
              <p className="text-neutral-500 font-medium mb-0.5">Weightage Balance</p>
              <p className="text-neutral-300">{review.weightage_balance}</p>
            </div>
          </div>

          {/* Suggested comment */}
          {review.suggested_comment && onUseComment && (
            <button type="button" onClick={() => onUseComment(review.suggested_comment)}
              className="flex w-full items-center gap-1.5 rounded-lg border border-purple-500/20 bg-neutral-900/60 px-3 py-2 text-left text-[11px] text-neutral-300 hover:bg-purple-500/10 transition-colors">
              <MessageSquare className="h-3 w-3 shrink-0 text-purple-400" />
              <span className="flex-1">Use AI comment: <span className="italic text-purple-300">"{review.suggested_comment.slice(0, 60)}…"</span></span>
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
