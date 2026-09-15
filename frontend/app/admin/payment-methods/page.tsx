'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { PaymentMethod } from '@/lib/usePaymentMethods';

export default function AdminPaymentMethodsPage() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  async function load() {
    const data = await api.get<{ paymentMethods: PaymentMethod[] }>('/payment-methods?includeInactive=true');
    setMethods(data.paymentMethods);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!focusId) return;
    setShowHidden(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  useEffect(() => {
    if (!focusId || loading) return;
    const id = Number(focusId);
    setHighlightId(id);
    const el = document.getElementById(`payment-method-row-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [focusId, loading, methods]);

  const displayedMethods = methods.filter((pm) => showHidden || pm.is_active);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/payment-methods', { name });
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add this payment method.');
    }
  }

  async function toggleActive(pm: PaymentMethod) {
    await api.patch(`/payment-methods/${pm.id}`, { is_active: !pm.is_active });
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Payment methods</h1>
      <p className="text-forest-500/70 text-sm mb-8">
        These appear as options wherever a receptionist records a payment — for example specific mobile money
        providers (M-Pesa, Tigo Pesa, Airtel Money), alongside cash and card. Hide one to stop it appearing as a
        choice without losing the history of payments already recorded against it.
      </p>

      <form onSubmit={create} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 flex flex-wrap items-end gap-3 mb-8">
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Method name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Halotel Pesa"
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-56"
          />
        </div>
        <button type="submit" className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700">
          Add payment method
        </button>
        {error && <p className="text-sm text-clay basis-full">{error}</p>}
      </form>

      <label className="flex items-center gap-2 text-sm text-forest-600 mb-4">
        <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
        Show hidden payment methods
      </label>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {displayedMethods.map((pm) => (
                <tr key={pm.id} id={`payment-method-row-${pm.id}`} className={`transition-colors ${pm.is_active ? '' : 'opacity-50'} ${highlightId === pm.id ? 'bg-honey-500/20' : ''}`}>
                  <td className="px-4 py-3 font-medium">{pm.name}</td>
                  <td className="px-4 py-3">{pm.is_active ? 'Active' : 'Hidden'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleActive(pm)} className="text-xs font-medium text-forest-600 hover:text-forest-800">
                      {pm.is_active ? 'Hide' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
              {displayedMethods.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-forest-500/60">
                    {showHidden ? 'No payment methods yet.' : 'No active payment methods — check "Show hidden" if you\u2019re looking for one you hid.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
