# Project architecture

- Keep the shared bottom navigation in `BottomNav` at the router level so shop, roulette, profile, and product pages expose the same three destinations.
- Roulette prizes, vb$ wallet, ticket purchase and code redemption run through security-definer RPCs (spin_roulette, buy_tickets, redeem_code) so balances and winners are decided server-side, never by the client.
- Display product media with containment in fixed-size frames and a horizontally scrolling thumbnail strip so portrait and large galleries do not overflow the page.