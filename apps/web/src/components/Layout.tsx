import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { StatusBadge } from './StatusBadge';

const navItems = [
  { to: '/pdv', label: 'PDV', icon: '🛒' },
  { to: '/produtos', label: 'Produtos', icon: '📦' },
  { to: '/caixa', label: 'Caixa', icon: '💵' },
  { to: '/compras', label: 'Compras', icon: '📥', adminOnly: true },
  { to: '/financeiro', label: 'Financeiro', icon: '📊', adminOnly: true },
];

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 font-bold text-white">
            E
          </span>
          <span className="text-lg font-bold">Exodus</span>
        </div>
        <StatusBadge />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-semibold leading-tight">{user?.name}</div>
            <div className="text-xs text-slate-500">{user?.role}</div>
          </div>
          <button
            className="btn-ghost h-10 px-3 text-sm"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Sair
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="flex w-24 flex-col gap-1 border-r border-slate-200 bg-white p-2 sm:w-28">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin())
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex min-h-touch flex-col items-center justify-center gap-1 rounded-xl p-2 text-xs font-medium transition ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <span className="text-2xl">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>

        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
