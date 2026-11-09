import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Square, Check, Shield, Mail, LogOut, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings, SiteMode } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ContactForm from "@/components/ContactForm";

const options: { value: SiteMode; title: string; desc: string; icon: typeof Sparkles }[] = [
  {
    value: "dinamico",
    title: "Modo dinâmico",
    desc: "Com brilho neon, animações e efeitos nos cartões e no logótipo.",
    icon: Sparkles,
  },
  {
    value: "normal",
    title: "Modo normal",
    desc: "Visual simples e leve, sem animações — ideal para internet lenta.",
    icon: Square,
  },
];

const Settings = () => {
  const { mode, setMode, theme, setTheme } = useSettings();
  const { isAdmin, session, signOut } = useAuth();
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

        {session && (
          <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <h2 className="font-display text-sm font-semibold">Dados de contacto</h2>
            <p className="text-xs text-muted-foreground">Nome, contacto e e-mail: 1 alteração a cada 15 dias.</p>
            <ContactForm />
          </section>
        )}

        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4">
          <h2 className="font-display text-sm font-semibold">Aparência</h2>
          <div className="flex gap-1" role="group" aria-label="Tema do site">
            <Button variant={theme === "light" ? "default" : "outline"} aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sun size={16} className="mr-2" />Claro</Button>
            <Button variant={theme === "dark" ? "default" : "outline"} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Moon size={16} className="mr-2" />Dark</Button>
          </div>
        </section>
        {options.map(o => {
          const Icon = o.icon;
          const active = mode === o.value;
          return (
            <button
              key={o.value}
              onClick={() => { setMode(o.value); toast.success(`${o.title} activado`); }}
              className={`w-full text-left flex gap-3 items-start p-4 rounded-2xl border transition ${
                active ? "border-primary bg-secondary" : "border-border bg-card hover:bg-secondary/60"
              }`}
            >
              <span className="mt-0.5 p-2 rounded-xl bg-primary/10 text-primary"><Icon size={18} /></span>
              <span className="flex-1">
                <span className="block font-display font-semibold text-sm">{o.title}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{o.desc}</span>
              </span>
              {active && <Check size={18} className="text-primary shrink-0" />}
            </button>
          );
        })}

        {session && (
          <button
            type="button"
            onClick={async () => { await signOut(); navigate("/"); }}
            className="w-full text-left flex gap-3 items-center p-4 rounded-2xl border border-border bg-card hover:bg-secondary/60 transition"
          >
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><LogOut size={18} /></span>
            <span className="flex-1">
              <span className="block font-display font-semibold text-sm">Sair da conta</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Terminar a sessão neste dispositivo.</span>
            </span>
          </button>
        )}

        {isAdmin && (
          <Link
            to="/admin"
            className="w-full text-left flex gap-3 items-center p-4 rounded-2xl border border-border bg-card hover:bg-secondary/60 transition"
          >
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><Shield size={18} /></span>
            <span className="flex-1">
              <span className="block font-display font-semibold text-sm">Painel ADM</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Gerir produtos e anúncios da loja.</span>
            </span>
          </Link>
        )}
      </main>
    </div>
  );
};

export default Settings;
