import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/lib/product";
import { toast } from "sonner";
import AnnouncementHero from "@/components/AnnouncementHero";


const Index = () => {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const categories = ["Todos", "MODs", "Jogos", "Eletrónicos", "Pro Digital", "Mais"];

  useEffect(() => {
    supabase.from("products").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setProducts((data as Product[]) || []); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!session) { setWishlist(new Set()); return; }
    supabase.from("wishlists").select("product_id").eq("user_id", session.user.id)
      .then(({ data }) => setWishlist(new Set((data || []).map((w: any) => w.product_id))));
  }, [session]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter(p =>
      (selectedCategory === "Todos" || (p as any).category === selectedCategory || (!(p as any).category && selectedCategory === "Mais")) &&
      (!s || p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s))
    );
  }, [products, q, selectedCategory]);

  const toggleWishlist = async (productId: string) => {
    if (!session) { toast.error("Entre para favoritar"); navigate("/auth"); return; }
    if (wishlist.has(productId)) {
      await supabase.from("wishlists").delete().eq("user_id", session.user.id).eq("product_id", productId);
      const n = new Set(wishlist); n.delete(productId); setWishlist(n);
    } else {
      await supabase.from("wishlists").insert({ user_id: session.user.id, product_id: productId });
      const n = new Set(wishlist); n.add(productId); setWishlist(n);
      toast.success("Adicionado aos desejos");
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <header className="shrink-0 sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar produtos por nome..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <AnnouncementHero />
      <main className="max-w-6xl mx-auto px-4 py-6 pb-20">
        <section aria-label="Categorias de produtos" className="mb-5">
          <p className="text-sm font-semibold mb-2">Categorias</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {categories.map(category => (
              <button key={category} type="button" onClick={() => setSelectedCategory(category)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${selectedCategory === category ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"}`}>
                {category}
              </button>
            ))}
          </div>
        </section>
        {!loading && products.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">Nenhum produto ainda.</p>
            {isAdmin && <Link to="/admin" className="inline-block mt-3 text-primary font-semibold text-sm">Adicionar o primeiro produto →</Link>}
          </div>
        )}
        {loading ? (
          <div className="py-20 text-center"><div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"/></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">Nenhum produto encontrado {selectedCategory !== "Todos" ? `na categoria ${selectedCategory}` : ""}{q.trim() ? ` para "${q}"` : ""}.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map(p => (
              <ProductCard key={p.id} product={p}
                inWishlist={wishlist.has(p.id)}
                onToggleWishlist={() => toggleWishlist(p.id)} />
            ))}
          </div>
        )}
      </main>
      </div>

    </div>
  );
};

export default Index;