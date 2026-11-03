import { useEffect, useState } from "react";
import { Bell, BellRing, Download } from "lucide-react";
import { toast } from "sonner";
import { enablePush, isPushEnabled, pushSupported } from "@/lib/push";

const INSTALLED_KEY = "marcha-app-installed";
const tile = "flex min-w-0 flex-col items-center justify-start gap-2 rounded-xl px-1 py-4 text-center text-xs font-medium hover:bg-muted hover:text-primary sm:text-sm";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: BIP | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e as BIP; });
}

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;

export const InstallAppTile = () => {
  const [hidden, setHidden] = useState(() => isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1");
  useEffect(() => {
    const done = () => { localStorage.setItem(INSTALLED_KEY, "1"); setHidden(true); toast.success("Aplicativo instalado!"); };
    window.addEventListener("appinstalled", done);
    return () => window.removeEventListener("appinstalled", done);
  }, []);
  if (hidden) return null;

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      if (outcome === "accepted") { localStorage.setItem(INSTALLED_KEY, "1"); setHidden(true); }
      return;
    }
    if (window.top !== window.self) { toast.info("Abra o site numa aba própria (ou no site publicado) para instalar."); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    toast.info(ios ? "No Safari toque em Partilhar → \"Adicionar ao ecrã principal\"." : "No menu do Chrome (⋮) toque em \"Instalar aplicativo\" ou \"Adicionar ao ecrã principal\".", { duration: 8000 });
  };
  return (
    <button type="button" onClick={() => void install()} className={tile}>
      <Download size={28} strokeWidth={1.8} />
      <span className="leading-tight">Baixar Aplicativo</span>
    </button>
  );
};

export const NotificationsTile = ({ userId }: { userId: string }) => {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void isPushEnabled().then(setOn); }, []);
  if (!pushSupported()) return null;

  const enable = async () => {
    setBusy(true);
    const r = await enablePush(userId);
    setBusy(false);
    if (r === "registered") { setOn(true); toast.success("Notificações ativadas neste dispositivo."); }
    else if (r === "open-in-new-tab") toast.info("Abra o site numa aba própria (ou no aplicativo) para ativar as notificações.");
    else if (r === "denied") toast.error("Notificações bloqueadas. Permita-as nas definições do navegador para este site.");
    else if (r === "unsupported") toast.error("Este navegador não suporta notificações.");
    else toast.error("Não foi possível ativar as notificações.");
  };
  return (
    <button type="button" onClick={() => void enable()} disabled={busy} className={tile}>
      {on ? <BellRing size={28} strokeWidth={1.8} className="text-primary" /> : <Bell size={28} strokeWidth={1.8} />}
      <span className="leading-tight">{on ? "Notificações ativas" : busy ? "A ativar..." : "Ativar notificações"}</span>
    </button>
  );
};
