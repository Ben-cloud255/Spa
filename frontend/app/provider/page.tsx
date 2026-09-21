'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRooms } from '@/lib/useRooms';
import { api, ApiError } from '@/lib/api';
import RoomCard from '@/components/RoomCard';
import ExtraServiceModal from '@/components/ExtraServiceModal';
import RoomInventoryPanel from '@/components/RoomInventoryPanel';
import type { Room, Service } from '@/lib/types';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { rooms, loading, refresh } = useRooms();
  const [services, setServices] = useState<Service[]>([]);
  const [extraServiceRoom, setExtraServiceRoom] = useState<Room | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentEnded, setRecentEnded] = useState<import('@/lib/types').Booking[]>([]);

  async function loadRecentEnded() {
    try {
      const data = await api.get<{ bookings: import('@/lib/types').Booking[] }>('/bookings?status=completed');
      const TEN_MINUTES_MS = 10 * 60 * 1000;
      const now = Date.now();
      setRecentEnded(
        data.bookings
          .filter((b) => b.provider_id === user?.id)
          .filter((b) => {
            const endedAt = b.ended_at || b.created_at;
            if (!endedAt) return false;
            return now - new Date(endedAt).getTime() <= TEN_MINUTES_MS;
          })
          .slice(0, 10)
      );
    } catch {
      setRecentEnded([]);
    }
  }

  useEffect(() => {
    api.get<{ services: Service[] }>('/services').then((d) => setServices(d.services));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadRecentEnded();
    const timer = window.setInterval(loadRecentEnded, 30000);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  const myRooms = rooms.filter(
    (r) => r.provider?.id === user?.id || r.currentBooking?.provider?.id === user?.id
  );

  async function confirmStart(bookingId: number) {
    setBusyId(bookingId);
    setError(null);
    try {
      await api.post(`/bookings/${bookingId}/confirm-start`);
      refresh();
      loadRecentEnded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm the start.');
    } finally {
      setBusyId(null);
    }
  }

  async function confirmEnd(bookingId: number) {
    setBusyId(bookingId);
    setError(null);
    try {
      await api.post(`/bookings/${bookingId}/confirm-end`);
      refresh();
      loadRecentEnded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not confirm the end.');
    } finally {
      setBusyId(null);
    }
  }

  async function reportNoShow(bookingId: number) {
    setBusyId(bookingId);
    setError(null);
    try {
      await api.post(`/bookings/${bookingId}/report-no-show`);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not notify the front desk.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {recentEnded.length > 0 && (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 mb-8">
          <h2 className="font-display text-xl mb-1">Recently ended services</h2>
          <p className="text-sm text-forest-500/70 mb-4">If the customer wants another service after you ended the first one, request it here. The front desk collects payment and the timer starts once it's paid in full.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentEnded.map((b) => (
              <div key={b.id} className="rounded-lg border border-forest-100 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{b.customer_name}</p>
                  <p className="text-xs text-forest-500/70">{b.service_name} · {b.room_name}</p>
                  <p className="text-xs text-forest-500/60 mt-1">Ended {new Date(b.ended_at || b.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <button onClick={() => { const r = rooms.find((room) => room.id === b.room_id); if (r) setExtraServiceRoom({ ...r, currentBooking: { id: b.id, customerName: b.customer_name, customerPhone: b.customer_phone, status: b.status, pendingStartedAt: b.pending_started_at, activeStartedAt: b.active_started_at, expectedEndAt: b.expected_end_at, extendedMinutes: b.extended_minutes, paymentStatus: b.payment_status, amountDue: b.amount_due, amountPaid: b.amount_paid, provider: user ? { id: user.id, name: user.name } : null, service: { id: b.service_id, name: b.service_name, durationMinutes: b.duration_minutes }, pendingAddon: null } }); }} className="shrink-0 rounded-lg border border-forest-300 text-forest-700 px-3 py-2 text-xs font-medium">Request extra service</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <h1 className="font-display text-3xl mb-1">My rooms</h1>
      <p className="text-forest-500/70 text-sm mb-8">
        Confirm when a service starts and ends, and let the front desk know about anything extra.
      </p>

      {error && <p className="mb-4 text-sm text-clay bg-clay/10 rounded-lg px-3 py-2 inline-block">{error}</p>}

      {loading ? (
        <p className="text-forest-500/70">Loading your rooms…</p>
      ) : myRooms.length === 0 ? (
        <p className="text-forest-500/70">You are not currently assigned to any room. Ask your admin to assign you one.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {myRooms.map((room, i) => {
            const booking = room.currentBooking;
            return (
              <div key={room.id} className="animate-fadeInUp" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <RoomCard room={room} enableAlertSound>
                {booking?.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => confirmStart(booking.id)}
                      disabled={busyId === booking.id}
                      className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2 text-xs font-medium hover:bg-forest-700 disabled:opacity-60"
                    >
                      {busyId === booking.id ? 'Confirming…' : 'Confirm client has entered'}
                    </button>
                    {booking.pendingNotified && (
                      <button
                        onClick={() => reportNoShow(booking.id)}
                        disabled={busyId === booking.id}
                        className="rounded-lg border border-forest-200 px-3 py-2 text-xs font-medium hover:bg-forest-50"
                        title="Let the front desk know this customer hasn't shown up — this won't cancel anything"
                      >
                        Not shown up
                      </button>
                    )}
                  </div>
                )}

                {booking?.status === 'active' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExtraServiceRoom(room)}
                      className="flex-1 rounded-lg border border-forest-300 text-forest-700 py-2 text-xs font-medium hover:bg-forest-50"
                    >
                      Add extra service
                    </button>
                    <button
                      onClick={() => confirmEnd(booking.id)}
                      disabled={busyId === booking.id}
                      className="flex-1 rounded-lg bg-forest-600 text-sand-50 py-2 text-xs font-medium hover:bg-forest-700 disabled:opacity-60"
                    >
                      {busyId === booking.id ? 'Confirming…' : 'Confirm service ended'}
                    </button>
                  </div>
                )}
                {room.branch && (
                  <RoomInventoryPanel roomId={room.id} roomName={room.name} branchId={room.branch.id} role="provider" />
                )}
              </RoomCard>
              </div>
            );
          })}
        </div>
      )}

      {extraServiceRoom && (
        <ExtraServiceModal
          room={extraServiceRoom}
          services={services}
          onClose={() => setExtraServiceRoom(null)}
          onAdded={() => { refresh(); loadRecentEnded(); }}
        />
      )}
    </div>
  );
}
