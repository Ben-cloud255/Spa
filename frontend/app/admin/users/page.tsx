'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useBranches } from '@/lib/useBranches';
import BranchFilter from '@/components/BranchFilter';
import type { User } from '@/lib/types';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  receptionist: 'Receptionist',
  provider: 'Service provider',
};

export default function AdminUsersPage() {
  const { branches } = useBranches();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'receptionist', branch_id: '' });
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  // Arriving from the global search: make sure nothing is hiding the row
  // we're being pointed at, regardless of whatever filters were already set.
  useEffect(() => {
    if (!focusId) return;
    setShowHidden(true);
    setFilterBranch('');
    setFilterRole('');
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterBranch) params.set('branchId', filterBranch);
    if (filterRole) params.set('role', filterRole);
    if (showHidden) params.set('includeInactive', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await api.get<{ users: User[] }>(`/users${query}`);
    setUsers(data.users);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranch, filterRole, showHidden]);

  useEffect(() => {
    if (!form.branch_id && branches.length > 0) setForm((f) => ({ ...f, branch_id: String(branches[0].id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  // Selection is cleared whenever the visible list changes shape, so a
  // stale checkbox never points at someone no longer on screen.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterBranch, filterRole, showHidden, search]);

  useEffect(() => {
    if (!focusId || loading) return;
    const id = Number(focusId);
    setHighlightId(id);
    const el = document.getElementById(`user-row-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [focusId, loading, users]);

  const displayedUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone || '').toLowerCase().includes(q);
  });

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === displayedUsers.length ? new Set() : new Set(displayedUsers.map((u) => u.id))));
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/users', {
        ...form,
        branch_id: form.role === 'admin' ? null : Number(form.branch_id),
      });
      setForm({ name: '', email: '', phone: '', password: '', role: 'receptionist', branch_id: form.branch_id });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account.');
    }
  }

  async function toggleActive(user: User) {
    await api.patch(`/users/${user.id}`, { is_active: !user.is_active });
    load();
  }

  async function bulkSetActive(active: boolean) {
    const targets = displayedUsers.filter((u) => selectedIds.has(u.id) && u.is_active !== active);
    if (targets.length === 0) return;
    const verb = active ? 'reactivate' : 'deactivate';
    if (!window.confirm(`${active ? 'Reactivate' : 'Deactivate'} ${targets.length} staff account${targets.length === 1 ? '' : 's'}?`)) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(targets.map((u) => api.patch(`/users/${u.id}`, { is_active: active })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) setError(`Could not ${verb} ${failed} of ${targets.length} accounts.`);
    setSelectedIds(new Set());
    setBulkBusy(false);
    load();
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { newPassword: resetPassword });
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password.');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-3xl">Staff accounts</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="receptionist">Receptionist</option>
            <option value="provider">Service provider</option>
          </select>
          <BranchFilter value={filterBranch} onChange={setFilterBranch} />
          <label className="flex items-center gap-2 text-sm text-forest-600">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show hidden staff
          </label>
        </div>
      </div>
      <p className="text-forest-500/70 text-sm mb-6">
        Create logins for receptionists and service providers at any branch. Each person signs in with their own account.
      </p>

      <div className="mb-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff by name, email or phone…"
          className="w-full sm:w-80 rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm"
        />
      </div>

      <form onSubmit={createUser} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 items-end">
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Full name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Email</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          >
            <option value="receptionist">Receptionist</option>
            <option value="provider">Service provider</option>
            <option value="admin">Admin (all branches)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Branch</label>
          <select
            value={form.branch_id}
            disabled={form.role === 'admin'}
            onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full disabled:opacity-50"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Temporary password</label>
          <input
            required
            type="text"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <button type="submit" className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700 w-full">
            Create account
          </button>
        </div>
        {error && <p className="text-sm text-clay sm:col-span-3">{error}</p>}
      </form>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 bg-forest-50 border border-forest-200 rounded-lg px-4 py-2.5">
          <p className="text-sm font-medium text-forest-700">
            {selectedIds.size} account{selectedIds.size === 1 ? '' : 's'} selected
          </p>
          <button
            onClick={() => bulkSetActive(true)}
            disabled={bulkBusy}
            className="rounded-lg border border-forest-300 bg-white text-forest-700 px-3 py-1.5 text-xs font-medium hover:bg-forest-50 disabled:opacity-50"
          >
            Reactivate
          </button>
          <button
            onClick={() => bulkSetActive(false)}
            disabled={bulkBusy}
            className="rounded-lg border border-clay/40 bg-white text-clay px-3 py-1.5 text-xs font-medium hover:bg-clay/5 disabled:opacity-50"
          >
            Deactivate
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs font-medium text-forest-500 hover:text-forest-700 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={displayedUsers.length > 0 && selectedIds.size === displayedUsers.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all staff"
                  />
                </th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {displayedUsers.map((u) => (
                <tr
                  key={u.id}
                  id={`user-row-${u.id}`}
                  className={`transition-colors ${u.is_active ? '' : 'opacity-50'} ${highlightId === u.id ? 'bg-honey-500/20' : ''}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleSelect(u.id)}
                      aria-label={`Select ${u.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {u.name}
                    {!u.is_active && <span className="ml-2 text-xs text-clay font-normal">Hidden</span>}
                  </td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                  <td className="px-4 py-3">{u.branch_name || (u.role === 'admin' ? 'All branches' : '—')}</td>
                  <td className="px-4 py-3">{u.is_active ? 'Active' : 'Deactivated'}</td>
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <button onClick={() => setResetTarget(u)} className="text-xs font-medium text-forest-600 hover:text-forest-800">
                      Reset password
                    </button>
                    <button onClick={() => toggleActive(u)} className="text-xs font-medium text-clay hover:text-clay/80">
                      {u.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
              {displayedUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-forest-500/60">
                    No staff match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-modalBackdropIn">
          <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6 animate-modalContentIn">
            <h2 className="font-display text-2xl mb-1">Reset password</h2>
            <p className="text-sm text-forest-500/70 mb-5">{resetTarget.name}</p>
            <form onSubmit={submitReset} className="space-y-4">
              <input
                required
                minLength={8}
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="New password (min. 8 characters)"
                className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="flex-1 rounded-lg border border-forest-200 py-2.5 text-sm font-medium hover:bg-forest-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2.5 text-sm font-medium hover:bg-forest-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
