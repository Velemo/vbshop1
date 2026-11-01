import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { validateStatusChange } from "./validation.ts";

Deno.serve(async (req: Request) => {
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Método inválido" });
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return respond(401, { error: "Inicia sessão" });
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return respond(500, { error: "Serviço indisponível" });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(header.slice(7));
  if (authError || !auth.user) return respond(401, { error: "Sessão inválida" });
  const { data: caller, error: callerError } = await admin.auth.admin.getUserById(auth.user.id);
  if (callerError || !caller.user || (caller.user.banned_until && Date.parse(caller.user.banned_until) > Date.now())) return respond(403, { error: "Conta bloqueada" });
  const { data: role, error: roleError } = await admin.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (roleError || !role) return respond(403, { error: "Acesso reservado ao administrador" });
  let change;
  try { change = validateStatusChange(await req.json(), auth.user.id); }
  catch (error) { return respond(400, { error: error instanceof Error ? error.message : "Pedido inválido" }); }
  const { data, error } = await admin.auth.admin.updateUserById(change.user_id, { ban_duration: change.banned ? "876000h" : "none" });
  if (error || !data.user) return respond(400, { error: "Não foi possível alterar o estado da conta" });
  return respond(200, { success: true, is_banned: !!data.user.banned_until && Date.parse(data.user.banned_until) > Date.now() });
});