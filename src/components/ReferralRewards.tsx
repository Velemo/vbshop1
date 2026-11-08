import { useCallback, useEffect, useState } from "react";
import { Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatVb, useWallet } from "@/hooks/useWallet";
import { canWithdrawReferral, referralShareMessage, type ReferralDashboard } from "@/lib/referrals";
import { toast } from "sonner";

function useReferralDashboard() {
  const { session } = useAuth();
  const [data, setData] = useState<ReferralDashboard | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    if (!session) { setData(null); return; }
    const result = await supabase.rpc("referral_dashboard");
    setError(Boolean(result.error));
    if (!result.error) setData(result.data as unknown as ReferralDashboard);
  }, [session?.user.id]);
  useEffect(() => { setData(null); void load(); }, [load]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 30000);
    window.addEventListener("focus", load);
    return () => { clearInterval(timer); window.removeEventListener("focus", load); };
  }, [load, session?.user.id]);
  return { data, error, load };
}

export function ReferralRewardsTile() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, error, load } = useReferralDashboard();
  const { refresh } = useWallet();
  const withdraw = async () => {
    if (!window.confirm("Resgatar o saldo de partilha para a sua carteira vb$?")) return;
    setBusy(true);
    const result = await supabase.rpc("referral_withdraw");
    setBusy(false);
    if (result.error) { toast.error(result.error.message); return; }
    toast.success(`${formatVb(Number(result.data))} enviados para a sua carteira.`);
    await Promise.all([load(), refresh()]);
  };
  return <>
    <Button variant="ghost" onClick={() => { setOpen(true); void load(); }} className="h-auto min-w-0 flex-col gap-2 whitespace-normal px-1 py-4 text-xs sm:text-sm"><Gift size={28} strokeWidth={1.8} /><span>Partilhar e ganhar</span></Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto">
      <DialogTitle>Partilhar e ganhar</DialogTitle>
      <DialogDescription>Convide novas pessoas. No primeiro depósito de vb$, o seu convidado recebe 0,10 vb$ e acumula 0,11 vb$ para si. Resgate a partir de 2 vb$.</DialogDescription>
      {!data ? <p className="text-sm text-muted-foreground">{error ? "Não foi possível carregar as recompensas." : "A carregar..."}</p> : <>
        <div><p className="text-sm text-muted-foreground">Saldo de partilha</p><p className="font-display text-3xl font-bold">{formatVb(Number(data.pending_balance))}</p><progress className="mt-2 h-2 w-full accent-primary" value={Math.min(Number(data.pending_balance), 2)} max={2} /><p className="mt-1 text-xs text-muted-foreground">Meta: 2 vb$ · {data.invited} indicações · {data.qualified} com depósito</p></div>
        <div className="flex items-center justify-between gap-3 border-y border-border py-3"><span className="text-sm">Código de partilha</span><span className="font-mono font-semibold">{data.code}</span></div>
        <Button variant="outline" onClick={withdraw} disabled={busy || !canWithdrawReferral(Number(data.pending_balance))}>{busy ? "A resgatar..." : "Resgatar saldo"}</Button>
        <Button asChild><a target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(referralShareMessage(data.settings.message, window.location.origin, data.settings.channel_url, data.code))}`}><Share2 size={16} className="mr-2" />Partilhar no WhatsApp</a></Button>
        <h3 className="font-semibold">Movimentos</h3>
        {data.movements.length ? data.movements.map((m, i) => <div key={`${m.created_at}-${i}`} className="flex justify-between gap-2 border-b border-border py-2 text-sm"><span>{m.kind === "withdrawal" ? "Resgate" : "Bónus de indicação"}<small className="block text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-MZ")}</small></span><span>{formatVb(Number(m.amount))}</span></div>) : <p className="text-sm text-muted-foreground">Ainda sem movimentos.</p>}
      </>}
    </DialogContent></Dialog>
  </>;
}

export function ReferralInvitePrompt() {
  const { data, load } = useReferralDashboard();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const remaining = data ? Date.parse(data.deadline) - now : 0;
  const submit = async () => {
    setBusy(true);
    const result = await supabase.rpc("referral_link", { _code: code.trim().toUpperCase() });
    setBusy(false);
    if (result.error) { toast.error(result.error.message); return; }
    setOpen(false); setCode(""); toast.success("Referência registada. O bónus será libertado no primeiro depósito."); await load();
  };
  if (!data?.can_link || remaining <= 0) return null;
  const seconds = Math.ceil(remaining / 1000);
  return <>
    <Button className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 gap-2 shadow-lg" onClick={() => setOpen(true)}><Gift size={18} />Referência · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[calc(100%-2rem)]"><DialogTitle>Quem lhe convidou?</DialogTitle><DialogDescription>Registe o código de partilha antes do primeiro depósito.</DialogDescription><label className="text-sm font-medium" htmlFor="referral-code">Código de partilha</label><input id="referral-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={7} placeholder="MV742K9" className="rounded-lg border border-border bg-background p-3" /><Button disabled={busy || !code.trim()} onClick={submit}>{busy ? "A validar..." : "Validar referência"}</Button></DialogContent></Dialog>
  </>;
}