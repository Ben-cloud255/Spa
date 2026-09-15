'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import BranchFilter from '@/components/BranchFilter';
import type { Booking, User } from '@/lib/types';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-honey-500/10 text-honey-600',
  active: 'bg-forest-500/10 text-forest-700',
  completed: 'bg-forest-100 text-forest-700',
  cancelled: 'bg-clay/10 text-clay',
  on_hold: 'bg-honey-500/10 text-honey-700',
  awaiting_payment: 'bg-honey-500/10 text-honey-700',
};

const RECENT_DAYS = 20;

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    api.get<{ users: User[] }>('/users?role=provider').then((d) => setProviders(d.users));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (branchFilter) params.set('branchId', branchFilter);
    if (!showAllHistory) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
      params.set('from', cutoff.toISOString());
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    setLoading(true);
    api.get<{ bookings: Booking[] }>(`/bookings${query}`).then((d) => {
      setBookings(d.bookings);
      setLoading(false);
    });
  }, [statusFilter, branchFilter, showAllHistory]);

  const displayedBookings = bookings
    .filter((b) => !providerFilter || String(b.provider_id) === providerFilter)
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else cmp = Number(a.amount_paid) - Number(b.amount_paid);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const totalCollected = displayedBookings.reduce((sum, b) => sum + Number(b.amount_paid), 0);
  const totalOutstanding = displayedBookings.reduce(
    (sum, b) => sum + (b.status === 'cancelled' ? 0 : Number(b.amount_due) - Number(b.amount_paid)),
    0
  );

  return (
    <div>
      <div className="flex items-start justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-3xl">Customers and services</h1>
      </div>
      <p className="text-forest-500/70 text-sm mb-4">
        {money(totalCollected)} TZS collected · {money(totalOutstanding)} TZS outstanding
        {!showAllHistory && ` · showing the last ${RECENT_DAYS} days`}
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <BranchFilter value={branchFilter} onChange={setBranchFilter} />
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="on_hold">On hold</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
        >
          <option value="date">Sort by date</option>
          <option value="amount">Sort by amount paid</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white hover:bg-forest-50"
        >
          {sortDir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
        </button>
        <label className="flex items-center gap-2 text-sm text-forest-600 ml-auto">
          <input type="checkbox" checked={showAllHistory} onChange={(e) => setShowAllHistory(e.target.checked)} />
          Show full history
        </label>
      </div>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Room</th>
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-left px-4 py-3">Receptionist</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Payment</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {displayedBookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{b.customer_name}</p>
                    <p className="text-xs text-forest-500/70">{b.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-forest-600">{b.branch_name || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.service_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.room_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.provider_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.receptionist_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {money(b.amount_paid)} / {money(b.amount_due)}
                    <span className="ml-1.5 text-xs text-forest-500/60 capitalize">({b.payment_status})</span>
                  </td>
                  <td className="px-4 py-3 text-forest-500/70 whitespace-nowrap">
                    {new Date(b.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
              {displayedBookings.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-forest-500/60">
                    No bookings match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
