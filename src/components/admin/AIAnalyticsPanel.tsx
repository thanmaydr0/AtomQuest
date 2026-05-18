import { useState } from 'react';
import { Sparkles, Send, Loader2, Lightbulb, BarChart3, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DataPoint {
  label: string;
  value: string;
}

interface AnalyticsResult {
  answer: string;
  data_points: DataPoint[];
  insight: string;
  confidence: 'high' | 'medium' | 'low';
}

const EXAMPLE_QUERIES = [
  'Which department has the most goals?',
  'Who has the highest average score?',
  'How many goals are still in draft?',
  'Which thrust area is most popular?',
  'Give me an executive summary of this cycle',
  'Which manager has the best check-in rate?',
  'Are there any employees with no goals?',
  'What percentage of goals are locked?',
];

export function AIAnalyticsPanel() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ q: string; a: AnalyticsResult }[]>([]);

  async function askQuestion(q?: string) {
    const query = q ?? question;
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error: fnError } = await supabase.functions.invoke('ai-coach', {
        body: { mode: 'analytics', question: query },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) throw fnError;

      const r = data.result as AnalyticsResult;
      setResult(r);
      setHistory((prev) => [{ q: query, a: r }, ...prev].slice(0, 10));
      setQuestion('');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const confidenceColor = {
    high: 'text-emerald-400 bg-emerald-500/10',
    medium: 'text-amber-400 bg-amber-500/10',
    low: 'text-red-400 bg-red-500/10',
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-950/30 to-neutral-900/80 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">AtomAI Analytics</span>
          <span className="text-[10px] text-purple-500">Ask anything about your organization's goals</span>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && askQuestion()}
            placeholder="e.g. Which department has the lowest Q2 completion rate?"
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800/80 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
            disabled={loading}
          />
          <button
            onClick={() => askQuestion()}
            disabled={loading || !question.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-purple-600/20 px-4 py-2 text-sm font-medium text-purple-300 transition-all hover:bg-purple-600/30 disabled:opacity-40 disabled:cursor-not-allowed border border-purple-600/30"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </div>

        {/* Quick suggestions */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.slice(0, 4).map((eq) => (
            <button
              key={eq}
              onClick={() => { setQuestion(eq); askQuestion(eq); }}
              disabled={loading}
              className="rounded-full border border-neutral-700/50 bg-neutral-800/40 px-2.5 py-1 text-[10px] text-neutral-400 hover:text-purple-300 hover:border-purple-500/30 transition-colors disabled:opacity-40"
            >
              {eq}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-950/20 p-3">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-4 animate-in fade-in duration-300">
          {/* Confidence badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">AI Response</span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${confidenceColor[result.confidence]}`}>
              {result.confidence} confidence
            </span>
          </div>

          {/* Answer */}
          <p className="text-sm text-neutral-200 leading-relaxed">{result.answer}</p>

          {/* Data points */}
          {result.data_points && result.data_points.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {result.data_points.map((dp, i) => (
                <div key={i} className="rounded-lg border border-neutral-700/50 bg-neutral-800/40 p-2.5">
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{dp.label}</p>
                  <p className="mt-0.5 text-sm font-bold text-white">{dp.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Insight */}
          {result.insight && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
              <Lightbulb className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200/80">{result.insight}</p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-neutral-600 font-semibold">Previous Queries</p>
          {history.slice(1).map((h, i) => (
            <div key={i} className="rounded-lg border border-neutral-800/50 bg-neutral-900/30 p-3">
              <p className="text-xs text-purple-400/80 mb-1 flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3" />
                {h.q}
              </p>
              <p className="text-xs text-neutral-400 line-clamp-2">{h.a.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
