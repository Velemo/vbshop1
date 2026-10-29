import { Link, useNavigate } from "react-router-dom";
import { Heart, LogOut, Settings, UserRound, Mail, Camera, Send, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWallet, formatVb } from "@/hooks/useWallet";
import { toast } from "sonner";

const Profile = () => {
  const { session, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { balance, tickets, refresh } = useWallet();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarUrl = profileAvatar || session?.user.user_metadata?.avatar_url || session?.user.user_metadata?.picture;

  useEffect(() => {
    if (!session) return;
    (supabase as any).from("profiles").select("display_name,avatar_url").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data?.display_name) setName(data.display_name);
        if (data?.avatar_url) setProfileAvatar(data.avatar_url);
      });
  }, [session?.user.id]);

  const saveName = async () => {
    if (!session) return;
    const cleanName = name.trim().slice(0, 60);
    if (!cleanName) { toast.error("Introduza um nome."); return; }
    setSavingName(true);
    const { data: existing, error: readError } = await (supabase as any).from("profiles").select("id").eq("user_id", session.user.id).maybeSingle();
    if (readError) { setSavingName(false); toast.error("Não foi possível consultar o perfil."); return; }
    const profileValues = { display_name: cleanName, email: session.user.email, updated_at: new Date().toISOString() };
    const result = existing
      ? await (supabase as any).from("profiles").update(profileValues).eq("user_id", session.user.id)
      : await (supabase as any).from("profiles").insert({ user_id: session.user.id, ...profileValues });
    setSavingName(false);
    if (result.error) { toast.error("Não foi possível guardar o nome no perfil."); return; }
    await supabase.auth.updateUser({ data: { full_name: cleanName, name: cleanName } });
    toast.success("Nome atualizado!");
  };

  const uploadAvatar = async (file?: File) => {
    if (!file || !session) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um ficheiro de imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 5 MB."); return; }
    setUploadingAvatar(true);
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${session.user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setUploadingAvatar(false);
      toast.error("Não foi possível carregar a foto. Confirme se o armazenamento de avatares está configurado.");
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { data: existing, error: readError } = await (supabase as any).from("profiles").select("id").eq("user_id", session.user.id).maybeSingle();
    if (readError) { setUploadingAvatar(false); toast.error("Não foi possível consultar o perfil."); return; }
    const profileValues = { avatar_url: data.publicUrl, email: session.user.email, updated_at: new Date().toISOString() };
    const result = existing
      ? await (supabase as any).from("profiles").update(profileValues).eq("user_id", session.user.id)
      : await (supabase as any).from("profiles").insert({ user_id: session.user.id, ...profileValues });
    if (result.error) {
      setUploadingAvatar(false);
      toast.error("Foto carregada, mas não foi possível guardar no perfil.");
      return;
    }
    await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl, picture: data.publicUrl } });
    setProfileAvatar(data.publicUrl);
    setUploadingAvatar(false);
    toast.success("Foto de perfil atualizada!");
  };

  const redeem = async () => {
    if (!code.trim()) return;
    const { error } = await (supabase as any).rpc("redeem_code", { _code: code.trim().slice(0, 40) });
    if (error) { toast.error(error.message); return; }
    toast.success("Saldo recarregado!"); setCode(""); refresh();
  };

  return (
    <main className="mx-auto max-w-xl px-4 pt-0 pb-28 min-h-screen">
      <div className="mt-0 flex flex-col items-center gap-4 border-b border-border pb-6">
        {session ? (
          <>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={uploadingAvatar} aria-label="Alterar foto de perfil" className="relative grid size-24 place-items-center overflow-hidden rounded-full bg-secondary text-primary ring-2 ring-border hover:ring-primary disabled:opacity-60">
              {avatarUrl ? <img src={avatarUrl} alt="Foto de perfil" className="size-full object-cover" /> : <UserRound size={38} />}
              <span className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1 bg-black/65 py-1 text-xs text-white"><Camera size={13} /> {uploadingAvatar ? "A carregar..." : "Alterar"}</span>
            </button>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={e => { void uploadAvatar(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            <div className="w-full max-w-sm">
              <label htmlFor="profile-name" className="mb-1 block text-sm font-medium">Nome</label>
              <div className="flex gap-2">
                <input id="profile-name" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="O seu nome" className="min-w-0 flex-1 rounded-lg border border-border bg-background p-2 text-sm" />
                <Button onClick={saveName} disabled={savingName}>{savingName ? "A guardar..." : "Guardar"}</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="grid size-24 place-items-center rounded-full bg-secondary text-primary"><UserRound size={38} /></div>
        )}
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
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={40} placeholder="Código de recarga" className="flex-1 min-w-0 rounded-lg border border-border bg-background p-2 text-sm" />
              <Button onClick={redeem}>Recarregar</Button>
            </div>
          </div>
          <Link to="/send-vb" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Send size={20} /> Enviar vb$</Link>
          <Link to="/p2p" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><ArrowLeftRight size={20} /> P2P — Comprar vb$</Link>
          <Link to="/wishlist" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Heart size={20} /> Lista de desejos</Link>
          <Link to="/correio" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Mail size={20} /> Correio</Link>
          <Link to="/settings" className="flex items-center gap-3 border-b border-border py-4 text-sm font-medium hover:text-primary"><Settings size={20} /> Definições</Link>
          <Button variant="ghost" className="mt-4 gap-3 px-0" onClick={async () => { await signOut(); navigate("/"); }}><LogOut size={20} /> Sair da conta</Button>
        </div>
      )}
      {!session && <Link to="/settings" className="mt-6 flex items-center gap-3 text-sm text-muted-foreground hover:text-primary"><Settings size={20} /> Definições</Link>}
    </main>
  );
};

export default Profile;
