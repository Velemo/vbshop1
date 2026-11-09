import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type Contact = { full_name: string; phone: string; email: string; name_changed_at: string; phone_changed_at: string; email_changed_at: string };

const DAY = 86400000;
const nextChange = (at: string, days: number) => new Date(new Date(at).getTime() + days * DAY);
const fmt = (d: Date) => d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const loadContact = async (uid: string): Promise<Contact | null> => {
  const { data } = await (supabase as any).from("user_contacts").select("*").eq("user_id", uid).maybeSingle();
  return data ?? null;
};

const ContactForm = ({ onSaved, compact }: { onSaved?: () => void; compact?: boolean }) => {
  const { session } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!session) return;
    const c = await loadContact(session.user.id);
    setContact(c);
    setName(c?.full_name ?? ""); setPhone(c?.phone ?? ""); setEmail(c?.email ?? session.user.email ?? "");
  };
  useEffect(() => { load(); }, [session?.user.id]);

  const now = new Date();
  const lock = (at: string | undefined, days: number) => (at && nextChange(at, days) > now ? nextChange(at, days) : null);
  const nameLock = contact ? lock(contact.name_changed_at, 15) : null;
  const phoneLock = contact ? lock(contact.phone_changed_at, 15) : null;
  const emailLock = contact ? lock(contact.email_changed_at, 15) : null;

  const save = async () => {
    setBusy(true);
    const { error } = await (supabase as any).rpc("save_contact", { _name: name, _phone: phone, _email: email });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Dados guardados"); await load(); onSaved?.();
  };

  const inp = "w-full p-2.5 rounded-xl bg-background border border-border text-sm disabled:opacity-60";
  const hint = (d: Date | null, days: number) => (
    <span className="block text-[11px] text-muted-foreground mt-0.5">
      {contact ? (d ? `Pode alterar novamente em ${fmt(d)}` : `Pode alterar agora (1 vez a cada ${days} dias)`) : ""}
    </span>
  );

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <label className="block text-xs font-medium">Nome
        <input value={name} maxLength={80} disabled={!!nameLock} onChange={e => setName(e.target.value)} className={inp} />
        {hint(nameLock, 15)}
      </label>
      <label className="block text-xs font-medium">Número de contacto
        <input value={phone} maxLength={20} inputMode="tel" placeholder="+258 84 000 0000" disabled={!!phoneLock} onChange={e => setPhone(e.target.value)} className={inp} />
        {hint(phoneLock, 15)}
      </label>
      <label className="block text-xs font-medium">E-mail
        <input type="email" value={email} maxLength={255} disabled={!!emailLock} onChange={e => setEmail(e.target.value)} className={inp} />
        {hint(emailLock, 15)}
      </label>
      <button onClick={save} disabled={busy} className="w-full p-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60">
        {busy ? "A guardar..." : "Guardar dados"}
      </button>
    </div>
  );
};

export default ContactForm;
