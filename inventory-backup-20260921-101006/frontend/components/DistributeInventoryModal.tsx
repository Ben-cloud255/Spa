'use client';

import { useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Branch, InventoryItem } from '@/lib/types';

export default function DistributeInventoryModal({
  items,
  branches,
  onClose,
  onDistributed,
}: {
  items: InventoryItem[];
  branches: Branch[];
  onClose: () => void;
  onDistributed: () => void;
}) {
  const [itemId, setItemId] = useState(items[0] ? String(items[0].id) : '');
  const [note, setNote] = useState('');
  const [selectedBranches, setSelectedBranches] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleBranch(branchId: number) {
    setSelectedBranches((prev) => {
      const next = { ...prev };
      if (branchId in next) delete next[branchId];
      else next[branchId] = '';
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const allocations = Object.entries(selectedBranches)
      .filter(([, qty]) => qty && Number(qty) > 0)
      .map(([branchId, qty]) => ({ branchId: Number(branchId), quantity: Number(qty) }));
    if (!itemId) {
      setError('Choose an item.');
      return;
    }
    if (allocations.length === 0) {
      setError('Select at least one branch and enter a quantity for it.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/inventory/distribute', { itemId: Number(itemId), note: note.trim() || undefined, allocations });
      onDistributed();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record this delivery.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-modalBackdropIn">
      <div className="bg-white rounded-xl2 shadow-card w-full max-w-md p-6 animate-modalContentIn">
        <h2 className="font-display text-2xl mb-1">Record a delivery</h2>
        <p className="text-sm text-forest-500/70 mb-5">
          Log newly bought stock and hand it to one or more branches at once.
        </p>

        {items.length === 0 ? (
          <p className="text-sm text-clay bg-clay/10 rounded-lg px-3 py-2">
            Add an item to the catalog first, then come back here to distribute it.
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
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Send to</label>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {branches.map((b) => {
                  const checked = b.id in selectedBranches;
                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm flex-1">
                        <input type="checkbox" checked={checked} onChange={() => toggleBranch(b.id)} />
                        {b.name}
                      </label>
                      {checked && (
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={selectedBranches[b.id]}
                          onChange={(e) => setSelectedBranches((prev) => ({ ...prev, [b.id]: e.target.value }))}
                          placeholder="Qty"
                          className="w-24 rounded-lg border border-forest-200 px-2.5 py-1.5 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-forest-200 px-3.5 py-2.5 text-sm focus:border-forest-500 focus:ring-1 focus:ring-forest-500 outline-none"
                placeholder="e.g. supplier invoice #, delivery date"
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
                {submitting ? 'Recording…' : 'Record delivery'}
              </button>
            </div>
          </form>
        )}

        {items.length === 0 && (
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
