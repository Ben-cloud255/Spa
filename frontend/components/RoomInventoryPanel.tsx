'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import CompleteInventoryModal from '@/components/CompleteInventoryModal';
import type { InventoryRoomAllocation } from '@/lib/types';

export default function RoomInventoryPanel({
  roomId,
  roomName,
  branchId,
  role,
}: {
  roomId: number;
  roomName: string;
  branchId: number;
  role: 'receptionist' | 'provider';
}) {
  const [items, setItems] = useState<InventoryRoomAllocation[]>([]);
  const [completeTarget, setCompleteTarget] = useState<InventoryRoomAllocation | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ allocations: InventoryRoomAllocation[] }>(
        `/inventory/room-allocations?roomId=${roomId}&status=in_use`
      );
      setItems(data.allocations);
    } catch {
      // Item tracking is a secondary feature — a failure here shouldn't block the room card.
    }
  }, [roomId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <div className="border-t border-forest-100 pt-3 mt-1">
      {items.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-forest-700 truncate">
                {Number(it.quantity)} {it.item_name}
              </span>
              {role === 'provider' && (
                <button
                  onClick={() => setCompleteTarget(it)}
                  className="shrink-0 rounded-full bg-honey-500/10 text-honey-700 px-2.5 py-1 font-medium hover:bg-honey-500/20"
                >
                  Mark finished
                </button>
              )}
            </li>
          ))}
        </ul>
      )}


      {items.length === 0 && role === 'provider' && (
        <p className="text-xs text-forest-500/50">No items assigned to this room right now.</p>
      )}

      {completeTarget && (
        <CompleteInventoryModal
          allocation={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onCompleted={load}
        />
      )}
    </div>
  );
}
