import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Disc3, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Product, formatMt, activePrice } from "@/lib/product";
import { Button } from "@/components/ui/button";

const Roleta = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.from("products").select("*").then(({ data }) => {
      setProducts((data as Product[]) || []);
      setLoading(false);
    });
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const spin = () => {
    if (!products.length || spinning) return;
    setSelected(null);
    setSpinning(true);
    timer.current = setTimeout(() => {
      setSelected(products[Math.floor(Math.random() * products.length)]);
      setSpinning(false);
    }, 1200);
  };

  return (
    <main className="mx-auto max-w-xl px-4 pt-8 pb-28 min-h-screen text-center">
      <h1 className="font-display text-3xl font-bold">Roleta</h1>
      <p className="mt-2 text-sm text-muted-foreground">Descubra um produto da loja ao acaso.</p>
      <div className="mx-auto mt-10 grid size-44 place-items-center rounded-full border-4 border-primary bg-secondary text-primary">
        <Disc3 size={92} strokeWidth={1} className={spinning ? "animate-spin" : ""} aria-hidden="true" />
      </div>
      <Button className="mt-8 min-w-44" onClick={spin} disabled={loading || spinning || products.length === 0}>
        {spinning ? "A girar..." : "Girar roleta"}
      </Button>
      {!loading && products.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Ainda não há produtos na loja.</p>}
      {selected && (
        <div className="mt-10 border-t border-border pt-6" aria-live="polite">
          <p className="mb-4 text-sm font-semibold">O seu produto</p>
          <Link to={`/product/${selected.id}`} className="flex items-center gap-4 text-left hover:text-primary">
            {selected.image_url && <img src={selected.image_url} alt="" className="size-20 shrink-0 rounded-md bg-muted object-contain" />}
            <span className="min-w-0 flex-1">
              <span className="block font-semibold break-words">{selected.name}</span>
              <span className="text-sm text-muted-foreground">{formatMt(activePrice(selected).price)}</span>
            </span>
            <ArrowRight size={20} className="shrink-0" />
          </Link>
        </div>
      )}
    </main>
  );
};

export default Roleta;