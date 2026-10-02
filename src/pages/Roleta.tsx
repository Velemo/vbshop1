import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket, TicketPlus, ChevronRight, RefreshCw, UserRound, Globe, X, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, formatVb } from "@/hooks/useWallet";
import { toast } from "sonner";

type Slot = { position: number; image_url: string | null; label: string };
type Hist = { label: string; image_url: string | null; created_at: string };

const PACKS = [{ qty: 1, price: 1.76 }, { qty: 2, price: 2.36 }];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const pos = (i: number) => {
  const a = (-90 + i * 36) * Math.PI / 180;
  return { left: `${50 + 39 * Math.cos(a)}%`, top: `${50 + 39 * Math.sin(a)}%` };
};

const Roleta = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { balance, tickets, refresh } = useWallet();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [hist, setHist] = useState<{ title: string; items: Hist[] } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (supabase as any).from("roulette_slots").select("*").order("position").then(({ data }: any) => setSlots(data || []));
    return () => { alive.current = false; };
  }, []);

  const slot = (i: number) => slots.find(s => s.position === i);
  const requireLogin = () => { if (!session) { navigate("/auth"); return true; } return false; };

  const spin = async () => {
    if (spinning || requireLogin()) return;
    if (tickets < 1) { toast.error("Sem bilhetes. Compre um bilhete para girar."); setBuyOpen(true); return; }
    setSpinning(true); setWinner(null);
    const { data, error } = await (supabase as any).rpc("spin_roulette");
    if (error) { toast.error(error.message); setSpinning(false); return; }
    const target = Number(data);
    refresh();
    let cur = active ?? 0;
    const start = Date.now();
    while (Date.now() - start < 3000) { cur = (cur + 1) % 10; if (!alive.current) return; setActive(cur); await sleep(60); }
    const steps = 10 + ((target - (cur + 10)) % 10 + 10) % 10;
    for (let s = 1; s <= steps; s++) {
      cur = (cur + 1) % 10; if (!alive.current) return; setActive(cur);
      await sleep(70 + Math.pow(s / steps, 2) * 480);
    }
    setWinner(target); setSpinning(false);
    toast.success(`Prémio: ${slot(target)?.label || `Quadrado ${target + 1}`}`);
  };

  const buy = async (qty: number) => {
    if (requireLogin()) return;
    const { error } = await (supabase as any).rpc("buy_tickets", { _qty: qty });
    if (error) { toast.error(error.message); return; }
    toast.success(`${qty} bilhete(s) comprado(s)`); setBuyOpen(false); refresh();
  };

  const openHist = async (global: boolean) => {
    if (requireLogin()) return;
    const { data } = global
      ? await (supabase as any).rpc("global_spins")
      : await (supabase as any).from("roulette_spins").select("label,image_url,created_at").eq("user_id", session!.user.id).order("created_at", { ascending: false }).limit(30);
    setHist({ title: global ? "Histórico Global" : "Meu Histórico", items: data || [] });
  };

  const shown = active != null ? slot(active) : undefined;
  const cardCls = "rounded-2xl border-2 border-roulette bg-card";

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-28 min-h-screen">
      <div className="grid grid-cols-[1.4fr_1fr] gap-3">
        <div className={`${cardCls} flex items-center gap-3 p-3`}>
          <Ticket className="text-roulette shrink-0" size={34} />
          <div className="min-w-0">
            <p className="text-xs">Bilhetes na conta</p>
            <p className="font-display text-2xl font-bold leading-none">{tickets}</p>
            <p className="text-[11px] text-muted-foreground">{tickets ? formatVb(balance) : "(Nenhum)"}</p>
          </div>
        </div>
        <button onClick={() => setBuyOpen(true)} className="rounded-2xl bg-roulette text-roulette-foreground flex items-center justify-center gap-2 p-3 font-display font-bold text-sm leading-tight">
          <TicketPlus size={28} className="shrink-0" /> <span className="text-left">COMPRAR<br />BILHETE</span> <ChevronRight size={16} />
        </button>
      </div>

      <div className="relative mx-auto mt-6 aspect-square w-full">
        <div className="absolute inset-[11%] rounded-full border border-roulette/50" />
        {Array.from({ length: 10 }).map((_, i) => {
          const s = slot(i); const on = active === i; const win = winner === i;
          return (
            <button key={i} disabled={spinning} onClick={() => { setActive(i); setWinner(null); }}
              style={pos(i)}
              className={`absolute w-[19%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 bg-card overflow-hidden transition-all duration-75 ${
                win ? "border-destructive ring-4 ring-destructive shadow-[0_0_24px_hsl(var(--destructive))] scale-110 z-10"
                : on ? "border-destructive shadow-[0_0_18px_hsl(var(--destructive))] scale-105 z-10" : "border-roulette"}`}>
              {s?.image_url && <img src={s.image_url} alt={s.label} className="size-full object-contain p-1" />}
            </button>
          );
        })}
        <div className={`absolute left-1/2 top-1/2 w-[36%] aspect-square -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 bg-card grid place-items-center overflow-hidden p-2 ${
          winner != null ? "border-destructive shadow-[0_0_30px_hsl(var(--destructive))]" : "border-roulette shadow-[0_0_30px_hsl(var(--roulette)/0.6)]"}`}>
          {shown?.image_url ? <img src={shown.image_url} alt={shown.label} className="size-full object-contain" />
            : <Gift className="text-roulette" size={40} />}
          {shown?.label && <span className="absolute bottom-1 inset-x-1 truncate text-center text-[10px] font-semibold bg-card/90 rounded">{shown.label}</span>}
        </div>
      </div>

      <button onClick={spin} disabled={spinning}
        className="mt-6 w-full rounded-full bg-roulette text-roulette-foreground py-4 flex items-center justify-center gap-4 font-display text-2xl font-bold disabled:opacity-70">
        <RefreshCw size={28} className={spinning ? "animate-spin" : ""} /> <span className="h-7 w-px bg-roulette-foreground/40" />
        {spinning ? "A GIRAR..." : "GIRAR"} <ChevronRight />
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={() => openHist(false)} className={`${cardCls} flex items-center gap-2 p-3 text-sm`}><UserRound size={20} /> Meu Histórico <ChevronRight size={16} className="ml-auto" /></button>
        <button onClick={() => openHist(true)} className={`${cardCls} flex items-center gap-2 p-3 text-sm`}><Globe size={20} /> Histórico Global <ChevronRight size={16} className="ml-auto" /></button>
      </div>

      {buyOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur grid place-items-center p-4" onClick={() => setBuyOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-lg">Comprar bilhete</h2>
              <button onClick={() => setBuyOpen(false)}><X size={18} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Saldo: {formatVb(balance)}</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-2">Pacote</th><th>Preço</th><th /></tr></thead>
              <tbody>
                {PACKS.map(p => (
                  <tr key={p.qty} className="border-t border-border">
                    <td className="py-3">{p.qty} bilhete{p.qty > 1 ? "s" : ""}</td>
                    <td>{p.price.toFixed(2)} vb$</td>
                    <td className="text-right"><button onClick={() => buy(p.qty)} className="rounded-lg bg-roulette text-roulette-foreground px-3 py-1.5 font-semibold">Comprar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hist && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur grid place-items-center p-4" onClick={() => setHist(null)}>
          <div className="w-full max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-lg">{hist.title}</h2>
              <button onClick={() => setHist(null)}><X size={18} /></button>
            </div>
            {hist.items.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem giros.</p> : hist.items.map((h, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-border py-2 text-sm">
                {h.image_url ? <img src={h.image_url} alt="" className="size-10 rounded object-contain bg-muted" /> : <Gift size={20} />}
                <span className="flex-1 truncate">{h.label || "Prémio"}</span>
                <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-MZ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

export default Roleta;
