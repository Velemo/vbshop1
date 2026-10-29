import { useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Site-wide music receiver. Browsers require a user gesture before audio can play. */
const SiteMusicPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [broadcastPlaying, setBroadcastPlaying] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await (supabase as any).from("site_music_broadcast").select("music_url,music_name,is_playing").eq("id", 1).maybeSingle();
      if (!alive || !data) return;
      setUrl(data.music_url || ""); setName(data.music_name || ""); setBroadcastPlaying(!!data.is_playing);
    };
    void load();
    const channel = supabase.channel("site-music-broadcast-listener").on("postgres_changes", { event: "*", schema: "public", table: "site_music_broadcast" }, (payload: any) => {
      const row = payload.new || {};
      setUrl(row.music_url || ""); setName(row.music_name || ""); setBroadcastPlaying(!!row.is_playing);
    }).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.src !== url) { audio.pause(); audio.src = url; audio.load(); }
    if (!url || !broadcastPlaying || !enabled) { audio.pause(); setPlaying(false); return; }
    audio.loop = true;
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [url, broadcastPlaying, enabled]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !url || !broadcastPlaying) return;
    if (!enabled || audio.paused) {
      setEnabled(true);
      audio.loop = true;
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause(); setPlaying(false); setEnabled(false);
    }
  };

  if (!url || !broadcastPlaying) return <audio ref={audioRef} preload="none" loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />;
  return <>
    <audio ref={audioRef} preload="none" loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    <button type="button" onClick={toggle} aria-label={playing ? "Desactivar música do site" : "Activar música do site"} title={name ? `Música do site: ${name}` : "Música do site"} className="fixed bottom-24 left-4 z-40 grid size-11 place-items-center rounded-full border border-border bg-background/95 text-foreground shadow-lg backdrop-blur">
      {playing ? <Volume2 size={19}/> : <Music size={19}/>}
    </button>
  </>;
};
export default SiteMusicPlayer;
