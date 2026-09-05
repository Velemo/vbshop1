import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Heart } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/lib/product";

const Wishlist = () => {
  const { session, loading } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);

  const load = async () => {
    if (!session) return;
    const { data: w } = await supabase.from("wishlists").select("product_id").eq("user_id", session.user.id);
    const ids = (w || []).map((x: any) => x.product_id);
    if (ids.length === 0) { setItems([]); setReady(true); return; }
    const { data: ps } = await supabase.from("products").select("*").in("id", ids);
    setItems((ps as Product[]) || []);
    setReady(true);
  };

  useEffect(() => { load(); }, [session?.user.id]);

  if (loading) return <div className="min-h-screen grid place-items-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"/></div>;
  if (!session) return <Navigate to="/auth" replace />;

  const remove = async (productId: string) => {
    await supabase.from("wishlists").delete().eq("user_id", session.user.id).eq("product_id", productId);
    setItems(items.filter(p => p.id !== productId));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-secondary"><ArrowLeft size={18}/></Link>
          <h1 className="font-display font-semibold">Lista de desejos</h1>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        {ready && items.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <Heart className="mx-auto text-muted-foreground" size={32}/>
            <p className="text-sm text-muted-foreground">Sua lista está vazia.</p>
            <Link to="/" className="inline-block mt-3 text-primary font-semibold text-sm">Explorar produtos →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {items.map(p => (
              <ProductCard key={p.id} product={p} inWishlist onToggleWishlist={() => remove(p.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Wishlist;