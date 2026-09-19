import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export type AccountAccess = { status: "pending" | "approved" | "rejected"; is_admin: boolean };
export function useAccountAccess(userId?: string) {
  return useQuery({
    queryKey: ["account-access", userId], enabled: !!userId, staleTime: 0,
    queryFn: async (): Promise<AccountAccess> => {
      const { data, error } = await (supabase as any).rpc("account_access_status");
      if (error) throw error;
      if (!data || !["pending", "approved", "rejected"].includes(data.status)) throw new Error("Situação da conta indisponível");
      return data;
    },
  });
}
