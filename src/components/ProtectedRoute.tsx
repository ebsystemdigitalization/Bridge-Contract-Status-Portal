import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from './LoadingScreen';

/**
 * Route guard component.
 * Restricts access to authenticated users with 'Active' status and optionally filters by admin role.
 */
export const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, profile, isAdmin, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  
  // If not logged in, or logged in but not Active, redirect to login
  if (!user || profile?.status !== 'Active') {
    return <Navigate to="/login" />;
  }
  
  if (adminOnly && !isAdmin) return <Navigate to="/" />;
  
  return <>{children}</>;
};
