'use client';

import { useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { groupServicesByCategory } from '@/lib/services';
import type { Room, Service } from '@/lib/types';

export default function ExtraServiceModal({
  room,
  services,
  onClose,
  onAdded,
}: {
  room: Room;
  services: Service[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const booking = room.currentBooking!;
  const sessionAlreadyEnded = booking.status !== 'active';
  const [serviceId, setServiceId] = useState<string>(services[0]?.id.toString() || '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/bookings/${booking.id}/extra-service`, { serviceId: Number(serviceId) });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the extra service.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-modalBackdropIn">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6 animate-modalContentIn">
        <h2 className="font-display text-2xl mb-1">Add extra service</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          {sessionAlreadyEnded
            ? `${booking.customerName}'s service already ended. This sends a request to the front desk — the timer only starts once they've collected full payment.`
            : `${booking.customerName} would like something more. The timer extends right away and the front desk will be notified.`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Additional service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
            >
              {groupServicesByCategory(services).map((group) => (
                <optgroup key={group.categoryName} label={group.categoryName}>
                  {group.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · +{s.duration_minutes} min · {new Intl.NumberFormat('en-TZ').format(s.price)} TZS
                    </option>
                  ))}
                </optgroup>
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
              disabled={submitting}
              className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2.5 text-sm font-medium hover:bg-forest-700 disabled:opacity-60"
            >
              {submitting ? (sessionAlreadyEnded ? 'Requesting…' : 'Adding…') : sessionAlreadyEnded ? 'Request payment to start' : 'Add & extend timer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
