import { Link, useNavigate } from "react-router-dom";
import { Heart, LogOut, Settings, Shield, UserRound, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet, formatVb } from "@/hooks/useWallet";
import { toast } from "sonner";

const Profile = () => {
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { balance, tickets, refresh } = useWallet();
  const [code, setCode] = useState("");
  const redeem = async () => {
    if (!code.trim()) return;
    const { error } = await (supabase as any).rpc("redeem_code", { _code: code.trim().slice(0, 40) });
    if (error) { toast.error(error.message); return; }
    toast.success("Saldo recarregado!"); setCode(""); refresh();
  };

  return (
    <main className="mx-auto max-w-xl px-4 pt-8 pb-28 min-h-screen">
      <h1 className="font-display text-3xl font-bold">Perfil</h1>
      <div className="mt-8 flex items-center gap-4 border-b border-border pb-6">
        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-secondary text-primary"><UserRound size={25} /></div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{session?.user.email || "Visitante"}</p>
          <p className="text-sm text-muted-foreground">{session ? "A sua conta" : "Entre para guardar os seus favoritos"}</p>
        </div>
      </div>
      {!session ? (
        <Button asChild className="mt-6 w-full"><Link to="/auth">Entrar</Link></Button>
      ) : (
        <div className="mt-6 space-y-1">
          <div className="rounded-2xl border-2 border-roulette p-4 mb-4">
            <p className="text-xs text-muted-foreground">Saldo vb moeda</p>
            <p className="font-display text-3xl font-bold">{formatVb(balance)}</p>
            <p className="text-xs text-muted-foreground">{tickets} bilhete(s) da roleta</p>
            <div className="mt-3 flex gap-2">
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={40} placeholder="Código de recarga"
                className="flex-1 min-w-0 rounded-lg border border-border bg-background p-2 text-sm" />
              <Button onClick={redeem}>Recarregar</Button>
            </div>
          </div>
          <Link to="/wishlist" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Heart size={20} /> Lista de desejos</Link>
          <Link to="/correio" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Mail size={20} /> Correio</Link>
          <Link to="/settings" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Settings size={20} /> Definições</Link>
          {isAdmin && <Link to="/admin" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Shield size={20} /> Painel ADM</Link>}
          <Button variant="ghost" className="mt-4 gap-3 px-0" onClick={async () => { await signOut(); navigate("/"); }}><LogOut size={20} /> Sair da conta</Button>
        </div>
      )}
      {!session && <Link to="/settings" className="mt-6 flex items-center gap-3 text-sm text-muted-foreground hover:text-primary"><Settings size={20} /> Definições</Link>}
    </main>
  );
};

export default Profile;