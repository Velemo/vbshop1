import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isVideo } from "@/lib/media";

type PrizeMail = { id: string; label: string; image_url: string | null; prize_text: string; prize_link: string | null; prize_video_url: string | null; created_at: string };

const Correio = () => {
  const { session, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<PrizeMail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) { setMessages([]); setLoading(false); return; }
    setLoading(true);
    (supabase as any).from("prize_mail").select("id,label,image_url,prize_text,prize_link,prize_video_url,created_at")
      .eq("user_id", session.user.id).order("created_at", { ascending: false })
      .then(({ data, error }: { data: PrizeMail[] | null; error: unknown }) => {
        setMessages(data || []); setError(!!error); setLoading(false);
      });
  }, [session?.user.id]);

  return (
    <main className="mx-auto max-w-xl px-4 pt-8 pb-28 min-h-screen">
      <h1 className="font-display text-3xl font-bold flex items-center gap-3"><Mail size={28} /> Correio</h1>
      {authLoading || loading ? <p className="mt-8 text-sm text-muted-foreground">A carregar...</p>
        : !session ? <div className="mt-8 text-sm"><Link to="/auth" className="text-primary font-semibold">Entrar</Link> para ver o seu Correio.</div>
        : error ? <p className="mt-8 text-sm text-destructive">Não foi possível carregar o Correio.</p>
        : messages.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">Ainda não há mensagens.</p>
        : <div className="mt-6 space-y-4">{messages.map(message => (
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
        ))}</div>}
    </main>
  );
};

export default Correio;