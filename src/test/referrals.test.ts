import { describe, expect, it } from "vitest";
import { isReferralCode, canLinkReferral, canWithdrawReferral, referralShareMessage, REFERRAL_INVITEE_BONUS, REFERRAL_REFERRER_BONUS } from "@/lib/referrals";
describe("Referral mission rules", () => {
  it("uses MV + three digits + a letter + one digit", () => { expect(isReferralCode("MV742K9")).toBe(true); expect(isReferralCode("MV74299")).toBe(false); expect(isReferralCode("mv742K9")).toBe(false); });
  it("limits linking to the first 15 minutes", () => { const born = "2026-11-08T07:00:00Z"; expect(canLinkReferral(born, Date.parse("2026-11-08T07:14:59Z"), false, false)).toBe(true); expect(canLinkReferral(born, Date.parse("2026-11-08T07:15:00Z"), false, false)).toBe(false); });
  it("blocks a second reference", () => { expect(canLinkReferral("2026-11-08T07:00:00Z", Date.parse("2026-11-08T07:01:00Z"), true, false)).toBe(false); });
  it("blocks linking after a deposit", () => { expect(canLinkReferral("2026-11-08T07:00:00Z", Date.parse("2026-11-08T07:01:00Z"), false, true)).toBe(false); });
  it("awards 0.10 to the invitee", () => { expect(REFERRAL_INVITEE_BONUS).toBe(0.10); });
  it("awards 0.11 to the referrer", () => { expect(REFERRAL_REFERRER_BONUS).toBe(0.11); });
  it("requires at least 2 vb$ to withdraw", () => { expect(canWithdrawReferral(1.99)).toBe(false); expect(canWithdrawReferral(2)).toBe(true); });
  it("keeps the generated code when the message is edited", () => { const text = referralShareMessage("Olá {CODIGO}", "https://marchavb.com", "https://whatsapp.com/channel/test", "MV742K9"); expect(text).toContain("Código de partilha: MV742K9"); expect(text).toContain("https://marchavb.com"); expect(text).toContain("https://whatsapp.com/channel/test"); });
});