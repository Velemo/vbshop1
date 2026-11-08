export const REFERRAL_INVITEE_BONUS = 0.10;
export const REFERRAL_REFERRER_BONUS = 0.11;
export const REFERRAL_MIN_WITHDRAWAL = 2;
export const REFERRAL_WINDOW_MS = 15 * 60 * 1000;
export const isReferralCode = (code: string) => /^MV\d{3}[A-Z]\d$/.test(code);
export const canWithdrawReferral = (balance: number) => balance >= REFERRAL_MIN_WITHDRAWAL;
export const canLinkReferral = (createdAt: string, now: number, linked: boolean, deposited: boolean) =>
  !linked && !deposited && now < Date.parse(createdAt) + REFERRAL_WINDOW_MS;
export function referralShareMessage(message: string, site: string, channel: string, code: string) {
  const text = message.replace(/\{CODIGO\}/g, "").replace(/\{SITE\}|\{LINK\}/g, site).replace(/\{CANAL\}/g, channel).trim();
  return `${text}${text.includes(site) ? "" : `\n${site}`}${text.includes(channel) ? "" : `\n${channel}`}\nCódigo de partilha: ${code}`;
}
export type ReferralDashboard = {
  code: string; pending_balance: number; invited: number; qualified: number; can_link: boolean; deadline: string; server_now: string;
  settings: { message: string; channel_url: string };
  movements: { kind: string; amount: number; created_at: string }[];
};