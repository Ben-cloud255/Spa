'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRooms } from '@/lib/useRooms';
import { useNotifications } from '@/lib/useNotifications';
import { api } from '@/lib/api';
import RoomCard from '@/components/RoomCard';
import BranchFilter from '@/components/BranchFilter';
import OnHoldList from '@/components/OnHoldList';
import type { Booking } from '@/lib/types';

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5">
      <p className="text-xs uppercase tracking-wide text-forest-500/70">{label}</p>
      <p className="font-display text-3xl mt-1.5">{value}</p>
      {hint && <p className="text-xs text-forest-500/60 mt-1">{hint}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [branchId, setBranchId] = useState('');
  const { rooms, loading } = useRooms(branchId);
  const { notifications } = useNotifications(branchId);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const query = branchId ? `?branchId=${branchId}` : '';
    api.get<{ bookings: Booking[] }>(`/bookings${query}`).then((d) => setBookings(d.bookings));
  }, [branchId]);

  const stats = useMemo(() => {
    const active = rooms.filter((r) => r.status === 'active').length;
    const pending = rooms.filter((r) => r.status === 'pending').length;
    const free = rooms.filter((r) => r.status === 'inactive').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysRevenue = bookings
      .filter((b) => new Date(b.created_at) >= today)
      .reduce((sum, b) => sum + Number(b.amount_paid), 0);
    const customersServedToday = bookings.filter(
      (b) => b.status === 'completed' && b.ended_at && new Date(b.ended_at) >= today
    ).length;

    return { active, pending, free, todaysRevenue, customersServedToday };
  }, [rooms, bookings]);

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-3xl">Overview</h1>
        <BranchFilter value={branchId} onChange={setBranchId} />
      </div>
      <p className="text-forest-500/70 text-sm mb-8">
        {branchId ? 'What\u2019s happening at this branch, right now.' : 'Every branch, in one place, right now.'}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="In session" value={String(stats.active)} hint={`of ${rooms.length} rooms`} />
        <StatCard label="Awaiting confirmation" value={String(stats.pending)} />
        <StatCard label="Free rooms" value={String(stats.free)} />
        <StatCard label="Revenue today" value={`${money(stats.todaysRevenue)}`} hint="TZS collected" />
        <StatCard label="Customers served today" value={String(stats.customersServedToday)} />
      </div>

      <OnHoldList branchId={branchId} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2">
          <h2 className="font-display text-xl mb-4">Rooms</h2>
          {loading ? (
            <p className="text-forest-500/70">Loading rooms…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} />
              ))}
              {rooms.length === 0 && (
                <p className="text-forest-500/60 text-sm">No rooms found for this branch yet.</p>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-xl mb-4">Latest activity</h2>
          <div className="bg-white rounded-xl2 border border-forest-100 shadow-card divide-y divide-forest-50 max-h-[640px] overflow-y-auto">
            {notifications.slice(0, 25).map((n) => (
              <div key={n.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[11px] font-semibold text-forest-600 uppercase tracking-wide">{n.type.replace(/_/g, ' ')}</span>
                  <span className="text-[11px] text-forest-500/60 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                </div>
                <p className="text-sm text-ink leading-snug">{n.message}</p>
              </div>
            ))}
            {notifications.length === 0 && (
              <p className="text-sm text-forest-500/60 px-4 py-6 text-center">No activity yet today.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
