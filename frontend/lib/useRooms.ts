'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { Room } from '@/lib/types';

export function useRooms(branchId: string = '') {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const query = branchId ? `?branchId=${branchId}` : '';
    const data = await api.get<{ rooms: Room[] }>(`/rooms${query}`);
    setRooms(data.rooms);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (room: Room) => {
      setRooms((prev) => {
        // If we're filtered to a single branch and this update is for a
        // different one, ignore it instead of injecting a stray room.
        if (branchId && room.branch?.id && String(room.branch.id) !== branchId) return prev;
        const exists = prev.some((r) => r.id === room.id);
        return exists ? prev.map((r) => (r.id === room.id ? room : r)) : prev;
      });
    };

    socket.on('room:updated', handler);
    return () => {
      socket.off('room:updated', handler);
    };
  }, [branchId]);

  return { rooms, loading, refresh };
}
