export function validateStatusChange(body: unknown, callerId: string): { user_id: string; banned: boolean } {
  if (!body || typeof body !== "object" || !("user_id" in body) || !("banned" in body) || typeof body.user_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.user_id) || typeof body.banned !== "boolean") {
    throw new Error("Pedido inválido");
  }
  if (body.user_id === callerId) throw new Error("Não podes alterar o bloqueio da tua própria conta");
  return { user_id: body.user_id, banned: body.banned };
}