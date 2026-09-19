import { Button } from "@/components/ui/button";
export default function AccountWaiting({ rejected = false, error = false, onRefresh, onSignOut }: {
  rejected?: boolean; error?: boolean; onRefresh: () => void; onSignOut: () => void;
}) {
  return <main className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
    <section className="max-w-md rounded-xl border bg-card p-6 space-y-4" role="status">
      <h1 className="text-xl font-semibold">{error ? "Não foi possível verificar sua conta" : rejected ? "Cadastro não aprovado" : "Aguardando aprovação"}</h1>
      <p>{error ? "Tente novamente em instantes." : rejected ? "Sua solicitação de cadastro não foi aprovada. Para esclarecer a decisão, entre em contato com a administração." : "Sua conta foi criada e está aguardando aprovação da administração. Você receberá um e-mail quando sua solicitação for analisada."}</p>
      <div className="flex gap-3"><Button onClick={onRefresh}>Verificar novamente</Button><Button variant="outline" onClick={onSignOut}>Sair</Button></div>
    </section>
  </main>;
}
