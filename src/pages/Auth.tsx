import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="min-h-screen grid place-items-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"/></div>;
  if (session) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast.error("Senha precisa ter pelo menos 6 caracteres");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10 flex flex-col">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16}/> Voltar à loja
      </Link>
      <div className="flex-1 grid place-items-center">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-display font-bold">MARCHA vb</h1>
            <p className="text-sm text-muted-foreground">
              Entre na sua conta existente
            </p>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input type="email" required value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full pl-9 pr-3 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="Senha (mín. 6)"
                className="w-full pl-9 pr-3 py-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
            </div>
            <button type="submit" disabled={busy}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50">
              {busy ? "..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;