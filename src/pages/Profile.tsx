import { Link, useNavigate } from "react-router-dom";
import { Heart, Settings, UserRound, Camera, Send, ArrowLeftRight, Crown, TrendingUp } from "lucide-react";
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
  const [userCode, setUserCode] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [showVipDetails, setShowVipDetails] = useState(false);
  const [vipLoading, setVipLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const avatarUrl = profileAvatar || session?.user.user_metadata?.avatar_url || session?.user.user_metadata?.picture;

  useEffect(() => {
    if (!session) return;
    (supabase as any).from("profiles").select("display_name,avatar_url,user_code").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }: any) => {
        if (data?.display_name) setName(data.display_name);
        if (data?.user_code) setUserCode(data.user_code);
        if (data?.avatar_url) setProfileAvatar(data.avatar_url);
      });
    (supabase as any).from("vip_memberships").select("user_id").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }: any) => setIsVip(!!data));
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


  const activateVip = async () => {
    if (!session || isVip || vipLoading) return;
    if (balance < 10) { toast.error("Precisas de pelo menos 10 vb$ para ativar a Zona VIP."); return; }
    setVipLoading(true);
    const { error } = await (supabase as any).rpc("activate_vip");
    setVipLoading(false);
    if (error) { toast.error(error.message || "Não foi possível ativar a Zona VIP."); return; }
    setIsVip(true);
    await refresh();
    toast.success("Zona VIP ativada com sucesso!");
  };

  const redeem = async () => {
    if (!code.trim()) return;
    const { error } = await (supabase as any).rpc("redeem_code", { _code: code.trim().slice(0, 40) });
    if (error) { toast.error(error.message); return; }
    toast.success("Saldo recarregado!"); setCode(""); refresh();
  };

  return (
    <main className="mx-auto max-w-xl px-4 pt-0 pb-28 min-h-screen">
      <div className="mt-8 flex flex-col items-center gap-4 border-b border-border pb-6">
        {session ? (
          <>
            <button type="button" onClick={() => fileInput.current?.click()} disabled={uploadingAvatar} aria-label="Alterar foto de perfil" className="relative grid size-24 place-items-center overflow-hidden rounded-full bg-secondary text-primary ring-2 ring-border hover:ring-primary disabled:opacity-60">
              {avatarUrl ? <img src={avatarUrl} alt="Foto de perfil" className="size-full object-cover" /> : <UserRound size={38} />}
              <span className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1 bg-black/65 py-1 text-xs text-white"><Camera size={13} /> {uploadingAvatar ? "A carregar..." : "Alterar"}</span>
            </button>
            <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={e => { void uploadAvatar(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            <div className="w-full max-w-sm">
              <div className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-center">
                <p className="text-xs text-muted-foreground">ID do utilizador</p>
                <p className="font-mono text-base font-semibold tracking-wide">{userCode || "A gerar ID..."}</p>
              </div>
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
          <div className="grid grid-cols-4 gap-2">
            <Link to="/send-vb" className="flex min-w-0 flex-col items-center justify-start gap-2 rounded-xl px-1 py-4 text-center text-xs font-medium hover:bg-muted hover:text-primary sm:text-sm">
              <Send size={28} strokeWidth={1.8} />
              <span className="leading-tight">Enviar vb$</span>
            </Link>
            <Link to="/p2p" className="flex min-w-0 flex-col items-center justify-start gap-2 rounded-xl px-1 py-4 text-center text-xs font-medium hover:bg-muted hover:text-primary sm:text-sm">
              <ArrowLeftRight size={28} strokeWidth={1.8} />
              <span className="leading-tight">P2P — Comprar vb$</span>
            </Link>
            <Link to="/wishlist" className="flex min-w-0 flex-col items-center justify-start gap-2 rounded-xl px-1 py-4 text-center text-xs font-medium hover:bg-muted hover:text-primary sm:text-sm">
              <Heart size={28} strokeWidth={1.8} />
              <span className="leading-tight">Lista de desejos</span>
            </Link>
            <button type="button" onClick={() => setShowVipDetails(v => !v)} className="flex min-w-0 flex-col items-center justify-start gap-2 rounded-xl px-1 py-4 text-center text-xs font-medium hover:bg-muted hover:text-primary sm:text-sm">
              <Crown size={28} strokeWidth={1.8} className={isVip ? "text-amber-400" : ""} />
              <span className="leading-tight">{isVip ? "Zona VIP ativa" : vipLoading ? "A ativar..." : "Zona VIP"}</span>
            </button>
            <Link to="/trend" className="flex min-w-0 flex-col items-center justify-start gap-2 rounded-xl px-1 py-4 text-center text-xs font-medium hover:bg-muted hover:text-primary sm:text-sm">
              <TrendingUp size={28} strokeWidth={1.8} />
              <span className="leading-tight">Trend</span>
            </Link>
          </div>
          {showVipDetails && <section className="mt-3 rounded-2xl border border-amber-400/50 bg-amber-400/5 p-4">
            <div className="flex items-center gap-2 font-semibold"><Crown size={20} className="text-amber-400" /> Zona VIP {isVip && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs text-amber-500">VIP</span>}</div>
            <p className="mt-2 text-sm text-muted-foreground">Ativação por 10 vb$. Benefício previsto: até 70% de desconto em quase todos os produtos. Outros privilégios chegam em breve.</p>
            {!isVip && <Button className="mt-3 w-full" onClick={activateVip} disabled={vipLoading}>{vipLoading ? "A ativar..." : "Ativar Zona VIP — 10 vb$"}</Button>}
          </section>}
          <Link to="/settings" className="mt-3 flex items-center gap-3 border-t border-border py-4 text-sm font-medium hover:text-primary"><Settings size={20} /> Definições</Link>
        </div>
      )}
      {!session && <Link to="/settings" className="mt-6 flex items-center gap-3 text-sm text-muted-foreground hover:text-primary"><Settings size={20} /> Definições</Link>}
    </main>
  );
};

export default Profile;
