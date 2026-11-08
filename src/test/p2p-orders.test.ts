import { describe, expect, it } from "vitest";
import { canCreateP2POrder, isActiveP2POrder, uniqueP2POrders, p2pOrdersRemaining, p2pReceiptRemainingMs, p2pMaputoDay } from "@/lib/p2p-orders";

describe("P2P active purchase limit", () => {
  it("allows exactly five created orders per day, including cancelled orders", () => {
    expect(p2pOrdersRemaining(0)).toBe(5);
    expect(p2pOrdersRemaining(1)).toBe(4);
    expect(p2pOrdersRemaining(5)).toBe(0);
    expect(p2pOrdersRemaining(6)).toBe(0);
  });
  it("expires pending receipts at exactly 15 minutes", () => {
    const order = { status: "pending", created_at: "2026-11-08T07:00:00Z" };
    expect(p2pReceiptRemainingMs(order, Date.parse("2026-11-08T07:14:59Z"))).toBe(1000);
    expect(p2pReceiptRemainingMs(order, Date.parse("2026-11-08T07:15:00Z"))).toBe(0);
  });
  it("stops the timer after a receipt is sent", () => {
    expect(p2pReceiptRemainingMs({ status: "receipt_sent", created_at: "2026-11-08T07:00:00Z" }, Date.parse("2026-11-08T08:00:00Z"))).toBeNull();
  });
  it("starts a new daily allowance at Maputo midnight", () => {
    expect(p2pMaputoDay("2026-11-08T21:59:59Z")).toBe("2026-11-08");
    expect(p2pMaputoDay("2026-11-08T22:00:00Z")).toBe("2026-11-09");
  });
  for (const status of ["pending", "receipt_sent", "rejected", "disputed"]) {
    it(`blocks another purchase while ${status}`, () => {
      expect(canCreateP2POrder([{ buyer_id: "buyer", status }], "buyer")).toBe(false);
    });
  }
  it("allows buying again after approval or cancellation", () => {
    expect(canCreateP2POrder([{ buyer_id: "buyer", status: "confirmed" }, { buyer_id: "buyer", status: "cancelled" }], "buyer")).toBe(true);
  });
  it("does not prevent sellers handling other buyers", () => {
    expect(canCreateP2POrder([{ buyer_id: "other-buyer", status: "receipt_sent" }], "seller")).toBe(true);
  });
  it("deduplicates orders without deleting previous history", () => {
    const orders = uniqueP2POrders([{ id: "active", status: "pending" }, { id: "past", status: "confirmed" }, { id: "active", status: "pending" }]);
    expect(orders.map(order => order.id)).toEqual(["active", "past"]);
    expect(orders.filter(isActiveP2POrder)).toHaveLength(1);
  });
});