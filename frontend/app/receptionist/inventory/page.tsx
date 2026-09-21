'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import AssignInventoryModal from '@/components/AssignInventoryModal';
import type { Room } from '@/lib/types';
import type { InventoryBranchStock, InventoryRoomAllocation } from '@/lib/types';

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ReceptionistInventoryPage() {
  const { user } = useAuth();
  const [stock, setStock] = useState<InventoryBranchStock[]>([]);
  const [allocations, setAllocations] = useState<InventoryRoomAllocation[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const selectedRoom = rooms.find((room) => String(room.id) === roomId && room.branch?.id === user?.branch_id);

  useEffect(() => {
    if (!user?.branch_id) return;
    setError(null);
    Promise.all([
      api.get<{ stock: InventoryBranchStock[] }>(`/inventory/branch-stock?branchId=${user.branch_id}`),
      api.get<{ allocations: InventoryRoomAllocation[] }>(`/inventory/room-allocations?branchId=${user.branch_id}`),
      api.get<{ rooms: Room[] }>('/rooms'),
    ]).then(([stockData, allocData, roomData]) => {
      setRooms(roomData.rooms.filter((room) => room.branch?.id === user.branch_id && !room.isArchived));
      setStock(stockData.stock);
      setAllocations(allocData.allocations);
    }).catch(() => setError('Could not load inventory. Please refresh and try again.')).finally(() => setLoading(false));
  }, [user?.branch_id, refreshVersion]);

  const displayedAllocations = statusFilter ? allocations.filter((a) => a.status === statusFilter) : allocations;

  return (
    <div>
      <h1 className="font-display text-3xl mb-1">Inventory</h1>
      <p className="text-forest-500/70 text-sm mb-6">
        Stock on hand at your branch and a history of items taken to rooms. Select a room below to assign stock.
      </p>

      {error && <p role="alert" className="text-sm text-clay mb-4">{error}</p>}
      <div className="bg-white rounded-xl2 border border-forest-100 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="inventory-room" className="block text-sm font-medium mb-1.5">Room</label>
          <select id="inventory-room" value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border border-forest-200 px-3 py-2" disabled={loading}>
            <option value="">Select a room</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </div>
        <button type="button" disabled={!selectedRoom || loading} onClick={() => setShowAssign(true)} className="rounded-lg bg-forest-600 text-sand-50 px-4 py-2 text-sm font-medium disabled:opacity-50">Assign items to room</button>
        {!loading && !error && rooms.length === 0 && <p className="text-sm text-forest-500">No rooms available at this branch.</p>}
      </div>
      {showAssign && selectedRoom && user?.branch_id && (
        <AssignInventoryModal roomId={selectedRoom.id} roomName={selectedRoom.name} branchId={user.branch_id} onClose={() => setShowAssign(false)} onAssigned={() => setRefreshVersion((version) => version + 1)} />
      )}

      {loading ? (
        <p className="text-forest-500/70">Loading…</p>
      ) : (
        <>
          <h2 className="font-display text-xl mb-3">Stock on hand</h2>
          <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-left px-4 py-3">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-50">
                  {stock.map((s) => {
                    const low = Number(s.quantity) <= Number(s.minimum_stock);
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-3 font-medium">{s.item_name}{low && <span className="ml-2 text-xs text-clay">Low stock</span>}</td>
                        <td className={`px-4 py-3 ${low ? 'text-clay font-medium' : ''}`}>
                          {Number(s.quantity)}
                          
                        </td>
                      </tr>
                    );
                  })}
                  {stock.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-forest-500/60">
                        No stock has been sent to your branch yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl">Items taken to rooms</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-forest-200 px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="in_use">In use</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="bg-white rounded-xl2 border border-forest-100 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-sand-100/70 text-forest-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Item</th>
                    <th className="text-left px-4 py-3">Room</th>
                    <th className="text-left px-4 py-3">Quantity</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Assigned</th>
                    <th className="text-left px-4 py-3">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-50">
                  {displayedAllocations.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium">{a.item_name}</td>
                      <td className="px-4 py-3">{a.room_name}</td>
                      <td className="px-4 py-3">{Number(a.quantity)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.status === 'in_use' ? 'bg-honey-500/10 text-honey-700' : 'bg-forest-500/10 text-forest-700'}`}>
                          {a.status === 'in_use' ? 'In use' : 'Completed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-forest-500/70">
                        {a.assigned_by_name || '—'} · {timeAgo(a.assigned_at)}
                        {a.note && <div className="text-xs text-forest-500/50 mt-0.5">{a.note}</div>}
                      </td>
                      <td className="px-4 py-3 text-forest-500/70">
                        {a.status === 'completed' ? (
                          <>
                            {a.completed_by_name || '—'} · {a.completed_at ? timeAgo(a.completed_at) : ''}
                            {a.completion_note && <div className="text-xs text-forest-500/50 mt-0.5">{a.completion_note}</div>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                  {displayedAllocations.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-forest-500/60">
                        Nothing has been taken to a room yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
