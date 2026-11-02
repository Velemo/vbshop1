import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Crown, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, formatVb } from "@/hooks/useWallet";
import { uploadWithProgress } from "@/lib/upload";
import { toast } from "sonner";

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
  status: string;
};

const available = (o: Offer) => Number(o.amount_vb) - Number(o.sold_vb) - Number(o.reserved_vb);
const fmtMt = (n: number) => Number(n || 0).toLocaleString("pt-MZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const methods = (o: Offer) => [o.mpesa_number ? "M-Pesa" : null, o.emola_number ? "e-Mola" : null].filter(Boolean) as string[];

/* ---------- Painel de compra ---------- */
function BuyPanel({ offer, onDone }: { offer: Offer; onDone: () => void }) {
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
        <p className="mt-1 text-xs text-muted-foreground">Disponível: {formatVb(available(offer))} · {fmtMt(Number(offer.price_per_vb))} MT por vb$</p>
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
        {offer.mpesa_number && <p><span className="font-semibold">M-Pesa:</span> {offer.mpesa_number}</p>}
        {offer.emola_number && <p><span className="font-semibold">e-Mola:</span> {offer.emola_number}</p>}
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
function CreateOfferForm({ balance, onCreated }: { balance: number; onCreated: () => void }) {
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [mpesa, setMpesa] = useState(false);
  const [emola, setEmola] = useState(false);
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [emolaNumber, setEmolaNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const value = Number(amount), unit = Number(price);
    if (!Number.isFinite(value) || value <= 0) { toast.error("Indique quantos vb$ quer vender."); return; }
    if (value > balance) { toast.error("Só pode vender até ao seu saldo disponível."); return; }
    if (!Number.isFinite(unit) || unit <= 0) { toast.error("Indique o preço de cada vb$ em meticais."); return; }
    if (mpesa && !mpesaNumber.trim() && emola && !emolaNumber.trim()) { toast.error("Indique os números que vão receber os pagamentos."); return; }
    if (!mpesa && !emola) { toast.error("Escolha M-Pesa, e-Mola ou ambos."); return; }
    setSaving(true);
    const { error } = await (supabase as any).rpc("p2p_create_offer", {
      _amount_vb: value, _price_per_vb: unit,
      _mpesa_number: mpesa ? mpesaNumber.trim() : "", _emola_number: emola ? emolaNumber.trim() : "",
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
          <label htmlFor="offer-price" className="mb-1 block text-sm font-medium">Preço por vb$ (MT)</label>
          <input id="offer-price" type="number" min="0.01" step="any" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ex.: 90" className="w-full rounded-lg border border-border bg-background p-2 text-sm" />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={mpesa} onChange={e => setMpesa(e.target.checked)} /> M-Pesa</label>
          {mpesa && <input value={mpesaNumber} onChange={e => setMpesaNumber(e.target.value)} placeholder="Número que recebe o pagamento" className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-sm" />}
        </div>
        <div className="rounded-xl border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={emola} onChange={e => setEmola(e.target.checked)} /> e-Mola</label>
          {emola && <input value={emolaNumber} onChange={e => setEmolaNumber(e.target.value)} placeholder="Número que recebe o pagamento" className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-sm" />}
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
  const [showP2PInfo, setShowP2PInfo] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [buying, setBuying] = useState<Offer | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).from("p2p_offers").select("*").order("created_at", { ascending: false });
    const all = (data || []) as Offer[];
    setOffers(all.filter(o => o.status === "active"));
    setMyOffers(all.filter(o => o.status === "active" && session && o.seller_id === session.user.id));
    setLoading(false);
  }, [session?.user.id]);

  useEffect(() => {
    void load();
    if (session) {
      (supabase as any).from("vip_memberships").select("user_id").eq("user_id", session.user.id).maybeSingle()
        .then(({ data }: any) => setIsVip(!!data));
    }
  }, [session?.user.id, load]);

  const cancelOffer = async (o: Offer) => {
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
              <CreateOfferForm balance={balance} onCreated={async () => { setShowCreate(false); await Promise.all([load(), refresh()]); }} />
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

      <div className="fixed bottom-[120px] right-5 z-40 flex flex-col items-end gap-2">
        {showP2PInfo && (
          <div className="w-[min( calc(100vw-2.5rem),22rem)] rounded-2xl border border-border bg-card p-4 text-sm shadow-xl">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-semibold">P2P · Comprar e vender vb$</h2>
              <button type="button" onClick={() => setShowP2PInfo(false)} aria-label="Fechar informações" className="rounded-full p-1 hover:bg-muted"><X size={16} /></button>
            </div>
            <p className="text-muted-foreground">Compre vb$ de vendedores da comunidade por M-Pesa ou e-Mola. O pagamento é verificado entre as partes antes de os vb$ serem libertados.</p>
            <div className="mt-4 border-t border-border pt-3">
              <p className="font-semibold">Quer vender vb$?</p>
              <p className="mt-1 text-muted-foreground">A criação de ofertas é exclusiva para membros VIP. Ative a Zona VIP no seu perfil para vender.</p>
              <Button asChild variant="outline" size="sm" className="mt-2"><Link to="/perfil">Ativar VIP no perfil</Link></Button>
            </div>
          </div>
        )}
        <button type="button" onClick={() => setShowP2PInfo(value => !value)} aria-label="Mais informações sobre P2P" aria-expanded={showP2PInfo} className="grid size-10 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-muted hover:text-foreground">
          <Info size={19} />
        </button>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold">Ofertas disponíveis</h2>
        {loading ? <p className="text-sm text-muted-foreground">A carregar ofertas...</p>
          : offers.length === 0 ? <div className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">Ainda não existem ofertas disponíveis.</div>
          : <div className="space-y-3">
              {offers.map(o => (
                <article key={o.id} className="rounded-2xl border border-border p-4">
                  {buying?.id === o.id ? <BuyPanel offer={o} onDone={async () => { setBuying(null); await load(); }} /> : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{formatVb(available(o))} disponíveis</p>
                          <p className="text-sm text-muted-foreground">{fmtMt(Number(o.price_per_vb))} MT por vb$ · {o.seller_name}</p>
                        </div>
                        <div className="flex gap-1">
                          {methods(o).map(m => <span key={m} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{m}</span>)}
                        </div>
                      </div>
                      {session && o.seller_id === session.user.id ? (
                        <p className="mt-3 text-xs text-muted-foreground">Esta é a sua oferta.</p>
                      ) : (
                        <Button className="mt-3 w-full" onClick={() => setBuying(o)} disabled={available(o) <= 0}>{available(o) <= 0 ? "Esgotada" : "Comprar"}</Button>
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
