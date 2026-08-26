'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Booking, Room } from '@/lib/types';

export default function ResumeHoldModal({
  booking,
  onClose,
  onResumed,
}: {
  booking: Booking;
  onClose: () => void;
  onResumed: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const query = booking.branch_id ? `?branchId=${booking.branch_id}` : '';
    api.get<{ rooms: Room[] }>(`/rooms${query}`).then((d) => {
      const free = d.rooms.filter((r) => r.status === 'inactive' && r.provider);
      setRooms(free);
      setRoomId(free[0] ? String(free[0].id) : '');
      setLoading(false);
    });
  }, [booking.branch_id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomId) {
      setError('No rooms are free right now.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/bookings/${booking.id}/resume`, { roomId: Number(roomId) });
      onResumed();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resume this booking.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6">
        <h2 className="font-display text-2xl mb-1">Resume booking</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          {booking.customer_name} · {booking.service_name} — already paid, just needs a room.
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
                {submitting ? 'Resuming…' : 'Resume'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
