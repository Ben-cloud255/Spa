'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import { unlockAudioContext } from '@/lib/alertSound';
import PushToggle from '@/components/PushToggle';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

export default function DashboardShell({
  navItems,
  children,
}: {
  navItems: NavItem[];
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    const unlock = () => {
      unlockAudioContext();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Close the mobile drawer automatically whenever they navigate.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="h-screen flex overflow-hidden print-shell-root">
      {navOpen && (
        <div className="fixed inset-0 bg-ink/40 z-30 md:hidden" onClick={() => setNavOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 h-screen w-64 md:w-60 shrink-0 bg-forest-700 text-sand-50 flex flex-col no-print transition-transform duration-200 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
        <div className="px-6 py-6 flex items-start justify-between shrink-0">
          <div>
            <p className="font-display italic text-2xl">Serene Spa</p>
            <p className="text-forest-200 text-xs mt-1 capitalize">
              {user?.role} workspace{user?.branch_name ? ` · ${user.branch_name}` : ''}
            </p>
          </div>
          <button
            onClick={() => setNavOpen(false)}
            className="md:hidden text-forest-200 hover:text-white"
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active ? 'bg-forest-600 text-white' : 'text-forest-100 hover:bg-forest-600/60'
                }`}
              >
                <span className="shrink-0 opacity-90">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-5 border-t border-forest-600/60 shrink-0">
          <p className="text-sm text-sand-50">{user?.name}</p>
          <p className="text-xs text-forest-200 truncate">{user?.email}</p>
          <div className="flex flex-col items-start gap-1.5 mt-3">
            <button
              onClick={() => setShowChangePassword(true)}
              className="text-xs text-forest-200 hover:text-white underline underline-offset-2"
            >
              Change password
            </button>
            <button onClick={logout} className="text-xs text-forest-200 hover:text-white underline underline-offset-2">
              Sign out
            </button>
          </div>
          <PushToggle />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0 print-shell-col">
        <header className="h-16 shrink-0 border-b border-forest-100 bg-sand-50/80 backdrop-blur flex items-center justify-between md:justify-end px-4 md:px-8 gap-3 no-print">
          <button
            onClick={() => setNavOpen(true)}
            className="md:hidden rounded-lg h-10 w-10 flex items-center justify-center border border-forest-100 bg-white"
            aria-label="Open menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
          <NotificationBell />
        </header>
        <main className="flex-1 min-h-0 p-4 sm:p-6 md:p-8 overflow-y-auto print-shell-main">{children}</main>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
