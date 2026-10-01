# Project architecture

- Keep the shared bottom navigation in `BottomNav` at the router level so shop, roulette, profile, and product pages expose the same three destinations.
- Treat the roulette as a client-side random product discovery view, not a prize or discount system, because no promotion rules exist.
- Display product media with containment in fixed-size frames and a horizontally scrolling thumbnail strip so portrait and large galleries do not overflow the page.