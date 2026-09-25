'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import GlobalSearch from '@/components/GlobalSearch';
import { unlockAudioContext } from '@/lib/alertSound';
import PushToggle from '@/components/PushToggle';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export interface NavItem { href: string; label: string; icon: ReactNode; children?: NavItem[]; }

function Chevron({ reverse = false }: { reverse?: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ transform: reverse ? 'rotate(180deg)' : undefined }}><path d="m14 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export default function DashboardShell({ navItems, children }: { navItems: NavItem[]; children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(navItems.filter(item => item.children?.some(child => child.href === pathname)).map(item => item.label)));
  const initials = (user?.name || 'Account').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  useEffect(() => {
    try { setCollapsed(localStorage.getItem('serene-sidebar-collapsed') === 'true'); } catch { /* Storage may be unavailable. */ }
    const unlock = () => unlockAudioContext();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    setNavOpen(false);
    setAccountOpen(false);
    setOpenGroups(previous => {
      const next = new Set(previous);
      navItems.forEach(item => { if (item.children?.some(child => child.href === pathname)) next.add(item.label); });
      return next;
    });
  }, [pathname, navItems]);

  useEffect(() => {
    if (!accountOpen && !navOpen) return;
    const outside = (event: PointerEvent) => {
      if (accountOpen && !accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (accountOpen) { setAccountOpen(false); accountButton.current?.focus(); }
      else setNavOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [accountOpen, navOpen]);

  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    setAccountOpen(false);
    try { localStorage.setItem('serene-sidebar-collapsed', String(value)); } catch { /* Keep the session preference. */ }
  }
  function toggleGroup(label: string) {
    if (collapsed) {
      changeCollapsed(false);
      setOpenGroups(previous => new Set(previous).add(label));
      return;
    }
    setOpenGroups(previous => { const next = new Set(previous); next.has(label) ? next.delete(label) : next.add(label); return next; });
  }
  function navLink(item: NavItem, child = false) {
    const active = pathname === item.href;
    return <Link key={item.href} href={item.href} title={item.label} aria-label={item.label} aria-current={active ? 'page' : undefined} className={`spa-nav-link ${active ? 'is-active' : ''} ${child ? 'spa-child-link' : ''}`}>
      <span className="spa-nav-icon" aria-hidden="true">{item.icon}</span><span className="spa-sidebar-label">{item.label}</span>
      {active && <span className="spa-active-dot spa-sidebar-label" aria-hidden="true" />}
    </Link>;
  }

  return (
    <div className="h-screen flex overflow-hidden print-shell-root">
      {navOpen && <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-40 md:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}
      <aside aria-label="Workspace sidebar" className={`spa-sidebar no-print ${collapsed ? 'spa-sidebar-collapsed' : ''} ${navOpen ? 'spa-sidebar-open' : ''}`}>
        <div className="spa-brand">
          <span className="spa-brand-mark" aria-hidden="true">S</span>
          <div className="spa-sidebar-label min-w-0"><p className="font-display italic text-2xl whitespace-nowrap">Serene Spa</p><p className="text-xs text-forest-200 capitalize truncate mt-1" title={user?.branch_name || undefined}>{user?.role} workspace{user?.branch_name ? ` · ${user.branch_name}` : ''}</p></div>
          <button onClick={() => setNavOpen(false)} className="md:hidden ml-auto p-2" aria-label="Close menu">✕</button>
        </div>
        <button onClick={() => changeCollapsed(!collapsed)} className="spa-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
          <Chevron reverse={collapsed} /><span className="spa-sidebar-label">Collapse sidebar</span>
        </button>
        <nav aria-label="Main navigation" className="spa-navigation">
          <p className="spa-nav-heading spa-sidebar-label">WORKSPACE</p>
          {navItems.map((item, index) => item.children ? <div key={item.label}>
            <button className={`spa-nav-link w-full ${item.children.some(child => child.href === pathname) ? 'is-active-group' : ''}`} onClick={() => toggleGroup(item.label)} title={item.label} aria-label={item.label} aria-expanded={openGroups.has(item.label) && (!collapsed || navOpen)} aria-controls={`sidebar-group-${index}`}>
              <span className="spa-nav-icon" aria-hidden="true">{item.icon}</span><span className="spa-sidebar-label flex-1 text-left">{item.label}</span><span className={`spa-sidebar-label transition-transform ${openGroups.has(item.label) ? '-rotate-90' : 'rotate-180'}`}><Chevron /></span>
            </button>
            <div id={`sidebar-group-${index}`} className="spa-nav-children" hidden={!openGroups.has(item.label)}>{item.children.map(child => navLink(child, true))}</div>
          </div> : navLink(item))}
        </nav>
        <div ref={accountRef} className="spa-account" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setAccountOpen(false); }}>
          {accountOpen && <div id="sidebar-account" role="dialog" aria-label="My account" className="spa-account-panel">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10"><span className="spa-avatar shrink-0">{initials}</span><div className="min-w-0"><p className="font-semibold text-sm break-words">{user?.name}</p><p className="text-xs text-forest-200 break-all mt-1">{user?.email}</p><p className="text-xs text-honey-400 capitalize mt-1">{user?.role}{user?.branch_name ? ` · ${user.branch_name}` : ''}</p></div></div>
            <button className="spa-account-action" onClick={() => { setAccountOpen(false); setShowChangePassword(true); }}>Change password <span aria-hidden="true">↗</span></button>
            <div className="px-3 pb-4 border-b border-white/10"><p className="text-xs font-medium text-forest-100">Phone notifications</p><PushToggle /></div>
            <button className="spa-account-action spa-signout" onClick={logout}>Sign out <span aria-hidden="true">→</span></button>
          </div>}
          <button ref={accountButton} className={`spa-account-trigger ${accountOpen ? 'is-open' : ''}`} onClick={() => setAccountOpen(!accountOpen)} aria-label="My account" title="My account" aria-expanded={accountOpen} aria-controls="sidebar-account" aria-haspopup="dialog">
            <span className="spa-avatar shrink-0">{initials}</span><span className="spa-sidebar-label text-left flex-1"><span className="block text-sm font-medium">My account</span><span className="block text-xs text-forest-200 mt-0.5">Profile & preferences</span></span><span className={`spa-sidebar-label ${accountOpen ? '-rotate-90' : 'rotate-90'}`}><Chevron /></span>
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 min-h-0 print-shell-col">
        <header className="relative z-30 h-16 shrink-0 border-b border-forest-100 bg-sand-50/80 backdrop-blur flex items-center justify-between px-4 md:px-8 gap-3 no-print">
          <button onClick={() => setNavOpen(true)} className="md:hidden rounded-lg h-10 w-10 flex items-center justify-center border border-forest-100 bg-white shrink-0" aria-label="Open menu" aria-expanded={navOpen}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" /></svg></button>
          {user?.role === 'admin' && <GlobalSearch />}<div className="flex-1" /><NotificationBell />
        </header>
        <main className="flex-1 min-h-0 p-4 sm:p-6 md:p-8 overflow-y-auto print-shell-main"><motion.div key={pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15, ease: 'easeOut' }}>{children}</motion.div></main>
      </div>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}

