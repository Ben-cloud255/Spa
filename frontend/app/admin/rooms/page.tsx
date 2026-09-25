'use client';

import { useEffect, useState, useRef, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useBranches } from '@/lib/useBranches';
import RoomCard from '@/components/RoomCard';
import StatusBadge from '@/components/StatusBadge';
import BranchFilter from '@/components/BranchFilter';
import type { Room, User } from '@/lib/types';

export default function AdminRoomsPage() {
  const [view, setView] = useState<'board' | 'manage'>('board');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState('');
  const requestId = useRef(0);
  const { branches } = useBranches();
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  useEffect(() => {
    if (!focusId) return;
    setShowArchived(true);
    setView('manage');
    setSearch('');
    setFilterBranch('');
    setFilterProvider('');
    setFilterStatus('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  async function load() {
    const request = ++requestId.current;
    setLoading(true);
    setLoadError('');
    const params = new URLSearchParams();
    if (filterBranch) params.set('branchId', filterBranch);
    if (showArchived) params.set('includeArchived', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    try {
    const [roomsRes, usersRes] = await Promise.all([
      api.get<{ rooms: Room[] }>(`/rooms${query}`),
      api.get<{ users: User[] }>('/users?role=provider'),
    ]);
    if (request !== requestId.current) return;
    setRooms(roomsRes.rooms);
    setProviders(usersRes.users);
    } catch {
      if (request === requestId.current) setLoadError('Could not load rooms. Please refresh to try again.');
    } finally { if (request === requestId.current) setLoading(false); }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBranch, showArchived]);

  useEffect(() => {
    if (!newBranch && branches.length > 0) setNewBranch(String(branches[0].id));
  }, [branches, newBranch]);

  const providersForNewBranch = providers.filter((p) => !newBranch || String(p.branch_id) === newBranch);

  const displayedRooms = rooms
    .filter((r) => `${r.name} ${r.branch?.name || ''} ${r.currentBooking?.customerName || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((r) => !filterProvider || String(r.provider?.id || '') === filterProvider)
    .filter((r) => !filterStatus || r.status === filterStatus)
    .sort((a, b) => (sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));

  // Selection is cleared whenever the visible list changes shape, so a stale
  // checkbox never points at a room that's no longer on screen.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterBranch, filterProvider, filterStatus, showArchived, search, view]);

  useEffect(() => {
    if (!focusId || loading) return;
    const id = Number(focusId);
    setHighlightId(id);
    const el = document.getElementById(`room-row-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(timer);
  }, [focusId, loading, rooms]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = displayedRooms.filter((r) => !r.isArchived);
    setSelectedIds((prev) => (prev.size === selectable.length ? new Set() : new Set(selectable.map((r) => r.id))));
  }

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      await api.post('/rooms', {
        name: newName.trim(),
        provider_id: newProvider ? Number(newProvider) : null,
        branch_id: newBranch ? Number(newBranch) : null,
      });
      setShowCreate(false);
      setNewName('');
      setNewProvider('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the room.');
    } finally { setCreating(false); }
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

  async function bulkUnassign() {
    const targets = displayedRooms.filter((r) => selectedIds.has(r.id) && !r.isArchived && r.provider);
    if (targets.length === 0) return;
    if (!window.confirm(`Unassign the provider from ${targets.length} room${targets.length === 1 ? '' : 's'}? Rooms currently mid-session keep serving their current booking either way — this only clears the room's default provider.`)) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    const results = await Promise.allSettled(
      targets.map((r) => api.patch(`/rooms/${r.id}`, { provider_id: null }))
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) setError(`Unassigned ${targets.length - failed} of ${targets.length} rooms — ${failed} failed.`);
    setSelectedIds(new Set());
    setBulkBusy(false);
    load();
  }

  async function bulkRemove() {
    const targets = displayedRooms.filter((r) => selectedIds.has(r.id) && !r.isArchived);
    if (targets.length === 0) return;
    const busyCount = targets.filter((r) => r.status !== 'inactive').length;
    if (
      !window.confirm(
        `Remove ${targets.length} room${targets.length === 1 ? '' : 's'}? They'll disappear from booking and staff views, but booking history is kept and you can restore them later.` +
          (busyCount > 0 ? ` Note: ${busyCount} of them currently have a session and will be skipped until freed.` : '')
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    const eligible = targets.filter((r) => r.status === 'inactive');
    const results = await Promise.allSettled(eligible.map((r) => api.del(`/rooms/${r.id}`)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    const skipped = targets.length - eligible.length;
    if (failed > 0 || skipped > 0) {
      setError(
        `Removed ${eligible.length - failed} room${eligible.length - failed === 1 ? '' : 's'}.` +
          (skipped > 0 ? ` ${skipped} skipped (still in session).` : '') +
          (failed > 0 ? ` ${failed} failed.` : '')
      );
    }
    setSelectedIds(new Set());
    setBulkBusy(false);
    load();
  }

  const selectableCount = displayedRooms.filter((r) => !r.isArchived).length;

  return (
    <div className="admin-room-page">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <div><p className="visits-eyebrow">SPACE & STAFFING</p><h1 className="font-display text-3xl">Rooms</h1></div>
        <BranchFilter value={filterBranch} onChange={setFilterBranch} />
      </div>
      <p className="text-forest-500 text-sm mb-6">A clear view of room availability, current sessions and provider assignments.</p>
      <div className="room-overview-stats">{[['Rooms in use', rooms.filter(r => !r.isArchived).length], ['Available', rooms.filter(r => !r.isArchived && r.status === 'inactive').length], ['In session', rooms.filter(r => !r.isArchived && r.status === 'active').length], ['Awaiting confirmation', rooms.filter(r => !r.isArchived && r.status === 'pending').length]].map(([label, value]) => <div key={label}><span>{label === 'Rooms in use' ? 'Total rooms' : label}</span><strong>{loading || loadError ? '—' : value}</strong><small>{label === 'Rooms in use' ? 'Excludes removed rooms' : 'Within the selected branch scope'}</small></div>)}</div>
      <div className="room-view-toolbar"><div className="room-view-switch" aria-label="Room view"><button aria-pressed={view === 'board'} onClick={() => setView('board')}>Room board</button><button aria-pressed={view === 'manage'} onClick={() => setView('manage')}>Manage rooms</button></div><div className="flex gap-2"><button className="visits-button" disabled={loading} onClick={load}>{loading ? 'Refreshing…' : '↻ Refresh'}</button><button className="room-add-button" aria-expanded={showCreate} aria-controls="room-create-form" onClick={() => setShowCreate(!showCreate)}>{showCreate ? 'Close form' : '+ Add room'}</button></div></div>


      {showCreate && <form id="room-create-form" onSubmit={createRoom} className="bg-white rounded-xl2 border border-forest-100 shadow-card p-5 flex flex-wrap items-end gap-3 mb-6">
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
        <button type="submit" disabled={creating || !newName.trim() || !newBranch} className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium hover:bg-forest-700">
          {creating ? 'Adding…' : 'Add room'}
        </button>
      </form>}

      <div className="room-filter-bar flex flex-wrap items-center gap-3 mb-3">
        <input type="search" aria-label="Search rooms" placeholder="Search room, branch or customer" value={search} onChange={e => setSearch(e.target.value)} className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white" />
        <select
          aria-label="Filter by default provider"
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value)}
          className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">All default providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by room status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          <option value="inactive">Free</option>
          <option value="pending">Awaiting confirmation</option>
          <option value="active">In session</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="rounded-lg border border-forest-200 px-3 py-2 text-sm bg-white hover:bg-forest-50"
        >
          Name {sortDir === 'asc' ? 'A → Z' : 'Z → A'}
        </button>
        <label className="flex items-center gap-2 text-sm text-forest-600 ml-auto">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show removed rooms
        </label>
        {error && <p role="alert" className="text-sm text-clay basis-full">{error}</p>}
      </div>

      {view === 'manage' && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-3 bg-forest-50 border border-forest-200 rounded-lg px-4 py-2.5">
          <p className="text-sm font-medium text-forest-700">
            {selectedIds.size} room{selectedIds.size === 1 ? '' : 's'} selected
          </p>
          <button
            onClick={bulkUnassign}
            disabled={bulkBusy}
            className="rounded-lg border border-forest-300 bg-white text-forest-700 px-3 py-1.5 text-xs font-medium hover:bg-forest-50 disabled:opacity-50"
          >
            Unassign provider
          </button>
          <button
            onClick={bulkRemove}
            disabled={bulkBusy}
            className="rounded-lg border border-clay/40 bg-white text-clay px-3 py-1.5 text-xs font-medium hover:bg-clay/5 disabled:opacity-50"
          >
            Remove rooms
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs font-medium text-forest-500 hover:text-forest-700 ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      <p className="text-xs text-forest-500 mb-5">{view === 'board' ? 'Rooms are grouped by branch. Open session details for customer information and timing.' : 'Manage default providers and room availability. Removing a room preserves its visit history.'}</p>
      {loadError ? <p role="alert" className="visits-error">{loadError} <button className="visits-text-button" onClick={load}>Retry</button></p> : loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : view === 'board' ? (
        <div className="room-branch-board">
          {Array.from(new Set(displayedRooms.map(r => r.branch?.id ?? 0))).map(branchId => {
            const group = displayedRooms.filter(r => (r.branch?.id ?? 0) === branchId);
            return <section className="room-branch-section" key={branchId}><header><h2>{group[0].branch?.name || 'Unassigned branch'}</h2><span>{group.length} rooms · {group.filter(r => !r.isArchived && r.status === 'inactive').length} available</span></header><div className="room-admin-grid">{group.map(room => <article className={`room-admin-card ${room.isArchived ? 'room-archived' : ''}`} key={room.id}>
              <div className="room-admin-card-heading"><span className="room-door-icon" aria-hidden="true">▥</span><div><h3>{room.name}</h3><p>{room.isArchived ? 'Removed from service' : room.status === 'inactive' ? 'Ready for the next customer' : 'Room currently occupied'}</p></div>{room.isArchived ? <span className="text-xs text-clay">Removed</span> : <StatusBadge status={room.status} />}</div>
              <dl className="room-card-staff"><dt>Default provider</dt><dd>{room.provider?.name || 'Not assigned'}</dd>{room.currentBooking && <><dt>Serving now</dt><dd>{room.currentBooking.provider?.name || 'Not assigned'}</dd></>}</dl>
              {room.currentBooking ? <details className="room-session-detail"><summary>View session details <span aria-hidden="true">⌄</span></summary><div className="pt-3"><RoomCard room={room} /></div></details> : <p className="room-card-empty">{room.isArchived ? 'Restore this room from Manage rooms.' : 'No current session'}</p>}
            </article>)}</div></section>;
          })}
          {displayedRooms.length === 0 && <div className="visits-empty">No rooms match these filters.</div>}
        </div>
      ) : (
        <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectableCount > 0 && selectedIds.size === selectableCount}
                    onChange={toggleSelectAll}
                    aria-label="Select all rooms"
                  />
                </th>
                <th className="text-left px-4 py-3">Room</th>
                <th className="text-left px-4 py-3">Branch</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Assigned provider</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest-50">
              {displayedRooms.map((room) => (
                <tr key={room.id} id={`room-row-${room.id}`} className={`transition-colors ${room.isArchived ? 'opacity-50' : ''} ${highlightId === room.id ? 'bg-honey-500/20' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(room.id)}
                      disabled={room.isArchived}
                      onChange={() => toggleSelect(room.id)}
                      aria-label={`Select ${room.name}`}
                    />
                  </td>
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
                      aria-label={`Default provider for ${room.name}`}
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
                    {room.currentBooking?.provider &&
                      (!room.provider || room.currentBooking.provider.id !== room.provider.id) && (
                        <p className="text-xs text-forest-600 font-medium mt-1">
                          Currently: {room.currentBooking.provider.name}
                        </p>
                      )}
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
              {displayedRooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-forest-500/60">
                    No rooms match this filter.
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
