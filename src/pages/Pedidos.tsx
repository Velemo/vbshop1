import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MessageSquareText, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadWithProgress } from "@/lib/upload";
import { formatVb } from "@/hooks/useWallet";
import { toast } from "sonner";

type Order = {
  id: string;
  offer_id: string;
  buyer_id: string;
  buyer_name: string;
  seller_id: string;
  amount_vb: number;
  price_per_vb: number;
  total_mt: number;
  status: string;
  receipt_note: string | null;
  receipt_image_url: string | null;
  dispute_reason: string | null;
  created_at: string;
};

const fmtMt = (n: number) => Number(n || 0).toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "A aguardar comprovativo", className: "bg-muted text-muted-foreground" },
  receipt_sent: { label: "Comprovativo enviado", className: "bg-primary/10 text-primary" },
  rejected: { label: "Comprovativo recusado", className: "bg-destructive/10 text-destructive" },
  confirmed: { label: "Concluído", className: "bg-green-500/10 text-green-600" },
  disputed: { label: "Em disputa", className: "bg-amber-400/15 text-amber-500" },
  cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

/* ---------- Envio de comprovativo (comprador) ---------- */
function ReceiptForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("O comprovativo deve ser uma imagem."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 10 MB."); return; }
    setUploading(true); setPct(0);
    const r = await uploadWithProgress("products", file, setPct, "p2p");
    setUploading(false);
    if (r.error || !r.url) { toast.error(r.error || "Não foi possível enviar a imagem."); return; }
    setUrl(r.url);
    toast.success("Imagem carregada. Envie para o vendedor.");
  };

  const send = async () => {
    if (!note.trim() && !url) { toast.error("Escreva uma nota ou envie a imagem do comprovativo."); return; }
    setSending(true);
    const { error } = await (supabase as any).rpc("p2p_submit_receipt", { _order_id: orderId, _note: note.trim(), _image_url: url || "" });
    setSending(false);
    if (error) { toast.error(error.message || "Não foi possível enviar o comprovativo."); return; }
    toast.success("Comprovativo enviado!");
    onDone();
  };

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Nota (ex.: referência da transferência)" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
      <input type="file" accept="image/*" className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-sm" disabled={uploading} onChange={e => { void upload(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      {uploading && (
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-xs text-muted-foreground">A carregar comprovativo… {pct}%</p>
        </div>
      )}
      {url && <p className="mt-1 flex items-center gap-1 text-xs text-green-600"><BadgeCheck size={14} /> Imagem carregada</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={send} disabled={sending || uploading}>{sending ? "A enviar..." : "Enviar comprovativo"}</Button>
        <Button size="sm" variant="outline" onClick={onDone}>Fechar</Button>
      </div>
    </div>
  );
}

/* ---------- Comunicar problema ---------- */
function DisputeForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!reason.trim()) { toast.error("Descreva o problema para o administrador."); return; }
    setSending(true);
    const { error } = await (supabase as any).rpc("p2p_report_dispute", { _order_id: orderId, _reason: reason.trim() });
    setSending(false);
    if (error) { toast.error(error.message || "Não foi possível comunicar o problema."); return; }
    toast.success("Problema comunicado ao administrador. A negociação ficou em disputa.");
    onDone();
  };
  return (
    <div className="mt-3 rounded-xl border border-amber-400/50 bg-amber-400/5 p-3">
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Descreva o problema (pagamento não recebido, valor errado...)" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={send} disabled={sending}>{sending ? "A enviar..." : "Comunicar ao ADM"}</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Fechar</Button>
      </div>
    </div>
  );
}

function OrderCard({ order, side, onChanged }: { order: Order; side: "buyer" | "seller"; onChanged: () => void }) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = STATUS[order.status] ?? { label: order.status, className: "bg-muted text-muted-foreground" };

  const call = async (fn: string, msg: string) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc(fn, { _order_id: order.id });
    setBusy(false);
    if (error) { toast.error(error.message || "Não foi possível concluir."); return; }
    toast.success(msg);
    onChanged();
  };

  const isBuyer = side === "buyer";
  return (
    <article className="rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{formatVb(Number(order.amount_vb))} · {fmtMt(Number(order.total_mt))} MT</p>
          <p className="text-xs text-muted-foreground">
            {isBuyer ? `Vendedor: oferta de ${fmtMt(Number(order.price_per_vb))} MT/vb$` : `Comprador: ${order.buyer_name}`} · {new Date(order.created_at).toLocaleString("pt-PT")}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>
      </div>

      {order.receipt_note && <p className="mt-2 text-sm text-muted-foreground">Nota: {order.receipt_note}</p>}
      {order.receipt_image_url && (
        <a href={order.receipt_image_url} target="_blank" rel="noreferrer" className="mt-2 block">
          <img src={order.receipt_image_url} alt="Comprovativo" className="max-h-40 rounded-lg border border-border object-contain" />
        </a>
      )}
      {order.dispute_reason && (
        <p className="mt-2 rounded-lg bg-amber-400/10 p-2 text-sm text-amber-600"><ShieldAlert size={14} className="mr-1 inline" /> {order.dispute_reason}</p>
      )}

      {/* Ações do comprador */}
      {isBuyer && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(order.status === "pending" || order.status === "rejected") && (
            <Button size="sm" onClick={() => { setShowReceipt(v => !v); setShowDispute(false); }}>
              {order.status === "rejected" ? "Reenviar comprovativo" : "Enviar comprovativo"}
            </Button>
          )}
          {order.status === "pending" && <Button size="sm" variant="outline" onClick={() => void call("p2p_cancel_order", "Pedido cancelado.")} disabled={busy}>Cancelar pedido</Button>}
          {["pending", "receipt_sent", "rejected"].includes(order.status) && (
            <Button size="sm" variant="ghost" onClick={() => { setShowDispute(v => !v); setShowReceipt(false); }}>Comunicar problema</Button>
          )}
        </div>
      )}

      {/* Ações do vendedor */}
      {!isBuyer && (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === "receipt_sent" && (
            <>
              <Button size="sm" onClick={() => void call("p2p_confirm_order", "Pagamento confirmado. vb$ enviados ao comprador.")} disabled={busy}>Confirmar pagamento</Button>
              <Button size="sm" variant="outline" onClick={() => void call("p2p_reject_order", "Comprovativo recusado. O comprador pode reenviar.")} disabled={busy}>Recusar comprovativo</Button>
            </>
          )}
          {["pending", "receipt_sent", "rejected"].includes(order.status) && (
            <Button size="sm" variant="ghost" onClick={() => { setShowDispute(v => !v); }}>Comunicar problema</Button>
          )}
          {order.status === "pending" && <p className="text-xs text-muted-foreground">A aguardar o comprovativo do comprador.</p>}
        </div>
      )}

      {showReceipt && <ReceiptForm orderId={order.id} onDone={() => { setShowReceipt(false); onChanged(); }} />}
      {showDispute && <DisputeForm orderId={order.id} onDone={() => { setShowDispute(false); onChanged(); }} />}
    </article>
  );
}

/* ---------- Resolução de disputas (ADM) ---------- */
function DisputeCard({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const resolve = async (release: boolean) => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("p2p_resolve_dispute", { _order_id: order.id, _release: release });
    setBusy(false);
    if (error) { toast.error(error.message || "Não foi possível resolver a disputa."); return; }
    toast.success(release ? "vb$ libertados para o comprador." : "Valor devolvido ao vendedor.");
    onChanged();
  };
  return (
    <article className="rounded-2xl border border-amber-400/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{formatVb(Number(order.amount_vb))} · {fmtMt(Number(order.total_mt))} MT</p>
          <p className="text-xs text-muted-foreground">Comprador: {order.buyer_name} · Vendedor (oferta #{order.offer_id.slice(0, 8)})</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-500">Disputa</span>
      </div>
      <p className="mt-2 rounded-lg bg-amber-400/10 p-2 text-sm text-amber-600">{order.dispute_reason}</p>
      {order.receipt_image_url && (
        <a href={order.receipt_image_url} target="_blank" rel="noreferrer"><img src={order.receipt_image_url} alt="Comprovativo" className="mt-2 max-h-40 rounded-lg border border-border object-contain" /></a>
      )}
      {order.receipt_note && <p className="mt-1 text-sm text-muted-foreground">Nota: {order.receipt_note}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void resolve(true)} disabled={busy}>Libertar vb$ ao comprador</Button>
        <Button size="sm" variant="outline" onClick={() => void resolve(false)} disabled={busy}>Devolver ao vendedor</Button>
      </div>
    </article>
  );
}

const Pedidos = () => {
  const { session, loading, isAdmin } = useAuth();
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [sellerOrders, setSellerOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<Order[]>([]);
  const [isVip, setIsVip] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    const [b, s, d, vip] = await Promise.all([
      (supabase as any).from("p2p_orders").select("*").eq("buyer_id", uid).order("created_at", { ascending: false }),
      (supabase as any).from("p2p_orders").select("*").eq("seller_id", uid).order("created_at", { ascending: false }),
      isAdmin ? (supabase as any).from("p2p_orders").select("*").eq("status", "disputed").order("updated_at", { ascending: false }) : Promise.resolve({ data: [] }),
      (supabase as any).from("vip_memberships").select("user_id").eq("user_id", uid).maybeSingle(),
    ]);
    setBuyerOrders(b.data || []);
    setSellerOrders((s.data || []).filter((o: Order) => o.buyer_id !== uid));
    setDisputes(d.data || []);
    setIsVip(!!vip.data);
    setPageLoading(false);
  }, [session?.user.id, isAdmin]);

  useEffect(() => { void load(); }, [load]);

  if (loading || pageLoading) return <div className="grid min-h-[70vh] place-items-center"><div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!session) return <Navigate to="/auth" replace />;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col px-3 pb-24 pt-3 sm:px-5">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/perfil" aria-label="Voltar ao perfil" className="grid size-10 shrink-0 place-items-center rounded-full border border-border hover:bg-muted"><ArrowLeft size={19} /></Link>
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><MessageSquareText size={23} /></div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Negociações P2P de vb$</p>
        </div>
      </header>

      {isAdmin && disputes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Disputas para resolver</h2>
          <div className="space-y-3">{disputes.map(o => <DisputeCard key={o.id} order={o} onChanged={() => void load()} />)}</div>
        </section>
      )}

      {(isVip || isAdmin) && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Vendas recebidas</h2>
          {sellerOrders.length === 0
            ? <p className="text-sm text-muted-foreground">Ainda não recebeu pedidos de compra. Crie ofertas na página P2P.</p>
            : <div className="space-y-3">{sellerOrders.map(o => <OrderCard key={o.id} order={o} side="seller" onChanged={() => void load()} />)}</div>}
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">As minhas compras</h2>
        {buyerOrders.length === 0
          ? <p className="text-sm text-muted-foreground">Ainda não comprou vb$. Veja as ofertas na página P2P.</p>
          : <div className="space-y-3">{buyerOrders.map(o => <OrderCard key={o.id} order={o} side="buyer" onChanged={() => void load()} />)}</div>}
      </section>
    </main>
  );
};

export default Pedidos;
