export const ACTIVE_P2P_STATUSES = ["pending", "receipt_sent", "rejected", "disputed"] as const;
export const P2P_DAILY_LIMIT = 5;
export const P2P_RECEIPT_TIMEOUT_MS = 15 * 60 * 1000;

export function p2pReceiptRemainingMs(order: { status: string; created_at: string }, now = Date.now()) {
  return order.status === "pending" ? Math.max(0, Date.parse(order.created_at) + P2P_RECEIPT_TIMEOUT_MS - now) : null;
}

export function p2pOrdersRemaining(used: number) {
  return Math.max(0, P2P_DAILY_LIMIT - used);
}

export function p2pMaputoDay(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Maputo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}

export const isActiveP2POrder = (order: { status: string }) =>
  ACTIVE_P2P_STATUSES.some(status => status === order.status);

export function uniqueP2POrders<T extends { id: string }>(orders: T[]): T[] {
  return Array.from(new Map(orders.map(order => [order.id, order])).values());
}

export function canCreateP2POrder(orders: { buyer_id: string; status: string }[], userId: string) {
  return !orders.some(order => order.buyer_id === userId && isActiveP2POrder(order));
}