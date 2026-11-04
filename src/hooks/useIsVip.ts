import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

let cache: { uid: string; vip: boolean; at: number } | null = null;
let pending: Promise<boolean> | null = null;

const fetchVip = (uid: string) => {
  if (cache && cache.uid === uid && Date.now() - cache.at < 60_000) return Promise.resolve(cache.vip);
  if (!pending) {
    pending = (supabase as any).rpc("is_vip", { _user_id: uid }).then(({ data }: any) => {
      cache = { uid, vip: !!data, at: Date.now() };
      pending = null;
      return !!data;
    });
  }
  return pending!;
};

/** Estado VIP ativo (validado no servidor, respeita expiração). */
export const useIsVip = () => {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [vip, setVip] = useState(!!uid && cache?.uid === uid ? cache.vip : false);
  useEffect(() => {
    if (!uid) { setVip(false); return; }
    let alive = true;
    fetchVip(uid).then((v) => alive && setVip(v));
    return () => { alive = false; };
  }, [uid]);
  return vip;
};
