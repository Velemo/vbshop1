import { useEffect, useState } from "react";
import { p2pReceiptRemainingMs } from "@/lib/p2p-orders";

export default function P2PReceiptDeadline({ createdAt, onExpired }: { createdAt: string; onExpired?: () => void }) {
  const [now, setNow] = useState(Date.now());
  const remaining = p2pReceiptRemainingMs({ status: "pending", created_at: createdAt }, now) ?? 0;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (remaining === 0) onExpired?.(); }, [remaining, onExpired]);
  const seconds = Math.ceil(remaining / 1000);
  return <p className={`mt-2 text-sm ${remaining ? "text-muted-foreground" : "text-destructive"}`}>
    {remaining ? `Enviar comprovativo em ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Prazo terminado · Pedido expirado"}
  </p>;
}