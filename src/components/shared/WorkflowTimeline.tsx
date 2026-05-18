import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Edit3, Send, CheckCircle, AlertCircle, Target, AlertTriangle, User, Calendar } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface TimelineEvent {
  event_time: string;
  event_type: 'goal_update' | 'check_in' | 'escalation';
  title: string;
  description: string;
  icon_type: string;
  actor_name: string;
  actor_role: string;
}

interface WorkflowTimelineProps {
  userId: string;
  cycleId: string;
}

export function WorkflowTimeline({ userId, cycleId }: WorkflowTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase.rpc('get_workflow_timeline', {
          p_user_id: userId,
          p_cycle_id: cycleId
        });
        if (error) throw error;
        setEvents(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    if (userId && cycleId) {
      loadEvents();
    }
  }, [userId, cycleId]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#fdb913]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-4 text-sm text-red-400">
        Failed to load timeline: {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
        <Calendar className="h-10 w-10 text-neutral-600 mb-3" />
        <p className="text-sm font-medium text-neutral-400">No events yet.</p>
        <p className="text-xs text-neutral-500 mt-1">Start by creating a goal to begin your timeline.</p>
      </div>
    );
  }

  const getIcon = (iconType: string) => {
    switch (iconType) {
      case 'Edit3': return <Edit3 className="h-4 w-4" />;
      case 'Send': return <Send className="h-4 w-4" />;
      case 'CheckCircle': return <CheckCircle className="h-4 w-4" />;
      case 'AlertCircle': return <AlertCircle className="h-4 w-4" />;
      case 'AlertTriangle': return <AlertTriangle className="h-4 w-4" />;
      case 'Target': return <Target className="h-4 w-4" />;
      default: return <Edit3 className="h-4 w-4" />;
    }
  };

  const getIconColors = (iconType: string) => {
    switch (iconType) {
      case 'CheckCircle': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'AlertCircle': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'AlertTriangle': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Send': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Target': return 'bg-[#fdb913]/20 text-[#fdb913] border-[#fdb913]/30';
      default: return 'bg-neutral-800 text-neutral-400 border-neutral-700';
    }
  };

  return (
    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-800 before:to-transparent">
      {events.map((event, idx) => (
        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          
          {/* Icon Marker */}
          <div className={`flex items-center justify-center w-10 h-10 rounded-full border shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-transform group-hover:scale-110 ${getIconColors(event.icon_type)}`}>
            {getIcon(event.icon_type)}
          </div>
          
          {/* Content Card */}
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-neutral-900/80 border border-neutral-800 backdrop-blur-sm rounded-xl p-4 shadow-sm transition-all hover:bg-neutral-800 hover:border-neutral-700">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h4 className="font-semibold text-white text-sm">{event.title}</h4>
              <time className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 shrink-0">
                {formatDistanceToNow(new Date(event.event_time), { addSuffix: true })}
              </time>
            </div>
            
            <p className="text-xs text-neutral-400 leading-relaxed mb-3">
              {event.description}
            </p>
            
            <div className="flex items-center justify-between border-t border-neutral-800 pt-3">
              <div className="flex items-center gap-1.5">
                <div className="h-5 w-5 rounded-full bg-neutral-800 flex items-center justify-center">
                  <User className="h-3 w-3 text-neutral-400" />
                </div>
                <span className="text-[11px] font-medium text-neutral-300">
                  {event.actor_name || 'System'}
                </span>
              </div>
              <span className="text-[10px] text-neutral-600">
                {format(new Date(event.event_time), 'MMM d, yyyy • h:mm a')}
              </span>
            </div>
          </div>
          
        </div>
      ))}
    </div>
  );
}
