'use client';

import { AlertTriangle, BarChart3, Bell, FileText, LayoutDashboard, Menu, Settings, Users, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clientes', icon: Users },
  { href: '/dashboard/invoices', label: 'Faturas', icon: FileText },
  { href: '/dashboard/reminders', label: 'Lembretes', icon: Bell },
  { href: '/dashboard/risk', label: 'Risco', icon: AlertTriangle },
  { href: '/dashboard/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings },
];

// P2-1: elements the focus trap cycles through (dialog itself is reachable
// only programmatically via tabIndex={-1}).
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Icon className="w-5 h-5" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function Brand({ href, onClick }: { href: string; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2">
      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center" aria-hidden="true">
        <span className="text-white font-bold text-sm">A</span>
      </div>
      <span className="text-xl font-bold text-gray-900">Agiliza</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // P2-1: closing always returns focus to the trigger (hamburger), per the
  // APG dialog pattern. Called from Escape, backdrop, X button and nav links.
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  // P2-1/P3: while open, block body scroll and move focus into the dialog.
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? dialog)?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  // P2-1/P3: Escape closes the drawer; Tab is trapped inside the dialog so
  // focus never leaks to the (inert) page behind the overlay.
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, closeMenu]);

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-gray-200 min-h-screen">
        <div className="p-6 border-b border-gray-100">
          <Brand href="/dashboard" />
        </div>
        <nav className="flex-1 p-4 space-y-1" aria-label="Navegação principal">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">Agiliza v0.12.0</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200">
        <Brand href="/dashboard" />
        <button
          ref={hamburgerRef}
          type="button"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu-dialog"
          onClick={() => setMenuOpen(true)}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Menu className="w-6 h-6" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* P2-2: backdrop is non-focusable and non-announced — a plain div
              with role="presentation", not a <button> that would sit first in
              tab order behind the overlay. */}
          <div
            data-testid="drawer-backdrop"
            role="presentation"
            aria-hidden="true"
            onClick={closeMenu}
            className="absolute inset-0 bg-gray-900/50"
          />
          <div
            ref={dialogRef}
            id="mobile-menu-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Menu móvel"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <Brand href="/dashboard" onClick={closeMenu} />
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={closeMenu}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                <X className="w-6 h-6" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1" aria-label="Menu móvel">
              <NavLinks pathname={pathname} onNavigate={closeMenu} />
            </nav>
            <div className="p-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">Agiliza v0.12.0</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
