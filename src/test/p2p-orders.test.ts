import { describe, expect, it } from "vitest";
import { canCreateP2POrder, isActiveP2POrder, uniqueP2POrders } from "@/lib/p2p-orders";

describe("P2P active purchase limit", () => {
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