'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { useAuth } from '@/context/AuthContext';
import BranchFilter from '@/components/BranchFilter';
import RevenueByDayChart from '@/components/RevenueByDayChart';
import type { ReportSummary, ReportDetailRow } from '@/lib/types';

type Preset = 'today' | 'week' | 'month' | 'year' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom range' },
];

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-honey-500/10 text-honey-600',
  active: 'bg-forest-500/10 text-forest-700',
  completed: 'bg-forest-100 text-forest-700',
  cancelled: 'bg-clay/10 text-clay',
  on_hold: 'bg-honey-500/10 text-honey-700',
};

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();

  if (preset === 'today') {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to };
  }
  if (preset === 'week') {
    const from = new Date(now);
    const day = from.getDay() === 0 ? 7 : from.getDay(); // Monday-start week
    from.setDate(from.getDate() - (day - 1));
    from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to };
  }
  if (preset === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: from.toISOString(), to };
  }
  if (preset === 'year') {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: from.toISOString(), to };
  }
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to };
}

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5">
      <p className="text-xs uppercase tracking-wide text-forest-500/70">{label}</p>
      <p className="font-display text-3xl mt-1.5">{value}</p>
      {hint && <p className="text-xs text-forest-500/60 mt-1">{hint}</p>}
    </div>
  );
}

export default function ReportView({ allowBranchFilter = false }: { allowBranchFilter?: boolean }) {
  const { user } = useAuth();
  const [preset, setPreset] = useState<Preset>('today');
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));
  const [branchId, setBranchId] = useState('');
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [detail, setDetail] = useState<ReportDetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      let from: string;
      let to: string;
      if (preset === 'custom') {
        from = new Date(`${customFrom}T00:00:00`).toISOString();
        to = new Date(`${customTo}T23:59:59`).toISOString();
      } else {
        const range = rangeForPreset(preset);
        from = range.from;
        to = range.to;
      }
      const params = new URLSearchParams({ from, to });
      if (allowBranchFilter && branchId) params.set('branchId', branchId);

      const [summary, detailData] = await Promise.all([
        api.get<ReportSummary>(`/reports/summary?${params.toString()}`),
        api.get<{ bookings: ReportDetailRow[] }>(`/reports/detail?${params.toString()}`),
      ]);
      setReport(summary);
      setDetail(detailData.bookings);
    } catch (err) {
      setError('Could not generate the report. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadCsv() {
    downloadCsv(
      `serene-spa-report-${toInputDate(new Date())}.csv`,
      [
        { label: 'Date', value: (r: ReportDetailRow) => new Date(r.created_at).toLocaleString('en-GB') },
        { label: 'Customer', value: (r: ReportDetailRow) => r.customer_name },
        { label: 'Phone', value: (r: ReportDetailRow) => r.customer_phone },
        { label: 'Branch', value: (r: ReportDetailRow) => r.branch_name || '' },
        { label: 'Service', value: (r: ReportDetailRow) => r.service_name },
        { label: 'Extra services', value: (r: ReportDetailRow) => r.extra_services },
        { label: 'Room', value: (r: ReportDetailRow) => r.room_name },
        { label: 'Provider', value: (r: ReportDetailRow) => r.provider_name },
        { label: 'Receptionist', value: (r: ReportDetailRow) => r.receptionist_name },
        { label: 'Status', value: (r: ReportDetailRow) => r.status },
        { label: 'Amount due (TZS)', value: (r: ReportDetailRow) => r.amount_due },
        { label: 'Amount paid (TZS)', value: (r: ReportDetailRow) => r.amount_paid },
        { label: 'Payment status', value: (r: ReportDetailRow) => r.payment_status },
      ],
      detail
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1 no-print">
        <h1 className="font-display text-3xl">Reports</h1>
        {report && (
          <div className="flex gap-2">
            <button
              onClick={handleDownloadCsv}
              className="rounded-lg border border-forest-300 text-forest-700 px-4 py-2 text-sm font-medium hover:bg-forest-50"
            >
              Download CSV
            </button>
            <button
              onClick={() => window.print()}
              className="rounded-lg border border-forest-300 text-forest-700 px-4 py-2 text-sm font-medium hover:bg-forest-50"
            >
              Print / save as PDF
            </button>
          </div>
        )}
      </div>
      <p className="text-forest-500/70 text-sm mb-6 no-print">
        Generate a financial and activity report for any period — daily, weekly, monthly, yearly, or a custom
        range{allowBranchFilter ? ' — across one branch or all of them' : ''}.
      </p>

      <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 mb-8 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-forest-600 mb-1.5">Period</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    preset === p.key
                      ? 'bg-forest-600 text-sand-50 border-forest-600'
                      : 'bg-white text-forest-700 border-forest-200 hover:bg-forest-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {preset === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-medium text-forest-600 mb-1.5">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-forest-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-forest-600 mb-1.5">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-forest-200 px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

          {allowBranchFilter && (
            <div>
              <label className="block text-xs font-medium text-forest-600 mb-1.5">Branch</label>
              <BranchFilter value={branchId} onChange={setBranchId} />
            </div>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className="rounded-lg bg-forest-600 text-sand-50 px-5 py-2 text-sm font-medium hover:bg-forest-700 disabled:opacity-60"
          >
            {loading ? 'Generating…' : 'Generate report'}
          </button>
        </div>
        {error && <p className="text-sm text-clay mt-3">{error}</p>}
      </div>

      {report && (
        <div id="report-content">
          <div className="print-header mb-8 pb-4 border-b-2" style={{ borderColor: '#1a1a1a' }}>
            <p className="font-display italic text-3xl mb-1">Serene Spa</p>
            <p className="text-lg mb-4">Financial &amp; Activity Report</p>
            <table className="text-sm">
              <tbody>
                <tr>
                  <td className="pr-6 py-0.5 font-semibold">Period</td>
                  <td className="py-0.5">
                    {new Date(report.range.from).toLocaleDateString('en-GB', { dateStyle: 'long' })} –{' '}
                    {new Date(report.range.to).toLocaleDateString('en-GB', { dateStyle: 'long' })}
                  </td>
                </tr>
                <tr>
                  <td className="pr-6 py-0.5 font-semibold">Branch</td>
                  <td className="py-0.5">{allowBranchFilter && !branchId ? 'All branches' : report.byBranch[0]?.branchName || '—'}</td>
                </tr>
                <tr>
                  <td className="pr-6 py-0.5 font-semibold">Generated by</td>
                  <td className="py-0.5">
                    {user?.name} ({user?.role}) on{' '}
                    {new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-forest-500/60 mb-4 no-print">
            {new Date(report.range.from).toLocaleDateString('en-GB', { dateStyle: 'medium' })} —{' '}
            {new Date(report.range.to).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
            {allowBranchFilter && !branchId ? ' · All branches' : ''}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Revenue collected" value={`${money(report.totals.revenueCollected)}`} hint="TZS" />
            <StatCard label="Outstanding balance" value={`${money(report.totals.revenueOutstanding)}`} hint="TZS not yet paid" />
            <StatCard label="Bookings" value={String(report.totals.bookingsCount)} hint={`${report.totals.completedCount} completed`} />
            <StatCard label="Cancelled" value={String(report.totals.cancelledCount)} />
          </div>

          {report.byDay.length > 0 && (
            <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 mb-8">
              <h2 className="font-display text-xl mb-4">Revenue collected by day</h2>
              <RevenueByDayChart data={report.byDay} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
              <h2 className="font-display text-lg px-5 py-4 border-b border-forest-100">By branch</h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-forest-50">
                  {report.byBranch.map((row) => (
                    <tr key={row.branchName}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.branchName}</p>
                        <p className="text-xs text-forest-500/60">{row.bookingsCount} bookings</p>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">{money(row.revenueCollected)} TZS</td>
                    </tr>
                  ))}
                  {report.byBranch.length === 0 && (
                    <tr>
                      <td className="px-5 py-6 text-center text-forest-500/60">No activity in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
              <h2 className="font-display text-lg px-5 py-4 border-b border-forest-100">By service</h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-forest-50">
                  {report.byService.map((row) => (
                    <tr key={row.serviceId}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.serviceName}</p>
                        <p className="text-xs text-forest-500/60">{row.bookingsCount} bookings</p>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">{money(row.revenueExpected)} TZS</td>
                    </tr>
                  ))}
                  {report.byService.length === 0 && (
                    <tr>
                      <td className="px-5 py-6 text-center text-forest-500/60">No activity in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
              <h2 className="font-display text-lg px-5 py-4 border-b border-forest-100">By provider</h2>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-forest-50">
                  {report.byProvider.map((row) => (
                    <tr key={row.providerId}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{row.providerName}</p>
                        <p className="text-xs text-forest-500/60">{row.bookingsCount} bookings</p>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">{row.sessionsCompleted} completed</td>
                    </tr>
                  ))}
                  {report.byProvider.length === 0 && (
                    <tr>
                      <td className="px-5 py-6 text-center text-forest-500/60">No activity in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
            <h2 className="font-display text-lg px-5 py-4 border-b border-forest-100">
              Bookings in this period ({detail.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Customer</th>
                    {allowBranchFilter && <th className="text-left px-4 py-3">Branch</th>}
                    <th className="text-left px-4 py-3">Service</th>
                    <th className="text-left px-4 py-3">Extra services</th>
                    <th className="text-left px-4 py-3">Provider</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Payment</th>
                    <th className="text-left px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-50">
                  {detail.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{row.customer_name}</p>
                        <p className="text-xs text-forest-500/70">{row.customer_phone}</p>
                      </td>
                      {allowBranchFilter && <td className="px-4 py-3 whitespace-nowrap">{row.branch_name}</td>}
                      <td className="px-4 py-3 whitespace-nowrap">{row.service_name}</td>
                      <td className="px-4 py-3 text-forest-500/70">{row.extra_services || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.provider_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLE[row.status]}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {money(row.amount_paid)} / {money(row.amount_due)}
                      </td>
                      <td className="px-4 py-3 text-forest-500/70 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
                      </td>
                    </tr>
                  ))}
                  {detail.length === 0 && (
                    <tr>
                      <td colSpan={allowBranchFilter ? 8 : 7} className="px-4 py-8 text-center text-forest-500/60">
                        No bookings in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <p className="text-forest-500/60 text-sm no-print">Choose a period above and generate a report to see it here.</p>
      )}
    </div>
  );
}
