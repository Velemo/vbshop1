import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWallet, formatVb } from "@/hooks/useWallet";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
export default function SendVb() {
 const {session}=useAuth(); const {balance,refresh}=useWallet(); const navigate=useNavigate();
 const [recipient,setRecipient]=useState(""); const [amount,setAmount]=useState(""); const [sending,setSending]=useState(false); const [recipientInfo,setRecipientInfo]=useState<{user_id:string;display_name:string;user_code:string}|null>(null); const [confirmOpen,setConfirmOpen]=useState(false);
 const submit=async()=>{if(!session){navigate("/auth");return;} const value=Number(amount);
 if(!recipient.trim()){toast.error("Introduza o ID do destinatário.");return;}
 if(!Number.isFinite(value)||value<=0||value>balance){toast.error("Valor inválido ou saldo insuficiente.");return;}
 const {data,error}=await (supabase as any).from("profiles").select("user_id,display_name,user_code").eq("user_code",recipient.trim()).maybeSingle();
 if(error||!data){toast.error("ID de utilizador não encontrado.");return;}
 if(data.user_id===session.user.id){toast.error("Não pode enviar vb$ para si mesmo.");return;}
 setRecipientInfo(data);setConfirmOpen(true);
 };
 const confirmSend=async()=>{if(!session||!recipientInfo)return;const value=Number(amount);setSending(true);
 const {error}=await (supabase as any).rpc("send_vb_by_user_code",{p_recipient_code:recipientInfo.user_code,p_amount:value});setSending(false);
 if(error){toast.error(error.message||"Não foi possível enviar vb$.");return;}
 toast.success("Transferência concluída.");setRecipient("");setAmount("");setRecipientInfo(null);setConfirmOpen(false);await refresh();};
 return <main className="mx-auto max-w-xl min-h-screen px-4 pt-6 pb-28"><Link to="/perfil" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18}/> Voltar ao perfil</Link><h1 className="mt-5 font-display text-3xl font-bold">Enviar vb$</h1><p className="mt-2 text-sm text-muted-foreground">Transfira vb$ para outro utilizador.</p><div className="mt-6 rounded-2xl border border-border p-4"><p className="text-sm text-muted-foreground">Saldo disponível</p><p className="text-2xl font-bold">{formatVb(balance)}</p></div><div className="mt-5 space-y-4"><div><label htmlFor="recipient" className="mb-1 block text-sm font-medium">ID do destinatário</label><input id="recipient" value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Ex.: mv00000001" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/></div><div><label htmlFor="amount" className="mb-1 block text-sm font-medium">Quantidade de vb$</label><input id="amount" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ex.: 10" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/></div><p className="text-xs text-muted-foreground">Confirme o ID antes de enviar. As transferências concluídas podem não ser reversíveis.</p><Button className="w-full" onClick={submit} disabled={sending}><Send size={17} className="mr-2"/>Continuar</Button>
 {confirmOpen && recipientInfo && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-xl"><h2 className="text-lg font-bold">Confirmar transferência</h2><p className="mt-3 text-sm text-muted-foreground">Destinatário</p><p className="font-semibold">{recipientInfo.display_name || "Utilizador"}</p><p className="text-sm text-muted-foreground">{recipientInfo.user_code}</p><p className="mt-4 text-sm text-muted-foreground">Valor a enviar</p><p className="text-2xl font-bold">{formatVb(Number(amount))}</p><p className="mt-2 text-xs text-muted-foreground">Sem taxa de envio.</p><div className="mt-5 flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>setConfirmOpen(false)} disabled={sending}>Voltar</Button><Button className="flex-1" onClick={()=>void confirmSend()} disabled={sending}>{sending?"A enviar...":"Confirmar"}</Button></div></div></div>}</div></main>;
}