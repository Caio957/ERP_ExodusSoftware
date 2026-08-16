import { NavLink } from 'react-router-dom';
import { Building2, CreditCard } from 'lucide-react';

const LINKS = [
  { to: '/admin/contratos', label: 'Contratos', icon: Building2 },
  { to: '/admin/faturamento', label: 'Faturamento', icon: CreditCard },
];

/**
 * Navegação entre as telas do Back-Office da Exodus. As duas são páginas
 * irmãs (mesma proteção `<SuperAdminRoute>`) e não entram em `navItems` do
 * Layout — aquela lista é filtrada por `canAccess`, que é RBAC de tenant, um
 * eixo que não se aplica ao super admin. Esta pílula é o único caminho entre
 * elas depois de entrar pelo ícone do header.
 */
export function AdminNav() {
  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map((l) => (
        <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'btn-primary' : 'btn-ghost')}>
          <l.icon className="h-5 w-5" /> {l.label}
        </NavLink>
      ))}
    </div>
  );
}
