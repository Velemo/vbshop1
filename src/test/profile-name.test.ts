import { describe, expect, it } from "vitest";
import { nextProfileNameChange } from "@/lib/profile-name";

describe("Profile name cooldown", () => {
  it("blocks another name change until exactly 15 days have passed", () => {
    const changed = "2026-11-01T00:00:00Z";
    expect(nextProfileNameChange(changed, Date.parse("2026-11-15T23:59:59Z"))?.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    expect(nextProfileNameChange(changed, Date.parse("2026-11-16T00:00:00Z"))).toBeNull();
  });
  it("allows the first name change", () => {
    expect(nextProfileNameChange(null)).toBeNull();
  });
});