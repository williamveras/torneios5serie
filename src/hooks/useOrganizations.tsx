import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Organization = {
  id: string;
  nome: string;
  slug: string | null;
  created_by: string | null;
};

export type OrgMembership = Organization & { role: "owner" | "admin" | "member" };

const STORAGE_KEY = "activeOrgId";

export function useOrganizations() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null)
  );
  const [loading, setLoading] = useState(true);

  const setActiveOrgId = useCallback((id: string | null) => {
    setActiveOrgIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const fetch = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("organization_members" as any)
      .select("role, organization:organizations(id, nome, slug, created_by)")
      .eq("user_id", user.id);
    if (error) {
      console.error(error);
      setOrgs([]);
      setLoading(false);
      return;
    }
    const mapped: OrgMembership[] = (data ?? [])
      .map((row: any) => row.organization && { ...row.organization, role: row.role })
      .filter(Boolean);
    mapped.sort((a, b) => a.nome.localeCompare(b.nome));
    setOrgs(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  // Ensure activeOrgId is valid
  useEffect(() => {
    if (loading) return;
    if (orgs.length === 0) {
      if (activeOrgId !== null) setActiveOrgId(null);
      return;
    }
    if (!activeOrgId || !orgs.some((o) => o.id === activeOrgId)) {
      setActiveOrgId(orgs[0].id);
    }
  }, [orgs, activeOrgId, loading, setActiveOrgId]);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;

  return { orgs, activeOrg, activeOrgId, setActiveOrgId, refetch: fetch, loading };
}

/** Creates an organization and adds the creator as owner. Returns the new org id. */
export async function createOrganization(nome: string, userId: string): Promise<string> {
  const { data: org, error } = await supabase
    .from("organizations" as any)
    .insert({ nome: nome.trim(), created_by: userId } as any)
    .select("id")
    .single();
  if (error || !org) throw error ?? new Error("Falha ao criar organização");
  const orgId = (org as any).id as string;
  const { error: memErr } = await supabase
    .from("organization_members" as any)
    .insert({ organization_id: orgId, user_id: userId, role: "owner" } as any);
  if (memErr) throw memErr;
  return orgId;
}
