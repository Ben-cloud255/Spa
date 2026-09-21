'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useBranches } from '@/lib/useBranches';
import DistributeInventoryModal from '@/components/DistributeInventoryModal';
import type { InventoryItem, InventoryBranchStock, InventoryDistribution, InventoryRoomAllocation } from '@/lib/types';

const EMPTY_FORM = { name: '', minimumStock: '', costPerUnit: '', initialQuantity: '' };

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(Math.round(n));
}

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminInventoryPage() {
  const { branches } = useBranches();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [stock, setStock] = useState<InventoryBranchStock[]>([]);
  const [distributions, setDistributions] = useState<InventoryDistribution[]>([]);
  const [allocations, setAllocations] = useState<InventoryRoomAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [stockBranchFilter, setStockBranchFilter] = useState('');
  const [allocationStatusFilter, setAllocationStatusFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [quantityAdded, setQuantityAdded] = useState('');
  const [restocking, setRestocking] = useState(false);
  const [restockError, setRestockError] = useState<string | null>(null);
  const [showDistribute, setShowDistribute] = useState(false);

  async function loadAll() {
    const [itemsData, stockData, distData, allocData] = await Promise.all([
      api.get<{ items: InventoryItem[] }>('/inventory/items?includeInactive=true'),
      api.get<{ stock: InventoryBranchStock[] }>('/inventory/branch-stock'),
      api.get<{ distributions: InventoryDistribution[] }>('/inventory/distributions'),
      api.get<{ allocations: InventoryRoomAllocation[] }>('/inventory/room-allocations'),
    ]);
    setItems(itemsData.items);
    setStock(stockData.stock);
    setDistributions(distData.distributions);
    setAllocations(allocData.allocations);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const displayedItems = items.filter((it) => showHidden || it.is_active);
  const lowStockRows = stock.filter((s) => Number(s.quantity) <= Number(s.minimum_stock));
  const stockValue = items.reduce((sum, item) => sum + Number(item.available_quantity) * Number(item.cost_per_unit || 0), 0) + stock.reduce((sum, s) => sum + Number(s.quantity) * Number(s.cost_per_unit || 0), 0);
  const inUseCount = allocations.filter((a) => a.status === 'in_use').length;

  const displayedStock = stockBranchFilter ? stock.filter((s) => String(s.branch_id) === stockBranchFilter) : stock;
  const displayedAllocations = allocationStatusFilter
    ? allocations.filter((a) => a.status === allocationStatusFilter)
    : allocations;

  async function createItem(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/inventory/items', {
        name: form.name,
        initialQuantity: form.initialQuantity || '0',
        minimumStock: form.minimumStock,
        costPerUnit: form.costPerUnit || null,
      });
      setForm(EMPTY_FORM);
      loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this item.');
    }
  }

  async function addStock(e: FormEvent) {
    e.preventDefault();
    if (!restockItem || restocking) return;
    setRestockError(null);
    setRestocking(true);
    try {
      const result = await api.patch<{ item: InventoryItem }>('/inventory/items/' + restockItem.id, { quantityAdded });
      setItems((current) => current.map((item) => item.id === result.item.id ? result.item : item));
      setRestockItem(null);
      setQuantityAdded('');
    } catch (err) {
      setRestockError(err instanceof ApiError ? err.message : 'Could not add stock.');
    } finally { setRestocking(false); }
  }

  async function toggleActive(item: InventoryItem) {
    await api.patch(`/inventory/items/${item.id}`, { isActive: !item.is_active });
    loadAll();
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Inventory</h1>
      <p className="text-forest-500/70 text-sm mb-6">
        Track consumable stock — oils, creams, and other supplies — from purchase to the room it was used in.
        Everything here is recorded by hand: admin logs what was bought and which branch(es) it went to,
        receptionists hand it out to a room for a service, and providers mark it as used up. Nothing here is
        deducted automatically from a booking — see the note below on why.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5">
          <p className="text-xs uppercase tracking-wide text-forest-500/70">Items in catalog</p>
          <p className="font-display text-3xl mt-1.5">{items.filter((i) => i.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5">
          <p className="text-xs uppercase tracking-wide text-forest-500/70">Low stock alerts</p>
          <p className={`font-display text-3xl mt-1.5 ${lowStockRows.length > 0 ? 'text-clay' : ''}`}>{lowStockRows.length}</p>
        </div>
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5">
          <p className="text-xs uppercase tracking-wide text-forest-500/70">Items in rooms now</p>
          <p className="font-display text-3xl mt-1.5">{inUseCount}</p>
        </div>
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5">
          <p className="text-xs uppercase tracking-wide text-forest-500/70">Stock value</p>
          <p className="font-display text-3xl mt-1.5">{money(stockValue)}</p>
          <p className="text-xs text-forest-500/60 mt-1">TZS · catalog and branch stock</p>
        </div>
      </div>

      {lowStockRows.length > 0 && (
        <div className="bg-white rounded-xl2 border border-clay/30 shadow-card overflow-hidden mb-8">
          <h2 className="font-display text-lg px-5 py-3 border-b border-clay/20 bg-clay/5 text-clay">Low stock alerts</h2>
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Current</th>
                <th className="text-left px-4 py-3">Minimum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {lowStockRows.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.item_name}</td>
                  <td className="px-4 py-3">{s.branch_name}</td>
                  <td className="px-4 py-3 text-clay font-medium">{Number(s.quantity)}</td>
                  <td className="px-4 py-3">{Number(s.minimum_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Catalog */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl">Item catalog</h2>
        <button
          onClick={() => setShowDistribute(true)}
          className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700"
        >
          + Record a delivery
        </button>
      </div>

      <form onSubmit={createItem} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6 items-end">
        <div className="sm:col-span-2 lg:col-span-2">
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Item name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Massage Oil"
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Minimum stock (per branch)</label>
          <input
            required
            type="number"
            min="0"
            value={form.minimumStock}
            onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Cost/unit (optional)</label>
          <input
            type="number"
            min="0"
            value={form.costPerUnit}
            onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Quantity</label>
          <input type="number" min="0" step="0.01" value={form.initialQuantity} onChange={(e) => setForm({ ...form, initialQuantity: e.target.value })} placeholder="0" className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-full" />
        </div>
        <div className="sm:col-span-2 lg:col-span-5 flex items-end gap-3">
          <button type="submit" className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700">
            Add to catalog
          </button>
          {error && <span className="text-sm text-clay">{error}</span>}
        </div>
      </form>

      <p className="text-sm text-forest-500/70 mb-4">Enter the quantity you bought when adding an item. Recording a delivery automatically reduces the remaining quantity in the catalog. Click an item name to add more quantity. Use this form for a new item or a different cost per item.</p>
      {restockItem && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="restock-title">
        <form onSubmit={addStock} className="bg-white rounded-xl2 border border-forest-100 p-5 space-y-3 w-full max-w-sm">
          <h2 id="restock-title" className="font-display text-xl">{restockItem.name}</h2>
          <label className="block text-sm font-medium" htmlFor="quantity-added">Quantity to add</label>
          <input id="quantity-added" autoFocus required type="number" min="0.01" step="0.01" value={quantityAdded} onChange={(e) => setQuantityAdded(e.target.value)} className="rounded-lg border border-forest-200 px-3 py-2 text-sm" />
          <button disabled={restocking} type="submit" className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm disabled:opacity-60">{restocking ? 'Saving…' : 'Save stock'}</button>
          <button disabled={restocking} type="button" onClick={() => setRestockItem(null)} className="px-4 py-2 text-sm">Cancel</button>
          {restockError && <p role="alert" className="text-sm text-clay">{restockError}</p>}
        </form>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm text-forest-600 mb-4">
        <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
        Show hidden items
      </label>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Item</th>
                  <th className="text-left px-4 py-3">Remaining quantity</th>
                  <th className="text-left px-4 py-3">Minimum (per branch)</th>
                  <th className="text-left px-4 py-3">Cost/unit</th>
                  <th className="text-left px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-50">
                {displayedItems.map((it) => (
                  <tr key={it.id} className={it.is_active ? '' : 'opacity-50'}>
                    <td className="px-4 py-3 font-medium">
                      <button type="button" onClick={() => { setRestockItem(it); setQuantityAdded(''); setRestockError(null); }} className="text-forest-600 underline underline-offset-2 hover:text-forest-800">{it.name}</button>
                      {!it.is_active && <span className="ml-2 text-xs text-clay font-normal">Hidden</span>}
                    </td>
                    <td className="px-4 py-3 font-medium">{Number(it.available_quantity)}</td>
                    <td className="px-4 py-3">{Number(it.minimum_stock)}</td>
                    <td className="px-4 py-3">{it.cost_per_unit == null ? '—' : Number(it.cost_per_unit)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleActive(it)} className="text-xs font-medium text-clay hover:text-clay/80">
                        {it.is_active ? 'Hide' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
                {displayedItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-forest-500/60">
                      No inventory items yet — add one above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Branch stock */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl">Stock by branch</h2>
        <select
          value={stockBranchFilter}
          onChange={(e) => setStockBranchFilter(e.target.value)}
          className="rounded-lg border border-forest-200 px-3 py-1.5 text-sm"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-4 py-3">Quantity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {displayedStock.map((s) => {
                const low = Number(s.quantity) <= Number(s.minimum_stock);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{s.branch_name}</td>
                    <td className="px-4 py-3 font-medium">{s.item_name}</td>
                    <td className={`px-4 py-3 ${low ? 'text-clay font-medium' : ''}`}>{Number(s.quantity)}</td>
                  </tr>
                );
              })}
              {displayedStock.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-forest-500/60">
                    No stock recorded yet — record a delivery above to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution history */}
      <h2 className="font-display text-xl mb-3">Delivery history</h2>
      <div className="space-y-3 mb-8">
        {Array.from(new Map([
          ...branches.map((b) => [b.id, b.name] as const),
          ...distributions.map((d) => [d.branch_id, d.branch_name] as const),
        ])).map(([branchId, branchName]) => {
          const deliveries = distributions.filter((d) => d.branch_id === branchId);
          return (
            <details key={branchId} className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
              <summary className="cursor-pointer px-5 py-4 font-medium text-forest-700">
                {branchName} <span className="ml-2 text-xs font-normal text-forest-500">({deliveries.length})</span>
              </summary>
              {deliveries.length === 0 ? (
                <p className="px-5 pb-4 text-sm text-forest-500/70">No deliveries recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3">When</th>
                        <th className="text-left px-4 py-3">Item</th>
                        <th className="text-left px-4 py-3">Quantity</th>
                        <th className="text-left px-4 py-3">Note</th>
                        <th className="text-left px-4 py-3">Recorded by</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-forest-50">
                      {deliveries.map((d) => (
                        <tr key={d.id}>
                          <td className="px-4 py-3 text-forest-500/70">{timeAgo(d.created_at)}</td>
                          <td className="px-4 py-3 font-medium">{d.item_name}</td>
                          <td className="px-4 py-3">{Number(d.quantity)}</td>
                          <td className="px-4 py-3 text-forest-500/70">{d.note || '—'}</td>
                          <td className="px-4 py-3">{d.recorded_by_name || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          );
        })}
        {branches.length === 0 && distributions.length === 0 && <p className="text-sm text-forest-500/70">No deliveries recorded yet.</p>}
      </div>

      {/* Room allocation history */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-xl">Items taken to rooms</h2>
        <select
          value={allocationStatusFilter}
          onChange={(e) => setAllocationStatusFilter(e.target.value)}
          className="rounded-lg border border-forest-200 px-3 py-1.5 text-sm"
        >
          <option value="">All</option>
          <option value="in_use">In use</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-4 py-3">Room</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Qty</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Assigned</th>
                <th className="text-left px-4 py-3">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {displayedAllocations.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium">{a.item_name}</td>
                  <td className="px-4 py-3">{a.room_name}</td>
                  <td className="px-4 py-3">{a.branch_name}</td>
                  <td className="px-4 py-3">{Number(a.quantity)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === 'in_use' ? 'bg-honey-500/10 text-honey-700' : 'bg-forest-500/10 text-forest-700'}`}>
                      {a.status === 'in_use' ? 'In use' : 'Completed'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-forest-500/70">
                    {a.assigned_by_name || '—'} · {timeAgo(a.assigned_at)}
                    {a.note && <div className="text-xs text-forest-500/50 mt-0.5">{a.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-forest-500/70">
                    {a.status === 'completed' ? (
                      <>
                        {a.completed_by_name || '—'} · {a.completed_at ? timeAgo(a.completed_at) : ''}
                        {a.completion_note && <div className="text-xs text-forest-500/50 mt-0.5">{a.completion_note}</div>}
                        {Number(a.quantity_returned) > 0 && (
                          <div className="text-xs text-forest-500/50 mt-0.5">{Number(a.quantity_returned)} returned to stock</div>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
              {displayedAllocations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-forest-500/60">
                    No items have been taken to a room yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDistribute && (
        <DistributeInventoryModal
          items={items.filter((i) => i.is_active)}
          branches={branches}
          onClose={() => setShowDistribute(false)}
          onDistributed={loadAll}
        />
      )}
    </div>
  );
}
