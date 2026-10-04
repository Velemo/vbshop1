import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Auth = () => {
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="min-h-screen grid place-items-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"/></div>;
  if (session) return <Navigate to="/" replace />;

  const submit = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) toast.error(result.error.message || "Não foi possível entrar com Google");
    } catch {
      toast.error("Não foi possível entrar com Google");
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
              Entre com a sua conta Google
            </p>
          </div>
          <Button onClick={submit} disabled={busy} className="w-full py-6">
            {busy ? "A abrir Google..." : "Continuar com Google"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;