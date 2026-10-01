import { Link, useNavigate } from "react-router-dom";
import { Heart, LogOut, Settings, Shield, UserRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const Profile = () => {
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

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
        <Button asChild className="mt-6 w-full"><Link to="/auth">Entrar ou criar conta</Link></Button>
      ) : (
        <div className="mt-6 space-y-1">
          <Link to="/wishlist" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Heart size={20} /> Lista de desejos</Link>
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