import { useState } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
type RequestRow = {user_id:string; nome:string; email:string; status:string; created_at:string; decided_at:string|null};
export default function AccountApprovals() {
  const {user, loading}=useAuth();
  const access=useAccountAccess(user?.id);
  const [params]=useSearchParams();
  const [confirm,setConfirm]=useState<{row:RequestRow;decision:"approved"|"rejected"}|null>(null);
  const [saving,setSaving]=useState(false);
  const requests=useQuery({queryKey:["account-requests",user?.id],enabled:access.data?.is_admin===true,
    queryFn:async():Promise<RequestRow[]>=>{const {data,error}=await (supabase as any).rpc("account_approval_requests");if(error)throw error;return data;}});
  if(loading || (user && access.isPending))return <p className="p-8">Carregando...</p>;
  if(!user)return <Navigate to="/auth?next=approvals" replace/>;
  if(!access.data?.is_admin)return <main className="p-8"><p>Acesso restrito ao administrador de aprovação de contas.</p><Link to="/admin">Voltar ao painel</Link></main>;
  const decide=async()=>{
    if(!confirm)return;setSaving(true);
    const {error}=await (supabase as any).rpc("decide_account_approval",{target:confirm.row.user_id,decision:confirm.decision});
    setSaving(false);
    if(error){toast.error("Não foi possível concluir. A solicitação pode já ter sido analisada.");await requests.refetch();setConfirm(null);return;}
    toast.success(confirm.decision==="approved"?"Conta aprovada. O aviso por e-mail foi agendado.":"Cadastro recusado. O aviso por e-mail foi agendado.");setConfirm(null);await requests.refetch();
  };
  return <main className="max-w-4xl mx-auto p-6 space-y-5">
    <Link to="/admin" className="underline">Voltar ao painel</Link><h1 className="text-2xl font-bold">Aprovação de contas</h1>
    <p>A aprovação libera a conta. As permissões de acesso às organizações são administradas separadamente.</p>
    <Button variant="outline" onClick={()=>requests.refetch()}>Atualizar solicitações</Button>
    {requests.isError && <p role="alert">Não foi possível carregar as solicitações. Tente novamente.</p>}
    {requests.isPending && <p>Carregando solicitações...</p>}
    {requests.data?.filter(r=>r.status==='pending').length===0 && <p>Nenhuma solicitação pendente.</p>}
    {requests.data?.map(row=><section key={row.user_id} className={`border rounded-lg p-4 space-y-2 ${params.get('request')===row.user_id?'border-primary bg-primary/5':''}`}>
      <h2 className="font-semibold">{row.nome||row.email}</h2><p>{row.email}</p><p>Solicitada em {new Date(row.created_at).toLocaleString('pt-BR')}</p>
      <p>Situação: {row.status==='pending'?'Pendente':row.status==='approved'?'Aprovada':'Recusada'}</p>
      {row.status==='pending' && <div className="flex gap-3"><Button disabled={saving} onClick={()=>setConfirm({row,decision:'approved'})}>Aprovar</Button><Button variant="destructive" disabled={saving} onClick={()=>setConfirm({row,decision:'rejected'})}>Recusar</Button></div>}
    </section>)}
    {confirm && <div role="dialog" aria-modal="true" aria-label="Confirmar decisão" className="fixed inset-0 bg-black/50 flex items-center justify-center p-6"><section className="bg-background rounded-lg p-6 max-w-md space-y-4">
      <h2 className="font-semibold">{confirm.decision==='approved'?'Aprovar':'Recusar'} o cadastro?</h2><p>{confirm.row.email}</p><p>O usuário será avisado por e-mail.</p>
      <div className="flex gap-3"><Button disabled={saving} onClick={decide}>{saving?'Salvando...':'Confirmar'}</Button><Button variant="outline" disabled={saving} onClick={()=>setConfirm(null)}>Cancelar</Button></div>
    </section></div>}
  </main>;
}
