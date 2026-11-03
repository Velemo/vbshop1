import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Row = { user_id: string; user_code: string | null; display_name: string | null; avatar_url: string | null; full_name: string | null; phone: string | null; email: string | null; spins: number; wins_total: number; last_spin: string | null };

const RouletteAdmin = ({ onReset }: { onReset?: () => void }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [resetAt, setResetAt] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await (supabase as any).rpc("admin_roulette_stats");
    if (error) toast.error(error.message); else setRows(data || []);
    const { data: st } = await (supabase as any).from("roulette_settings").select("reset_at").eq("id", 1).maybeSingle();
    setResetAt(st?.reset_at && new Date(st.reset_at).getFullYear() > 1970 ? st.reset_at : null);
  };
  useEffect(() => { load(); }, []);

  const reset = async () => {
    const { error } = await (supabase as any).rpc("admin_reset_roulette");
    if (error) { toast.error(error.message); return; }
    toast.success("Roleta reiniciada. Prémios e códigos entregues foram mantidos.");
    load(); onReset?.();
  };

  const total = rows.reduce((s, r) => s + Number(r.spins), 0);
  const term = q.trim().toLowerCase();
  const list = rows.filter(r => !term || [r.full_name, r.display_name, r.user_code, r.phone, r.email].some(v => v?.toLowerCase().includes(term)));

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h2 className="font-display font-semibold">Administração da Roleta</h2>
          <p className="text-xs text-muted-foreground">Total de giros: <b className="text-foreground">{total}</b>{resetAt && ` · desde ${new Date(resetAt).toLocaleString("pt-PT")}`}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border" aria-label="Atualizar"><RefreshCw size={14} /></button>
          <button onClick={() => setConfirm(true)} className="px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold">Reiniciar Roleta</button>
        </div>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar nome, ID, contacto ou e-mail" className="w-full p-2 rounded-lg bg-background border border-border text-sm" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left">
            <tr><th className="p-1.5">Utilizador</th><th className="p-1.5">Contacto</th><th className="p-1.5">E-mail</th><th className="p-1.5 text-right">Giros</th><th className="p-1.5 text-right">Prémios</th></tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r.user_id} className="border-t border-border">
                <td className="p-1.5"><div className="font-medium">{r.full_name || r.display_name || "Utilizador"}</div><div className="text-muted-foreground">{r.user_code}</div></td>
                <td className="p-1.5 whitespace-nowrap">{r.phone ? <a href={`tel:${r.phone}`} className="text-primary">{r.phone}</a> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-1.5 break-all">{r.email ? <a href={`mailto:${r.email}`} className="text-primary">{r.email}</a> : <span className="text-muted-foreground">—</span>}</td>
                <td className="p-1.5 text-right font-semibold">{r.spins}</td>
                <td className="p-1.5 text-right">{r.wins_total}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Sem dados</td></tr>}
          </tbody>
        </table>
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar a roleta?</AlertDialogTitle>
            <AlertDialogDescription>Zera os giros gerais, individuais e os contadores de metas. Percentagens, regras, prémios, metas configuradas, prémios ganhos e códigos entregues ficam intactos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={reset}>Reiniciar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RouletteAdmin;
