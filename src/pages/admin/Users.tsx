import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Pencil, Unlock, Loader2, X, Search, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SkeletonTable } from '@/components/shared/Skeletons';
import type { User, Role } from '@/types';
import toast from 'react-hot-toast';

type UserForm = { email: string; name: string; role: Role; department: string; manager_id: string };
const emptyForm: UserForm = { email: '', name: '', role: 'employee', department: '', manager_id: '' };

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [unlockDialog, setUnlockDialog] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');

  const managers = users.filter((u) => u.role === 'manager' || u.role === 'admin');
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))];

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('users').select('*').order('name');
    setUsers((data ?? []) as User[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (deptFilter && u.department !== deptFilter) return false;
    if (searchQ && !u.name.toLowerCase().includes(searchQ.toLowerCase()) && !u.email.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  function openCreate() { setEditId(null); setForm(emptyForm); setModalOpen(true); }
  function openEdit(u: User) {
    setEditId(u.user_id);
    setForm({ email: u.email, name: u.name, role: u.role, department: u.department, manager_id: u.manager_id ?? '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.email) { toast.error('Name and email are required'); return; }
    setSaving(true);
    const payload = { name: form.name, email: form.email, role: form.role, department: form.department, manager_id: form.manager_id || null };

    if (editId) {
      const { error } = await supabase.from('users').update(payload).eq('user_id', editId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('User updated');
    } else {
      const { error } = await supabase.from('users').insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('User created');
    }
    setSaving(false); setModalOpen(false); load();
  }

  async function handleUnlock(userId: string) {
    if (!unlockReason.trim()) { toast.error('Reason is required'); return; }
    const { error } = await supabase.from('goals').update({ status: 'approved' }).eq('owner_id', userId).eq('status', 'locked');
    if (error) { toast.error('Failed to unlock goals'); return; }
    toast.success('Goals unlocked');
    setUnlockDialog(null); setUnlockReason('');
  }

  const managerName = (id: string | null) => { if (!id) return '—'; const m = users.find((u) => u.user_id === id); return m?.name ?? '—'; };
  const inp = "w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none focus:border-[#fdb913]";

  if (loading) return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
      <SkeletonTable rows={10} cols={6} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-white"><Users className="h-6 w-6 text-[#fdb913]" />User Management</h1><p className="mt-1 text-sm text-neutral-400">Manage users, roles, and team assignments</p></div>
        <button onClick={openCreate} className="flex items-center gap-1.5 rounded-lg bg-[#fdb913] px-4 py-2 text-sm font-semibold text-black hover:bg-[#fdb913]/90"><Plus className="h-4 w-4" />Add User</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" /><input placeholder="Search users…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-800/60 pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-[#fdb913] w-56" /></div>
        <div className="flex items-center gap-1.5"><Filter className="h-4 w-4 text-neutral-500" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none">
            <option value="">All Roles</option><option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
          </select>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none">
            <option value="">All Departments</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900/60">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-800 text-left">
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Name</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Email</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Role</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Dept</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Manager</th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.user_id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                <td className="px-5 py-3 font-medium text-white">{u.name}</td>
                <td className="px-4 py-3 text-neutral-400">{u.email}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${u.role === 'admin' ? 'bg-purple-500/15 text-purple-400' : u.role === 'manager' ? 'bg-blue-500/15 text-blue-400' : 'bg-neutral-800 text-neutral-400'}`}>{u.role}</span></td>
                <td className="px-4 py-3 text-neutral-400">{u.department || '—'}</td>
                <td className="px-4 py-3 text-neutral-400 text-xs">{managerName(u.manager_id)}</td>
                <td className="px-4 py-3 flex items-center gap-1">
                  <button onClick={() => openEdit(u)} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                  {u.role === 'employee' && <button onClick={() => setUnlockDialog(u.user_id)} className="rounded p-1.5 text-neutral-500 hover:bg-amber-500/10 hover:text-amber-400" title="Unlock goals"><Unlock className="h-3.5 w-3.5" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4"><h2 className="text-lg font-semibold text-white">{editId ? 'Edit User' : 'Add User'}</h2><button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800"><X className="h-5 w-5" /></button></div>
            <div className="space-y-4 p-6">
              <div><label className="mb-1 block text-xs font-medium text-neutral-500">Name *</label><input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="mb-1 block text-xs font-medium text-neutral-500">Email *</label><input type="email" className={inp} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editId} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">Role</label>
                  <select className={inp} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                    <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Admin</option>
                  </select></div>
                <div><label className="mb-1 block text-xs font-medium text-neutral-500">Department</label><input className={inp} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              </div>
              <div><label className="mb-1 block text-xs font-medium text-neutral-500">Manager</label>
                <select className={inp} value={form.manager_id} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                  <option value="">None</option>{managers.map((m) => <option key={m.user_id} value={m.user_id}>{m.name} ({m.role})</option>)}
                </select></div>
              <div className="flex gap-3 border-t border-neutral-800 pt-5">
                <button onClick={() => setModalOpen(false)} className="flex-1 rounded-lg border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:bg-neutral-800">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#fdb913] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#fdb913]/90 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{editId ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unlock dialog */}
      {unlockDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Unlock Goals</h3>
            <p className="mt-2 text-sm text-neutral-400">This will change locked goals back to approved. Provide a reason:</p>
            <textarea rows={2} value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} placeholder="Reason for unlocking…" className="mt-3 w-full rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-white outline-none resize-none focus:border-[#fdb913]" />
            <div className="mt-5 flex gap-3">
              <button onClick={() => { setUnlockDialog(null); setUnlockReason(''); }} className="flex-1 rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800">Cancel</button>
              <button onClick={() => handleUnlock(unlockDialog)} disabled={!unlockReason.trim()} className="flex-1 rounded-lg bg-[#fdb913] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e5a710] disabled:opacity-40">Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
