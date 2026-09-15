'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { usePaymentMethods } from '@/lib/usePaymentMethods';
import type { Appointment, Room, User } from '@/lib/types';

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
  const [providers, setProviders] = useState<User[]>([]);
  const [roomId, setRoomId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [amountPaid, setAmountPaid] = useState(String(appointment.price));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const { paymentMethods } = usePaymentMethods();

  useEffect(() => {
    if (paymentMethods.length > 0) setPaymentMethod(paymentMethods[0].name);
  }, [paymentMethods]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ rooms: Room[] }>(`/rooms?branchId=${appointment.branch_id}`),
      api.get<{ users: User[] }>(`/users?role=provider&branchId=${appointment.branch_id}`),
    ]).then(([roomsData, usersData]) => {
      const free = roomsData.rooms.filter((r) => r.status === 'inactive');
      const freeProviders = usersData.users.filter((p) => !p.is_busy);
      setRooms(free);
      setProviders(freeProviders);
      setRoomId(free[0] ? String(free[0].id) : '');
      setProviderId(freeProviders[0] ? String(freeProviders[0].id) : '');
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
    if (!providerId) {
      setError('No providers are free at this branch right now.');
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
        providerId: Number(providerId),
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
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-modalBackdropIn">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-md p-6 animate-modalContentIn">
        <h2 className="font-display text-2xl mb-1">Check in</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          {appointment.customer_name} · {appointment.service_name} · {appointment.branch_name}
        </p>

        {loading ? (
          <p className="text-forest-500/70 text-sm">Loading free rooms and providers…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Room</label>
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
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Provider</label>
                <select
                  required
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  disabled={providers.length === 0}
                  className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm"
                >
                  {providers.length === 0 && <option>No providers free right now</option>}
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
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
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.name}>
                      {pm.name}
                    </option>
                  ))}
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
                disabled={submitting || rooms.length === 0 || providers.length === 0}
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
