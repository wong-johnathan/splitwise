import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { LoadingSpinner } from '@/components/ui/loading';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner className="min-h-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
