import { useCallback, useEffect, useState } from 'react';
import { Calendar, Plus, Pencil, XCircle, Loader2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SkeletonTable } from '@/components/shared/Skeletons';
import type { GoalCycle } from '@/types';
import toast from 'react-hot-toast';

type CycleForm = {
  cycle_name: string; phase: string; start_date: string; end_date: string;
  checkin_window_start: string; checkin_window_end: string; status: string;
};
const empty: CycleForm = { cycle_name: '', phase: 'goal_setting', start_date: '', end_date: '', checkin_window_start: '', checkin_window_end: '', status: 'active' };

export default function AdminCycles() {
  const [cycles, setCycles] = useState<GoalCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CycleForm>(empty);
  const [saving, setSaving] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('goal_cycles').select('*').order('start_date', { ascending: false });
    setCycles((data ?? []) as GoalCycle[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditId(null); setForm(empty); setModalOpen(true); }
  function openEdit(c: GoalCycle) {
    setEditId(c.cycle_id);
    setForm({ cycle_name: c.cycle_name, phase: c.phase, start_date: c.start_date, end_date: c.end_date, checkin_window_start: c.checkin_window_start ?? '', checkin_window_end: c.checkin_window_end ?? '', status: c.status });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.cycle_name || !form.start_date || !form.end_date) { toast.error('Fill required fields'); return; }
    setSaving(true);

    // Warn if activating while another cycle is active
    if (form.status === 'active') {
      const existing = cycles.find((c) => c.status === 'active' && c.cycle_id !== editId);
      if (existing) { toast.error(`"${existing.cycle_name}" is already active. Close it first.`); setSaving(false); return; }
    }

    const payload = {
      cycle_name: form.cycle_name, phase: form.phase, start_date: form.start_date, end_date: form.end_date,
      checkin_window_start: form.checkin_window_start || null, checkin_window_end: form.checkin_window_end || null, status: form.status,
    };

    const { error } = editId
      ? await supabase.from('goal_cycles').update(payload).eq('cycle_id', editId)
      : await supabase.from('goal_cycles').insert(payload);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? 'Cycle updated' : 'Cycle created');
    setModalOpen(false);
    load();
  }

  async function closeCycle(id: string) {
    const { error } = await supabase.from('goal_cycles').update({ status: 'closed' }).eq('cycle_id', id);
    if (error) toast.error(error.message); else { toast.success('Cycle closed'); load(); }
    setCloseConfirm(null);
  }

  const inp = "w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none focus:border-[#fdb913]";

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
      <SkeletonTable rows={3} cols={6} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Calendar className="h-6 w-6 text-[#fdb913]" />Goal Cycles</h1>
          <p className="mt-1 text-sm text-neutral-400">Manage fiscal year cycles and check-in windows</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-[#fdb913] px-4 py-2 text-sm font-semibold text-black hover:bg-[#fdb913]/90"><Plus className="h-4 w-4" />Create Cycle</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-800 text-left">
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Cycle</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Phase</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Dates</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Check-in Window</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Actions</th>
          </tr></thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.cycle_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                <td className="px-5 py-3 font-medium text-white">{c.cycle_name}</td>
                <td className="px-4 py-3 text-neutral-400 capitalize">{c.phase.replace('_', ' ')}</td>
                <td className="px-4 py-3 text-neutral-400 text-xs">{c.start_date} → {c.end_date}</td>
                <td className="px-4 py-3 text-neutral-400 text-xs">{c.checkin_window_start && c.checkin_window_end ? `${c.checkin_window_start} → ${c.checkin_window_end}` : '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${c.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-neutral-800 text-neutral-500'}`}>{c.status === 'active' ? 'Active' : 'Closed'}</span>
                </td>
                <td className="px-4 py-3 flex items-center gap-2">
                  <button onClick={() => openEdit(c)} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                  {c.status === 'active' && <button onClick={() => setCloseConfirm(c.cycle_id)} className="rounded p-1.5 text-neutral-500 hover:bg-red-500/10 hover:text-red-400"><XCircle className="h-3.5 w-3.5" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">{editId ? 'Edit Cycle' : 'Create Cycle'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-6">
              <div><label className="mb-1 block text-xs font-medium text-neutral-500">Cycle Name *</label><input className={inp} value={form.cycle_name} onChange={(e) => setForm({ ...form, cycle_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">Phase *</label>
                  <select className={inp} value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
                    <option value="goal_setting">Goal Setting</option><option value="q1">Q1</option><option value="q2">Q2</option><option value="q3">Q3</option><option value="q4">Q4</option>
                  </select></div>
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">Status</label>
                  <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="active">Active</option><option value="closed">Closed</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">Start Date *</label><input type="date" className={inp} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">End Date *</label><input type="date" className={inp} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">Check-in Window Start</label><input type="date" className={inp} value={form.checkin_window_start} onChange={(e) => setForm({ ...form, checkin_window_start: e.target.value })} /></div>
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">Check-in Window End</label><input type="date" className={inp} value={form.checkin_window_end} onChange={(e) => setForm({ ...form, checkin_window_end: e.target.value })} /></div>
              </div>
              <div className="flex gap-3 border-t border-neutral-800 pt-5">
                <button onClick={() => setModalOpen(false)} className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#fdb913] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#fdb913]/90 disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}{editId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!closeConfirm} title="Close Cycle?"
        description="This will mark the cycle as closed. No new goals or check-ins can be created."
        variant="danger" confirmLabel="Close Cycle"
        onConfirm={() => { if (closeConfirm) closeCycle(closeConfirm); }}
        onCancel={() => setCloseConfirm(null)} />
    </div>
  );
}
