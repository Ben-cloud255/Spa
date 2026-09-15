'use client';

import { useState, useEffect, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { usePaymentMethods } from '@/lib/usePaymentMethods';
import type { Room } from '@/lib/types';

export default function PaymentModal({
  room,
  onClose,
  onRecorded,
}: {
  room: Room;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const booking = room.currentBooking!;
  const outstanding = booking.amountDue - booking.amountPaid;
  const requiresFullPayment = booking.status === 'awaiting_payment';
  const [amount, setAmount] = useState<string>(outstanding > 0 ? String(outstanding) : '');
  const [method, setMethod] = useState('cash');
  const { paymentMethods } = usePaymentMethods();

  useEffect(() => {
    if (paymentMethods.length > 0) setMethod(paymentMethods[0].name);
  }, [paymentMethods]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/bookings/${booking.id}/payment`, { amount: Number(amount), method });
      onRecorded();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-modalBackdropIn">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6 animate-modalContentIn">
        <h2 className="font-display text-2xl mb-1">Additional payment</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          {requiresFullPayment
            ? `${booking.customerName} requested an extra service that hasn't started yet. Full payment is required before the timer begins — partial payment won't start it.`
            : `For a service added after the original booking. ${booking.customerName} · ${room.name}`}
        </p>

        <p className="text-sm text-forest-600 mb-4">
          Outstanding balance:{' '}
          <span className="font-semibold">{new Intl.NumberFormat('en-TZ').format(outstanding)} TZS</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Amount received (TZS)</label>
            <input
              required
              type="number"
              min="1"
              max={requiresFullPayment ? outstanding : undefined}
              readOnly={requiresFullPayment}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none ${requiresFullPayment ? 'bg-forest-50 text-forest-600' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Payment method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.name}>
                  {pm.name}
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
              disabled={submitting}
              className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2.5 text-sm font-medium hover:bg-forest-700 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
