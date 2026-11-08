# Project architecture
- Enforce one active P2P order per buyer with a database uniqueness invariant and buyer-scoped transactional lock; synchronize existing chats, orders, offers and wallets through lifecycle-managed subscriptions so sellers can handle different buyers safely.
- Enforce P2P daily quotas and receipt deadlines in server RPCs; a single SQL scheduled job persists expired cancellations and releases reservations even with no connected users.
- Read ADM user directory/history through admin-only RPCs over existing tables; change bans through the authenticated admin edge function and enforce auth bans in the Data API pre-request hook so existing JWTs cannot spend funds.

- Keep the shared bottom navigation in `BottomNav` at the router level so shop, roulette, Correio, profile, and product pages expose consistent destinations.
- Roulette prizes, vb$ wallet, ticket purchase and code redemption run through security-definer RPCs (spin_roulette, buy_tickets, redeem_code) so balances and winners are decided server-side, never by the client.
- Display product media with containment in fixed-size frames and a horizontally scrolling thumbnail strip so portrait and large galleries do not overflow the page.
- Snapshot configured roulette prize content inside the server-side spin transaction into an owner-only inbox so winnings remain private and cannot be forged by clients.
- Store product video URLs alongside image URLs in the existing gallery and render media according to URL type so existing products stay compatible.
- Keep the router's bottom navigation in a separate flex row below a scrollable content viewport so no page can overlap it.
- Process vb$ purchases and consume ordered one-time product content in a single security-definer transaction, then show owner-only delivery snapshots in Correio; client code never debits wallets directly.
- Record site treasury payments from immutable delivery snapshots and debit funded recharge codes at creation through an append-only, admin-only ledger with transactional serialization; keep external recharge issuance separate to preserve existing operations.
- Resolve transfer recipients through an authenticated exact-public-ID RPC exposing only the recipient ID and name, because profiles are owner-only.
- Keep initial ADM navigation in a function grid and its operational views intact; persist appearance independently from animation mode in the shared settings provider.