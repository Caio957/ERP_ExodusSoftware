import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  Wallet,
  Truck,
  BarChart3,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { StatusBadge } from './StatusBadge';

const navItems: { to: string; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { to: '/pdv', label: 'PDV', icon: ShoppingCart },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/caixa', label: 'Caixa', icon: Wallet },
  { to: '/compras', label: 'Compras', icon: Truck, adminOnly: true },
  { to: '/financeiro', label: 'Financeiro', icon: BarChart3, adminOnly: true },
];

function initials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-lg font-bold text-white shadow-brand">
            E
          </span>
          <div className="leading-none">
            <div className="font-display text-lg font-extrabold">Exodus</div>
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
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 ring-2 ring-white">
            {initials(user?.name)}
          </span>
          <button
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
            title="Sair"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="flex w-[88px] flex-col gap-2 border-r border-slate-200/70 bg-white/60 p-3 backdrop-blur-sm sm:w-28">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin())
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group relative flex min-h-touch flex-col items-center justify-center gap-1.5 rounded-2xl p-2 text-[11px] font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-gradient text-white shadow-brand'
                      : 'text-slate-500 hover:bg-brand-50 hover:text-brand-700'
                  }`
                }
              >
                <item.icon className="h-6 w-6" strokeWidth={2.1} />
                {item.label}
              </NavLink>
            ))}
        </nav>

        {/* Conteúdo */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto h-full max-w-6xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
