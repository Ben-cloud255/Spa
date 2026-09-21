'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { InventoryBranchStock } from '@/lib/types';

export default function AssignInventoryModal({
  roomId,
  roomName,
  branchId,
  onClose,
  onAssigned,
}: {
  roomId: number;
  roomName: string;
  branchId: number;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [stock, setStock] = useState<InventoryBranchStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get<{ stock: InventoryBranchStock[] }>(`/inventory/branch-stock?branchId=${branchId}`)
      .then((d) => {
        const available = d.stock.filter((s) => Number(s.quantity) > 0);
        setStock(available);
        setItemId(available[0] ? String(available[0].item_id) : '');
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  const selected = stock.find((s) => String(s.item_id) === itemId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!itemId || !quantity) return;
    if (selected && Number(quantity) > Number(selected.quantity)) {
      setError(`Only ${Number(selected.quantity)} available at this branch.`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/room-allocations', {
        itemId: Number(itemId),
        roomId,
        quantity: Number(quantity),
        note: note.trim() || undefined,
      });
      onAssigned();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not assign this item.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-modalBackdropIn">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-sm p-6 animate-modalContentIn">
        <h2 className="font-display text-2xl mb-1">Assign item</h2>
        <p className="text-sm text-forest-500/70 mb-5">Take stock out of the branch stockroom for {roomName}.</p>

        {loading ? (
          <p className="text-sm text-forest-500/70">Loading branch stock…</p>
        ) : stock.length === 0 ? (
          <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">
            No stock available at this branch yet. Ask an admin to distribute some first.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Item</label>
              <select
                required
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
              >
                {stock.map((s) => (
                  <option key={s.item_id} value={s.item_id}>
                    {s.item_name} — {Number(s.quantity)} available
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Quantity
              </label>
              <input
                required
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                placeholder="e.g. 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                placeholder="e.g. for the deep tissue massage"
              />
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
                {submitting ? 'Assigning…' : 'Assign to room'}
              </button>
            </div>
          </form>
        )}

        {stock.length === 0 && !loading && (
          <div className="flex justify-end pt-4">
            <button onClick={onClose} className="rounded-lg border border-forest-200 px-4 py-2 text-sm font-medium hover:bg-forest-50">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
