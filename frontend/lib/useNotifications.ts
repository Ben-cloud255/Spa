'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { playUrgentAlert } from '@/lib/alertSound';
import type { Notification } from '@/lib/types';

export function useNotifications(branchId: string = '') {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const query = branchId ? `?branchId=${branchId}` : '';
    const data = await api.get<{ notifications: Notification[] }>(`/notifications${query}`);
    setNotifications(data.notifications);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handler = (notification: Notification) => {
      if (branchId && notification.branch_id && String(notification.branch_id) !== branchId) return;
      setNotifications((prev) => [notification, ...prev]);
      playUrgentAlert();
    };

    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [branchId]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markRead(id: number) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await api.post(`/notifications/${id}/read`);
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await api.post('/notifications/read-all');
  }

  return { notifications, unreadCount, loading, markRead, markAllRead };
}
