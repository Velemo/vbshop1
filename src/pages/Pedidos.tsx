import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Send, ShieldAlert } from "lucide-react";
import VipBadge from "@/components/VipBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadWithProgress } from "@/lib/upload";
import { formatVb } from "@/hooks/useWallet";
import { toast } from "sonner";
import { isActiveP2POrder, uniqueP2POrders } from "@/lib/p2p-orders";
import P2PReceiptDeadline from "@/components/P2PReceiptDeadline";

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

function OrderCard({ order, side, onChanged, adminView = false }: { order: Order; side: "buyer" | "seller"; onChanged: () => void; adminView?: boolean }) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = STATUS[order.status] ?? { label: order.status, className: "bg-muted text-muted-foreground" };

  const call = async (fn: string, msg: string) => {
    if (!window.confirm(fn === "p2p_confirm_order" ? "Tem a certeza que quer APROVAR este pedido? As vb$ serão libertadas e o negócio fica fechado." : "Tem a certeza que quer CANCELAR este pedido? O negócio fica fechado.")) return;
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
      {order.status === "pending" && <P2PReceiptDeadline createdAt={order.created_at} />}
      {order.receipt_image_url && (
        <a href={order.receipt_image_url} target="_blank" rel="noreferrer" className="mt-2 block">
          <img src={order.receipt_image_url} alt="Comprovativo" className="max-h-40 rounded-lg border border-border object-contain" />
        </a>
      )}
      {order.dispute_reason && (
        <p className="mt-2 rounded-lg bg-amber-400/10 p-2 text-sm text-amber-600"><ShieldAlert size={14} className="mr-1 inline" /> {order.dispute_reason}</p>
      )}

      {/* Ações do comprador */}
      {isBuyer && !adminView && (
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
      {!isBuyer && !adminView && (
        <div className="mt-3 flex flex-wrap gap-2">
          {order.status === "receipt_sent" && (
            <>
              <Button size="sm" onClick={() => void call("p2p_confirm_order", "Pagamento confirmado. vb$ enviados ao comprador.")} disabled={busy}>Aprovar</Button>
              <Button size="sm" variant="outline" onClick={() => void call("p2p_cancel_order", "Pedido cancelado.")} disabled={busy}>Cancelar</Button>
            </>
          )}
          {["pending", "rejected"].includes(order.status) && <Button size="sm" variant="outline" onClick={() => void call("p2p_cancel_order", "Pedido cancelado.")} disabled={busy}>Cancelar</Button>}
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

type Msg = { id: string; user_id: string; from_admin: boolean; kind: string; body: string; order_id: string | null; created_at: string };
type Thread = { user_id: string; display_name: string; avatar_url: string | null; user_code: string | null; vip: boolean; last_body: string; last_at: string; last_from_admin: boolean };

function AdminOrderActions({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const call = async (fn: string, args: Record<string, unknown>, msg: string) => {
    const approve = fn === "p2p_confirm_order" || args._release === true;
    if (!window.confirm(approve ? "Tem a certeza que quer APROVAR este pedido? As vb$ serão libertadas e o negócio fica fechado." : "Tem a certeza que quer CANCELAR este pedido? O negócio fica fechado.")) return;
    setBusy(true);
    const { error } = await (supabase as any).rpc(fn, args);
    setBusy(false);
    if (error) { toast.error(error.message || "Não foi possível concluir."); return; }
    toast.success(msg); onChanged();
  };
  if (order.status === "receipt_sent") return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Button size="sm" onClick={() => void call("p2p_confirm_order", { _order_id: order.id }, "Pedido aprovado.")} disabled={busy}>Aprovar</Button>
      <Button size="sm" variant="outline" onClick={() => void call("p2p_cancel_order", { _order_id: order.id }, "Pedido cancelado.")} disabled={busy}>Cancelar</Button>
    </div>
  );
  if (order.status === "disputed") return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Button size="sm" onClick={() => void call("p2p_resolve_dispute", { _order_id: order.id, _release: true }, "vb$ libertados ao comprador.")} disabled={busy}>Aprovar (libertar vb$)</Button>
      <Button size="sm" variant="outline" onClick={() => void call("p2p_resolve_dispute", { _order_id: order.id, _release: false }, "Pedido rejeitado e cancelado.")} disabled={busy}>Cancelar</Button>
    </div>
  );
  return null;
}

function ChatView({ userId, adminView, title, vip, avatar, onBack }: { userId: string; adminView: boolean; title: string; vip?: boolean; avatar?: string | null; onBack?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [text, setText] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [sending, setSending] = useState(false);
  const loadVersion = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    await supabase.rpc("p2p_purchase_status");
    const [m, o] = await Promise.all([
      (supabase as any).from("chat_messages").select("*").eq("user_id", userId).order("created_at", { ascending: true }).limit(500),
      (supabase as any).from("p2p_orders").select("*").or(`buyer_id.eq.${userId},seller_id.eq.${userId}`).order("created_at", { ascending: false }),
    ]);
    if (version !== loadVersion.current) return;
    if (m.error || o.error) { toast.error("Não foi possível atualizar a conversa."); return; }
    setMsgs(m.data || []); setOrders(uniqueP2POrders((o.data || []) as Order[]));
  }, [userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`chat-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${userId}` }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "p2p_orders", filter: `buyer_id=eq.${userId}` }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "p2p_orders", filter: `seller_id=eq.${userId}` }, () => { void load(); })
      .subscribe(() => { void load(); });
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    return () => { loadVersion.current++; supabase.removeChannel(ch); clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [userId, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const { error } = await (supabase as any).rpc("chat_send", { _user_id: adminView ? userId : null, _body: text.trim(), _order_id: orderRef || null });
    setSending(false);
    if (error) { toast.error(error.message || "Não foi possível enviar."); return; }
    setText(""); setOrderRef(""); void load();
  };

  const orderById = (id: string | null) => orders.find(o => o.id === id);

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-28">
      <div className="sticky top-0 z-30 -mx-3 mb-2 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5">
        {onBack && <Button variant="outline" size="icon" onClick={onBack} aria-label="Voltar"><ArrowLeft size={17} /></Button>}
        {avatar ? <img src={avatar} alt="" className="size-9 shrink-0 rounded-full object-cover" /> : <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{title[0]}</div>}
        <p className="flex min-w-0 items-center gap-1 font-semibold"><span className="truncate">{title}</span>{vip && <VipBadge />}</p>
      </div>

      <div className="min-h-[40vh] flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-muted/20 p-3">
        {msgs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há mensagens. Escreva para {adminView ? "o utilizador" : "o ADM"}.</p>}
        {msgs.map(m => {
          if (m.kind === "status") return (
            <p key={m.id} className="mx-auto w-fit max-w-[90%] rounded-full bg-primary/10 px-3 py-1 text-center text-xs text-primary">
              {m.body} · {new Date(m.created_at).toLocaleString("pt-PT")}
            </p>
          );
          const mine = adminView ? m.from_admin : !m.from_admin;
          const o = orderById(m.order_id);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                {!mine && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold opacity-80">{m.from_admin ? "ADM" : title}{!m.from_admin && vip && <VipBadge />}</p>}
                {o && <p className="mb-1 text-[11px] opacity-80">Pedido: {formatVb(Number(o.amount_vb))} · {fmtMt(Number(o.total_mt))} MT</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="mt-0.5 text-right text-[10px] opacity-70">{new Date(m.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          );
        })}
        {orders.filter(isActiveP2POrder).map(o => (
          <div key={o.id} className="pt-2">
            <OrderCard order={o} side={o.buyer_id === userId ? "buyer" : "seller"} adminView={adminView} onChanged={() => void load()} />
            {adminView && <AdminOrderActions order={o} onChanged={() => void load()} />}
          </div>
        ))}
        {orders.some(o => !isActiveP2POrder(o)) && (
          <details className="pt-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">Histórico P2P</summary>
            <div className="mt-2 space-y-2">{orders.filter(o => !isActiveP2POrder(o)).map(o => <OrderCard key={o.id} order={o} side={o.buyer_id === userId ? "buyer" : "seller"} adminView={adminView} onChanged={() => void load()} />)}</div>
          </details>
        )}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 mx-auto w-full max-w-3xl space-y-2 border-t border-border bg-background/95 px-3 py-2 backdrop-blur sm:px-5">
        {orders.length > 0 && (
          <select value={orderRef} onChange={e => setOrderRef(e.target.value)} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
            <option value="">Sem pedido associado</option>
            {orders.map(o => <option key={o.id} value={o.id}>{formatVb(Number(o.amount_vb))} · {fmtMt(Number(o.total_mt))} MT · {STATUS[o.status]?.label ?? o.status}</option>)}
          </select>
        )}
        <div className="flex gap-2">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={1} maxLength={2000} placeholder="Escreva uma mensagem…"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            className="flex-1 resize-none rounded-xl border border-border bg-background p-2 text-sm" />
          <Button onClick={() => void send()} disabled={sending || !text.trim()} aria-label="Enviar"><Send size={16} /></Button>
        </div>
      </div>
    </div>
  );
}

function AdminInbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [disputes, setDisputes] = useState<Order[]>([]);
  const [sel, setSel] = useState<Thread | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([
      (supabase as any).rpc("admin_chat_threads"),
      (supabase as any).from("p2p_orders").select("*").eq("status", "disputed").order("updated_at", { ascending: false }),
    ]);
    setThreads(((t.data || []) as Thread[]).sort((a, b) => b.last_at.localeCompare(a.last_at)));
    setDisputes(d.data || []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`admin-inbox-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "p2p_orders" }, () => { void load(); })
      .subscribe(() => { void load(); });
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(timer); };
  }, [load]);

  if (sel) return <ChatView userId={sel.user_id} adminView title={sel.display_name} vip={sel.vip} avatar={sel.avatar_url} onBack={() => { setSel(null); void load(); }} />;

  const s = q.trim().toLowerCase();
  const list = threads.filter(t => !s || t.display_name.toLowerCase().includes(s) || (t.user_code || "").toLowerCase().includes(s));
  return (
    <div>
      {disputes.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-semibold">Disputas para resolver</h2>
          <div className="space-y-3">{disputes.map(o => <DisputeCard key={o.id} order={o} onChanged={() => void load()} />)}</div>
        </section>
      )}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar por nome ou ID" className="mb-3 w-full rounded-xl border border-border bg-background p-2 text-sm" />
      {list.length === 0 && <p className="text-sm text-muted-foreground">Sem conversas.</p>}
      <div className="space-y-2">
        {list.map(t => (
          <button key={t.user_id} onClick={() => setSel(t)} className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left hover:bg-muted/50">
            {t.avatar_url ? <img src={t.avatar_url} alt="" className="size-10 shrink-0 rounded-full object-cover" /> : <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">{t.display_name[0]}</div>}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 font-semibold"><span className="truncate">{t.display_name}</span>{t.vip && <VipBadge />}<span className="ml-1 text-xs font-normal text-muted-foreground">{t.user_code}</span></p>
              <p className="truncate text-xs text-muted-foreground">{t.last_from_admin ? "Você/Sistema: " : ""}{t.last_body}</p>
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(t.last_at).toLocaleDateString("pt-PT")}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const Pedidos = () => {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <div className="grid min-h-[70vh] place-items-center"><div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!session) return <Navigate to="/auth" replace />;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-3 pb-24 pt-3 sm:px-5">
      {isAdmin ? <AdminInbox /> : <ChatView userId={session.user.id} adminView={false} title="ADM" />}
    </main>
  );
};

export default Pedidos;
