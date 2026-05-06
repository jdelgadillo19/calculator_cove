# Open questions (post-v1 build)

These items were **not** blocking shipping defaults; confirm when you’re back if you want behavior changed.

1. **Battleship fleet** — Implemented as **one straight ship of length 3** per player (orthogonal adjacency). Do you want classic multi-ship lengths later?

2. **Pass-and-play fog** — One shared screen shows **both fleets after placement** (honor-system / “look away” style). Should we add a stricter “shield” UI or device handoff flow?

3. **Stats identity** — Wins / losses / quits are keyed by **normalized player display names** from the menu (plus mode keys). OK for single-device play, or do you want explicit profile slots?

4. **Quadrants + Battleship ocean split** — Default ocean ownership: **Q1** shared board; **Q2** left 6×6 vs right 6×6; **Q4** Q0+Q3 vs Q1+Q2 in a 12×12 layout. Prefer a different partition?

5. **Computer opponent** — Human is always **Player 1** vs **CPU Player 2** when enabled. Should Player 2 ever be human while Player 1 is CPU?
