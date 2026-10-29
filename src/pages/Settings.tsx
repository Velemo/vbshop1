import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Square, Check, Shield, Mail, LogOut, Bell, Music2, Volume2, Play } from "lucide-react";
import { useSettings, SiteMode } from "@/contexts/SettingsContext";
import { useSound } from "@/contexts/SoundContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const options: { value: SiteMode; title: string; desc: string; icon: typeof Sparkles }[] = [
  { value: "dinamico", title: "Modo dinâmico", desc: "Com brilho neon, animações e efeitos nos cartões e no logótipo.", icon: Sparkles },
  { value: "normal", title: "Modo normal", desc: "Visual simples e leve, sem animações — ideal para internet lenta.", icon: Square },
];

const Settings = () => {
  const { mode, setMode } = useSettings();
  const { isAdmin, session, signOut } = useAuth();
  const { notificationsEnabled, setNotificationsEnabled, musicEnabled, setMusicEnabled, volume, setVolume, audioReady, enableAudio, playNotification } = useSound();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-secondary"><ArrowLeft size={18} /></Link>
          <h1 className="font-display font-semibold">Definições</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {session?.user.email && (
          <section className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
            <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary"><Mail size={18} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-sm font-semibold">Email da conta</h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">{session.user.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">O seu email aparece apenas nas definições.</p>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div>
            <h2 className="flex items-center gap-2 font-display font-semibold"><Music2 size={18} className="text-primary" /> Sons e música</h2>
            <p className="mt-1 text-xs text-muted-foreground">Áudio ambiente original, com melodias suaves e inspiração africana moderna. As preferências ficam guardadas neste dispositivo.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary"><Bell size={18} /></span>
            <div className="flex-1"><p className="text-sm font-medium">Sons de notificações</p><p className="text-xs text-muted-foreground">Avisos de acções concluídas com sucesso.</p></div>
            <button type="button" role="switch" aria-checked={notificationsEnabled} onClick={() => { setNotificationsEnabled(!notificationsEnabled); if (!audioReady) enableAudio(); }} className={`relative h-6 w-11 rounded-full transition ${notificationsEnabled ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${notificationsEnabled ? "left-[22px]" : "left-0.5"}`} /></button>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary"><Music2 size={18} /></span>
            <div className="flex-1"><p className="text-sm font-medium">Música de fundo</p><p className="text-xs text-muted-foreground">Melodia ambiente em ciclo, criada por síntese de áudio.</p></div>
            <button type="button" role="switch" aria-checked={musicEnabled} onClick={() => { const next = !musicEnabled; setMusicEnabled(next); if (next) enableAudio(); }} className={`relative h-6 w-11 rounded-full transition ${musicEnabled ? "bg-primary" : "bg-muted"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${musicEnabled ? "left-[22px]" : "left-0.5"}`} /></button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><label htmlFor="site-sound-volume" className="flex items-center gap-2 text-sm font-medium"><Volume2 size={16} /> Volume geral</label><span className="text-sm tabular-nums text-muted-foreground">{volume}%</span></div>
            <input id="site-sound-volume" type="range" min="0" max="100" step="1" value={volume} onChange={e => setVolume(Number(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-muted-foreground"><span>Silêncio</span><span>Máximo</span></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => { enableAudio(); toast.success("Áudio activado neste dispositivo"); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><Play size={16} />{audioReady ? "Reactivar áudio" : "Activar áudio"}</button>
            <button type="button" onClick={() => { enableAudio(); playNotification(); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-secondary"><Bell size={16} />Testar notificação</button>
          </div>
          <p className="text-xs text-muted-foreground">Por segurança do navegador, o som só começa depois de tocar num controlo de áudio. Se o som estiver bloqueado pelo dispositivo, verifique também o volume do telemóvel.</p>
        </section>

        <p className="text-sm text-muted-foreground">Escolha como o site deve aparecer neste dispositivo.</p>
        {options.map(o => {
          const Icon = o.icon;
          const active = mode === o.value;
          return (
            <button key={o.value} onClick={() => { setMode(o.value); toast.success(`${o.title} activado`); }}
              className={`w-full text-left flex gap-3 items-start p-4 rounded-2xl border transition ${active ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary/60"}`}>
              <span className="mt-0.5 p-2 rounded-xl bg-primary/10 text-primary"><Icon size={18} /></span>
              <span className="flex-1"><span className="block font-display font-semibold text-sm">{o.title}</span><span className="block text-xs text-muted-foreground mt-0.5">{o.desc}</span></span>
              {active && <Check size={18} className="text-primary shrink-0" />}
            </button>
          );
        })}

        {session && (
          <button type="button" onClick={async () => { await signOut(); navigate("/"); }}
            className="w-full text-left flex gap-3 items-center p-4 rounded-2xl border border-border bg-card hover:bg-secondary/60 transition">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><LogOut size={18} /></span>
            <span className="flex-1"><span className="block font-display font-semibold text-sm">Sair da conta</span><span className="block text-xs text-muted-foreground mt-0.5">Terminar a sessão neste dispositivo.</span></span>
          </button>
        )}

        {isAdmin && (
          <Link to="/admin" className="w-full text-left flex gap-3 items-center p-4 rounded-2xl border border-border bg-card hover:bg-secondary/60 transition">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><Shield size={18} /></span>
            <span className="flex-1"><span className="block font-display font-semibold text-sm">Painel ADM</span><span className="block text-xs text-muted-foreground mt-0.5">Gerir produtos e anúncios da loja.</span></span>
          </Link>
        )}
      </main>
    </div>
  );
};

export default Settings;
