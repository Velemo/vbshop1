import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatVb } from "@/hooks/useWallet";
import { toast } from "sonner";
type Overview = {
  accounts: { code: string; name: string; user_code: string; pending_balance: number; invited: number; qualified: number }[];
  links: { invitee_name: string; user_code: string; referrer_code: string; linked_at: string; rewarded_at: string | null }[];
  movements: { name: string; user_code: string; kind: string; amount: number; created_at: string }[];
};
export default function ReferralAdmin() {
  const [data, setData] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    const [overview, own] = await Promise.all([supabase.rpc("admin_referral_dashboard"), supabase.rpc("referral_dashboard")]);
    setError(Boolean(overview.error || own.error));
    if (!overview.error) setData(overview.data as unknown as Overview);
    if (!own.error) { const settings = (own.data as unknown as { settings: { message: string; channel_url: string } }).settings; setMessage(settings.message); setChannel(settings.channel_url); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    let url: URL;
    try { url = new URL(channel); } catch { toast.error("Indique um link válido para o canal."); return; }
    if (url.protocol !== "https:") { toast.error("O link deve começar por https://."); return; }
    setSaving(true);
    const result = await supabase.from("referral_settings").upsert({ id: 1, message, channel_url: channel, updated_at: new Date().toISOString() });
    setSaving(false);
    if (result.error) toast.error(result.error.message); else toast.success("Mensagem de partilha guardada.");
  };
  return <section className="space-y-6">
    <div className="flex items-center justify-between"><h2 className="font-display text-xl font-semibold">Indicações e recompensas</h2><Button size="icon" variant="outline" aria-label="Atualizar indicações" onClick={() => void load()}><RefreshCw size={18} /></Button></div>
    <div className="space-y-3 border-b border-border pb-6"><label htmlFor="share-message" className="block text-sm font-medium">Mensagem de partilha</label><textarea id="share-message" value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full rounded-lg border border-border bg-background p-3 text-sm" /><p className="text-xs text-muted-foreground">Use {'{SITE}'} e {'{CANAL}'}. O código pessoal é acrescentado automaticamente e não pode ser alterado.</p><label htmlFor="share-channel" className="block text-sm font-medium">Link do canal WhatsApp</label><input id="share-channel" value={channel} onChange={e => setChannel(e.target.value)} className="w-full rounded-lg border border-border bg-background p-3 text-sm" /><Button onClick={save} disabled={saving || !message.trim()}>{saving ? "A guardar..." : "Guardar mensagem"}</Button></div>
    {error && <p className="text-destructive">Não foi possível carregar as indicações.</p>}
    <h3 className="font-semibold">Metas dos divulgadores</h3>
    {data?.accounts.map(a => <div key={a.code} className="flex flex-wrap justify-between gap-3 border-b border-border py-3"><div><p className="font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{a.user_code} · {a.code}</p><p className="text-sm text-muted-foreground">{a.invited} indicações · {a.qualified} com depósito</p></div><p>{formatVb(Number(a.pending_balance))} / 2 vb$</p></div>)}
    <h3 className="font-semibold">Contas indicadas</h3>
    {data?.links.map((l, i) => <div key={i} className="border-b border-border py-3 text-sm"><p>{l.invitee_name} · {l.user_code}</p><p className="text-muted-foreground">{l.referrer_code} · {new Date(l.linked_at).toLocaleString("pt-MZ")} · {l.rewarded_at ? "Bónus libertado" : "A aguardar primeiro depósito"}</p></div>)}
    <h3 className="font-semibold">Movimentos e resgates</h3>
    {data?.movements.map((m, i) => <div key={i} className="flex justify-between gap-3 border-b border-border py-2 text-sm"><div>{m.name} · {m.user_code}<p className="text-xs text-muted-foreground">{m.kind === "withdrawal" ? "Resgate" : "Bónus"} · {new Date(m.created_at).toLocaleString("pt-MZ")}</p></div><span>{formatVb(Number(m.amount))}</span></div>)}
    {data && !data.links.length && <p className="text-sm text-muted-foreground">Ainda sem indicações registadas.</p>}
  </section>;
}