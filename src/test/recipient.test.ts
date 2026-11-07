import { describe, it, expect } from "vitest";
import { readRecipient } from "@/lib/recipient";
describe("recipient confirmation", () => {
  it("returns the recipient name and public ID", () => {
    expect(readRecipient([{ user_id: "recipient", user_code: "mv00000001", display_name: "Maria" }])).toEqual({ user_id: "recipient", user_code: "mv00000001", display_name: "Maria" });
  });
  it("does not confirm a transfer without a recipient name", () => {
    expect(readRecipient([{ user_id: "recipient", user_code: "mv00000001", display_name: "" }])).toBeNull();
  });
});