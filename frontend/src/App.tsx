import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from './services/api';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { DailyDeliveries } from './pages/DailyDeliveries';
import { DriverPortal } from './pages/DriverPortal';
import { Customers } from './pages/Customers';
import { CustomerDetails } from './pages/CustomerDetails';
import { Bills } from './pages/Bills';
import { Payments } from './pages/Payments';
import { Products } from './pages/Products';
import { Reports } from './pages/Reports';
import { Expenses } from './pages/Expenses';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!api.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const AdminOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = api.getUser();
  if (user?.role === 'worker') {
    return <Navigate to="/driver" replace />;
  }
  return <>{children}</>;
};

const DriverRouteGuard: React.FC = () => {
  const user = api.getUser();
  if (user?.role !== 'worker') {
    return <Navigate to="/deliveries?view=route" replace />;
  }
  return <DriverPortal />;
};

const IndexRedirect: React.FC = () => {
  const user = api.getUser();
  if (user?.role === 'worker') {
    return <Navigate to="/driver" replace />;
  }
  return <Dashboard />;
};

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<IndexRedirect />} />
            <Route path="driver" element={<DriverRouteGuard />} />

            {/* Admin-only features (Blocked for Delivery Guy) */}
            <Route path="deliveries" element={<AdminOnlyRoute><DailyDeliveries /></AdminOnlyRoute>} />
            <Route path="customers" element={<AdminOnlyRoute><Customers /></AdminOnlyRoute>} />
            <Route path="customers/:id" element={<AdminOnlyRoute><CustomerDetails /></AdminOnlyRoute>} />
            <Route path="bills" element={<AdminOnlyRoute><Bills /></AdminOnlyRoute>} />
            <Route path="payments" element={<AdminOnlyRoute><Payments /></AdminOnlyRoute>} />
            <Route path="products" element={<AdminOnlyRoute><Products /></AdminOnlyRoute>} />
            <Route path="reports" element={<AdminOnlyRoute><Reports /></AdminOnlyRoute>} />
            <Route path="expenses" element={<AdminOnlyRoute><Expenses /></AdminOnlyRoute>} />
            <Route path="settings" element={<AdminOnlyRoute><Settings /></AdminOnlyRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}


export default App;
