import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Crown, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, formatVb } from "@/hooks/useWallet";
import { uploadWithProgress } from "@/lib/upload";
import { toast } from "sonner";
import { ACTIVE_P2P_STATUSES } from "@/lib/p2p-orders";
import { useIsVip } from "@/hooks/useIsVip";

type Offer = {
  id: string;
  seller_id: string;
  seller_name: string;
  amount_vb: number;
  sold_vb: number;
  reserved_vb: number;
  price_per_vb: number;
  mpesa_number: string | null;
  emola_number: string | null;
  mpesa_name: string | null;
  emola_name: string | null;
  status: string;
};

const available = (o: Offer) => Number(o.amount_vb) - Number(o.sold_vb) - Number(o.reserved_vb);
const fmtMt = (n: number) => Number(n || 0).toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const methods = (o: Offer) => [o.mpesa_number ? "M-Pesa" : null, o.emola_number ? "e-Mola" : null].filter(Boolean) as string[];

/* ---------- Painel de compra ---------- */
function BuyPanel({ offer, minBuy, onDone }: { offer: Offer; minBuy: number; onDone: () => void }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [qty, setQty] = useState("");
  const [order, setOrder] = useState<{ id: string; total_mt: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [sending, setSending] = useState(false);

  const createOrder = async () => {
    if (!session) { navigate("/auth"); return; }
    const value = Number(qty);
    if (!Number.isFinite(value) || value <= 0) { toast.error("Indique a quantidade de vb$ que quer comprar."); return; }
    if (minBuy > 0 && value < minBuy) { toast.error(`A compra mínima é de ${formatVb(minBuy)}.`); return; }
    if (value > available(offer)) { toast.error("Quantidade indisponível nesta oferta."); return; }
    setCreating(true);
    const { data, error } = await (supabase as any).rpc("p2p_create_order", { _offer_id: offer.id, _amount_vb: value });
    setCreating(false);
    if (error) { toast.error(error.message || "Não foi possível reservar."); return; }
    setOrder({ id: data as string, total_mt: Number((value * Number(offer.price_per_vb)).toFixed(2)) });
  };

  const uploadReceipt = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("O comprovativo deve ser uma imagem."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("A imagem deve ter no máximo 10 MB."); return; }
    setUploading(true); setUploadPct(0);
    const result = await uploadWithProgress("products", file, setUploadPct, "p2p");
    setUploading(false);
    if (result.error || !result.url) { toast.error(result.error || "Não foi possível enviar a imagem."); return; }
    setReceiptUrl(result.url);
    toast.success("Comprovativo carregado. Envie para o vendedor.");
  };

  const sendReceipt = async () => {
    if (!order) return;
    if (!note.trim() && !receiptUrl) { toast.error("Escreva uma nota ou envie a imagem do comprovativo."); return; }
    setSending(true);
    const { error } = await (supabase as any).rpc("p2p_submit_receipt", { _order_id: order.id, _note: note.trim(), _image_url: receiptUrl || "" });
    setSending(false);
    if (error) { toast.error(error.message || "Não foi possível enviar o comprovativo."); return; }
    toast.success("Comprovativo enviado! O vendedor recebeu o pedido.");
    onDone();
  };

  const cancelOrder = async () => {
    if (!order) return;
    setCreating(true);
    const { error } = await (supabase as any).rpc("p2p_cancel_order", { _order_id: order.id });
    setCreating(false);
    if (error) { toast.error(error.message || "Não foi possível cancelar."); return; }
    toast.success("Reserva cancelada.");
    onDone();
  };

  if (!order) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
        <p className="text-sm font-semibold">Comprar de {offer.seller_name}</p>
        <p className="mt-1 text-xs text-muted-foreground">Disponível: {formatVb(available(offer))} · {fmtMt(Number(offer.price_per_vb))} MT por vb${minBuy > 0 ? ` · Mínimo ${formatVb(minBuy)}` : ""}</p>
        <div className="mt-3">
          <label htmlFor="p2p-qty" className="mb-1 block text-sm font-medium">Quantidade de vb$</label>
          <input id="p2p-qty" type="number" min="0.01" step="any" value={qty} onChange={e => setQty(e.target.value)} placeholder="Ex.: 5" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
        </div>
        <p className="mt-2 text-sm">Total: <span className="font-bold">{fmtMt(Number(qty) * Number(offer.price_per_vb))} MT</span></p>
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={createOrder} disabled={creating}>{creating ? "A reservar..." : "Reservar e ver pagamento"}</Button>
          <Button variant="outline" onClick={onDone}>Voltar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="text-sm font-semibold">Passo 2 · Pagamento ao vendedor</p>
      <p className="mt-1 text-sm">Total a pagar: <span className="font-bold">{fmtMt(order.total_mt)} MT</span> por {formatVb(Number(qty))}</p>
      <div className="mt-3 space-y-2 rounded-xl border border-border bg-background p-3 text-sm">
        {offer.mpesa_number && <p><span className="font-semibold">M-Pesa:</span> {offer.mpesa_number}{offer.mpesa_name ? ` — ${offer.mpesa_name}` : ""}</p>}
        {offer.emola_number && <p><span className="font-semibold">e-Mola:</span> {offer.emola_number}{offer.emola_name ? ` — ${offer.emola_name}` : ""}</p>}
        <p className="text-xs text-muted-foreground">Transfira o valor exato e envie o comprovativo abaixo.</p>
      </div>
      <div className="mt-3">
        <label htmlFor="p2p-note" className="mb-1 block text-sm font-medium">Nota (opcional)</label>
        <textarea id="p2p-note" value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Ex.: referência da transferência" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
      </div>
      <div className="mt-3">
        <label htmlFor="p2p-receipt" className="mb-1 block text-sm font-medium">Imagem do comprovativo (opcional)</label>
        <input id="p2p-receipt" type="file" accept="image/*" className="w-full rounded-lg border border-border bg-background p-2 text-sm" disabled={uploading} onChange={e => { void uploadReceipt(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        {uploading && (
          <div className="mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} /></div>
            <p className="mt-1 text-xs text-muted-foreground">A carregar comprovativo… {uploadPct}%</p>
          </div>
        )}
        {receiptUrl && <p className="mt-1 flex items-center gap-1 text-xs text-green-600"><BadgeCheck size={14} /> Imagem carregada</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <Button className="flex-1" onClick={sendReceipt} disabled={sending || uploading}>{sending ? "A enviar..." : "Enviar comprovativo"}</Button>
        <Button variant="outline" onClick={cancelOrder} disabled={creating}>Cancelar reserva</Button>
      </div>
    </div>
  );
}

/* ---------- Formulário VIP de criação de oferta ---------- */
function CreateOfferForm({ balance, minPrice, onCreated }: { balance: number; minPrice: number; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [mpesa, setMpesa] = useState(false);
  const [emola, setEmola] = useState(false);
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [emolaNumber, setEmolaNumber] = useState("");
  const [mpesaName, setMpesaName] = useState("");
  const [emolaName, setEmolaName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = Number(amount), unit = Number(price);
    if (!Number.isFinite(value) || value <= 0) { toast.error("Indique quantos vb$ quer vender."); return; }
    if (value > balance) { toast.error("Só pode vender até ao seu saldo disponível."); return; }
    if (!Number.isFinite(unit) || unit <= 0) { toast.error("Indique o preço de cada vb$ em meticais."); return; }
    if (minPrice > 0 && unit < minPrice) { toast.error(`O preço mínimo por vb$ definido pelo ADM é ${fmtMt(minPrice)} MT.`); return; }
    if (!mpesa && !emola) { toast.error("Escolha M-Pesa, e-Mola ou ambos."); return; }
    if (mpesa && !mpesaNumber.trim()) { toast.error("Indique o número M-Pesa que recebe os pagamentos."); return; }
    if (emola && !emolaNumber.trim()) { toast.error("Indique o número e-Mola que recebe os pagamentos."); return; }
    if (mpesa && !mpesaName.trim()) { toast.error("Indique o nome responsável pelo número M-Pesa."); return; }
    if (emola && !emolaName.trim()) { toast.error("Indique o nome responsável pelo número e-Mola."); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("p2p_create_offer", {
      _amount_vb: value, _price_per_vb: unit,
      _mpesa_number: mpesa ? mpesaNumber.trim() : "", _emola_number: emola ? emolaNumber.trim() : "",
      _mpesa_name: mpesa ? mpesaName.trim() : "", _emola_name: emola ? emolaName.trim() : "",
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Não foi possível criar a oferta."); return; }
    toast.success("Oferta criada! O valor vendido fica reservado até concluir as vendas.");
    setAmount(""); setPrice(""); onCreated();
  };

  return (
    <div className="rounded-2xl border border-amber-400/50 bg-amber-400/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Crown size={18} className="text-amber-400" /> Criar oferta de venda de vb$</p>
      <p className="mt-1 text-xs text-muted-foreground">O valor anunciado fica reservado do seu saldo durante as negociações.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="offer-amount" className="mb-1 block text-sm font-medium">vb$ a vender (saldo: {formatVb(balance)})</label>
          <input id="offer-amount" type="number" min="0.01" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ex.: 20" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
        </div>
        <div>
          <label htmlFor="offer-price" className="mb-1 block text-sm font-medium">Preço por vb$ (MT){minPrice > 0 ? ` · mínimo ${fmtMt(minPrice)} MT` : ""}</label>
          <input id="offer-price" type="number" min="0.01" step="any" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ex.: 90" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mpesa} onChange={e => setMpesa(e.target.checked)} /> M-Pesa</label>
          {mpesa && (
            <div className="mt-2 space-y-2">
              <input value={mpesaNumber} onChange={e => setMpesaNumber(e.target.value)} placeholder="Número que recebe o pagamento" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
              <input value={mpesaName} onChange={e => setMpesaName(e.target.value)} placeholder="Nome responsável pelo número" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={emola} onChange={e => setEmola(e.target.checked)} /> e-Mola</label>
          {emola && (
            <div className="mt-2 space-y-2">
              <input value={emolaNumber} onChange={e => setEmolaNumber(e.target.value)} placeholder="Número que recebe o pagamento" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
              <input value={emolaName} onChange={e => setEmolaName(e.target.value)} placeholder="Nome responsável pelo número" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
            </div>
          )}
        </div>
      </div>
      <Button className="mt-3 w-full" onClick={submit} disabled={saving}>{saving ? "A criar..." : "Publicar oferta"}</Button>
    </div>
  );
}

/* ---------- Página ---------- */
export default function P2P() {
  const { session } = useAuth();
  const { balance, refresh } = useWallet();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [myOffers, setMyOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [buying, setBuying] = useState<Offer | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [minBuy, setMinBuy] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [onlineSellers, setOnlineSellers] = useState<Set<string>>(new Set());
  const vipActive = useIsVip();

  const load = useCallback(async () => {
    const [{ data, error }, current, settings, online] = await Promise.all([
      supabase.from("p2p_offers").select("*").order("created_at", { ascending: false }),
      session ? supabase.from("p2p_orders").select("id").eq("buyer_id", session.user.id).in("status", [...ACTIVE_P2P_STATUSES]).maybeSingle() : Promise.resolve({ data: null, error: null }),
      (supabase as any).from("p2p_settings").select("min_buy_vb,min_price_per_vb").eq("id", 1).maybeSingle(),
      (supabase as any).rpc("p2p_online_sellers"),
    ]);
    if (error || current.error) { toast.error("Não foi possível atualizar os pedidos P2P."); return; }
    setActiveOrderId(current.data?.id ?? null);
    setMinBuy(Number(settings.data?.min_buy_vb || 0));
    setMinPrice(Number(settings.data?.min_price_per_vb || 0));
    const onlineSet = new Set<string>((online.data || []) as string[]);
    setOnlineSellers(onlineSet);
    const all = (data || []) as Offer[];
    const active = all.filter(o => o.status === "active");
    // Ofertas de vendedores online no site aparecem primeiro.
    active.sort((a, b) => Number(onlineSet.has(b.seller_id)) - Number(onlineSet.has(a.seller_id)));
    setOffers(active);
    setMyOffers(all.filter(o => o.status === "active" && session && o.seller_id === session.user.id));
    setLoading(false);
  }, [session?.user.id]);

  useEffect(() => {
    void load();
  }, [session?.user.id, load]);
  useEffect(() => { setIsVip(vipActive); }, [vipActive]);
  useEffect(() => {
    const channel = supabase.channel(`p2p-market-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "p2p_offers" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "p2p_orders" }, () => { void load(); })
      .subscribe(() => { void load(); });
    const onFocus = () => { void load(); };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    return () => { void supabase.removeChannel(channel); window.removeEventListener("focus", onFocus); clearInterval(timer); };
  }, [load]);

  const cancelOffer = async (o: Offer) => {
    const { data: open } = await supabase.from("p2p_orders").select("id,buyer_name,amount_vb,total_mt,status").eq("offer_id", o.id).in("status", [...ACTIVE_P2P_STATUSES]);
    if (open && open.length > 0) {
      const list = open.map((x: any) => `• ${x.buyer_name}: ${formatVb(Number(x.amount_vb))} (${fmtMt(Number(x.total_mt))} MT)`).join("\n");
      window.alert(`Esta oferta tem negócios abertos:\n${list}\n\nAprove ou cancele estes pedidos em Pedidos antes de cancelar a oferta.`);
      return;
    }
    if (!window.confirm("Tem a certeza que quer cancelar esta oferta?")) return;
    const { data, error } = await (supabase as any).rpc("p2p_cancel_offer", { _offer_id: o.id });
    if (error) { toast.error(error.message || "Não foi possível cancelar a oferta."); return; }
    toast.success(`Oferta cancelada. ${formatVb(Number(data))} devolvidos ao saldo.`);
    await Promise.all([load(), refresh()]);
  };

  return (
    <main className="mx-auto max-w-xl px-4 pt-6 pb-28">
      <Link to="/perfil" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={18} /> Voltar ao perfil</Link>
      {!session ? (
        <Button asChild className="mt-4 w-full"><Link to="/auth">Entrar para comprar</Link></Button>
      ) : isVip ? (
        <div className="mt-5">
          {showCreate ? (
            <div className="relative">
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Fechar" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full hover:bg-muted"><X size={16} /></button>
              <CreateOfferForm balance={balance} minPrice={minPrice} onCreated={async () => { setShowCreate(false); await Promise.all([load(), refresh()]); }} />
            </div>
          ) : (
            <Button className="w-full" onClick={() => setShowCreate(true)}>Criar oferta de venda</Button>
          )}
          {myOffers.length > 0 && (
            <section className="mt-4">
              <h2 className="mb-2 text-sm font-semibold">As minhas ofertas</h2>
              <div className="space-y-2">
                {myOffers.map(o => (
                  <div key={o.id} className="rounded-2xl border border-border p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{formatVb(Number(o.amount_vb))} · {fmtMt(Number(o.price_per_vb))} MT/vb$</p>
                        <p className="text-xs text-muted-foreground">Vendido: {formatVb(Number(o.sold_vb))} · Reservado: {formatVb(Number(o.reserved_vb))} · {methods(o).join(" + ")}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => void cancelOffer(o)}>Cancelar</Button>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/pedidos" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Ver pedidos de compra recebidos →</Link>
            </section>
          )}
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Ofertas disponíveis</h2>
        {activeOrderId && <p className="mb-3 text-sm text-muted-foreground">Já tem um pedido ativo. <Link to="/pedidos" className="text-primary underline">Abrir conversa</Link></p>}
        {loading ? <p className="text-sm text-muted-foreground">A carregar ofertas...</p>
          : offers.length === 0 ? <div className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">Ainda não existem ofertas disponíveis.</div>
          : <div className="space-y-3">
              {offers.map(o => (
                <article key={o.id} className="rounded-2xl border border-border p-4">
                  {buying?.id === o.id ? <BuyPanel offer={o} minBuy={minBuy} onDone={async () => { setBuying(null); await load(); }} /> : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{formatVb(available(o))} disponíveis</p>
                          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            {fmtMt(Number(o.price_per_vb))} MT por vb$ · {o.seller_name}
                            {onlineSellers.has(o.seller_id) && <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-600"><span className="size-1.5 rounded-full bg-green-500" />Online</span>}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {methods(o).map(m => <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{m}</span>)}
                        </div>
                      </div>
                      {session && o.seller_id === session.user.id ? (
                        <p className="mt-3 text-xs text-muted-foreground">Esta é a sua oferta.</p>
                      ) : (
                        <Button className="mt-3 w-full" onClick={() => setBuying(o)} disabled={loading || !!activeOrderId || available(o) <= 0}>{available(o) <= 0 ? "Esgotada" : activeOrderId ? "Pedido ativo" : "Comprar"}</Button>
                      )}
                    </>
                  )}
                </article>
              ))}
            </div>}
      </section>
    </main>
  );
}
