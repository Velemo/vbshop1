export const PROFILE_NAME_COOLDOWN_DAYS = 15;
export function nextProfileNameChange(changedAt: string | null, now = Date.now()): Date | null {
  if (!changedAt) return null;
  const next = new Date(Date.parse(changedAt) + PROFILE_NAME_COOLDOWN_DAYS * 86400000);
  return next.getTime() > now ? next : null;
}