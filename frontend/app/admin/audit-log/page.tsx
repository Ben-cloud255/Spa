'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useBranches } from '@/lib/useBranches';
import type { AuditLogEntry } from '@/lib/types';
const day = (offset = 0) => new Date(Date.now() + 10800000 + offset * 86400000).toISOString().slice(0, 10);
const initialFilters = () => ({ search: '', action: '', role: '', branchId: '', from: day(-13), to: day() });
export default function AdminAuditLogPage() {
  const { branches } = useBranches();
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);
  const invalid = !!(draft.from && draft.to && draft.from > draft.to);
  useEffect(() => {
    let current = true;
    const params = new URLSearchParams({ limit: '50' });
    for (const key of ['search', 'action', 'role', 'branchId'] as const) if (filters[key]) params.set(key, filters[key]);
    if (filters.from) params.set('from', `${filters.from}T00:00:00+03:00`);
    if (filters.to) params.set('to', `${filters.to}T23:59:59.999+03:00`);
    const before = cursors[cursors.length - 1];
    if (before) params.set('before', String(before));
    setLoading(true); setError('');
    api.get<{ entries: AuditLogEntry[]; nextCursor: number | null }>(`/audit-log?${params}`).then(data => { if (current) { setEntries(data.entries); setNextCursor(data.nextCursor); } }).catch(() => { if (current) setError('Could not load activity. Please try again.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [filters, cursors, refresh]);
  const set = (key: keyof typeof draft, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  return <div className="audit-page">
    <header className="visits-heading"><div><p className="visits-eyebrow">ACCOUNTABILITY & ACTIVITY</p><h1 className="font-display text-3xl">Audit log</h1><p className="visits-subtitle">Review who performed an action, what it affected and when it happened.</p></div><button className="visits-button" disabled={loading} onClick={() => { setCursors([null]); setRefresh(n => n + 1); }}>↻ Refresh</button></header>
    <div className="audit-intro"><strong>Activity history for administrators</strong><p>Use this record to investigate payments, room assignments, inventory and account changes. Service and category changes are also recorded from this update onward.</p></div>
    <form className="audit-filters" onSubmit={event => { event.preventDefault(); if (!invalid) { setFilters({ ...draft }); setCursors([null]); } }}>
      <label className="audit-search">Search activity<input type="search" value={draft.search} onChange={e => set('search', e.target.value)} placeholder="Staff name, action or affected item" /></label>
      <label>From<input type="date" value={draft.from} onChange={e => set('from', e.target.value)} /></label><label>To<input type="date" value={draft.to} onChange={e => set('to', e.target.value)} /></label>
      <label>Branch<select value={draft.branchId} onChange={e => set('branchId', e.target.value)}><option value="">All branches & shared activity</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label>Staff role<select value={draft.role} onChange={e => set('role', e.target.value)}><option value="">All roles</option><option value="admin">Admin</option><option value="receptionist">Receptionist</option><option value="provider">Provider</option></select></label>
      <label>Action contains<input value={draft.action} onChange={e => set('action', e.target.value)} placeholder="e.g. payment, removed" /></label>
      <button className="room-add-button" type="submit" disabled={invalid}>Apply filters</button><button type="button" className="visits-text-button" onClick={() => { const reset = initialFilters(); setDraft(reset); setFilters(reset); setCursors([null]); }}>Reset</button><button type="button" className="visits-text-button" onClick={() => setDraft(previous => ({ ...previous, from: '', to: '' }))}>All dates</button>
      <p className="audit-filter-note">{invalid ? 'The end date must be on or after the start date.' : 'Times are shown in East Africa Time. Choose Apply filters after changing the fields.'}</p>
    </form>
    {error ? <div role="alert" className="visits-error">{error} <button className="visits-text-button" onClick={() => setRefresh(n => n + 1)}>Retry</button></div> : loading ? <div className="visits-empty" role="status">Loading activity…</div> : <section className="audit-records" aria-label="Recorded activity"><div className="audit-records-heading"><h2>Recorded activity</h2><span>{entries.length} records on this page · newest first</span></div>
      {!entries.length ? <div className="visits-empty">No activity matches these filters.</div> : entries.map(entry => <article className="audit-entry" key={entry.id}><span className="audit-avatar" aria-hidden="true">{(entry.actor_name || 'S').slice(0, 1).toUpperCase()}</span><div className="audit-entry-content"><div className="audit-entry-title"><strong>{entry.action.replaceAll('_', ' ')}</strong><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' })}</time></div><p>{entry.entity_label || 'No additional details recorded'}</p><div className="audit-meta"><span>{entry.actor_name || 'System'} · {entry.actor_role}</span><span>{entry.branch_name || 'Shared / branch not recorded'}</span><span>{entry.entity_type.replaceAll('_', ' ')} · Record #{entry.id}</span></div></div></article>)}
      <footer className="visits-pagination"><span>Page {cursors.length}</span><div><button className="visits-button" disabled={cursors.length === 1} onClick={() => setCursors(previous => previous.slice(0, -1))}>Newer activity</button><button className="visits-button" disabled={!nextCursor} onClick={() => { if (nextCursor) setCursors(previous => [...previous, nextCursor]); }}>Older activity</button></div></footer>
    </section>}
  </div>;
}
