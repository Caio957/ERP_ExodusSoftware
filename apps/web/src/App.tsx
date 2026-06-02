import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { PdvPage } from './pages/PdvPage';
import { ProductsPage } from './pages/ProductsPage';
import { CashPage } from './pages/CashPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { FinancialPage } from './pages/FinancialPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Rotas autenticadas (CASHIER + ADMIN) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/pdv" element={<PdvPage />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/caixa" element={<CashPage />} />

            {/* Rotas exclusivas de ADMIN (RBAC - Requisito 4.5) */}
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/compras" element={<PurchasesPage />} />
              <Route path="/financeiro" element={<FinancialPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/pdv" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
