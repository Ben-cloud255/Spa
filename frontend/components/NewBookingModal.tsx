'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { groupServicesByCategory } from '@/lib/services';
import type { Room, Service } from '@/lib/types';

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

export default function NewBookingModal({
  rooms,
  services,
  onClose,
  onCreated,
}: {
  rooms: Room[];
  services: Service[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const freeRooms = rooms.filter((r) => r.status === 'inactive' && r.provider);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceId, setServiceId] = useState<string>(services[0]?.id.toString() || '');
  const [roomId, setRoomId] = useState<string>(freeRooms[0]?.id.toString() || '');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = services.find((s) => String(s.id) === serviceId);

  // Keep the amount defaulted to the service price, but let the receptionist
  // see/edit it — it stays editable in case of a discount or exact change.
  useEffect(() => {
    if (selectedService) setAmountPaid(String(selectedService.price));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!roomId) {
      setError('No rooms are free right now. Please wait for one to become available.');
      return;
    }
    if (selectedService && Number(amountPaid) < selectedService.price) {
      setError(`Full payment is required before assigning a room. This service costs ${money(selectedService.price)} TZS.`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/bookings', {
        customerName,
        customerPhone,
        serviceId: Number(serviceId),
        roomId: Number(roomId),
        amountPaid: Number(amountPaid),
        paymentMethod,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the booking.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-md p-6">
        <h2 className="font-display text-2xl mb-1">New booking</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          Collect payment, then assign a free room. A room is only ever assigned once payment is confirmed.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Customer name</label>
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
              placeholder="e.g. Sarah Mnyika"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone number</label>
            <input
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
              placeholder="e.g. 0712 345 678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Service</label>
            <select
              required
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
            >
              {groupServicesByCategory(services).map((group) => (
                <optgroup key={group.categoryName} label={group.categoryName}>
                  {group.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration_minutes} min · {money(s.price)} TZS
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Room</label>
            <select
              required
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
              disabled={freeRooms.length === 0}
            >
              {freeRooms.length === 0 && <option>No rooms free right now</option>}
              {freeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} — {r.provider?.name}
                </option>
              ))}
            </select>
          </div>

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
              disabled={submitting || freeRooms.length === 0}
              className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2.5 text-sm font-medium hover:bg-forest-700 disabled:opacity-60"
            >
              {submitting ? 'Booking…' : 'Confirm payment & assign room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
