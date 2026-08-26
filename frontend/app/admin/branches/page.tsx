'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Branch } from '@/lib/types';

export default function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  async function load() {
    try {
      const data = await api.get<{ branches: Branch[] }>('/branches?includeInactive=true');
      setBranches(data.branches);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load branches.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createBranch(e: FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    try {
      await api.post('/branches', { name, location: location || null });
      setName(''); setLocation(''); await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the branch.');
    } finally { setSubmitting(false); }
  }

  async function setBranchActive(branch: Branch, active: boolean) {
    setError(null);
    try {
      await api.patch(`/branches/${branch.id}`, { is_active: active });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the branch.');
    }
  }

  const visible = branches.filter((b) => showInactive || b.is_active !== false);

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <div>
          <h1 className="font-display text-3xl mb-1">Branches</h1>
          <p className="text-forest-500/70 text-sm mb-8">
            Add locations and temporarily place a branch on maintenance without deleting its history.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-forest-600 mt-1">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show branches on maintenance
        </label>
      </div>

      <form onSubmit={createBranch} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 flex flex-wrap items-end gap-3 mb-8">
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Branch name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mwanza" className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-52" />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Location / area (optional)</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mwanza City" className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-52" />
        </div>
        <button type="submit" disabled={submitting} className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700 disabled:opacity-60">
          {submitting ? 'Adding…' : 'Add branch'}
        </button>
        {error && <p className="text-sm text-clay basis-full">{error}</p>}
      </form>

      {loading ? <p className="text-forest-500/70">Loading…</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((b) => {
            const active = b.is_active !== false;
            return (
              <div key={b.id} className={`bg-white rounded-xl2 border shadow-card p-5 ${active ? 'border-forest-100' : 'border-clay/20 opacity-70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl">{b.name}</h3>
                    {b.location && <p className="text-sm text-forest-500/70 mt-1">{b.location}</p>}
                  </div>
                  <span className={`text-xs font-semibold rounded-full px-2 py-1 ${active ? 'bg-forest-500/10 text-forest-700' : 'bg-clay/10 text-clay'}`}>
                    {active ? 'Active' : 'Maintenance'}
                  </span>
                </div>
                <button
                  onClick={() => setBranchActive(b, !active)}
                  className={`mt-4 w-full rounded-lg border px-3 py-2 text-sm font-medium ${active ? 'border-clay/30 text-clay hover:bg-clay/5' : 'border-forest-300 text-forest-700 hover:bg-forest-50'}`}
                >
                  {active ? 'Put branch on maintenance' : 'Restore branch'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
