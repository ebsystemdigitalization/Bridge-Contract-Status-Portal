import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { LoginAdmin } from './pages/LoginAdmin';
import { SearchPage } from './pages/SearchPage';
import { AdminPanel } from './pages/AdminPanel';
import { MaintenancePage } from './pages/MaintenancePage';

/**
 * Main Application Component.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/login-admin" element={<LoginAdmin />} />
            <Route path="/" element={
              <ProtectedRoute>
                <div className="min-h-screen">
                  <Navbar />
                  <SearchPage />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <div className="min-h-screen">
                  <Navbar />
                  <AdminPanel />
                </div>
              </ProtectedRoute>
            } />
            <Route path="/maintenance" element={
              <ProtectedRoute adminOnly>
                <div className="min-h-screen">
                  <Navbar />
                  <MaintenancePage />
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
