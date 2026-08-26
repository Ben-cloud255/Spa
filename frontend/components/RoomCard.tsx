'use client';

import { ReactNode } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { useCountdown } from '@/lib/useCountdown';
import { playWarningChime, playUrgentAlert } from '@/lib/alertSound';
import type { Room } from '@/lib/types';

const BORDER: Record<string, string> = {
  inactive: 'border-l-status-inactive',
  pending: 'border-l-status-pending',
  active: 'border-l-status-active',
};

function money(n: number) {
  return new Intl.NumberFormat('en-TZ').format(n);
}

export default function RoomCard({
  room,
  enableAlertSound = false,
  children,
}: {
  room: Room;
  enableAlertSound?: boolean;
  children?: ReactNode;
}) {
  const booking = room.currentBooking;
  const countdown = useCountdown(
    booking?.status === 'active' ? booking.expectedEndAt : null,
    enableAlertSound ? playWarningChime : undefined,
    enableAlertSound ? playUrgentAlert : undefined
  );

  return (
    <div
      className={`bg-white rounded-xl2 border border-forest-100 border-l-4 ${BORDER[room.status]} shadow-card p-5 flex flex-col gap-3`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-xl leading-tight">{room.name}</h3>
          <p className="text-xs text-forest-500/70 mt-0.5">
            {room.provider ? room.provider.name : 'No provider assigned'}
          </p>
          {room.branch && <p className="text-[11px] text-honey-600 font-medium mt-0.5">{room.branch.name}</p>}
        </div>
        <StatusBadge status={room.status} />
      </div>

      {booking ? (
        <div className="rounded-lg bg-sand-100/60 px-3.5 py-3 space-y-1.5">
          <p className="text-sm font-medium text-ink">{booking.customerName}</p>
          <p className="text-xs text-forest-500/80">{booking.customerPhone}</p>
          <p className="text-xs text-forest-600">
            {booking.service.name} · {booking.service.durationMinutes} min
            {booking.extendedMinutes > 0 ? ` (+${booking.extendedMinutes} added)` : ''}
          </p>

          {booking.status === 'pending' && (
            <p className="text-xs text-honey-600 font-medium">Waiting for service provider to confirm start</p>
          )}

          {booking.status === 'awaiting_payment' && (
            <p className="text-xs text-honey-600 font-medium">
              {booking.pendingAddon ? `Awaiting full payment for "${booking.pendingAddon.name}" — timer hasn't started` : 'Awaiting payment before this can start'}
            </p>
          )}

          {booking.status === 'active' && (
            <div className="pt-1">
              <p
                className={`font-display text-2xl tabular-nums ${
                  countdown.isOverdue ? 'text-clay' : countdown.isNearEnd ? 'text-honey-600' : 'text-forest-700'
                }`}
              >
                {countdown.isOverdue ? 'Time up' : countdown.label}
              </p>
              <p className="text-[11px] text-forest-500/70">
                {countdown.isOverdue ? 'Awaiting confirmation that the service has ended' : 'remaining'}
              </p>
            </div>
          )}

          <p className="text-xs text-forest-500/80 pt-0.5">
            Paid {money(booking.amountPaid)} / {money(booking.amountDue)} TZS
            {booking.paymentStatus !== 'paid' && (
              <span className="ml-1.5 text-honey-600 font-medium">
                {booking.paymentStatus === 'partial' ? 'Partially paid' : 'Unpaid'}
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="text-sm text-forest-500/60 italic py-2">Room is free</p>
      )}

      {children && <div className="pt-1">{children}</div>}
    </div>
  );
}
