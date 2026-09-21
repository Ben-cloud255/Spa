'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useBranches } from '@/lib/useBranches';
import type { AuditLogEntry } from '@/lib/types';

const RECENT_DAYS = 14;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminAuditLogPage() {
  const { branches } = useBranches();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: '300' });
    if (filterBranch) params.set('branchId', filterBranch);
    if (!showAllHistory) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
      params.set('from', cutoff.toISOString());
    }
    const data = await api.get<{ entries: AuditLogEntry[] }>(`/audit-log?${params.toString()}`);
    setEntries(data.entries);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAllHistory, filterBranch]);

  const displayedEntries = entries.filter((e) => filterAction === 'all' || e.action === filterAction);
  const availableActions = Array.from(new Set(entries.map((e) => e.action))).sort();

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Audit log</h1>
      <p className="text-forest-500/70 text-sm mb-3">
        Who did what, and when — payments, provider assignments, service completions, and account or branch changes.
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <label className="flex items-center gap-2 text-sm text-forest-600">
          <input type="checkbox" checked={showAllHistory} onChange={(e) => setShowAllHistory(e.target.checked)} />
          Show entries older than {RECENT_DAYS} days
        </label>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        {availableActions.length > 0 && (
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
          >
            <option value="all">All actions</option>
            {availableActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Entity</th>
                  <th className="text-left px-4 py-3">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-50">
                {displayedEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 whitespace-nowrap" title={new Date(e.created_at).toLocaleString('en-GB')}>
                      {timeAgo(e.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {e.actor_name}
                      <span className="text-xs text-forest-500/60 ml-1.5 capitalize">({e.actor_role})</span>
                    </td>
                    <td className="px-4 py-3">{e.action}</td>
                    <td className="px-4 py-3">{e.entity_label}</td>
                    <td className="px-4 py-3">{e.branch_name || '—'}</td>
                  </tr>
                ))}
                {displayedEntries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-forest-500/60">
                      {entries.length === 0
                        ? `Nothing recorded ${showAllHistory ? 'yet' : `in the last ${RECENT_DAYS} days`}.`
                        : 'No entries match this filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
