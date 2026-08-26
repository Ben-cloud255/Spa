'use client';

import { useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Booking } from '@/lib/types';

export default function PaymentRequestModal({ booking, onClose, onRecorded }: { booking: Booking; onClose: () => void; onRecorded: () => void }) {
  const outstanding = Math.max(0, Number(booking.amount_due) - Number(booking.amount_paid));
  const requiresFullPayment = booking.status === 'awaiting_payment';
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState('cash');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null); setSubmitting(true);
    try {
      await api.post(`/bookings/${booking.id}/payment`, { amount: Number(amount), method });
      onRecorded(); onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record the payment.');
    } finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6">
        <h2 className="font-display text-2xl mb-1">Record customer payment</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          {requiresFullPayment
            ? `${booking.customer_name} requested an extra service that hasn't started yet. Full payment is required before the timer begins.`
            : `${booking.customer_name} · ${booking.service_name} · ${booking.room_name}`}
        </p>
        <div className="rounded-lg bg-honey-500/10 px-3 py-3 text-sm mb-4">
          Outstanding balance: <strong>{new Intl.NumberFormat('en-TZ').format(outstanding)} TZS</strong>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Amount received (TZS)</label>
            <input required type="number" min="1" max={outstanding || undefined} readOnly={requiresFullPayment} value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm ${requiresFullPayment ? 'bg-forest-50 text-forest-600' : ''}`} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Payment method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm">
              <option value="cash">Cash</option>
              <option value="mobile_money">Mobile money</option>
              <option value="card">Card</option>
            </select>
          </div>
          {error && <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-forest-200 py-2.5 text-sm font-medium">Not received</button>
            <button type="submit" disabled={submitting || outstanding <= 0} className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2.5 text-sm font-medium disabled:opacity-60">
              {submitting ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
