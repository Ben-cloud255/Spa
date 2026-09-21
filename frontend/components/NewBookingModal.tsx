'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { usePaymentMethods } from '@/lib/usePaymentMethods';
import { groupServicesByCategory } from '@/lib/services';
import type { Room, Service, User } from '@/lib/types';

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

export default function NewBookingModal({
  rooms,
  services,
  providers,
  onClose,
  onCreated,
}: {
  rooms: Room[];
  services: Service[];
  providers: User[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const freeRooms = rooms.filter((r) => r.status === 'inactive');
  const freeProviders = providers.filter((p) => !p.is_busy);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceId, setServiceId] = useState<string>(services[0]?.id.toString() || '');
  const [roomId, setRoomId] = useState<string>(freeRooms[0]?.id.toString() || '');
  const [providerId, setProviderId] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const { paymentMethods } = usePaymentMethods();

  useEffect(() => {
    if (paymentMethods.length > 0) setPaymentMethod(paymentMethods[0].name);
  }, [paymentMethods]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedService = services.find((s) => String(s.id) === serviceId);
  const selectedRoom = rooms.find((r) => String(r.id) === roomId);

  // Default to the room's usual provider if they're free right now; otherwise
  // fall back to whichever free provider comes first. The receptionist can
  // always override this — providers aren't stuck to one room.
  //
  // `providers` is refetched/polled by the parent, so it arrives as a new
  // array reference on nearly every render even when nothing changed. We
  // only want to pick a fresh default when the ROOM actually changes; on any
  // other re-run (just a providers refresh) we should leave the
  // receptionist's manual choice alone, and only step in if their chosen
  // provider stopped being free.
  const prevRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (freeProviders.length === 0) {
      setProviderId('');
      return;
    }
    const roomChanged = prevRoomIdRef.current !== roomId;
    prevRoomIdRef.current = roomId;

    if (!roomChanged) {
      // Providers list just refreshed — keep the current selection unless
      // it's no longer valid (that provider got busy/removed).
      setProviderId((current) => {
        if (current && freeProviders.some((p) => String(p.id) === current)) return current;
        return String(freeProviders[0].id);
      });
      return;
    }

    const roomsUsual = selectedRoom?.provider?.id;
    const usualIsFree = roomsUsual && freeProviders.some((p) => p.id === roomsUsual);
    setProviderId(String(usualIsFree ? roomsUsual : freeProviders[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, providers]);

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
    if (!providerId) {
      setError('No providers are free right now. Please wait for one to become available.');
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
        providerId: Number(providerId),
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
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-modalBackdropIn">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-md p-6 animate-modalContentIn">
        <h2 className="font-display text-2xl mb-1">New booking</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          Collect payment, then assign a free room and any free provider. A room is only ever assigned once
          payment is confirmed.
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
          <div className="grid grid-cols-2 gap-3">
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
                className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                disabled={freeProviders.length === 0}
              >
                {freeProviders.length === 0 && <option>No providers free right now</option>}
                {freeProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
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
              disabled={submitting || freeRooms.length === 0 || freeProviders.length === 0}
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
