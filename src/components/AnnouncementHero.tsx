import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Announcement = {
  id: string;
  media_url: string | null;
  media_type: string;
  title: string | null;
  subtitle: string | null;
  button_label: string | null;
  button_url: string | null;
  active: boolean;
};

const AnnouncementHero = () => {
  const [ad, setAd] = useState<Announcement | null>(null);

  useEffect(() => {
    supabase
      .from("announcements")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAd((data as Announcement) || null));
  }, []);

  if (!ad || !ad.media_url) return null;

  return (
    <section className="relative overflow-hidden border-b border-border bg-[#05060a]">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 flex flex-col items-center text-center gap-4">
        {ad.media_type === "video" ? (
          <video src={ad.media_url} className="w-full max-w-3xl rounded-2xl object-cover max-h-[420px]"
            autoPlay muted loop playsInline controls />
        ) : (
          <img src={ad.media_url} alt={ad.title || "Anúncio MARCHA vb"}
            className="w-full max-w-3xl rounded-2xl object-cover max-h-[420px]" />
        )}
        {(ad.title || ad.subtitle) && (
          <div>
            {ad.title && <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">{ad.title}</h1>}
            {ad.subtitle && <p className="text-sm text-white/70 mt-1">{ad.subtitle}</p>}
          </div>
        )}
        {ad.button_label && ad.button_url && (
          <a href={ad.button_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
            {ad.button_label}
          </a>
        )}
      </div>
    </section>
  );
};

export default AnnouncementHero;
