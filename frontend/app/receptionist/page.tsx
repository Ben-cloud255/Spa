'use client';

import { useEffect, useState } from 'react';
import { useRooms } from '@/lib/useRooms';
import { api, ApiError } from '@/lib/api';
import RoomCard from '@/components/RoomCard';
import NewBookingModal from '@/components/NewBookingModal';
import PaymentModal from '@/components/PaymentModal';
import PaymentRequestModal from '@/components/PaymentRequestModal';
import type { Booking } from '@/lib/types';
import OnHoldList from '@/components/OnHoldList';
import RoomInventoryPanel from '@/components/RoomInventoryPanel';
import type { Room, Service, User } from '@/lib/types';

function money(n: number) {
  return n.toLocaleString('en-TZ');
}

export default function ReceptionistDashboard() {
  const { rooms, loading, refresh } = useRooms();
  const [services, setServices] = useState<Service[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [paymentRoom, setPaymentRoom] = useState<Room | null>(null);
  const [paymentRequests, setPaymentRequests] = useState<Booking[]>([]);
  const [paymentBooking, setPaymentBooking] = useState<Booking | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [holdRefreshKey, setHoldRefreshKey] = useState(0);

  async function loadProviders() {
    const data = await api.get<{ users: User[] }>('/users?role=provider');
    setProviders(data.users);
  }

  async function loadPaymentRequests() {
    try {
      const [completed, awaitingAddon] = await Promise.all([
        api.get<{ bookings: Booking[] }>('/bookings?status=completed'),
        api.get<{ bookings: Booking[] }>('/bookings?status=awaiting_payment'),
      ]);
      const outstandingCompleted = completed.bookings.filter((b) => Number(b.amount_paid) < Number(b.amount_due));
      setPaymentRequests([...awaitingAddon.bookings, ...outstandingCompleted]);
    } catch {
      // The main room dashboard remains usable even if the payment queue fails.
    }
  }

  useEffect(() => {
    api.get<{ services: Service[] }>('/services').then((d) => setServices(d.services));
    loadProviders();
    loadPaymentRequests();
    const timer = window.setInterval(() => {
      loadPaymentRequests();
      loadProviders();
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const freeCount = rooms.filter((r) => r.status === 'inactive').length;

  async function putOnHold(bookingId: number) {
    if (!window.confirm("Put this customer on hold? The room frees up while they're contacted.")) return;
    setBusyId(bookingId);
    setError(null);
    try {
      await api.post(`/bookings/${bookingId}/hold`);
      refresh();
      loadPaymentRequests();
      setHoldRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not put this booking on hold.');
    } finally {
      setBusyId(null);
    }
  }

  async function cancelExtraServiceRequest(bookingId: number) {
    if (!window.confirm('Cancel this extra-service request? The room will be freed and the amount removed from what they owe.')) return;
    setBusyId(bookingId);
    setError(null);
    try {
      await api.post(`/bookings/${bookingId}/extra-service/cancel`);
      refresh();
      loadPaymentRequests();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the extra-service request.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl">Rooms</h1>
          <p className="text-forest-500/70 text-sm mt-1">
            {freeCount} of {rooms.length} rooms free right now
          </p>
        </div>
        <button
          onClick={() => {
            loadProviders();
            setShowBookingModal(true);
          }}
          className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2.5 text-sm font-medium hover:bg-forest-700"
        >
          + New booking
        </button>
      </div>

      {paymentRequests.length > 0 && (
        <div className="bg-white rounded-xl2 border border-honey-500/30 shadow-card p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl">Payment follow-up</h2>
              <p className="text-sm text-forest-500/70 mt-1">These services have ended. Record payment only if the customer has actually paid.</p>
            </div>
            <span className="rounded-full bg-honey-500/10 text-honey-700 px-2.5 py-1 text-xs font-semibold">{paymentRequests.length} due</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paymentRequests.slice(0, 8).map((b) => {
              const awaitingAddon = b.status === 'awaiting_payment';
              return (
                <div key={b.id} className={`rounded-lg border p-4 flex items-center justify-between gap-3 ${awaitingAddon ? 'border-honey-500/40 bg-honey-500/5' : 'border-forest-100'}`}>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.customer_name}</p>
                    <p className="text-xs text-forest-500/70">{b.service_name} · {b.room_name}</p>
                    {awaitingAddon && <p className="text-xs text-honey-700 font-medium mt-0.5">Extra service requested — timer paused until paid in full</p>}
                    <p className="text-xs text-honey-700 mt-1">Outstanding: {money(Number(b.amount_due) - Number(b.amount_paid))} TZS</p>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <button onClick={() => setPaymentBooking(b)} className="rounded-lg bg-forest-600 text-sand-50 px-3 py-2 text-xs font-medium">Record payment</button>
                    {awaitingAddon && (
                      <button onClick={() => cancelExtraServiceRequest(b.id)} disabled={busyId === b.id} className="rounded-lg border border-clay/30 text-clay px-3 py-1.5 text-xs font-medium disabled:opacity-50">Cancel request</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <OnHoldList refreshTrigger={holdRefreshKey} />

      {error && <p className="mb-4 text-sm text-clay bg-clay/10 rounded-lg px-3 py-2 inline-block">{error}</p>}

      {loading ? (
        <p className="text-forest-500/70">Loading rooms…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {rooms.map((room, i) => (
            <div key={room.id} className="animate-fadeInUp" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <RoomCard room={room}>
              <div className="space-y-2">
                {room.currentBooking?.status === 'pending' && (
                  <button
                    onClick={() => putOnHold(room.currentBooking!.id)}
                    disabled={busyId === room.currentBooking.id}
                    className="w-full rounded-lg border border-honey-500 text-honey-600 py-2 text-xs font-medium hover:bg-honey-500/10 disabled:opacity-50"
                  >
                    Put on hold
                  </button>
                )}
                {room.currentBooking && room.currentBooking.amountPaid < room.currentBooking.amountDue && (
                  <button
                    onClick={() => setPaymentRoom(room)}
                    className="w-full rounded-lg border border-forest-300 text-forest-700 py-2 text-xs font-medium hover:bg-forest-50"
                  >
                    Additional payment
                  </button>
                )}
              </div>
              {room.branch && (
                <RoomInventoryPanel roomId={room.id} roomName={room.name} branchId={room.branch.id} role="receptionist" />
              )}
              </RoomCard>
            </div>
          ))}
        </div>
      )}

      {showBookingModal && (
        <NewBookingModal
          rooms={rooms}
          services={services}
          providers={providers}
          onClose={() => setShowBookingModal(false)}
          onCreated={() => {
            refresh();
            loadProviders();
          }}
        />
      )}
      {paymentRoom && (
        <PaymentModal room={paymentRoom} onClose={() => setPaymentRoom(null)} onRecorded={() => { refresh(); loadPaymentRequests(); }} />
      )}
      {paymentBooking && (
        <PaymentRequestModal booking={paymentBooking} onClose={() => setPaymentBooking(null)} onRecorded={() => { setPaymentBooking(null); loadPaymentRequests(); }} />
      )}
    </div>
  );
}
