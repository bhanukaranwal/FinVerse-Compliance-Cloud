import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { AuthLayout } from './components/layouts/AuthLayout';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { TradesPage } from './pages/TradesPage';
import { TaxPage } from './pages/TaxPage';
import { CompliancePage } from './pages/CompliancePage';
import { DocumentsPage } from './pages/DocumentsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/auth" element={<AuthLayout />}>
        <Route path="login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="register" element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        } />
        <Route path="forgot-password" element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        } />
        <Route path="verify-email" element={<VerifyEmailPage />} />
      </Route>

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <DashboardLayout>
            <DashboardPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/portfolio" element={
        <ProtectedRoute>
          <DashboardLayout>
            <PortfolioPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/trades" element={
        <ProtectedRoute>
          <DashboardLayout>
            <TradesPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/tax" element={
        <ProtectedRoute>
          <DashboardLayout>
            <TaxPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/compliance" element={
        <ProtectedRoute>
          <DashboardLayout>
            <CompliancePage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/documents" element={
        <ProtectedRoute>
          <DashboardLayout>
            <DocumentsPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/notifications" element={
        <ProtectedRoute>
          <DashboardLayout>
            <NotificationsPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <DashboardLayout>
            <SettingsPage />
          </DashboardLayout>
        </ProtectedRoute>
      } />

      {/* Catch all route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </div>
        </Router>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;
