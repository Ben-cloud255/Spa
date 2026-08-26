'use client';

import { ReactNode } from 'react';
import RoleGuard from '@/components/RoleGuard';
import DashboardShell, { NavItem } from '@/components/DashboardShell';
import { RoomsIcon } from '@/components/icons';

const NAV: NavItem[] = [{ href: '/provider', label: 'My rooms', icon: <RoomsIcon /> }];

export default function ProviderLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allow={['provider']}>
      <DashboardShell navItems={NAV}>{children}</DashboardShell>
    </RoleGuard>
  );
}
