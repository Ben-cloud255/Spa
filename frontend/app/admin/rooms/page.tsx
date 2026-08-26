'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useBranches } from '@/lib/useBranches';
import StatusBadge from '@/components/StatusBadge';
import BranchFilter from '@/components/BranchFilter';
import type { Room, User } from '@/lib/types';

export default function AdminRoomsPage() {
  const { branches } = useBranches();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterBranch) params.set('branchId', filterBranch);
    if (showArchived) params.set('includeArchived', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    const [roomsRes, usersRes] = await Promise.all([
      api.get<{ rooms: Room[] }>(`/rooms${query}`),
      api.get<{ users: User[] }>('/users?role=provider'),
    ]);
    setRooms(roomsRes.rooms);
    setProviders(usersRes.users);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranch, showArchived]);

  useEffect(() => {
    if (!newBranch && branches.length > 0) setNewBranch(String(branches[0].id));
  }, [branches, newBranch]);

  const providersForNewBranch = providers.filter((p) => !newBranch || String(p.branch_id) === newBranch);

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/rooms', {
        name: newName,
        provider_id: newProvider ? Number(newProvider) : null,
        branch_id: newBranch ? Number(newBranch) : null,
      });
      setNewName('');
      setNewProvider('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the room.');
    }
  }

  async function reassignProvider(roomId: number, providerId: string) {
    setSavingId(roomId);
    setError(null);
    try {
      await api.patch(`/rooms/${roomId}`, { provider_id: providerId ? Number(providerId) : null });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the room.');
    } finally {
      setSavingId(null);
    }
  }

  async function forceEndSession(room: Room) {
    if (!room.currentBooking) return;
    if (!window.confirm(`Close ${room.currentBooking.customerName}'s session in ${room.name} now? This should only be used when the provider hasn't confirmed the service has ended.`)) {
      return;
    }
    setSavingId(room.id);
    setError(null);
    try {
      await api.post(`/bookings/${room.currentBooking.id}/force-end`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not close this session.');
    } finally {
      setSavingId(null);
    }
  }

  async function removeRoom(room: Room) {
    if (!window.confirm(`Remove ${room.name}? It will disappear from booking and staff views, but its booking history is kept for reports. You can restore it later.`)) {
      return;
    }
    setSavingId(room.id);
    setError(null);
    try {
      await api.del(`/rooms/${room.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove the room.');
    } finally {
      setSavingId(null);
    }
  }

  async function restoreRoom(room: Room) {
    setSavingId(room.id);
    setError(null);
    try {
      await api.patch(`/rooms/${room.id}`, { is_archived: false });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore the room.');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <h1 className="font-display text-3xl">Rooms</h1>
        <BranchFilter value={filterBranch} onChange={setFilterBranch} />
      </div>
      <p className="text-forest-500/70 text-sm mb-8">Manage treatment rooms and which provider is assigned to each, across every branch.</p>

      <form onSubmit={createRoom} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Branch</label>
          <select
            required
            value={newBranch}
            onChange={(e) => {
              setNewBranch(e.target.value);
              setNewProvider('');
            }}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-44"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Room name</label>
          <input
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Willow Room"
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-52"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-forest-600 mb-1.5">Assign provider</label>
          <select
            value={newProvider}
            onChange={(e) => setNewProvider(e.target.value)}
            className="rounded-lg border border-forest-200 px-3 py-2 text-sm w-52"
          >
            <option value="">Unassigned for now</option>
            {providersForNewBranch.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700">
          Add room
        </button>
      </form>

      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 text-sm text-forest-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show removed rooms
        </label>
        {error && <p className="text-sm text-clay">{error}</p>}
      </div>

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Room</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Assigned provider</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {rooms.map((room) => (
                <tr key={room.id} className={room.isArchived ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 font-medium">
                    {room.name}
                    {room.isArchived && <span className="ml-2 text-xs text-clay font-normal">Removed</span>}
                  </td>
                  <td className="px-4 py-3 text-forest-600">{room.branch?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={room.status} />
                    {room.currentBooking && (
                      <p className="text-xs text-forest-500/60 mt-1">{room.currentBooking.customerName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={room.provider?.id || ''}
                      disabled={savingId === room.id || room.status !== 'inactive' || room.isArchived}
                      onChange={(e) => reassignProvider(room.id, e.target.value)}
                      className="rounded-lg border border-forest-200 px-2.5 py-1.5 text-sm disabled:opacity-50"
                      title={room.status !== 'inactive' ? 'Free the room before reassigning' : undefined}
                    >
                      <option value="">Unassigned</option>
                      {providers
                        .filter((p) => String(p.branch_id) === String(room.branch?.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {room.isArchived ? (
                      <button
                        onClick={() => restoreRoom(room)}
                        disabled={savingId === room.id}
                        className="text-xs font-medium text-forest-600 hover:text-forest-800 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    ) : room.status !== 'inactive' ? (
                      <button
                        onClick={() => forceEndSession(room)}
                        disabled={savingId === room.id}
                        className="text-xs font-medium text-honey-600 hover:text-honey-700 disabled:opacity-50"
                        title="Close a session the provider hasn't confirmed the end of"
                      >
                        Force end session
                      </button>
                    ) : (
                      <button
                        onClick={() => removeRoom(room)}
                        disabled={savingId === room.id}
                        className="text-xs font-medium text-clay hover:text-clay/80 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-forest-500/60">
                    No rooms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
