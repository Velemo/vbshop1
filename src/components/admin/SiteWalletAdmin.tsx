import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Copy, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatVb } from "@/hooks/useWallet";
import { toast } from "sonner";

type Summary = { balance: number; circulating: number; p2p: number; spent: number; issued: number; pending_codes: number };
type Entry = { id: string; kind: string; amount: number; description: string; created_at: string };

export default function SiteWalletAdmin() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [validity, setValidity] = useState("30");
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const [totals, movements] = await Promise.all([
      supabase.rpc("admin_site_wallet_summary"),
      supabase.from("site_wallet_entries").select("id,kind,amount,description,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    if (totals.error || movements.error) setError(totals.error?.message || movements.error?.message || "Não foi possível consultar a carteira.");
    else { setError(""); setSummary(totals.data as unknown as Summary); setEntries(movements.data || []); }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);
  const generate = async () => {
    const value = Number(amount);
    if (!summary || !Number.isFinite(value) || value <= 0 || value !== Math.round(value * 100) / 100 || value > summary.balance) { toast.error("Indique um valor válido dentro do saldo da carteira."); return; }
    setBusy(true);
    const { data, error: failure } = await supabase.rpc("admin_generate_site_recharge", { _amount: value, _expires_at: validity === "none" ? undefined : new Date(Date.now() + Number(validity) * 86400000).toISOString() });
    setBusy(false);
    if (failure) { toast.error(failure.message); return; }
    setCode(data); setAmount(""); toast.success("Código gerado com saldo da Carteira do Site."); await load();
  };
  return <section className="space-y-6 pb-10">
    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Wallet className="text-primary" />Carteira do Site</h2><Button variant="outline" size="icon" aria-label="Atualizar carteira" disabled={loading} onClick={() => void load()}><RefreshCw /></Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading && !summary && <p className="text-sm text-muted-foreground">A carregar movimentos...</p>}
    {summary && <>
      <div className="border-b border-border pb-5"><p className="text-sm text-muted-foreground">Saldo disponível da carteira</p><p className="mt-1 font-display text-3xl font-bold">{formatVb(summary.balance)}</p></div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-5 lg:grid-cols-5">
        {[['Saldo em circulação', summary.circulating], ['Saldo no P2P', summary.p2p], ['Gasto em produtos', summary.spent], ['Recargas geradas', summary.issued], ['Códigos por resgatar', summary.pending_codes]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{formatVb(Number(value))}</dd></div>)}
      </dl>
      <form className="max-w-lg space-y-3 border-y border-border py-5" onSubmit={e => { e.preventDefault(); void generate(); }}>
        <h3 className="font-semibold">Gerar recarga com saldo da carteira</h3>
        <div className="grid grid-cols-2 gap-3"><div><label htmlFor="site-recharge-amount" className="mb-1 block text-xs font-medium">Valor (vb$)</label><input id="site-recharge-amount" type="number" step="0.01" min="0.01" max={summary.balance} required value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded-md border border-input bg-background p-2.5 text-sm" /></div><div><label htmlFor="site-recharge-validity" className="mb-1 block text-xs font-medium">Validade</label><select id="site-recharge-validity" value={validity} onChange={e => setValidity(e.target.value)} className="w-full rounded-md border border-input bg-background p-2.5 text-sm"><option value="1">1 dia</option><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="none">Sem validade</option></select></div></div>
        <Button type="submit" disabled={busy || loading || summary.balance <= 0}>{busy ? "A gerar..." : "Gerar código"}</Button>
        {code && <div className="flex items-center gap-2"><output className="min-w-0 break-all font-mono text-sm">{code}</output><Button variant="ghost" size="icon" aria-label="Copiar código" onClick={() => void navigator.clipboard.writeText(code).then(() => toast.success("Código copiado"))}><Copy /></Button></div>}
      </form>
      <div><h3 className="mb-3 font-semibold">Movimentos recentes</h3>{entries.length === 0 ? <p className="text-sm text-muted-foreground">Sem movimentos.</p> : <ul className="divide-y divide-border">{entries.map(entry => <li key={entry.id} className="flex items-center gap-3 py-3">{entry.kind === "product_payment" ? <ArrowDownLeft className="shrink-0 text-primary" /> : <ArrowUpRight className="shrink-0 text-muted-foreground" />}<div className="min-w-0 flex-1"><p className="text-sm font-medium">{entry.kind === "product_payment" ? "Pagamento de produto" : "Recarga gerada"}</p><p className="break-all text-xs text-muted-foreground">{entry.description}</p><p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("pt-MZ")}</p></div><p className="shrink-0 text-sm font-semibold">{entry.kind === "product_payment" ? "+" : "−"}{formatVb(entry.amount)}</p></li>)}</ul>}</div>
    </>}
  </section>;
}