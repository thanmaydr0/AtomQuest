import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertTriangle, Target, User } from 'lucide-react';

interface OrgNodeData {
  name: string;
  role: string;
  department: string | null;
  activeGoals: number;
  activeEscalations: number;
  isSelected?: boolean;
}

export const OrgNode = memo(({ data, isConnectable }: { data: OrgNodeData; isConnectable: boolean }) => {
  const isManager = data.role === 'manager' || data.role === 'admin';
  const hasRisk = data.activeEscalations > 0;
  
  return (
    <div className={`relative min-w-[200px] rounded-xl border ${
      data.isSelected 
        ? 'border-[#fdb913] shadow-[0_0_15px_rgba(253,185,19,0.3)] bg-neutral-900' 
        : hasRisk 
          ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)] bg-neutral-900'
          : 'border-neutral-800 bg-neutral-900/80'
    } p-4 transition-all duration-200 hover:border-neutral-600`}>
      
      {/* Top Handle for Incoming (Manager) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable} 
        className="w-2 h-2 !bg-neutral-600 border-none"
      />

      <div className="flex items-start justify-between gap-3">
        {/* Avatar Placeholder */}
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
          isManager ? 'border-purple-500/30 bg-purple-500/10 text-purple-400' : 'border-neutral-700 bg-neutral-800 text-neutral-400'
        }`}>
          <User className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="truncate font-semibold text-white text-sm">
            {data.name}
          </h3>
          <p className="truncate text-xs text-neutral-400 capitalize">
            {data.role} {data.department ? `• ${data.department}` : ''}
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mt-4 flex items-center gap-3 border-t border-neutral-800 pt-3">
        <div className="flex items-center gap-1.5" title="Active Goals">
          <Target className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs font-medium text-neutral-300">{data.activeGoals}</span>
        </div>
        
        {data.activeEscalations > 0 && (
          <div className="flex items-center gap-1.5" title="Active Escalations">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-400">{data.activeEscalations}</span>
          </div>
        )}
      </div>

      {hasRisk && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      )}

      {/* Bottom Handle for Outgoing (Reports) */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        isConnectable={isConnectable}
        className="w-2 h-2 !bg-neutral-600 border-none"
      />
    </div>
  );
});
