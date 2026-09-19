import { useAuth } from "@/hooks/useAuth";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import AccountWaiting from "@/components/AccountWaiting";
import { Navigate, Link } from "react-router-dom";
import Dashboard from "@/components/Dashboard";
import { useEffect } from "react";
import { applySiteName } from "@/lib/siteConfig";

export default function Index() {
  const { user, loading, signOut } = useAuth();
  const access = useAccountAccess(user?.id);

  useEffect(() => {
    applySiteName();
  }, []);

  if (loading || (user && access.isPending)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (access.isError || access.data?.status !== "approved") return <AccountWaiting error={access.isError} rejected={access.data?.status === "rejected"} onRefresh={() => access.refetch()} onSignOut={signOut} />;
  return <>{access.data.is_admin && <div className="p-3 border-b"><Link className="underline" to="/account-approvals">Aprovação de novas contas</Link></div>}<Dashboard /></>;
}
