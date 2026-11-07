import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const token = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const authenticated = token ? createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } }) : null;
describe.skipIf(!authenticated)("site wallet financial guards", () => {
  it("cannot issue more vb$ than the site wallet contains", async () => {
    if (!authenticated) throw new Error("Authenticated test session required");
    const before = await authenticated.rpc("admin_site_wallet_summary");
    expect(before.error).toBeNull();
    const result = await authenticated.rpc("admin_generate_site_recharge", { _amount: Number(before.data.balance) + 1 });
    expect(result.error?.message).toContain("Saldo insuficiente");
    const after = await authenticated.rpc("admin_site_wallet_summary");
    expect(after.data.balance).toBe(before.data.balance);
    expect(after.data.issued).toBe(before.data.issued);
  });
  it("rejects zero-value funded recharge codes", async () => {
    if (!authenticated) throw new Error("Authenticated test session required");
    const result = await authenticated.rpc("admin_generate_site_recharge", { _amount: 0 });
    expect(result.error?.message).toContain("Valor inválido");
  });
  it("keeps site wallet information inaccessible without sign-in", async () => {
    const anonymous = createClient(url, key, { auth: { persistSession: false } });
    const result = await anonymous.rpc("admin_site_wallet_summary");
    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
  });
});