import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, Upload, X, Image as ImageIcon } from "lucide-react";
import { Product, formatMt } from "@/lib/product";
import { toast } from "sonner";

type Tab = "products" | "visits";

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
};

const empty: ProductForm = { name: "", description: "", image_url: "", gallery: [], price: "", promo_price: "", promo_ends_at: "", stock: "1", seller_whatsapp: "" };

const uploadImage = async (file: File): Promise<string | null> => {
  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("products").upload(path, file, { upsert: false });
  if (error) { toast.error("Erro ao enviar imagem"); return null; }
  const { data } = supabase.storage.from("products").getPublicUrl(path);
  return data.publicUrl;
};

const Admin = () => {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [stats, setStats] = useState({ total: 0, last24: 0, last7: 0, unique: 0 });
  const [recentVisits, setRecentVisits] = useState<any[]>([]);

  const loadProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data as Product[]) || []);
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

  useEffect(() => { loadProducts(); loadVisits(); }, []);

  const startEdit = (p?: Product) => {
    if (p) {
      setEditing({
        id: p.id, name: p.name, description: p.description,
        image_url: p.image_url || "",
        gallery: Array.isArray(p.gallery) ? p.gallery : [],
        price: String(p.price), promo_price: p.promo_price != null ? String(p.promo_price) : "",
        promo_ends_at: p.promo_ends_at ? p.promo_ends_at.slice(0, 16) : "",
        stock: String(p.stock), seller_whatsapp: p.seller_whatsapp,
      });
    } else setEditing({ ...empty });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.price || !editing.seller_whatsapp) {
      toast.error("Nome, preço e WhatsApp são obrigatórios"); return;
    }
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
    let error;
    if (editing.id) ({ error } = await supabase.from("products").update(payload).eq("id", editing.id));
    else ({ error } = await supabase.from("products").insert(payload));
    if (error) { toast.error("Erro: " + error.message); return; }
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
    const f = e.target.files?.[0]; if (!f || !editing) return;
    const url = await uploadImage(f); if (url) setEditing({ ...editing, image_url: url });
  };
  const onGallery = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing) return;
    const files = Array.from(e.target.files || []);
    const urls: string[] = [];
    for (const f of files) { const u = await uploadImage(f); if (u) urls.push(u); }
    setEditing({ ...editing, gallery: [...editing.gallery, ...urls] });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-secondary"><ArrowLeft size={18}/></Link>
          <h1 className="font-display font-semibold">Painel Admin</h1>
        </div>
        <div className="max-w-6xl mx-auto px-4 flex gap-1 border-t border-border">
          {(["products", "visits"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab===t?"border-primary text-foreground":"border-transparent text-muted-foreground"}`}>
              {t === "products" ? "Produtos" : "Visitantes"}
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
                  {p.image_url ? <img src={p.image_url} className="w-14 h-14 rounded-lg object-cover"/> : <div className="w-14 h-14 rounded-lg bg-muted grid place-items-center"><ImageIcon size={18} className="text-muted-foreground"/></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{formatMt(Number(p.price))} · Estoque {p.stock}</p>
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
      </main>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur grid place-items-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 space-y-3 my-8">
            <div className="flex justify-between items-center">
              <h2 className="font-display font-semibold text-lg">{editing.id ? "Editar" : "Novo"} produto</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded hover:bg-secondary"><X size={16}/></button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Imagem principal</label>
              {editing.image_url && <img src={editing.image_url} className="w-24 h-24 rounded-lg object-cover"/>}
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium cursor-pointer hover:bg-accent">
                <Upload size={12}/> Enviar
                <input type="file" accept="image/*" className="hidden" onChange={onMainImg}/>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Imagens de detalhes (galeria)</label>
              <div className="flex flex-wrap gap-2">
                {editing.gallery.map((g, i) => (
                  <div key={i} className="relative">
                    <img src={g} className="w-16 h-16 rounded-lg object-cover"/>
                    <button onClick={() => setEditing({ ...editing, gallery: editing.gallery.filter((_, j) => j !== i) })}
                      className="absolute -top-1 -right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground"><X size={10}/></button>
                  </div>
                ))}
                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-border grid place-items-center cursor-pointer hover:border-primary">
                  <Upload size={14} className="text-muted-foreground"/>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onGallery}/>
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

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-lg bg-secondary text-sm font-semibold">Cancelar</button>
              <button onClick={save} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;