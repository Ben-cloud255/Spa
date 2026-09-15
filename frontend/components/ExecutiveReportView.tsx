'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';
import { useAuth } from '@/context/AuthContext';
import type { ExecutiveReport, ReportDetailRow, User, Service, Branch } from '@/lib/types';

type Preset = 'today' | 'week' | 'month' | 'year' | 'custom';
type Scope = 'all' | 'branch' | 'provider' | 'service';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom range' },
];

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
    const day = from.getDay() === 0 ? 7 : from.getDay();
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
  return new Intl.NumberFormat('en-TZ').format(Math.round(n));
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

// Purely rank-based, from real revenue — never invents a rating. Top of the
// list in its section gets the strongest label, bottom gets flagged for a
// look, everyone else lands in between.
function statusLabel(index: number, total: number): { text: string; tone: 'top' | 'good' | 'mid' | 'watch' } {
  if (total <= 1) return { text: 'ONLY ENTRY', tone: 'mid' };
  if (index === 0) return { text: 'TOP PERFORMER', tone: 'top' };
  if (index === total - 1) return { text: 'REVIEW', tone: 'watch' };
  if (index < total / 2) return { text: 'STRONG', tone: 'good' };
  return { text: 'AVERAGE', tone: 'mid' };
}

// Dark, solid pills — matching a formal report's look — not soft app badges.
const TONE_STYLE: Record<string, { bg: string; color: string }> = {
  top: { bg: '#122f27', color: '#fdfcf9' },
  good: { bg: '#2f6b58', color: '#fdfcf9' },
  mid: { bg: '#c2933d', color: '#fdfcf9' },
  watch: { bg: '#b1614f', color: '#fdfcf9' },
};

function Badge({ text, tone }: { text: string; tone: 'top' | 'good' | 'mid' | 'watch' }) {
  const s = TONE_STYLE[tone];
  return (
    <span
      style={{ background: s.bg, color: s.color, fontSize: 10, letterSpacing: '0.04em', fontWeight: 700 }}
      className="px-2 py-1 rounded-sm inline-block whitespace-nowrap"
    >
      {text}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-display text-lg tracking-wide uppercase mb-3 pb-2"
      style={{ borderBottom: '2px solid #152625', color: '#152625' }}
    >
      {children}
    </h2>
  );
}

export default function ExecutiveReportView({ allowBranchFilter = false }: { allowBranchFilter?: boolean }) {
  const { user } = useAuth();
  const [preset, setPreset] = useState<Preset>('month');
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date()));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));
  const [scope, setScope] = useState<Scope>('all');
  const [branchId, setBranchId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [serviceId, setServiceId] = useState('');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [detail, setDetail] = useState<ReportDetailRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (allowBranchFilter) api.get<{ branches: Branch[] }>('/branches').then((d) => setBranches(d.branches));
    api.get<{ users: User[] }>('/users?role=provider').then((d) => setProviders(d.users));
    api.get<{ services: Service[] }>('/services').then((d) => setServices(d.services));
  }, [allowBranchFilter]);

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
      if (allowBranchFilter && scope === 'branch' && branchId) params.set('branchId', branchId);
      if (scope === 'provider' && providerId) params.set('providerId', providerId);
      if (scope === 'service' && serviceId) params.set('serviceId', serviceId);

      const [executive, detailData] = await Promise.all([
        api.get<ExecutiveReport>(`/reports/executive?${params.toString()}`),
        api.get<{ bookings: ReportDetailRow[] }>(`/reports/detail?${params.toString()}`),
      ]);
      setReport(executive);
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

  const scopeLabel = (() => {
    if (scope === 'branch') return branches.find((b) => String(b.id) === branchId)?.name || 'Selected branch';
    if (scope === 'provider') return providers.find((p) => String(p.id) === providerId)?.name || 'Selected provider';
    if (scope === 'service') return services.find((s) => String(s.id) === serviceId)?.name || 'Selected service';
    return 'All branches';
  })();

  const topProvider = report?.byProvider[0];
  const reviewProvider = report && report.byProvider.length > 1 ? report.byProvider[report.byProvider.length - 1] : null;
  const topService = report?.byService[0];
  const reviewService = report && report.byService.length > 1 ? report.byService[report.byService.length - 1] : null;

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
        Pick a period and, if you like, narrow it to one branch, one provider, or one service — then generate.
      </p>

      <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 mb-8 no-print space-y-4">
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
          <div className="flex flex-wrap gap-3">
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
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Report for</label>
          <div className="flex flex-wrap gap-2 mb-2.5">
            {(['all', ...(allowBranchFilter ? ['branch'] as const : []), 'provider', 'service'] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                  scope === s
                    ? 'bg-forest-600 text-sand-50 border-forest-600'
                    : 'bg-white text-forest-700 border-forest-200 hover:bg-forest-50'
                }`}
              >
                {s === 'all' ? 'Everything' : s === 'branch' ? 'A branch' : s === 'provider' ? 'A provider' : 'A service'}
              </button>
            ))}
          </div>

          {scope === 'branch' && (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-lg border border-forest-200 px-3 py-2 text-sm"
            >
              <option value="">Choose a branch…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          {scope === 'provider' && (
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="rounded-lg border border-forest-200 px-3 py-2 text-sm"
            >
              <option value="">Choose a provider…</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {scope === 'service' && (
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="rounded-lg border border-forest-200 px-3 py-2 text-sm"
            >
              <option value="">Choose a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>

        <button
          onClick={generate}
          disabled={loading || (scope === 'branch' && !branchId) || (scope === 'provider' && !providerId) || (scope === 'service' && !serviceId)}
          className="rounded-lg bg-forest-600 text-sand-50 px-5 py-2 text-sm font-medium hover:bg-forest-700 disabled:opacity-60"
        >
          {loading ? 'Generating…' : 'Generate report'}
        </button>
        {error && <p className="text-sm text-clay mt-1">{error}</p>}
      </div>

      {report && (
        // This whole block IS the document — same markup renders on screen
        // and in the print/PDF output, so there is no separate "preview"
        // vs "print" version to keep in sync.
        <div id="report-content" style={{ background: '#ffffff', color: '#152625' }} className="flex flex-col rounded-xl2 overflow-hidden border border-forest-100 shadow-card">
          {/* Header — plain, no color fill, just like a letterhead */}
          <div className="px-8 py-8" style={{ borderBottom: '2px solid #152625' }}>
            <p className="text-xs uppercase tracking-[0.25em] mb-3" style={{ color: '#6b7a75' }}>
              Serene Spa
            </p>
            <h1 className="font-display text-3xl md:text-4xl mb-1">Executive Performance Report</h1>
            <p className="text-xs uppercase tracking-[0.2em] mb-6" style={{ color: '#6b7a75' }}>
              Business Intelligence · Operations · Revenue · Performance
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#6b7a75' }}>Report period</p>
                <p>
                  {new Date(report.range.from).toLocaleDateString('en-GB', { dateStyle: 'long' })} –{' '}
                  {new Date(report.range.to).toLocaleDateString('en-GB', { dateStyle: 'long' })}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#6b7a75' }}>Scope</p>
                <p>{scopeLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#6b7a75' }}>Generated by</p>
                <p>
                  {user?.name} ({user?.role}) ·{' '}
                  {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
            <p className="text-xs italic mt-6" style={{ color: '#6b7a75' }}>Confidential Management Report</p>
          </div>

          {/* KPI row — plain numbers with thin dividers, no color fill */}
          <div className="px-8 py-6" style={{ borderBottom: '1px solid #d8d8d0' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:divide-x md:divide-forest-100">
              <div className="md:pr-6">
                <p className="font-display text-2xl md:text-3xl">{money(report.totals.revenueCollected)} <span className="text-sm font-normal" style={{ color: '#6b7a75' }}>TZS</span></p>
                <p className="text-xs uppercase tracking-wide mt-1" style={{ color: '#6b7a75' }}>Total revenue</p>
              </div>
              <div className="md:pl-6 md:pr-6">
                <p className="font-display text-2xl md:text-3xl">{report.totals.bookingsCount}</p>
                <p className="text-xs uppercase tracking-wide mt-1" style={{ color: '#6b7a75' }}>Bookings</p>
              </div>
              <div className="md:pl-6 md:pr-6">
                <p className="font-display text-2xl md:text-3xl">{report.totals.completedCount}</p>
                <p className="text-xs uppercase tracking-wide mt-1" style={{ color: '#6b7a75' }}>Completed</p>
              </div>
              <div className="md:pl-6">
                <p className="font-display text-2xl md:text-3xl">{pct(report.totals.cancellationRate)}</p>
                <p className="text-xs uppercase tracking-wide mt-1" style={{ color: '#6b7a75' }}>Cancellation rate</p>
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            {scope !== 'provider' && report.byProvider.length > 0 && (
              <div className="mb-9">
                <SectionHeading>Service Provider Performance</SectionHeading>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#f2f2ef' }}>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Provider</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Completed</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Revenue</th>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byProvider.map((row, i) => {
                      const s = statusLabel(i, report.byProvider.length);
                      return (
                        <tr key={row.providerId} style={{ borderBottom: '1px solid #eef4f1' }}>
                          <td className="px-3 py-2.5 font-medium">{row.providerName}</td>
                          <td className="px-3 py-2.5 text-right">{row.sessionsCompleted}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">{money(row.revenueCollected)} TZS</td>
                          <td className="px-3 py-2.5"><Badge text={s.text} tone={s.tone} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {topProvider && (
                  <p className="text-xs mt-3" style={{ color: '#4a4a44' }}>
                    <strong>Top performer:</strong> {topProvider.providerName} — highest revenue this period.
                    {reviewProvider && reviewProvider !== topProvider && (
                      <> &nbsp; <strong>Review:</strong> {reviewProvider.providerName} — furthest behind on revenue, worth a closer look.</>
                    )}
                  </p>
                )}
              </div>
            )}

            {scope !== 'service' && report.byService.length > 0 && (
              <div className="mb-9">
                <SectionHeading>Service Performance</SectionHeading>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#f2f2ef' }}>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Service</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Bookings</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Revenue</th>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byService.map((row, i) => {
                      const s = statusLabel(i, report.byService.length);
                      return (
                        <tr key={row.serviceId} style={{ borderBottom: '1px solid #eef4f1' }}>
                          <td className="px-3 py-2.5 font-medium">{row.serviceName}</td>
                          <td className="px-3 py-2.5 text-right">{row.bookingsCount}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">{money(row.revenueCollected)} TZS</td>
                          <td className="px-3 py-2.5"><Badge text={s.text} tone={s.tone} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {topService && (
                  <p className="text-xs mt-3" style={{ color: '#4a4a44' }}>
                    <strong>Best service:</strong> {topService.serviceName}.
                    {reviewService && reviewService !== topService && (
                      <> &nbsp; <strong>Lowest performing:</strong> {reviewService.serviceName} — worth reviewing demand, pricing, or marketing.</>
                    )}
                  </p>
                )}
              </div>
            )}

            {allowBranchFilter && scope === 'all' && report.byBranch.length > 0 && (
              <div className="mb-9">
                <SectionHeading>Branch Performance</SectionHeading>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#f2f2ef' }}>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Branch</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Revenue</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Completed</th>
                      <th className="text-right px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Cancellation</th>
                      <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byBranch.map((row, i) => {
                      const s = statusLabel(i, report.byBranch.length);
                      return (
                        <tr key={row.branchName} style={{ borderBottom: '1px solid #eef4f1' }}>
                          <td className="px-3 py-2.5 font-medium">{row.branchName}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">{money(row.revenueCollected)} TZS</td>
                          <td className="px-3 py-2.5 text-right">{row.completedCount}</td>
                          <td className="px-3 py-2.5 text-right">{pct(row.cancellationRate)}</td>
                          <td className="px-3 py-2.5"><Badge text={s.text} tone={s.tone} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mb-9">
              <SectionHeading>Operational Insights</SectionHeading>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#f2f2ef' }}>
                    <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Metric</th>
                    <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Result</th>
                    <th className="text-left px-3 py-2.5 font-semibold uppercase text-xs tracking-wide" style={{ color: '#122f27' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #eef4f1' }}>
                    <td className="px-3 py-2.5 font-medium">Peak hour</td>
                    <td className="px-3 py-2.5">{report.peakHour || '—'}</td>
                    <td className="px-3 py-2.5 text-forest-500/70">Most bookings started around this hour</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eef4f1' }}>
                    <td className="px-3 py-2.5 font-medium">Quiet hour</td>
                    <td className="px-3 py-2.5">{report.quietHour || '—'}</td>
                    <td className="px-3 py-2.5 text-forest-500/70">Consider a promotion around this time</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eef4f1' }}>
                    <td className="px-3 py-2.5 font-medium">No-shows</td>
                    <td className="px-3 py-2.5">{pct(report.totals.noShowRate)}</td>
                    <td className="px-3 py-2.5 text-forest-500/70">{report.totals.noShowCount} reported this period</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eef4f1' }}>
                    <td className="px-3 py-2.5 font-medium">Cancelled</td>
                    <td className="px-3 py-2.5">{report.totals.cancelledCount}</td>
                    <td className="px-3 py-2.5 text-forest-500/70">{pct(report.totals.cancellationRate)} of all bookings</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #eef4f1' }}>
                    <td className="px-3 py-2.5 font-medium">Outstanding balance</td>
                    <td className="px-3 py-2.5">{money(report.totals.revenueOutstanding)} TZS</td>
                    <td className="px-3 py-2.5 text-forest-500/70">Expected but not yet collected</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-medium">In progress</td>
                    <td className="px-3 py-2.5">{report.totals.activeOrPendingCount}</td>
                    <td className="px-3 py-2.5 text-forest-500/70">Still pending, active, or awaiting payment</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer — mt-auto pins this to the bottom of the page even when
              the report is short, instead of floating right after content. */}
          <div
            className="mt-auto px-8 py-4 text-center text-xs uppercase tracking-[0.2em]"
            style={{ color: '#6b7a75', borderTop: '1px solid #d8d8d0' }}
          >
            Confidential · Management Use · Serene Spa Performance Report
          </div>
        </div>
      )}

      {!report && !loading && (
        <p className="text-forest-500/60 text-sm no-print">Choose a period and scope above, then generate the report.</p>
      )}
    </div>
  );
}
