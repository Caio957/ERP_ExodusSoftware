import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '@exodus/shared';
import { useAuth } from '../store/auth';

interface Props {
  roles?: UserRole[];
}

/** Bloqueia rotas sem autenticação e, opcionalmente, por papel (RBAC). */
export function ProtectedRoute({ roles }: Props) {
  const { user, token } = useAuth();

  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/pdv" replace />;

  return <Outlet />;
}
