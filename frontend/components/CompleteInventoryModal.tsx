'use client';

import { useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { InventoryRoomAllocation } from '@/lib/types';

export default function CompleteInventoryModal({
  allocation,
  onClose,
  onCompleted,
}: {
  allocation: InventoryRoomAllocation;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [note, setNote] = useState('');
  const [quantityReturned, setQuantityReturned] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/inventory/room-allocations/${allocation.id}/complete`, {
        note: note.trim() || undefined,
        quantityReturned: Number(quantityReturned) || 0,
      });
      onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not mark this item as finished.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-modalBackdropIn">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6 animate-modalContentIn">
        <h2 className="font-display text-2xl mb-1">Mark as finished</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          {Number(allocation.quantity)} {allocation.item_name} in {allocation.room_name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">What happened (optional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
              placeholder="e.g. bottle finished during the massage"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Amount left over, if any
            </label>
            <input
              type="number"
              min="0"
              max={allocation.quantity}
              step="any"
              value={quantityReturned}
              onChange={(e) => setQuantityReturned(e.target.value)}
              className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
            />
            <p className="text-xs text-forest-500/60 mt-1">Leave as 0 if it was fully used — any amount here goes back into branch stock.</p>
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
              {submitting ? 'Saving…' : 'Mark finished'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
