import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Square, Check } from "lucide-react";
import { useSettings, SiteMode } from "@/contexts/SettingsContext";
import { toast } from "sonner";

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
  const { mode, setMode } = useSettings();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-secondary"><ArrowLeft size={18} /></Link>
          <h1 className="font-display font-semibold">Definições</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        <p className="text-sm text-muted-foreground">Escolha como o site deve aparecer neste dispositivo.</p>
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
      </main>
    </div>
  );
};

export default Settings;
