export const ACTIVE_P2P_STATUSES = ["pending", "receipt_sent", "rejected", "disputed"] as const;

export const isActiveP2POrder = (order: { status: string }) =>
  ACTIVE_P2P_STATUSES.some(status => status === order.status);

export function uniqueP2POrders<T extends { id: string }>(orders: T[]): T[] {
  return Array.from(new Map(orders.map(order => [order.id, order])).values());
}

export function canCreateP2POrder(orders: { buyer_id: string; status: string }[], userId: string) {
  return !orders.some(order => order.buyer_id === userId && isActiveP2POrder(order));
}