'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import BranchFilter from '@/components/BranchFilter';
import type { Booking } from '@/lib/types';

const statuses: Record<string, string> = { pending: 'Pending', active: 'In service', completed: 'Completed', cancelled: 'Cancelled', on_hold: 'On hold', awaiting_payment: 'Awaiting payment' };
const money = (value: number) => new Intl.NumberFormat('en-TZ').format(value);
const date = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const balance = (visit: Booking) => visit.status === 'cancelled' ? 0 : Math.max(0, Number(visit.amount_due) - Number(visit.amount_paid));
function day(offset = 0) { return new Date(Date.now() + 3 * 3600000 + offset * 86400000).toISOString().slice(0, 10); }

export default function CustomerVisitsPage() {
  const [visits, setVisits] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [branch, setBranch] = useState('');
  const [from, setFrom] = useState(() => day(-29));
  const [to, setTo] = useState(() => day());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [provider, setProvider] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const invalidRange = !!(from && to && from > to);

  useEffect(() => {
    let current = true;
    if (invalidRange) { setLoading(false); return; }
    const params = new URLSearchParams();
    if (branch) params.set('branchId', branch);
    if (from) params.set('from', `${from}T00:00:00+03:00`);
    if (to) params.set('to', `${to}T23:59:59.999+03:00`);
    setLoading(true); setError('');
    api.get<{ bookings: Booking[] }>(`/bookings?${params}`).then(data => { if (current) setVisits(data.bookings); }).catch(() => { if (current) setError('Could not load customer visits. Please try again.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [branch, from, to, refresh, invalidRange]);

  useEffect(() => { setPage(1); }, [branch, from, to, search, status, payment, provider, sort]);
  const providers = Array.from(new Map(visits.map(v => [String(v.provider_id), v.provider_name])).entries());
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return visits.filter(v => (!status || v.status === status) && (!payment || v.payment_status === payment) && (!provider || String(v.provider_id) === provider) && (!query || `${v.customer_name} ${v.customer_phone} ${v.service_name} ${v.id}`.toLowerCase().includes(query))).sort((a, b) => sort === 'balance' ? balance(b) - balance(a) : sort === 'oldest' ? +new Date(a.created_at) - +new Date(b.created_at) : +new Date(b.created_at) - +new Date(a.created_at));
  }, [visits, search, status, payment, provider, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 12, currentPage * 12);
  const unavailable = loading || !!error || invalidRange;
  function reset() { setSearch(''); setStatus(''); setPayment(''); setProvider(''); setBranch(''); setFrom(day(-29)); setTo(day()); setSort('newest'); }

  return <div className="visits-page">
    <header className="visits-heading"><div><p className="visits-eyebrow">CUSTOMER ACTIVITY</p><h1 className="font-display text-3xl">Customer Visits</h1><p className="visits-subtitle">Follow every visit, from arrival and service to payment.</p></div><button className="visits-button" disabled={loading} onClick={() => setRefresh(n => n + 1)}>{loading ? 'Refreshing…' : '↻ Refresh'}</button></header>
    <section className="visits-metrics" aria-label="Filtered visit summary">{[
      ['Visits', filtered.length, 'Matching your filters'],
      ['In service', filtered.filter(v => v.status === 'active').length, 'Currently active visits'],
      ['Amount paid', money(filtered.reduce((sum, v) => sum + Number(v.amount_paid), 0)), 'TZS · paid toward these visits'],
      ['Outstanding', money(filtered.reduce((sum, v) => sum + balance(v), 0)), 'TZS · excludes cancelled visits'],
    ].map(([label, value, hint]) => <div className="visits-metric" key={label}><p>{label}</p><strong>{unavailable ? '—' : value}</strong><span>{hint}</span></div>)}</section>
    <section className="visits-filters" aria-label="Filter customer visits">
      <div className="visits-filter-top"><label className="visits-search">Search visits<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Customer name, phone, service or visit number" /></label><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      <div className="visits-filter-bottom"><BranchFilter value={branch} onChange={value => { setBranch(value); setProvider(''); }} /><select aria-label="Visit status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All visit statuses</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select aria-label="Payment status" value={payment} onChange={e => setPayment(e.target.value)}><option value="">All payments</option><option value="paid">Paid</option><option value="partial">Partially paid</option><option value="unpaid">Unpaid</option></select><select aria-label="Provider" value={provider} onChange={e => setProvider(e.target.value)}><option value="">All providers in these visits</option>{providers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><button className="visits-text-button" onClick={() => { setFrom(''); setTo(''); }}>All dates</button><button className="visits-text-button" onClick={reset}>Reset filters</button></div>
      <p className="visits-filter-note">Dates refer to when the visit was recorded · East Africa Time. Summaries cover the matching visits, including payments recorded later.</p>
    </section>
    {invalidRange ? <p className="visits-error" role="alert">The end date must be on or after the start date.</p> : error ? <div className="visits-error" role="alert">{error} <button className="visits-text-button" onClick={() => setRefresh(n => n + 1)}>Retry</button></div> : loading ? <div className="visits-empty" role="status">Loading customer visits…</div> : <section className="visits-list" aria-label="Customer visits">
      <div className="visits-list-heading"><div><h2>Visit records <span>{filtered.length}</span></h2><p>Select a visit to view staff, session times and payment details.</p></div><select aria-label="Sort visits" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="balance">Highest outstanding</option></select></div>
      {visits.length >= 500 && <p className="visits-limit" role="status">Showing the latest 500 records for this date range and branch. Narrow the dates to see a complete set; search, filters and totals apply to these loaded records.</p>}
      {!filtered.length && <div className="visits-empty"><h3>No visits found</h3><p>Try another name, date range or filter.</p><button className="visits-text-button" onClick={reset}>Reset filters</button></div>}
      {visible.map(v => <details key={v.id} className="visit-record"><summary><span className="visit-person"><span className="visit-avatar" aria-hidden="true">{v.customer_name.trim().slice(0, 1).toUpperCase()}</span><span><strong>{v.customer_name}</strong><small>Visit #{v.id} · {v.customer_phone || 'No phone recorded'}</small></span></span><span className="visit-service"><strong>{v.service_name}</strong><small>{v.branch_name || 'Unassigned branch'} · {date(v.created_at)}</small></span><span className={`visit-status visit-status-${v.status}`}>{statuses[v.status] || v.status}</span><span className="visit-payment"><strong>{money(Number(v.amount_paid))} <small>TZS paid</small></strong><small>{balance(v) > 0 ? `${money(balance(v))} TZS outstanding` : v.status === 'cancelled' ? 'Cancelled visit' : 'No outstanding balance'}</small></span><span className="visit-chevron" aria-hidden="true">⌄</span></summary>
        <div className="visit-detail"><div><h3>Service & staff</h3><dl><dt>Service</dt><dd>{v.service_name}</dd><dt>Room</dt><dd>{v.room_name || '—'}</dd><dt>Provider</dt><dd>{v.provider_name || '—'}</dd><dt>Receptionist</dt><dd>{v.receptionist_name || '—'}</dd></dl></div><div><h3>Session timeline</h3><dl><dt>Recorded</dt><dd>{date(v.created_at)}</dd><dt>Started</dt><dd>{date(v.active_started_at)}</dd><dt>Expected end</dt><dd>{date(v.expected_end_at)}</dd><dt>Ended</dt><dd>{date(v.ended_at)}</dd><dt>Service duration</dt><dd>{v.duration_minutes} min{Number(v.extended_minutes) > 0 ? ` + ${v.extended_minutes} min extended` : ''}</dd></dl></div><div><h3>Payment summary</h3><dl><dt>Total charge</dt><dd>{money(Number(v.amount_due))} TZS</dd><dt>Amount paid</dt><dd>{money(Number(v.amount_paid))} TZS</dd><dt>Outstanding</dt><dd>{money(balance(v))} TZS</dd><dt>Payment status</dt><dd>{v.payment_status === 'partial' ? 'Partially paid' : v.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</dd></dl>{v.status === 'cancelled' && <p className="visits-filter-note">Cancelled visits are excluded from outstanding totals.</p>}</div></div>
      </details>)}
      {filtered.length > 0 && <footer className="visits-pagination"><span>{(currentPage - 1) * 12 + 1}–{Math.min(currentPage * 12, filtered.length)} of {filtered.length} visits</span><div><button className="visits-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button className="visits-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div></footer>}
    </section>}
  </div>;
}
