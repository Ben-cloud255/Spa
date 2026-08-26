'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import BranchFilter from '@/components/BranchFilter';
import CheckInModal from '@/components/CheckInModal';
import type { Appointment } from '@/lib/types';

const STATUS_STYLE: Record<string, string> = {
  requested: 'bg-honey-500/10 text-honey-600',
  confirmed: 'bg-forest-500/10 text-forest-700',
  completed: 'bg-forest-100 text-forest-700',
  cancelled: 'bg-clay/10 text-clay',
};

export default function AdminAppointmentsPage() {
  const [branchId, setBranchId] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<Appointment | null>(null);

  async function load() {
    setLoading(true);
    const query = branchId ? `?branchId=${branchId}` : '';
    const data = await api.get<{ appointments: Appointment[] }>(`/appointments${query}`);
    setAppointments(data.appointments);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function confirm(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/appointments/${id}/confirm`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm this request.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: number) {
    if (!window.confirm('Cancel this booking request?')) return;
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/appointments/${id}/cancel`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel this request.');
    } finally {
      setBusyId(null);
    }
  }

  const active = appointments.filter((a) => ['requested', 'confirmed'].includes(a.status));
  const past = appointments.filter((a) => ['completed', 'cancelled'].includes(a.status));

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-3xl">Booking requests</h1>
        <BranchFilter value={branchId} onChange={setBranchId} />
      </div>
      <p className="text-forest-500/70 text-sm mb-8">Every online request from the website, across every branch.</p>

      {error && <p className="mb-4 text-sm text-clay bg-clay/10 rounded-lg px-3 py-2 inline-block">{error}</p>}

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {active.map((a) => (
              <div key={a.id} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-display text-lg leading-tight">{a.customer_name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[a.status]}`}>
                    {a.status}
                  </span>
                </div>
                <p className="text-xs text-honey-600 font-medium mb-1">{a.branch_name}</p>
                <p className="text-xs text-forest-500/70 mb-3">{a.customer_phone}</p>
                <p className="text-sm text-ink mb-1">{a.service_name}</p>
                <p className="text-xs text-forest-500/70 mb-3">
                  {new Date(a.preferred_date).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                  {a.preferred_time ? ` · ${a.preferred_time}` : ''}
                </p>
                {a.notes && <p className="text-xs text-forest-500/60 italic mb-3">"{a.notes}"</p>}

                <div className="flex gap-2 pt-1">
                  {a.status === 'requested' && (
                    <button
                      onClick={() => confirm(a.id)}
                      disabled={busyId === a.id}
                      className="flex-1 rounded-lg border border-forest-300 text-forest-700 py-2 text-xs font-medium hover:bg-forest-50 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  )}
                  <button
                    onClick={() => setCheckInTarget(a)}
                    className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2 text-xs font-medium hover:bg-forest-700"
                  >
                    Check in
                  </button>
                  <button
                    onClick={() => cancel(a.id)}
                    disabled={busyId === a.id}
                    className="rounded-lg border border-forest-200 px-3 py-2 text-xs font-medium hover:bg-forest-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
            {active.length === 0 && (
              <p className="text-forest-500/60 text-sm">No open booking requests right now.</p>
            )}
          </div>

          {past.length > 0 && (
            <>
              <h2 className="font-display text-xl mb-4">History</h2>
              <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
                <div className="overflow-x-auto">
          <table className="w-full text-sm">
                  <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Customer</th>
                      <th className="text-left px-4 py-3">Branch</th>
                      <th className="text-left px-4 py-3">Service</th>
                      <th className="text-left px-4 py-3">Preferred date</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-forest-50">
                    {past.map((a) => (
                      <tr key={a.id}>
                        <td className="px-4 py-3 font-medium">{a.customer_name}</td>
                        <td className="px-4 py-3 text-forest-600">{a.branch_name}</td>
                        <td className="px-4 py-3">{a.service_name}</td>
                        <td className="px-4 py-3 text-forest-500/70">
                          {new Date(a.preferred_date).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[a.status]}`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          </div>
              </div>
            </>
          )}
        </>
      )}

      {checkInTarget && (
        <CheckInModal appointment={checkInTarget} onClose={() => setCheckInTarget(null)} onCheckedIn={load} />
      )}
    </div>
  );
}
