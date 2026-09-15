'use client';

import { useState } from 'react';
import { useNotifications } from '@/lib/useNotifications';

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_LABEL: Record<string, string> = {
  pending_timeout: 'Room not confirmed in time',
  service_overtime: 'Session running over time',
  extra_service_request: 'Extra service added',
  payment_recorded: 'Payment recorded',
  service_ended_payment_due: 'Service ended — payment follow-up',
  booking_cancelled: 'Booking cancelled',
  admin_force_ended: 'Session closed by admin',
  service_ending_soon: 'Session ending soon',
  booking_on_hold: 'Booking put on hold',
  provider_reported_no_show: 'Customer not shown up',
  booking_released: 'On-hold booking released',
  appointment_requested: 'New online booking request',
};

const RECENT_DAYS = 20;
const ALL_TYPES = 'all';

export default function ReceptionistNotificationsPage() {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const { notifications, unreadCount, markAllRead, markRead, loading } = useNotifications();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_DAYS);
  const displayedNotifications = notifications
    .filter((n) => showAllHistory || new Date(n.created_at) >= cutoff)
    .filter((n) => typeFilter === ALL_TYPES || n.type === typeFilter);

  const availableTypes = Array.from(new Set(notifications.map((n) => n.type)));

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-3xl">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead()}
            className="text-sm text-forest-600 hover:text-forest-800 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>
      <p className="text-forest-500/70 text-sm mb-3">
        Alerts raised at your branch — including customers who haven&apos;t shown up, overdue confirmations, and payments.
      </p>

      <div className="flex items-center flex-wrap gap-4 mb-6">
        <label className="flex items-center gap-2 text-sm text-forest-600">
          <input type="checkbox" checked={showAllHistory} onChange={(e) => setShowAllHistory(e.target.checked)} />
          Show notifications older than {RECENT_DAYS} days
        </label>

        {availableTypes.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-forest-200 rounded-lg px-2.5 py-1.5 bg-white"
          >
            <option value={ALL_TYPES}>All types</option>
            {availableTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t] || t}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card divide-y divide-forest-50">
          {displayedNotifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={`w-full text-left px-5 py-4 hover:bg-forest-50 transition-colors ${n.is_read ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-forest-600 uppercase tracking-wide">
                  {TYPE_LABEL[n.type] || n.type}
                </span>
                <span className="text-xs text-forest-500/60 whitespace-nowrap">{timeAgo(n.created_at)}</span>
              </div>
              <p className="text-sm text-ink">{n.message}</p>
            </button>
          ))}
          {displayedNotifications.length === 0 && (
            <p className="text-sm text-forest-500/60 px-5 py-10 text-center">Nothing to report yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
