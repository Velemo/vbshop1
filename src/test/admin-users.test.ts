import { describe, expect, it } from "vitest";
import { filterAndSortUsers, type AdminUser } from "../lib/admin-users";
import { validateStatusChange } from "../../supabase/functions/admin-user-status/validation";

const users: AdminUser[] = [
  { user_id: "00000000-0000-4000-8000-000000000001", display_name: "Zélia", email: "zelia@example.com", user_code: "mv00000001", balance: 10, tickets: 0, avatar_url: null, is_banned: false, account_created_at: "2026-01-01" },
  { user_id: "00000000-0000-4000-8000-000000000002", display_name: "Ana", email: "ana@example.com", user_code: "mv00000002", balance: 25, tickets: 0, avatar_url: null, is_banned: false, account_created_at: "2026-02-01" },
];
describe("ADM user rules", () => {
  it("sorts names A–Z", () => expect(filterAndSortUsers(users, "", "name-asc").map(u => u.display_name)).toEqual(["Ana", "Zélia"]));
  it("sorts names Z–A", () => expect(filterAndSortUsers(users, "", "name-desc").map(u => u.display_name)).toEqual(["Zélia", "Ana"]));
  it("sorts highest balance first", () => expect(filterAndSortUsers(users, "", "balance-desc").map(u => u.balance)).toEqual([25, 10]));
  it("sorts lowest balance first", () => expect(filterAndSortUsers(users, "", "balance-asc").map(u => u.balance)).toEqual([10, 25]));
  it.each(["ana", "ANA@EXAMPLE.COM", "mv00000002"])("searches name, email and public ID: %s", query => expect(filterAndSortUsers(users, query, "newest").map(u => u.user_code)).toEqual(["mv00000002"]));
  it("does not search internal UUIDs", () => expect(filterAndSortUsers(users, users[0].user_id, "newest")).toEqual([]));
  it("prevents ADM from banning itself", () => expect(() => validateStatusChange({ user_id: users[0].user_id, banned: true }, users[0].user_id)).toThrow());
  it("accepts real ban and unblock commands", () => {
    expect(validateStatusChange({ user_id: users[1].user_id, banned: true }, users[0].user_id).banned).toBe(true);
    expect(validateStatusChange({ user_id: users[1].user_id, banned: false }, users[0].user_id).banned).toBe(false);
  });
  it("rejects non-boolean ban commands", () => expect(() => validateStatusChange({ user_id: users[1].user_id, banned: "false" }, users[0].user_id)).toThrow());
});