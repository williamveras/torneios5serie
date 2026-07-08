import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate("/admin");
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome: nome.trim() },
          emailRedirectTo: `${window.location.origin}/admin`,
        },
      });
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Verifique seu email para confirmar.");
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else {
        toast.success("Enviamos um e-mail com o link para redefinir sua senha.");
        setMode("login");
      }
    }
    setLoading(false);
  };

  const title = mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Trophy className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Seu nome completo" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      className="text-xs text-primary underline-offset-4 hover:underline"
                      onClick={() => setMode("forgot")}
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Aguarde..."
                : mode === "login"
                ? "Entrar"
                : mode === "signup"
                ? "Criar conta"
                : "Enviar link de recuperação"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {mode === "forgot" ? (
              <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("login")}>
                Voltar para o login
              </button>
            ) : mode === "login" ? (
              <>
                Não tem conta?{" "}
                <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("signup")}>
                  Criar conta
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => setMode("login")}>
                  Entrar
                </button>
              </>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
