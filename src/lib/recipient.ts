export type TransferRecipient = { user_id: string; display_name: string; user_code: string };
export function readRecipient(data: unknown): TransferRecipient | null {
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row.user_id !== "string" || typeof row.display_name !== "string" || !row.display_name.trim() || typeof row.user_code !== "string") return null;
  return { user_id: row.user_id, display_name: row.display_name, user_code: row.user_code };
}