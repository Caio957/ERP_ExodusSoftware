import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Wallet,
  Truck,
  BarChart3,
  Settings,
  Receipt,
  Users,
  LineChart,
  ClipboardCheck,
  LogOut,
  LayoutGrid,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { StatusBadge } from './StatusBadge';

const navItems: { to: string; label: string; icon: LucideIcon; pageKey: string }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LineChart, pageKey: 'dashboard' },
  { to: '/pdv', label: 'PDV', icon: ShoppingCart, pageKey: 'pdv' },
  { to: '/produtos', label: 'Produtos', icon: Package, pageKey: 'products' },
  { to: '/estoque', label: 'Estoque', icon: ClipboardCheck, pageKey: 'stock' },
  { to: '/caixa', label: 'Caixa', icon: Wallet, pageKey: 'cash' },
  { to: '/cadastros', label: 'Cadastros', icon: Users, pageKey: 'registrations' },
  { to: '/vendas', label: 'Vendas', icon: Receipt, pageKey: 'sales' },
  { to: '/compras', label: 'Compras', icon: Truck, pageKey: 'purchases' },
  { to: '/financeiro', label: 'Financeiro', icon: BarChart3, pageKey: 'financial' },
  { to: '/configuracoes', label: 'Config', icon: Settings, pageKey: 'settings' },
];

function initials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

/** Classe do item de navegação (sidebar e drawer). */
function navItemClass(isActive: boolean) {
  return `group relative flex min-h-touch flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-[11px] font-semibold transition-all duration-300 ${
    isActive
      ? 'bg-brand-gradient text-white shadow-brand scale-[1.02]'
      : 'text-slate-500 hover:bg-brand-50 hover:text-brand-700 hover:scale-[1.03]'
  }`;
}

export function Layout() {
  const { user, logout, canAccess } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = navItems.filter((item) => canAccess(item.pageKey));
  const bottomItems = items.slice(0, 4); // principais no bottom nav (celular)

  async function doLogout() {
    const result = await logout();
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-white/40 bg-white/70 px-3 backdrop-blur-xl sm:px-4">
        <div className="flex items-center gap-2.5">
          <span className="relative grid h-10 w-10 place-items-center">
            <span className="absolute inset-0 rounded-xl bg-brand-gradient opacity-70 blur-md animate-glow-pulse" />
            <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-brand ring-2 ring-accent-400/80">
              E
            </span>
          </span>
          <div className="leading-none">
            <div className="font-display text-lg font-extrabold gradient-text">Exodus</div>
            <div className="text-[11px] font-medium text-slate-400">Beauty ERP</div>
          </div>
        </div>

        <StatusBadge />

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold leading-tight">{user?.name}</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-brand-600">
              {user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}
            </div>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-brand ring-2 ring-accent-300">
            {initials(user?.name)}
          </span>
          <button
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            title="Sair"
            onClick={doLogout}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar (tablet/desktop) — sticky, com scroll próprio se necessário */}
        <nav className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[88px] shrink-0 flex-col gap-2 self-start overflow-y-auto border-r border-white/40 bg-white/50 p-3 backdrop-blur-md md:flex md:w-28">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => navItemClass(isActive)}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute -left-3 top-1/2 h-7 w-1.5 -translate-y-1/2 rounded-full bg-brand-gradient shadow-brand" />
                  )}
                  <item.icon
                    className="h-6 w-6 transition-transform duration-300 group-hover:scale-110"
                    strokeWidth={2.1}
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Conteúdo — scroll natural do documento (robusto no mobile) */}
        <main className="min-w-0 flex-1 p-4 pb-28 sm:p-6 md:pb-8">
          <div className="mx-auto max-w-6xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom navigation (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around gap-1 border-t border-white/40 bg-white/80 px-2 pb-[env(safe-area-inset-bottom)] pt-1.5 backdrop-blur-xl md:hidden">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition-all ${
                isActive ? 'text-brand-700' : 'text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid h-9 w-9 place-items-center rounded-xl transition-all duration-300 ${
                    isActive ? 'bg-brand-gradient text-white shadow-brand' : 'text-slate-400'
                  }`}
                >
                  <item.icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold text-slate-400"
          onClick={() => setMenuOpen(true)}
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl text-slate-400">
            <LayoutGrid className="h-5 w-5" strokeWidth={2.2} />
          </span>
          Menu
        </button>
      </nav>

      {/* Drawer com todos os itens (celular) */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="absolute inset-x-0 bottom-0 animate-slide-up rounded-t-3xl border-t border-white/50 bg-white/95 p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-elevated backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold gradient-text">Menu</h2>
              <button
                className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => navItemClass(isActive)}
                >
                  <item.icon className="h-6 w-6" strokeWidth={2.1} />
                  {item.label}
                </NavLink>
              ))}
            </div>
            <button className="btn-ghost mt-4 w-full" onClick={doLogout}>
              <LogOut className="h-5 w-5" /> Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
