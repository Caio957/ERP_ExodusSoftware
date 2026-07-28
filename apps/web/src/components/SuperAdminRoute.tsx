import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../store/auth';

/**
 * Bloqueia o Back-Office da Exodus (ex.: /admin/contratos) para todo mundo
 * exceto o super admin. Diferente de `ProtectedRoute roles={['ADMIN']}`:
 * `role` é RBAC dentro do tenant (ADMIN/CASHIER da loja do cliente);
 * `isSuperAdmin` é um eixo totalmente separado (funcionário da Exodus dona
 * do SaaS, sinalizado por `SUPER_ADMIN_EMAIL` no backend). Um ADMIN comum de
 * uma loja cliente é bloqueado aqui normalmente.
 *
 * Este componente é só a trava de UX no frontend — a autorização real é
 * sempre reavaliada no backend (`assertSuperAdmin`, routes/admin.ts) a cada
 * chamada às rotas administrativas, então nunca depender só desta rota para
 * segurança de verdade.
 */
export function SuperAdminRoute() {
  const { user, token } = useAuth();

  if (!token || !user) return <Navigate to="/login" replace />;
  if (!user.isSuperAdmin) return <Navigate to="/pdv" replace />;

  return <Outlet />;
}
