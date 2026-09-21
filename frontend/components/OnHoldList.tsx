'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import ResumeHoldModal from '@/components/ResumeHoldModal';
import type { Booking } from '@/lib/types';

function timeSince(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function OnHoldList({ branchId = '', refreshTrigger = 0 }: { branchId?: string; refreshTrigger?: number }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumeTarget, setResumeTarget] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: 'on_hold' });
    if (branchId) params.set('branchId', branchId);
    const data = await api.get<{ bookings: Booking[] }>(`/bookings?${params.toString()}`);
    setBookings(data.bookings);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshTrigger]);

  async function release(id: number) {
    if (!window.confirm('Release this booking for good? The room and provider become fully available again.')) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/bookings/${id}/release`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not release this booking.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading || bookings.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="font-display text-xl mb-4">On hold ({bookings.length})</h2>
      {error && <p className="mb-3 text-sm text-clay bg-clay/10 rounded-lg px-3 py-2 inline-block">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {bookings.map((b) => (
          <div key={b.id} className="bg-white rounded-xl2 border border-l-4 border-l-honey-500 border-forest-100 shadow-card p-5">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-display text-lg leading-tight">{b.customer_name}</h3>
              <span className="text-[11px] text-honey-600 font-medium whitespace-nowrap">
                on hold {b.pending_started_at ? timeSince(b.pending_started_at) : ''}
              </span>
            </div>
            <p className="text-xs text-forest-500/70 mb-2">{b.customer_phone}</p>
            <p className="text-sm text-ink mb-1">{b.service_name}</p>
            <p className="text-xs text-forest-500/70 mb-4">
              Already paid {new Intl.NumberFormat('en-TZ').format(b.amount_paid)} TZS
              {b.branch_name ? ` · ${b.branch_name}` : ''}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setResumeTarget(b)}
                className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2 text-xs font-medium hover:bg-forest-700"
              >
                Resume
              </button>
              <button
                onClick={() => release(b.id)}
                disabled={busyId === b.id}
                className="rounded-lg border border-forest-200 px-3 py-2 text-xs font-medium hover:bg-forest-50 disabled:opacity-50"
              >
                Release
              </button>
            </div>
          </div>
        ))}
      </div>

      {resumeTarget && (
        <ResumeHoldModal booking={resumeTarget} onClose={() => setResumeTarget(null)} onResumed={load} />
      )}
    </div>
  );
}
