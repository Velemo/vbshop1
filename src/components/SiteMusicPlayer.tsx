import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Site-wide music receiver. Browsers require a user gesture before audio can play. */
const SiteMusicPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState("");
  const [broadcastPlaying, setBroadcastPlaying] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await (supabase as any).from("site_music_broadcast").select("music_url,music_name,is_playing").eq("id", 1).maybeSingle();
      if (!alive || !data) return;
      setUrl(data.music_url || ""); setBroadcastPlaying(!!data.is_playing);
    };
    void load();
    const channel = supabase.channel("site-music-broadcast-listener").on("postgres_changes", { event: "*", schema: "public", table: "site_music_broadcast" }, (payload: any) => {
      const row = payload.new || {};
      setUrl(row.music_url || ""); setBroadcastPlaying(!!row.is_playing);
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

  useEffect(() => {
    const handleToggleRequest = () => toggle();
    window.addEventListener("vbshop:toggle-site-music", handleToggleRequest);
    return () => window.removeEventListener("vbshop:toggle-site-music", handleToggleRequest);
  }, [url, broadcastPlaying, enabled, playing]);

  return <audio ref={audioRef} preload="none" loop onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />;
};
export default SiteMusicPlayer;
