'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Booking } from '@/lib/types';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-honey-500/10 text-honey-600',
  active: 'bg-forest-500/10 text-forest-700',
  completed: 'bg-forest-100 text-forest-700',
  cancelled: 'bg-clay/10 text-clay',
  on_hold: 'bg-honey-500/10 text-honey-700',
};

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

export default function BookingHistoryPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ bookings: Booking[] }>('/bookings').then((d) => {
      setBookings(d.bookings);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Booking history</h1>
      <p className="text-forest-500/70 text-sm mb-8">Every booking recorded at the front desk.</p>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Room</th>
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Payment</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{b.customer_name}</p>
                    <p className="text-xs text-forest-500/70">{b.customer_phone}</p>
                  </td>
                  <td className="px-4 py-3">{b.service_name}</td>
                  <td className="px-4 py-3">{b.room_name}</td>
                  <td className="px-4 py-3">{b.provider_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {money(b.amount_paid)} / {money(b.amount_due)} TZS
                  </td>
                  <td className="px-4 py-3 text-forest-500/70">
                    {new Date(b.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-forest-500/60">
                    No bookings recorded yet.
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
