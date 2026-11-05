// @refresh reset
// Wallet hook changes must remount consumers rather than reuse an old hook queue.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const formatVb = (n: number) => `${Number(n || 0).toFixed(2)} vb$`;

export function useWallet() {
  const { session } = useAuth();
  const [balance, setBalance] = useState(0);
  const [tickets, setTickets] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) { setBalance(0); setTickets(0); return; }
    const { data } = await (supabase as any).from("wallets").select("balance,tickets").eq("user_id", session.user.id).maybeSingle();
    setBalance(Number(data?.balance || 0));
    setTickets(Number(data?.tickets || 0));
  }, [session]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!session) return;
    const channel = supabase.channel(`wallet-${session.user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${session.user.id}` }, () => { void refresh(); })
      .subscribe();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { void supabase.removeChannel(channel); window.removeEventListener("focus", onFocus); };
  }, [session?.user.id, refresh]);
  return { balance, tickets, refresh };
}
