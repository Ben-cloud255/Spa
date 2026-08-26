'use client';

import { useState, useRef, useEffect } from 'react';
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
  pending_timeout: 'Room not confirmed',
  service_overtime: 'Session overtime',
  extra_service_request: 'Extra service',
  payment_recorded: 'Payment recorded',
  service_ended_payment_due: 'Service ended — payment follow-up',
  booking_cancelled: 'Booking cancelled',
  admin_force_ended: 'Session closed by admin',
  service_ending_soon: 'Session ending soon',
  booking_on_hold: 'Booking put on hold',
  booking_released: 'On-hold booking released',
  appointment_requested: 'New online booking request',
};

export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded-full h-10 w-10 flex items-center justify-center bg-white border border-forest-100 hover:bg-forest-50 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-clay text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white rounded-xl2 shadow-card border border-forest-100 overflow-hidden z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-forest-100">
            <h3 className="font-display text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead()} className="text-xs text-forest-500 hover:text-forest-700">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-forest-50">
            {notifications.length === 0 && (
              <p className="text-sm text-forest-500/70 px-4 py-6 text-center">Nothing to see here yet.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-left px-4 py-3 text-sm hover:bg-forest-50 transition-colors ${
                  n.is_read ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-xs font-semibold text-forest-600 uppercase tracking-wide">
                    {TYPE_LABEL[n.type] || n.type}
                  </span>
                  <span className="text-[11px] text-forest-500/60 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                </div>
                <p className="text-ink leading-snug">{n.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
