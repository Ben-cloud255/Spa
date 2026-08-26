'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Appointment, Room } from '@/lib/types';

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

export default function CheckInModal({
  appointment,
  onClose,
  onCheckedIn,
}: {
  appointment: Appointment;
  onClose: () => void;
  onCheckedIn: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [amountPaid, setAmountPaid] = useState(String(appointment.price));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ rooms: Room[] }>(`/rooms?branchId=${appointment.branch_id}`).then((d) => {
      const free = d.rooms.filter((r) => r.status === 'inactive' && r.provider);
      setRooms(free);
      setRoomId(free[0] ? String(free[0].id) : '');
      setLoading(false);
    });
  }, [appointment.branch_id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomId) {
      setError('No rooms are free at this branch right now.');
      return;
    }
    if (Number(amountPaid) < appointment.price) {
      setError(`Full payment is required before check-in. This service costs ${money(appointment.price)} TZS.`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/appointments/${appointment.id}/check-in`, {
        roomId: Number(roomId),
        amountPaid: Number(amountPaid),
        paymentMethod,
      });
      onCheckedIn();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check this customer in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-md p-6">
        <h2 className="font-display text-2xl mb-1">Check in</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          {appointment.customer_name} · {appointment.service_name} · {appointment.branch_name}
        </p>

        {loading ? (
          <p className="text-forest-500/70 text-sm">Loading free rooms…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Assign a room</label>
              <select
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={rooms.length === 0}
                className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm"
              >
                {rooms.length === 0 && <option>No rooms free right now</option>}
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.provider?.name}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-forest-500/60">
              {appointment.service_name} · {appointment.duration_minutes} min · {money(appointment.price)} TZS
            </p>

            <div className="grid grid-cols-2 gap-3 bg-sand-100/60 rounded-lg p-3.5">
              <div>
                <label className="block text-xs font-medium mb-1.5">Amount collected (TZS)</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-lg border border-forest-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Payment method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-forest-200 px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>

            {error && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-forest-200 py-2.5 text-sm font-medium hover:bg-forest-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || rooms.length === 0}
                className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2.5 text-sm font-medium hover:bg-forest-700 disabled:opacity-60"
              >
                {submitting ? 'Checking in…' : 'Confirm payment & check in'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
