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
  return { balance, tickets, refresh };
}
