import { useCallback, useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Activity, Users, Sparkles, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { cachedRpc, invalidateAll } from '@/lib/analyticsCache';
import { SkeletonCards } from '@/components/shared/Skeletons';
import type { GoalCycle } from '@/types';
import { AIAnalyticsPanel } from '@/components/admin/AIAnalyticsPanel';

const COLORS = ['#fdb913','#f59e0b','#d97706','#b45309','#92400e','#78350f'];
const STATUS_CLR: Record<string,string> = { draft:'#6b7280', submitted:'#3b82f6', approved:'#10b981', locked:'#8b5cf6', returned:'#f97316' };
const TT = { background:'#171717', border:'1px solid #262626', borderRadius:8, fontSize:12 };

type TabId = 'qoq'|'heatmap'|'distribution'|'manager'|'ai';

interface KPI { label:string; value:string|number; sub?:string; icon:React.ReactNode; color:string }

// ── RPC result shapes (match SQL function returns)
interface QoQPoint { phase:string; avgScore:number; goalCount:number; completionPct:number }
interface HeatCell { name:string; department:string; pct:number }
interface SliceD { name:string; value:number; color?:string }
interface MgrEff { [k:string]:unknown; name:string; team:number; checkinsDone:number; pct:number; avgScore:number }
interface DistributionData { thrust: SliceD[]; uom: SliceD[]; status: SliceD[] }

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabId>('qoq');
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [cycleName, setCycleName] = useState('');
  const [cycleId, setCycleId] = useState<string|null>(null);
  const [phase, setPhase] = useState('q1');

  // Tab-specific data — loaded lazily
  const [qoq, setQoq] = useState<QoQPoint[]|null>(null);
  const [heat, setHeat] = useState<HeatCell[]|null>(null);
  const [distrib, setDistrib] = useState<DistributionData|null>(null);
  const [mgrEff, setMgrEff] = useState<MgrEff[]|null>(null);

  // ── Load KPIs + cycle info (always)
  const loadCore = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
      invalidateAll();
    } else {
      setLoading(true);
    }

    const { data: cData } = await supabase
      .from('goal_cycles').select('*').eq('status','active').limit(1).single();

    const cy = cData as GoalCycle|null;
    if (!cy) {
      setCycleName('No active cycle');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setCycleName(cy.cycle_name);
    setCycleId(cy.cycle_id);
    setPhase(cy.phase);

    try {
      const data = await cachedRpc<{
        total_goals:number; approved_locked:number; avg_score:number;
        employee_count:number; manager_count:number;
      }>('get_admin_kpis', { p_cycle_id: cy.cycle_id });

      setKpis([
        { label:'Total Goals', value:data.total_goals, sub:`${data.employee_count} employees`, icon:<BarChart3 className="h-5 w-5"/>, color:'text-[#fdb913]' },
        { label:'Approved / Locked', value:data.approved_locked, sub:`${data.total_goals?Math.round(data.approved_locked/data.total_goals*100):0}% of total`, icon:<Activity className="h-5 w-5"/>, color:'text-emerald-400' },
        { label:'Avg Score', value:`${data.avg_score}%`, sub:'scored check-ins', icon:<TrendingUp className="h-5 w-5"/>, color:'text-amber-400' },
        { label:'Managers', value:data.manager_count, sub:`${data.employee_count} reports`, icon:<Users className="h-5 w-5"/>, color:'text-blue-400' },
      ]);
    } catch (err) {
      console.error('Failed to load KPIs:', err);
    }

    setLoading(false);
    setRefreshing(false);
  },[]);

  // ── Lazy tab data loaders
  const loadTab = useCallback(async (t: TabId) => {
    if (!cycleId) return;
    try {
      switch (t) {
        case 'qoq':
          if (!qoq) {
            const data = await cachedRpc<QoQPoint[]>('get_qoq_trends', { p_cycle_id: cycleId });
            setQoq(data ?? []);
          }
          break;
        case 'heatmap':
          if (!heat) {
            const data = await cachedRpc<HeatCell[]>('get_completion_heatmap', { p_cycle_id: cycleId });
            setHeat(data ?? []);
          }
          break;
        case 'distribution':
          if (!distrib) {
            const data = await cachedRpc<DistributionData>('get_goal_distribution', { p_cycle_id: cycleId });
            setDistrib(data);
          }
          break;
        case 'manager':
          if (!mgrEff) {
            const data = await cachedRpc<MgrEff[]>('get_manager_effectiveness', { p_cycle_id: cycleId, p_phase: phase });
            setMgrEff(data ?? []);
          }
          break;
      }
    } catch (err) {
      console.error(`Failed to load ${t} tab:`, err);
    }
  },[cycleId, phase, qoq, heat, distrib, mgrEff]);

  // Initial load
  useEffect(()=>{ loadCore(); },[loadCore]);

  // Load default tab data once cycle is known
  useEffect(()=>{
    if (cycleId && tab !== 'ai') loadTab(tab);
  },[cycleId, tab, loadTab]);

  // Handle forced refresh — clear tab caches so they reload
  const handleRefresh = useCallback(async () => {
    setQoq(null); setHeat(null); setDistrib(null); setMgrEff(null);
    await loadCore(true);
  }, [loadCore]);

  // Handle tab switch
  const handleTabSwitch = useCallback((t: TabId) => {
    setTab(t);
  }, []);

  const tabs = [
    { id:'qoq' as const, label:'QoQ Trends', icon:<TrendingUp className="h-3.5 w-3.5"/> },
    { id:'heatmap' as const, label:'Completion Heatmap', icon:<Activity className="h-3.5 w-3.5"/> },
    { id:'distribution' as const, label:'Goal Distribution', icon:<BarChart3 className="h-3.5 w-3.5"/> },
    { id:'manager' as const, label:'Manager Effectiveness', icon:<Users className="h-3.5 w-3.5"/> },
    { id:'ai' as const, label:'AI Analytics', icon:<Sparkles className="h-3.5 w-3.5"/> },
  ];

  if (loading) return <div className="space-y-6"><div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800"/><SkeletonCards count={4}/></div>;

  const heatColor = (pct:number) => {
    if (pct>=75) return 'bg-emerald-500/80 text-white';
    if (pct>=50) return 'bg-emerald-500/40 text-emerald-200';
    if (pct>=25) return 'bg-amber-500/40 text-amber-200';
    if (pct>0) return 'bg-red-500/30 text-red-300';
    return 'bg-neutral-800/60 text-neutral-500';
  };

  // Distribution data with colors
  const statusD = distrib?.status?.map(d => ({ ...d, color: STATUS_CLR[d.name] ?? '#6b7280' })) ?? [];
  const thrustD = distrib?.thrust ?? [];
  const uomD = distrib?.uom ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><BarChart3 className="h-6 w-6 text-[#fdb913]"/>Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-400">{cycleName}</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:border-neutral-600 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}/>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(k=>(
          <div key={k.label} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{k.label}</span>
              <span className={k.color}>{k.icon}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{k.value}</p>
            {k.sub && <p className="mt-0.5 text-xs text-neutral-500">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>handleTabSwitch(t.id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${tab===t.id?'bg-[#fdb913]/15 text-[#fdb913]':'text-neutral-400 hover:text-white'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* QoQ Trends */}
      {tab==='qoq' && (
        qoq ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-neutral-300">Average Score by Quarter</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={qoq}>
                  <XAxis dataKey="phase" tick={{fill:'#737373',fontSize:12}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'#737373',fontSize:11}} axisLine={false} tickLine={false} domain={[0,100]}/>
                  <Tooltip contentStyle={TT}/>
                  <Line type="monotone" dataKey="avgScore" stroke="#fdb913" strokeWidth={3} dot={{fill:'#fdb913',r:5}} name="Avg Score %"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-neutral-300">Check-in Completion Rate by Quarter</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={qoq}>
                  <XAxis dataKey="phase" tick={{fill:'#737373',fontSize:12}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'#737373',fontSize:11}} axisLine={false} tickLine={false} domain={[0,100]}/>
                  <Tooltip contentStyle={TT}/>
                  <Bar dataKey="completionPct" fill="#10b981" radius={[6,6,0,0]} name="Completion %" minPointSize={2}/>
                  <Bar dataKey="goalCount" fill="#3b82f6" radius={[6,6,0,0]} name="Check-ins Filed" minPointSize={2}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : <SkeletonCards count={2}/>
      )}

      {/* Heatmap */}
      {tab==='heatmap' && (
        heat ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
            <h3 className="mb-2 text-sm font-semibold text-neutral-300">Employee Check-in Completion Heatmap</h3>
            <p className="mb-4 text-xs text-neutral-500">Color intensity = % of all quarterly check-ins submitted</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="flex items-center gap-1 text-[10px] text-neutral-400"><span className="inline-block h-3 w-3 rounded bg-emerald-500/80"/>75–100%</span>
              <span className="flex items-center gap-1 text-[10px] text-neutral-400"><span className="inline-block h-3 w-3 rounded bg-emerald-500/40"/>50–74%</span>
              <span className="flex items-center gap-1 text-[10px] text-neutral-400"><span className="inline-block h-3 w-3 rounded bg-amber-500/40"/>25–49%</span>
              <span className="flex items-center gap-1 text-[10px] text-neutral-400"><span className="inline-block h-3 w-3 rounded bg-red-500/30"/>1–24%</span>
              <span className="flex items-center gap-1 text-[10px] text-neutral-400"><span className="inline-block h-3 w-3 rounded bg-neutral-800/60"/>0%</span>
            </div>
            {heat.length===0 ? <p className="text-sm text-neutral-600">No employee data</p> : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {heat.map(h=>(
                  <div key={h.name} className={`rounded-lg p-3 text-center transition-transform hover:scale-105 ${heatColor(h.pct)}`}>
                    <p className="truncate text-xs font-semibold">{h.name}</p>
                    <p className="text-lg font-bold">{h.pct}%</p>
                    <p className="truncate text-[10px] opacity-70">{h.department||'—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : <SkeletonCards count={1}/>
      )}

      {/* Distribution */}
      {tab==='distribution' && (
        distrib ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-neutral-300">Goals by Thrust Area</h3>
              {thrustD.length>0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={thrustD} margin={{left:0,right:16}}>
                    <XAxis dataKey="name" tick={{fill:'#737373',fontSize:10}} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60}/>
                    <YAxis tick={{fill:'#737373',fontSize:11}} axisLine={false} tickLine={false} allowDecimals={false}/>
                    <Tooltip contentStyle={TT}/>
                    <Bar dataKey="value" fill="#fdb913" radius={[4,4,0,0]} name="Goals"/>
                  </BarChart>
                </ResponsiveContainer>
              ):<p className="text-sm text-neutral-600">No goals</p>}
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                <h3 className="mb-4 text-sm font-semibold text-neutral-300">By UoM Type</h3>
                {uomD.length>0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart><Pie data={uomD} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`} labelLine={false} fontSize={11}>
                      {uomD.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie><Tooltip contentStyle={TT}/><Legend wrapperStyle={{fontSize:11,color:'#a3a3a3'}}/></PieChart>
                  </ResponsiveContainer>
                ):<p className="text-sm text-neutral-600">No data</p>}
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                <h3 className="mb-4 text-sm font-semibold text-neutral-300">By Status</h3>
                {statusD.length>0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart><Pie data={statusD} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name,value})=>`${name}: ${value}`} labelLine={false} fontSize={11}>
                      {statusD.map((d,i)=><Cell key={i} fill={d.color??'#6b7280'}/>)}
                    </Pie><Tooltip contentStyle={TT}/><Legend wrapperStyle={{fontSize:11,color:'#a3a3a3'}}/></PieChart>
                  </ResponsiveContainer>
                ):<p className="text-sm text-neutral-600">No data</p>}
              </div>
            </div>
          </div>
        ) : <SkeletonCards count={2}/>
      )}

      {/* Manager Effectiveness */}
      {tab==='manager' && (
        mgrEff ? (
          <div className="space-y-6">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
              <h3 className="mb-4 text-sm font-semibold text-neutral-300">Manager Check-in Completion Comparison (Current Phase)</h3>
              {mgrEff.length>0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mgrEff} layout="vertical" margin={{left:0,right:16}}>
                    <XAxis type="number" tick={{fill:'#737373',fontSize:11}} axisLine={false} tickLine={false} domain={[0,100]}/>
                    <YAxis type="category" dataKey="name" tick={{fill:'#d4d4d4',fontSize:12}} axisLine={false} tickLine={false} width={140}/>
                    <Tooltip contentStyle={TT}/>
                    <Bar dataKey="pct" fill="#10b981" radius={[0,6,6,0]} name="Completion %" minPointSize={2}/>
                  </BarChart>
                </ResponsiveContainer>
              ):<p className="text-sm text-neutral-600">No managers</p>}
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-800 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Manager</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Team Size</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Check-ins Done</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Completion %</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Avg Score</th>
                </tr></thead>
                <tbody>
                  {mgrEff.map(m=>(
                    <tr key={m.name} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                      <td className="px-4 py-3 font-medium text-white">{m.name}</td>
                      <td className="px-4 py-3 text-neutral-400">{m.team}</td>
                      <td className="px-4 py-3 text-neutral-300">{m.checkinsDone}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${m.pct===100?'bg-emerald-500/15 text-emerald-400':m.pct>0?'bg-amber-500/15 text-amber-400':'bg-neutral-800 text-neutral-500'}`}>{m.pct}%</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${m.avgScore>=80?'bg-emerald-500/15 text-emerald-400':m.avgScore>=50?'bg-amber-500/15 text-amber-400':'bg-neutral-800 text-neutral-500'}`}>{m.avgScore}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <SkeletonCards count={2}/>
      )}

      {/* AI Analytics */}
      {tab==='ai' && (
        <AIAnalyticsPanel />
      )}
    </div>
  );
}
