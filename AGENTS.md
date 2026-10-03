# Project architecture

- Keep the shared bottom navigation in `BottomNav` at the router level so shop, roulette, Correio, profile, and product pages expose consistent destinations.
- Roulette prizes, vb$ wallet, ticket purchase and code redemption run through security-definer RPCs (spin_roulette, buy_tickets, redeem_code) so balances and winners are decided server-side, never by the client.
- Display product media with containment in fixed-size frames and a horizontally scrolling thumbnail strip so portrait and large galleries do not overflow the page.
- Snapshot configured roulette prize content inside the server-side spin transaction into an owner-only inbox so winnings remain private and cannot be forged by clients.
- Store product video URLs alongside image URLs in the existing gallery and render media according to URL type so existing products stay compatible.