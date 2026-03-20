import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import Dashboard from "@/components/Dashboard";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return <Dashboard />;
}
