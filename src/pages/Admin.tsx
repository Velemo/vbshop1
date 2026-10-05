import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, Upload, X, Image as ImageIcon } from "lucide-react";
import { Product, formatMt } from "@/lib/product";
import { toast } from "sonner";
import { uploadWithProgress } from "@/lib/upload";
import { isVideo } from "@/lib/media";
import { Button } from "@/components/ui/button";

type Tab = "products" | "visits" | "ad" | "roleta" | "codes";
type Slot = { position: number; image_url: string | null; label: string };
type PrizeContent = { position: number; prize_text: string; prize_link: string; prize_video_url: string };
type Code = { id: string; code: string; amount: number; redeemed_by: string | null; created_at: string };
type Delivery = { delivery_order?: number; product_id?: string; content_text: string; content_link: string; media_url: string; delivered_at?: string | null };
const blankDelivery = (): Delivery => ({ content_text: "", content_link: "", media_url: "" });

type AdForm = {
  id?: string;
  media_url: string;
  media_type: string;
  title: string;
  subtitle: string;
  button_label: string;
  button_url: string;
  active: boolean;
};

const emptyAd: AdForm = { media_url: "", media_type: "image", title: "", subtitle: "", button_label: "", button_url: "", active: true };

type ProductForm = {
  id?: string;
  name: string;
  description: string;
  image_url: string;
  gallery: string[];
  price: string;
  promo_price: string;
  promo_ends_at: string;
  stock: string;
  seller_whatsapp: string;
  deliveries: Delivery[];
};

const empty: ProductForm = { name: "", description: "", image_url: "", gallery: [], price: "", promo_price: "", promo_ends_at: "", stock: "1", seller_whatsapp: "", deliveries: [] };

const Admin = () => {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [stats, setStats] = useState({ total: 0, last24: 0, last7: 0, unique: 0 });
  const [recentVisits, setRecentVisits] = useState<any[]>([]);
  const [ad, setAd] = useState<AdForm>(emptyAd);
  const [adSaving, setAdSaving] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [prizes, setPrizes] = useState<Record<number, PrizeContent>>({});
  const [codes, setCodes] = useState<Code[]>([]);
  const [codeAmount, setCodeAmount] = useState("10");
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [savingProduct, setSavingProduct] = useState(false);

  const uploadImage = async (file: File, label = "A carregar"): Promise<string | null> => {
    setProgress({ label: `${label}: ${file.name}`, percent: 0 });
    const { url, error } = await uploadWithProgress("products", file, (percent) =>
      setProgress({ label: `${label}: ${file.name}`, percent }),
    );
    setProgress(null);
    if (error) { toast.error(error); return null; }
    toast.success("Ficheiro carregado");
    return url;
  };

  const loadAd = async () => {
    const { data } = await supabase.from("announcements").select("*")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) setAd({
      id: (data as any).id,
      media_url: (data as any).media_url || "",
      media_type: (data as any).media_type || "image",
      title: (data as any).title || "",
      subtitle: (data as any).subtitle || "",
      button_label: (data as any).button_label || "",
      button_url: (data as any).button_url || "",
      active: !!(data as any).active,
    });
  };

  const onAdMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const url = await uploadImage(f);
    if (url) setAd(a => ({ ...a, media_url: url, media_type: f.type.startsWith("video") ? "video" : "image" }));
  };

  const saveAd = async () => {
    setAdSaving(true);
    const payload = {
      media_url: ad.media_url || null,
      media_type: ad.media_type,
      title: ad.title || null,
      subtitle: ad.subtitle || null,
      button_label: ad.button_label || null,
      button_url: ad.button_url || null,
      active: ad.active,
      updated_at: new Date().toISOString(),
    };
    const { error } = ad.id
      ? await supabase.from("announcements").update(payload).eq("id", ad.id)
      : await supabase.from("announcements").insert(payload);
    setAdSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Anúncio salvo");
    loadAd();
  };

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data as Product[]) || []);
    const { data: contents } = await supabase.from("product_contents").select("product_id,delivered_at").is("delivered_at", null);
    setAvailable((contents || []).reduce<Record<string, number>>((counts, row) => {
      counts[row.product_id] = (counts[row.product_id] || 0) + 1;
      return counts;
    }, {}));
  };

  const loadVisits = async () => {
    const now = Date.now();
    const d24 = new Date(now - 24 * 3600 * 1000).toISOString();
    const d7 = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const [total, last24, last7, recent] = await Promise.all([
      supabase.from("site_visits").select("*", { count: "exact", head: true }),
      supabase.from("site_visits").select("*", { count: "exact", head: true }).gte("created_at", d24),
      supabase.from("site_visits").select("*", { count: "exact", head: true }).gte("created_at", d7),
      supabase.from("site_visits").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setStats({
      total: total.count || 0,
      last24: last24.count || 0,
      last7: last7.count || 0,
      unique: new Set((recent.data || []).map((v: any) => v.user_id || v.user_agent)).size,
    });
    setRecentVisits(recent.data || []);
  };

  const loadSlots = async () => {
    const { data } = await (supabase as any).from("roulette_slots").select("*").order("position");
    setSlots(data || []);
    const { data: details } = await (supabase as any).from("roulette_prize_content").select("position,prize_text,prize_link,prize_video_url");
    setPrizes(Object.fromEntries((details || []).map((detail: PrizeContent) => [detail.position, detail])));
  };
  const loadCodes = async () => {
    const { data } = await (supabase as any).from("recharge_codes").select("*").order("created_at", { ascending: false }).limit(100);
    setCodes(data || []);
  };
  const saveSlot = async (sl: Slot) => {
    const { error } = await (supabase as any).from("roulette_slots").update({ image_url: sl.image_url, label: sl.label, updated_at: new Date().toISOString() }).eq("position", sl.position);
    if (error) toast.error("Erro: " + error.message); else toast.success(`Quadrado ${sl.position + 1} salvo`);
  };
  const updatePrize = (position: number, changes: Partial<PrizeContent>) => {
    setPrizes(current => ({ ...current, [position]: { position, prize_text: "", prize_link: "", prize_video_url: "", ...current[position], ...changes } }));
  };
  const savePrize = async (position: number, changes?: Partial<PrizeContent>) => {
    const prize = { position, prize_text: "", prize_link: "", prize_video_url: "", ...prizes[position], ...changes };
    const link = prize.prize_link.trim();
    if (link && !/^https?:\/\//i.test(link)) { toast.error("O link deve começar com https:// ou http://"); return; }
    const { error } = await (supabase as any).from("roulette_prize_content").upsert({ position, prize_text: prize.prize_text, prize_link: link || null, prize_video_url: prize.prize_video_url || null });
    if (error) toast.error("Erro: " + error.message); else toast.success(`Conteúdo do quadrado ${position + 1} salvo`);
  };
  const onPrizeVideo = async (position: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const url = await uploadImage(file);
    if (url) { updatePrize(position, { prize_video_url: url }); await savePrize(position, { prize_video_url: url }); }
  };
  const onSlotImg = async (position: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ""; if (!f) return;
    const url = await uploadImage(f);
    if (!url) return;
    const next = slots.map(s => s.position === position ? { ...s, image_url: url } : s);
    setSlots(next);
    const updated = next.find(s => s.position === position);
    if (updated) saveSlot(updated);
  };
  const genCode = async () => {
    const amount = Number(codeAmount);
    if (!(amount > 0) || amount > 100000) { toast.error("Valor inválido"); return; }
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rnd = crypto.getRandomValues(new Uint32Array(12));
    const code = "VB-" + Array.from(rnd, n => chars[n % chars.length]).join("").replace(/(.{4})(?=.)/g, "$1-");
    const { error } = await (supabase as any).from("recharge_codes").insert({ code, amount });
    if (error) { toast.error("Erro: " + error.message); return; }
    navigator.clipboard?.writeText(code).catch(() => {});
    toast.success(`Código ${code} criado e copiado`);
    loadCodes();
  };

  useEffect(() => { loadProducts(); loadVisits(); loadAd(); loadSlots(); loadCodes(); }, []);

  const startEdit = async (p?: Product) => {
    if (p) {
      const { data, error } = await supabase.from("product_contents").select("delivery_order,product_id,content_text,content_link,media_url,delivered_at").eq("product_id", p.id).order("delivery_order");
      if (error) { toast.error("Não foi possível carregar os conteúdos"); return; }
      setEditing({
        id: p.id, name: p.name, description: p.description,
        image_url: p.image_url || "",
        gallery: Array.isArray(p.gallery) ? p.gallery : [],
        price: String(p.price), promo_price: p.promo_price != null ? String(p.promo_price) : "",
        promo_ends_at: p.promo_ends_at ? p.promo_ends_at.slice(0, 16) : "",
        stock: String(p.stock), seller_whatsapp: p.seller_whatsapp,
        deliveries: (data || []).map(d => ({ ...d, content_link: d.content_link || "", media_url: d.media_url || "" })),
      });
    } else setEditing({ ...empty });
  };

  const save = async () => {
    if (!editing || savingProduct) return;
    if (!editing.name.trim() || !editing.price || !editing.seller_whatsapp) {
      toast.error("Nome, preço e WhatsApp são obrigatórios"); return;
    }
    if (editing.deliveries.some(d => !d.delivered_at && (!d.content_text.trim() && !d.content_link.trim() && !d.media_url.trim() || d.content_link && !/^https?:\/\//i.test(d.content_link)))) {
      toast.error("Cada entrega precisa de texto, link válido ou ficheiro"); return;
    }
    setSavingProduct(true);
    const payload = {
      name: editing.name.trim(),
      description: editing.description,
      image_url: editing.image_url || null,
      gallery: editing.gallery,
      price: Number(editing.price),
      promo_price: editing.promo_price ? Number(editing.promo_price) : null,
      promo_ends_at: editing.promo_ends_at ? new Date(editing.promo_ends_at).toISOString() : null,
      stock: parseInt(editing.stock) || 0,
      seller_whatsapp: editing.seller_whatsapp.trim(),
    };
    const result = editing.id
      ? await supabase.from("products").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("products").insert(payload).select("id").single();
    if (result.error || !result.data) { toast.error("Erro: " + (result.error?.message || "Produto indisponível")); setSavingProduct(false); return; }
    const pending = editing.deliveries.filter(d => !d.delivered_at);
    for (const d of pending) {
      const row = { product_id: result.data.id, content_text: d.content_text.trim(), content_link: d.content_link.trim() || null, media_url: d.media_url || null };
      const { error } = d.delivery_order
        ? await supabase.from("product_contents").update(row).eq("delivery_order", d.delivery_order).is("delivered_at", null)
        : await supabase.from("product_contents").insert(row);
      if (error) { toast.error("Produto guardado, mas falhou uma entrega: " + error.message); setSavingProduct(false); loadProducts(); return; }
    }
    setSavingProduct(false);
    toast.success("Produto salvo");
    setEditing(null);
    loadProducts();
  };

  const remove = async (id: string) => {
    if (!confirm("Apagar este produto?")) return;
    await supabase.from("products").delete().eq("id", id);
    loadProducts();
  };

  const onMainImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i], `A carregar ${i + 1}/${files.length}`);
      if (url) urls.push(url);
    }
    if (urls.length) setEditing(current => current ? {
      ...current,
      image_url: urls[0],
      gallery: [...current.gallery, ...urls.slice(1)],
    } : current);
  };
  const onGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const u = await uploadImage(files[i], `A carregar ${i + 1}/${files.length}`);
      if (u) urls.push(u);
    }
    if (urls.length) setEditing(current => current ? { ...current, gallery: [...current.gallery, ...urls] } : current);
  };

  const updateDelivery = (index: number, changes: Partial<Delivery>) => setEditing(current => current ? ({ ...current, deliveries: current.deliveries.map((d, i) => i === index ? { ...d, ...changes } : d) }) : current);
  const removeDelivery = async (index: number) => {
    const delivery = editing?.deliveries[index];
    if (!delivery || delivery.delivered_at) return;
    if (delivery.delivery_order) {
      const { error } = await supabase.from("product_contents").delete().eq("delivery_order", delivery.delivery_order).is("delivered_at", null);
      if (error) { toast.error(error.message); return; }
    }
    setEditing(current => current ? { ...current, deliveries: current.deliveries.filter((_, i) => i !== index) } : current);
  };
  const onDeliveryMedia = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file || !/^(video|image)\//.test(file.type)) return;
    const url = await uploadImage(file);
    if (url) updateDelivery(index, { media_url: url });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-secondary"><ArrowLeft size={18}/></Link>
          <h1 className="font-display font-semibold">Painel Admin</h1>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 border-t border-border overflow-x-auto">
          {(["products", "visits", "ad", "roleta", "codes"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-sm whitespace-nowrap font-medium border-b-2 ${tab===t?"border-primary text-foreground":"border-transparent text-muted-foreground"}`}>
              {({ products: "Produtos", visits: "Visitantes", ad: "Anúncio", roleta: "Roleta", codes: "Códigos vb$" } as Record<Tab, string>)[t]}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "products" && (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">{products.length} produto(s)</p>
              <button onClick={() => startEdit()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
                <Plus size={16}/> Novo
              </button>
            </div>
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex gap-3 items-center">
                  {p.image_url ? isVideo(p.image_url) ? <video src={p.image_url} className="w-14 h-14 rounded-lg object-contain" muted preload="metadata"/> : <img src={p.image_url} className="w-14 h-14 rounded-lg object-cover"/> : <div className="w-14 h-14 rounded-lg bg-muted grid place-items-center"><ImageIcon size={18} className="text-muted-foreground"/></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{formatMt(Number(p.price))} · Estoque {p.stock} · Entregas livres {available[p.id] || 0}</p>
                    {p.stock > 0 && !available[p.id] && <p className="text-xs text-destructive">Sem conteúdos para entrega em vb$</p>}
                  </div>
                  <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-secondary"><Pencil size={14}/></button>
                  <button onClick={() => remove(p.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "visits" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total", value: stats.total },
                { label: "Últ. 24h", value: stats.last24 },
                { label: "Últ. 7d", value: stats.last7 },
                { label: "Únicos (50)", value: stats.unique },
              ].map(s => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-display font-bold">{s.value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Últimas visitas</p>
              <div className="space-y-1.5">
                {recentVisits.map((v, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-2.5 text-xs flex items-center gap-2">
                    <Eye size={12} className="text-muted-foreground shrink-0"/>
                    <span className="text-muted-foreground shrink-0">{new Date(v.created_at).toLocaleString("pt-MZ")}</span>
                    <span className="font-mono truncate">{v.path}</span>
                    <span className="text-muted-foreground truncate ml-auto hidden sm:inline">{v.user_id ? "user" : "anon"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "ad" && (
          <div className="max-w-lg space-y-3">
            <p className="text-sm text-muted-foreground">Quando ativo, este anúncio aparece no topo da loja.</p>

            <div className="space-y-2">
              <label className="text-xs font-medium">Imagem ou vídeo do anúncio</label>
              {ad.media_url && (ad.media_type === "video"
                ? <video src={ad.media_url} className="w-full max-w-xs rounded-lg" controls muted />
                : <img src={ad.media_url} className="w-full max-w-xs rounded-lg object-cover" />)}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium cursor-pointer hover:bg-accent">
                <Upload size={12}/> Enviar ficheiro
                <input type="file" accept="image/*,video/*" className="hidden" onChange={onAdMedia}/>
              </label>
            </div>

            {[
              { k: "title", label: "Título (opcional)" },
              { k: "subtitle", label: "Subtítulo (opcional)" },
              { k: "button_label", label: "Nome do botão (ex: Ver mais)" },
              { k: "button_url", label: "Link do botão (https://...)" },
            ].map(f => (
              <div key={f.k} className="space-y-1">
                <label className="text-xs font-medium">{f.label}</label>
                <input value={(ad as any)[f.k]}
                  onChange={e => setAd({ ...ad, [f.k]: e.target.value } as AdForm)}
                  className="w-full p-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              </div>
            ))}

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={ad.active} onChange={e => setAd({ ...ad, active: e.target.checked })}/>
              Mostrar anúncio no site
            </label>

            <button onClick={saveAd} disabled={adSaving}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
              {adSaving ? "A guardar..." : "Salvar anúncio"}
            </button>
          </div>
        )}
        {tab === "roleta" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Coloque uma imagem e o nome do prémio em cada um dos 10 quadrados da roleta (o 1 fica no topo, seguindo no sentido do relógio).</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {slots.map(sl => (
                <div key={sl.position} className="bg-card border border-border rounded-xl p-2 space-y-2">
                  <p className="text-xs font-semibold">Quadrado {sl.position + 1}</p>
                  <label className="block aspect-square rounded-lg border-2 border-dashed border-border bg-muted cursor-pointer overflow-hidden grid place-items-center hover:border-primary">
                    {sl.image_url ? <img src={sl.image_url} className="size-full object-contain" /> : <Upload size={18} className="text-muted-foreground" />}
                    <input type="file" accept="image/*" className="hidden" onChange={e => onSlotImg(sl.position, e)} />
                  </label>
                  <input value={sl.label} maxLength={60} placeholder="Nome do prémio"
                    onChange={e => setSlots(slots.map(s => s.position === sl.position ? { ...s, label: e.target.value } : s))}
                    onBlur={() => saveSlot(sl)}
                    className="w-full p-1.5 rounded-md bg-background border border-border text-xs" />
                  {sl.image_url && <button onClick={() => { const n = { ...sl, image_url: null }; setSlots(slots.map(s => s.position === sl.position ? n : s)); saveSlot(n); }} className="text-xs text-destructive">Remover imagem</button>}
                  <textarea value={prizes[sl.position]?.prize_text || ""} maxLength={4000} rows={3} placeholder="Texto enviado ao vencedor" aria-label={`Texto do prémio ${sl.position + 1}`}
                    onChange={e => updatePrize(sl.position, { prize_text: e.target.value })} className="w-full p-1.5 rounded-md bg-background border border-border text-xs" />
                  <input type="url" value={prizes[sl.position]?.prize_link || ""} placeholder="Link https://..." aria-label={`Link do prémio ${sl.position + 1}`}
                    onChange={e => updatePrize(sl.position, { prize_link: e.target.value })} className="w-full p-1.5 rounded-md bg-background border border-border text-xs" />
                  {prizes[sl.position]?.prize_video_url && <video src={prizes[sl.position].prize_video_url} controls preload="metadata" className="w-full aspect-video object-contain rounded-md" />}
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-primary"><Upload size={12} /> Vídeo do prémio<input type="file" accept="video/*" className="hidden" onChange={e => onPrizeVideo(sl.position, e)} /></label>
                  {prizes[sl.position]?.prize_video_url && <button onClick={() => { updatePrize(sl.position, { prize_video_url: "" }); savePrize(sl.position, { prize_video_url: "" }); }} className="text-xs text-destructive">Remover vídeo</button>}
                  <button onClick={() => savePrize(sl.position)} className="w-full p-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold">Guardar conteúdo</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "codes" && (
          <div className="max-w-lg space-y-4">
            <p className="text-sm text-muted-foreground">Gere um código e envie ao cliente. Ele resgata no Perfil e o valor entra no saldo vb$.</p>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Valor (vb$)</label>
                <input type="number" min="0.01" step="0.01" value={codeAmount} onChange={e => setCodeAmount(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-background border border-border text-sm" />
              </div>
              <button onClick={genCode} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Gerar código</button>
            </div>
            <div className="space-y-1.5">
              {codes.map(c => (
                <div key={c.id} className="bg-card border border-border rounded-lg p-2.5 text-sm flex items-center gap-2">
                  <button className="font-mono truncate" onClick={() => { navigator.clipboard?.writeText(c.code); toast.success("Copiado"); }}>{c.code}</button>
                  <span className="ml-auto shrink-0">{Number(c.amount).toFixed(2)} vb$</span>
                  <span className={`text-xs shrink-0 ${c.redeemed_by ? "text-muted-foreground" : "text-primary"}`}>{c.redeemed_by ? "usado" : "livre"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {progress && (
        <div className="fixed inset-0 z-[60] bg-background/80 backdrop-blur grid place-items-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 space-y-3">
            <p className="text-sm font-medium truncate">{progress.label}</p>
            <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {progress.percent}% {progress.percent >= 100 ? "— a finalizar..." : "carregado"}
            </p>
          </div>
        </div>
      )}




      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur grid place-items-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 space-y-3 my-8">
            <div className="flex justify-between items-center">
              <h2 className="font-display font-semibold text-lg">{editing.id ? "Editar" : "Novo"} produto</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded hover:bg-secondary"><X size={16}/></button>
            </div>

            <div className="space-y-2">
               <label className="text-xs font-medium">Imagens e vídeos do produto (o primeiro será o principal)</label>
              {editing.image_url && (isVideo(editing.image_url) ? <video src={editing.image_url} controls preload="metadata" className="w-24 h-24 rounded-lg object-contain"/> : <img src={editing.image_url} className="w-24 h-24 rounded-lg object-cover"/>)}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium cursor-pointer hover:bg-accent">
                <Upload size={12}/> Enviar
                 <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onMainImg}/>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Imagens e vídeos de detalhes (galeria)</label>
              <div className="flex flex-wrap gap-2">
                {editing.gallery.map((g, i) => (
                  <div key={i} className="relative">
                    {isVideo(g) ? <video src={g} muted preload="metadata" className="w-16 h-16 rounded-lg object-contain" /> : <img src={g} className="w-16 h-16 rounded-lg object-cover"/>}
                    <button onClick={() => setEditing({ ...editing, gallery: editing.gallery.filter((_, j) => j !== i) })}
                      className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground"><X size={10}/></button>
                  </div>
                ))}
                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border grid place-items-center cursor-pointer hover:border-primary">
                  <Upload size={14} className="text-muted-foreground"/>
                  <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={onGallery}/>
                </label>
              </div>
            </div>

            {[
              { k: "name", label: "Nome", placeholder: "Nome do produto" },
              { k: "description", label: "Descrição", placeholder: "Descrição completa", textarea: true },
              { k: "price", label: "Preço (MZN)", placeholder: "1500", type: "number" },
              { k: "stock", label: "Quantidade disponível", placeholder: "10", type: "number" },
              { k: "promo_price", label: "Preço promocional (opcional)", placeholder: "999", type: "number" },
              { k: "promo_ends_at", label: "Fim da promoção", type: "datetime-local" },
              { k: "seller_whatsapp", label: "WhatsApp do vendedor (ex: +258841234567)", placeholder: "+258841234567" },
            ].map((f: any) => (
              <div key={f.k} className="space-y-1">
                <label className="text-xs font-medium">{f.label}</label>
                {f.textarea ? (
                  <textarea rows={3} value={(editing as any)[f.k]}
                    onChange={e => setEditing({ ...editing, [f.k]: e.target.value } as any)}
                    placeholder={f.placeholder}
                    className="w-full p-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                ) : (
                  <input type={f.type || "text"} value={(editing as any)[f.k]}
                    onChange={e => setEditing({ ...editing, [f.k]: e.target.value } as any)}
                    placeholder={f.placeholder}
                    className="w-full p-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
                )}
              </div>
            ))}

            <section className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-semibold">Conteúdo depois do pagamento · Full Entregas</h3>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing({ ...editing, deliveries: [...editing.deliveries, blankDelivery()] })}><Plus size={16} className="mr-1"/> Adicionar</Button>
              </div>
              <p className="text-xs text-muted-foreground">Uma entrega diferente por compra, na ordem abaixo. 1 vb$ = 85 Mt.</p>
              {editing.deliveries.map((d, i) => ({ d, i })).sort((a, b) => Number(!!a.d.delivered_at) - Number(!!b.d.delivered_at)).map(({ d, i }) => (
                <div key={d.delivery_order || `new-${i}`} className={`border-b border-border pb-3 space-y-2 ${d.delivered_at ? "opacity-70" : ""}`}>
                  <div className="flex justify-between items-center text-sm font-medium"><span>Entrega {i + 1} {d.delivered_at ? <span className="ml-1 inline-flex items-center rounded-full bg-primary/15 text-primary px-2 py-0.5 text-xs font-semibold">Entregue ✔️</span> : "· disponível"}</span>
                    {!d.delivered_at && <Button type="button" size="icon" variant="ghost" aria-label={`Remover entrega ${i + 1}`} onClick={() => removeDelivery(i)}><Trash2 size={15}/></Button>}
                  </div>
                  <textarea aria-label={`Texto da entrega ${i + 1}`} disabled={!!d.delivered_at} maxLength={4000} rows={2} value={d.content_text} onChange={e => updateDelivery(i, { content_text: e.target.value })} placeholder="Texto da entrega" className="w-full p-2 border border-border rounded-md bg-background text-sm" />
                  <input aria-label={`Link da entrega ${i + 1}`} disabled={!!d.delivered_at} maxLength={2048} type="url" value={d.content_link} onChange={e => updateDelivery(i, { content_link: e.target.value })} placeholder="Link https://..." className="w-full p-2 border border-border rounded-md bg-background text-sm" />
                  {d.media_url && (isVideo(d.media_url) ? <video src={d.media_url} controls className="w-full max-h-40 object-contain" /> : <img src={d.media_url} alt="Conteúdo" className="w-full max-h-40 object-contain" />)}
                  {!d.delivered_at && <label className="flex items-center gap-2 text-sm text-primary cursor-pointer"><Upload size={16}/> Carregar imagem ou vídeo<input type="file" accept="image/*,video/*" className="hidden" onChange={e => onDeliveryMedia(i, e)}/></label>}
                </div>
              ))}
            </section>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold">Cancelar</button>
              <Button onClick={save} disabled={savingProduct} className="flex-1">{savingProduct ? "A guardar..." : "Salvar"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;