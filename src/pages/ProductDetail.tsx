import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Heart, MessageCircle, Star, Trash2 } from "lucide-react";
import { Product, activePrice, formatMt, whatsappLink } from "@/lib/product";
import { toast } from "sonner";
import { isVideo } from "@/lib/media";

type Review = { id: string; user_id: string; rating: number; comment: string; created_at: string };

const Stars = ({ value, onChange, size = 18 }: { value: number; onChange?: (n: number) => void; size?: number }) => (
  <div className="inline-flex gap-0.5">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)}
        className={onChange ? "hover:scale-110 transition" : "cursor-default"}>
        <Star size={size} className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"} />
      </button>
    ))}
  </div>
);

const ProductDetail = () => {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImg, setActiveImg] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [inWishlist, setInWishlist] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    const p = data as Product;
    setProduct(p);
    setActiveImg(p.image_url || (Array.isArray(p.gallery) ? p.gallery.find((image): image is string => typeof image === "string" && !!image) : null) || null);
    const { data: rv } = await supabase.from("reviews").select("*").eq("product_id", id).order("created_at", { ascending: false });
    setReviews((rv as Review[]) || []);
    if (session) {
      const { data: w } = await supabase.from("wishlists").select("id").eq("user_id", session.user.id).eq("product_id", id).maybeSingle();
      setInWishlist(!!w);
      const mine = (rv as Review[] | null)?.find(r => r.user_id === session.user.id);
      if (mine) { setMyRating(mine.rating); setMyComment(mine.comment); }
    }
  };

  useEffect(() => { load(); }, [id, session?.user.id]);

  if (!product) return <div className="min-h-screen grid place-items-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"/></div>;

  const { price, promo, original } = activePrice(product);
  const gallery: string[] = Array.isArray(product.gallery) ? product.gallery.filter((image): image is string => typeof image === "string" && !!image) : [];
  const allImages = [product.image_url, ...gallery].filter((image): image is string => typeof image === "string" && !!image);
  const avgRating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  const toggleWish = async () => {
    if (!session) { toast.error("Crie conta para favoritar"); navigate("/auth"); return; }
    if (inWishlist) {
      await supabase.from("wishlists").delete().eq("user_id", session.user.id).eq("product_id", product.id);
      setInWishlist(false);
    } else {
      await supabase.from("wishlists").insert({ user_id: session.user.id, product_id: product.id });
      setInWishlist(true); toast.success("Adicionado aos desejos");
    }
  };

  const submitReview = async () => {
    if (!session) { navigate("/auth"); return; }
    if (myRating < 1) { toast.error("Escolha de 1 a 5 estrelas"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("reviews").upsert({
      user_id: session.user.id, product_id: product.id,
      rating: myRating, comment: myComment,
    }, { onConflict: "user_id,product_id" });
    setSubmitting(false);
    if (error) { toast.error("Erro ao enviar"); return; }
    toast.success("Avaliação enviada!");
    load();
  };

  const deleteReview = async (rid: string) => {
    await supabase.from("reviews").delete().eq("id", rid);
    setMyRating(0); setMyComment("");
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-secondary"><ArrowLeft size={18}/></Link>
          <p className="font-display font-semibold truncate">{product.name}</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 pb-28 space-y-6 min-w-0">
        <div className="grid md:grid-cols-2 gap-6 min-w-0">
          <div className="min-w-0 space-y-3">
            <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden grid place-items-center">
              {activeImg ? isVideo(activeImg) ? <video key={activeImg} src={activeImg} controls playsInline preload="metadata" className="block w-full h-full object-contain" /> : <img src={activeImg} alt={product.name} className="block w-full h-full object-contain"/> : null}
              <button onClick={toggleWish}
                className="absolute top-3 right-3 p-2.5 rounded-full bg-background/90 backdrop-blur shadow">
                <Heart size={18} className={inWishlist ? "fill-destructive text-destructive" : ""}/>
              </button>
            </div>
            {allImages.length > 1 && (
              <div className="flex w-full max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-2" aria-label="Imagens do produto">
                {allImages.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(img)} aria-label={`Ver imagem ${i + 1} de ${allImages.length}`} aria-pressed={activeImg === img}
                    className={`shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 bg-muted ${activeImg===img?"border-primary":"border-transparent"}`}>
                    {isVideo(img) ? <span className="relative block size-full"><video src={img} muted preload="metadata" className="size-full object-contain" /><span className="absolute inset-0 grid place-items-center text-xs font-bold bg-background/30">▶</span></span> : <img src={img} alt="" loading="lazy" className="w-full h-full object-contain"/>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4 break-words">
            <div>
              <h1 className="text-2xl font-display font-bold">{product.name}</h1>
              {reviews.length > 0 && (
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Stars value={Math.round(avgRating)} size={14}/>
                  <span className="text-muted-foreground">{avgRating.toFixed(1)} · {reviews.length} avaliações</span>
                </div>
              )}
            </div>

             <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-display font-bold">{formatMt(price)}</span>
              {promo && <span className="text-base text-muted-foreground line-through">{formatMt(original)}</span>}
            </div>

            <p className="text-sm text-muted-foreground">
              {product.stock > 0 ? `${product.stock} disponíveis` : "Esgotado"}
            </p>

            {product.description && (
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{product.description}</p>
            )}

            <a href={whatsappLink(product.seller_whatsapp, product.name)} target="_blank" rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#25D366] text-white font-semibold hover:opacity-90">
              <MessageCircle size={18}/> Falar com vendedor no WhatsApp
            </a>
          </div>
        </div>

        {/* Reviews */}
        <section className="border-t border-border pt-6 space-y-4">
          <h2 className="text-lg font-display font-semibold">Avaliações</h2>

          {session ? (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium">Sua avaliação</p>
              <Stars value={myRating} onChange={setMyRating}/>
              <textarea value={myComment} onChange={e=>setMyComment(e.target.value)}
                rows={3} placeholder="Escreva um comentário (opcional)"
                className="w-full p-3 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"/>
              <button onClick={submitReview} disabled={submitting}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                {submitting ? "..." : "Enviar avaliação"}
              </button>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-4 text-center text-sm">
              <Link to="/auth" className="text-primary font-semibold">Entre na sua conta</Link> para dar estrelas e comentar.
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Seja o primeiro a avaliar.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Stars value={r.rating} size={14}/>
                    {session?.user.id === r.user_id && (
                      <button onClick={() => deleteReview(r.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                  {r.comment && <p className="text-sm text-foreground/90 whitespace-pre-wrap">{r.comment}</p>}
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-MZ")}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ProductDetail;