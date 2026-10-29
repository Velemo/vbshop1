import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isVideo } from "@/lib/media";

type PrizeMail = { id: string; label: string; image_url: string | null; prize_text: string; prize_link: string | null; prize_video_url: string | null; created_at: string };
type ProductMail = { id: string; product_name: string; paid_vb: number; content_text: string; content_link: string | null; media_url: string | null; created_at: string };

const Correio = () => {
  const { session, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<PrizeMail[]>([]);
  const [purchases, setPurchases] = useState<ProductMail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tipoEntrega, setTipoEntrega] = useState<"premios" | "compras">("premios");

  useEffect(() => {
    if (!session) { setMessages([]); setPurchases([]); setLoading(false); return; }
    setLoading(true);
    Promise.all([
      supabase.from("prize_mail").select("id,label,image_url,prize_text,prize_link,prize_video_url,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }),
      supabase.from("product_mail").select("id,product_name,paid_vb,content_text,content_link,media_url,created_at").eq("user_id", session.user.id).order("created_at", { ascending: false }),
    ]).then(([prizes, products]) => {
      setMessages(prizes.data || []); setPurchases(products.data || []); setError(!!prizes.error || !!products.error); setLoading(false);
    });
  }, [session?.user.id]);

  return (
    <main className="mx-auto max-w-xl px-4 pt-0 pb-28 min-h-screen">
      {authLoading || loading ? <p className="mt-8 text-sm text-muted-foreground">A carregar...</p>
        : !session ? <div className="mt-8 text-sm"><Link to="/auth" className="text-primary font-semibold">Entrar</Link> para ver o seu Correio.</div>
        : error ? <p className="mt-8 text-sm text-destructive">Não foi possível carregar o Correio.</p>
        : <>
          <div className="mt-0 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            <button type="button" onClick={() => setTipoEntrega("premios")} className={`rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${tipoEntrega === "premios" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><Gift size={16} className="inline mr-2" />Prémios ({messages.length})</button>
            <button type="button" onClick={() => setTipoEntrega("compras")} className={`rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${tipoEntrega === "compras" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}><ShoppingBag size={16} className="inline mr-2" />Compras ({purchases.length})</button>
          </div>
          <div className="mt-6">
          {tipoEntrega === "compras" ? <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><ShoppingBag size={20} /> Entregas das compras <span className="text-sm font-normal text-muted-foreground">({purchases.length})</span></h2>
            {purchases.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há entregas de compras.</p> : <div className="space-y-4">
          {purchases.map(item => <article key={item.id} className="border-b border-border py-4 space-y-3">
            <div><h2 className="font-semibold break-words">{item.product_name}</h2><p className="text-xs text-muted-foreground">Compra · {Number(item.paid_vb).toFixed(2)} vb$ · {new Date(item.created_at).toLocaleString("pt-MZ")}</p></div>
            {item.content_text && <p className="text-sm whitespace-pre-wrap break-words">{item.content_text}</p>}
            {item.media_url && (isVideo(item.media_url) ? <video src={item.media_url} controls playsInline preload="metadata" className="w-full max-h-80 object-contain" /> : <img src={item.media_url} alt="Conteúdo da compra" className="w-full max-h-80 object-contain" />)}
            {item.content_link && /^https?:\/\//i.test(item.content_link) && <a href={item.content_link} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary underline break-all">Abrir conteúdo</a>}
          </article>)}
            </div>}
          </section> : <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Gift size={20} /> Prémios da roleta <span className="text-sm font-normal text-muted-foreground">({messages.length})</span></h2>
            {messages.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há prémios da roleta.</p> : <div className="space-y-4">
          {messages.map(message => (
          <article key={message.id} className="border-b border-border py-4 space-y-3">
            <div className="flex items-center gap-3">
              {message.image_url ? <img src={message.image_url} alt="" className="size-14 shrink-0 rounded-md bg-muted object-contain" /> : <Gift className="text-muted-foreground" size={32} />}
              <div className="min-w-0"><h2 className="font-semibold break-words">{message.label || "Prémio da roleta"}</h2><time className="text-xs text-muted-foreground">{new Date(message.created_at).toLocaleString("pt-MZ")}</time></div>
            </div>
            {message.prize_text && <p className="text-sm whitespace-pre-wrap break-words">{message.prize_text}</p>}
            {message.prize_video_url && (isVideo(message.prize_video_url)
              ? <video src={message.prize_video_url} controls playsInline preload="metadata" className="w-full max-h-80 rounded-md bg-muted object-contain" />
              : <a href={message.prize_video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Ver vídeo</a>)}
            {message.prize_link && /^https?:\/\//i.test(message.prize_link) && <a href={message.prize_link} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary underline break-all">Abrir link do prémio</a>}
          </article>
        ))}
            </div>}
          </section>}
          </div>
        </>}
    </main>
  );
};

export default Correio;