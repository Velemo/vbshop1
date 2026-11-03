export type UserSort = "newest" | "name-asc" | "name-desc" | "balance-desc" | "balance-asc";
export type AdminUser = {
  user_id: string; email: string | null; account_created_at: string;
  user_code: string | null; display_name: string | null; avatar_url: string | null;
  balance: number; tickets: number; is_banned: boolean; is_vip?: boolean;
};

export function filterAndSortUsers(users: AdminUser[], search: string, sort: UserSort) {
  const query = search.trim().toLocaleLowerCase();
  return users.filter(user => [user.display_name, user.email, user.user_code].some(value => (value || "").toLocaleLowerCase().includes(query)))
    .sort((a, b) => {
      if (sort === "name-asc" || sort === "name-desc") {
        const comparison = (a.display_name || "").localeCompare(b.display_name || "", "pt", { sensitivity: "base" });
        return (sort === "name-asc" ? comparison : -comparison) || (a.user_code || "").localeCompare(b.user_code || "");
      }
      if (sort === "balance-asc" || sort === "balance-desc") {
        const comparison = Number(a.balance) - Number(b.balance);
        return (sort === "balance-asc" ? comparison : -comparison) || (a.user_code || "").localeCompare(b.user_code || "");
      }
      return Date.parse(b.account_created_at) - Date.parse(a.account_created_at);
    });
}