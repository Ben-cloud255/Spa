'use client';

import { useEffect, useState, FormEvent } from 'react';
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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', role: 'receptionist', branch_id: '' });
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  async function load() {
    setLoading(true);
    const query = filterBranch ? `?branchId=${filterBranch}` : '';
    const data = await api.get<{ users: User[] }>(`/users${query}`);
    setUsers(data.users);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranch]);

  useEffect(() => {
    if (!form.branch_id && branches.length > 0) setForm((f) => ({ ...f, branch_id: String(branches[0].id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

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
        <BranchFilter value={filterBranch} onChange={setFilterBranch} />
      </div>
      <p className="text-forest-500/70 text-sm mb-8">
        Create logins for receptionists and service providers at any branch. Each person signs in with their own account.
      </p>

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

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {users.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium">{u.name}</td>
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
            </tbody>
          </table>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6">
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
