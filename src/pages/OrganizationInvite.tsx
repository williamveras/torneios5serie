import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import AccountWaiting from "@/components/AccountWaiting";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export default function OrganizationInvite() {
 const [params]=useSearchParams();const invitation=params.get('invite') || '';
 const valid=/^[0-9a-f-]{36}$/i.test(invitation);
 const {user,loading,signOut}=useAuth();const access=useAccountAccess(user?.id);
 const [saving,setSaving]=useState(false);
 const details=useQuery({queryKey:['org-invitation',invitation,user?.id],enabled:valid && access.data?.status==='approved',retry:false,
 queryFn:async()=>{const {data,error}=await (supabase as any).rpc('get_organization_invite',{invitation});if(error)throw error;return data as {organization_id:string;organization_name:string;role:string;status:string};}});
 if(!valid)return <main className="p-8">Convite inválido. Abra o link recebido por e-mail.</main>;
 if(loading || (user && access.isPending))return <p className="p-8">Carregando...</p>;
 if(!user)return <Navigate to={`/auth?invite=${encodeURIComponent(invitation)}`} replace/>;
 if(access.isError || access.data?.status!=='approved')return <AccountWaiting error={access.isError} rejected={access.data?.status==='rejected'} onRefresh={()=>access.refetch()} onSignOut={signOut}/>;
 async function accept(){setSaving(true);const {data,error}=await (supabase as any).rpc('accept_organization_invite',{invitation});setSaving(false);if(error){toast.error(error.message);return;}localStorage.setItem('activeOrgId',data.organization_id);await details.refetch();}
 return <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30"><section className="max-w-md border rounded-xl p-6 bg-card space-y-4">
 <h1 className="text-xl font-semibold">Convite para organização</h1>
 <p className="break-all">Conta: {user.email}</p>
 {details.isPending && <p>Carregando convite...</p>}
 {details.isError && <p role="alert">Não foi possível abrir o convite. Ele pode ter expirado, sido cancelado ou ter sido enviado para outro e-mail. Confira a conta utilizada ou solicite um novo convite.</p>}
 {details.data && <><h2 className="font-semibold">{details.data.organization_name}</h2><p>Papel: {details.data.role==='admin'?'Administrador':'Membro'}</p>{details.data.status==='accepted'?<><p role="status">Convite aceito. Você já pode acessar a organização.</p><Link className="underline" to="/admin">Ir para o painel</Link></>:<Button disabled={saving} onClick={accept}>{saving?'Aceitando...':'Aceitar convite'}</Button>}</>}
 <Button variant="outline" onClick={signOut}>Sair e usar outra conta</Button>
 </section></main>;
}
