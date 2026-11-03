import { describe, expect, it } from "vitest";
import { applyVipDiscount } from "../lib/product";

describe("Desconto VIP", () => {
  it("VIP paga 30% menos quando o produto tem Desconto VIP", () => {
    expect(applyVipDiscount(10, true, true)).toBe(7);
    expect(applyVipDiscount(1.7, true, true)).toBe(1.19);
  });
  it("Não VIP paga o preço normal mesmo com Desconto VIP ativo", () => {
    expect(applyVipDiscount(10, false, true)).toBe(10);
  });
  it("Produto sem Desconto VIP custa o preço normal para todos", () => {
    expect(applyVipDiscount(10, true, false)).toBe(10);
    expect(applyVipDiscount(10, true, undefined)).toBe(10);
  });
});
