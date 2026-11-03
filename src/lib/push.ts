import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BFl9gP6kZCZzscGySvXiS9f6hLhbZicONKMY_SNTNjtv9o2HZr5x_SIOIk8DxPow9pJfoynSUhPz4K-tpJakUjU";

export type PushResult = "registered" | "unsupported" | "open-in-new-tab" | "denied" | "error";

const b64ToBytes = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function isPushEnabled() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
  return !!(await reg?.pushManager.getSubscription());
}

/** Call from a click handler. */
export async function enablePush(userId: string): Promise<PushResult> {
  if (!pushSupported()) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return "denied";
  try {
    const reg = await navigator.serviceWorker.register("/push-sw.js");
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) }));
    const j = sub.toJSON();
    await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    const { error } = await (supabase as any).from("push_subscriptions").insert({
      user_id: userId, endpoint: sub.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth,
    });
    if (error) throw error;
    return "registered";
  } catch (e) {
    console.error("push subscribe failed", e);
    return "error";
  }
}
