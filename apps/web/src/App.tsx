import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SuperAdminRoute } from './components/SuperAdminRoute';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PdvPage } from './pages/PdvPage';
import { ProductsPage } from './pages/ProductsPage';
import { CashPage } from './pages/CashPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { FinancialPage } from './pages/FinancialPage';
import { SettingsPage } from './pages/SettingsPage';
import { SalesPage } from './pages/SalesPage';
import { RegistrationsPage } from './pages/RegistrationsPage';
import { DashboardPage } from './pages/DashboardPage';
import { StockAdjustPage } from './pages/StockAdjustPage';
import { AdminContractsPage } from './pages/AdminContractsPage';
import { AdminBillingPage } from './pages/AdminBillingPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />

        {/* Rotas autenticadas (CASHIER + ADMIN) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/pdv" element={<PdvPage />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/caixa" element={<CashPage />} />
            <Route path="/cadastros" element={<RegistrationsPage />} />

            {/* Rotas exclusivas de ADMIN (RBAC - Requisito 4.5) */}
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/vendas" element={<SalesPage />} />
              <Route path="/estoque" element={<StockAdjustPage />} />
              <Route path="/compras" element={<PurchasesPage />} />
              <Route path="/financeiro" element={<FinancialPage />} />
              <Route path="/configuracoes" element={<SettingsPage />} />
            </Route>

            {/* Back-Office da Exodus (super admin) — eixo de autorização
                separado do RBAC por papel (role) do tenant, ver SuperAdminRoute. */}
            <Route element={<SuperAdminRoute />}>
              <Route path="/admin/contratos" element={<AdminContractsPage />} />
              <Route path="/admin/faturamento" element={<AdminBillingPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/pdv" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
