import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWallet, formatVb } from "@/hooks/useWallet";
import { useAuth } from "@/contexts/AuthContext";
import { useSound } from "@/contexts/SoundContext";
import { toast } from "sonner";
export default function SendVb() {
 const {session}=useAuth(); const {balance,refresh}=useWallet(); const navigate=useNavigate(); const {playNotification}=useSound();
 const [recipient,setRecipient]=useState(""); const [amount,setAmount]=useState(""); const [sending,setSending]=useState(false);
 const submit=async()=>{if(!session){navigate("/auth");return;} const value=Number(amount);
 if(!/^[0-9a-f-]{36}$/i.test(recipient.trim())){toast.error("Introduza o ID válido do destinatário.");return;}
 if(!Number.isFinite(value)||value<=0||value>balance){toast.error("Valor inválido ou saldo insuficiente.");return;}
 setSending(true); const {error}=await (supabase as any).rpc("transfer_vb",{_recipient_user_id:recipient.trim(),_amount:value});setSending(false);
 if(error){toast.error(error.message||"Não foi possível enviar vb$.");return;}toast.success("Transferência concluída.");playNotification();setRecipient("");setAmount("");await refresh();};
 return <main className="mx-auto max-w-xl min-h-screen px-4 pt-6 pb-28"><Link to="/perfil" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar ao perfil</Link><h1 className="mt-5 font-display text-3xl font-bold">Enviar vb$</h1><p className="mt-2 text-sm text-muted-foreground">Transfira vb$ para outro utilizador.</p><div className="mt-6 rounded-2xl border border-border p-4"><p className="text-sm text-muted-foreground">Saldo disponível</p><p className="text-2xl font-bold">{formatVb(balance)}</p></div><div className="mt-5 space-y-4"><div><label htmlFor="recipient" className="mb-1 block text-sm font-medium">ID do destinatário</label><input id="recipient" value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="ID de utilizador (UUID)" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/></div><div><label htmlFor="amount" className="mb-1 block text-sm font-medium">Quantidade de vb$</label><input id="amount" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ex.: 10" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/></div><p className="text-xs text-muted-foreground">Confirme o ID antes de enviar. As transferências concluídas podem não ser reversíveis.</p><Button className="w-full" onClick={submit} disabled={sending}><Send size={17} className="mr-2"/>{sending?"A enviar...":"Confirmar envio"}</Button></div></main>;
}