// Sends a stored notification to all of the user's registered devices.
// Only accepts a notification id; content always comes from the database, and each id is sent once.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { id } = await req.json().catch(() => ({}));
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
      return new Response(JSON.stringify({ error: "invalid id" }), { status: 400, headers: cors });
    }
    const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!pub || !priv) throw new Error("VAPID keys not configured");
    webpush.setVapidDetails("mailto:campionatovbtvff@gmail.com", pub, priv);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // claim atomically so it is never sent twice
    const { data: n } = await db.from("notifications").update({ sent_at: new Date().toISOString() })
      .eq("id", id).is("sent_at", null).select("*").maybeSingle();
    if (!n) return new Response(JSON.stringify({ skipped: true }), { headers: cors });

    const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", n.user_id);
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.id });
    let sent = 0;
    for (const s of subs || []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", code, (e as Error).message);
      }
    }
    return new Response(JSON.stringify({ sent }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: cors });
  }
});
