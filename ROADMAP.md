# Calculator Cove — roadmap

Shipped locally (no online play yet): beach **Calculator Cove** branding, **vs computer** with three difficulties, **stats + `/stats`** (per-player W/L by mode key + quit counts), **multi-region boards** (1 / 2 / 4 quadrants) with per-turn **active quadrant** targeting, and **Island fleets** (battleship-style placement + factor aiming). See **`QUESTIONS.md`** for defaults you may want to revisit.

---

## Brand and presentation

### Rename to “Calculator Cove”

Rebrand copy, titles, routes/metadata, and repo-facing naming where appropriate so the product reads consistently as **Calculator Cove**.

### Beach leisure art direction

Shift visuals toward a **“playing games at the beach”** feel: palette, typography, backgrounds, and UI chrome that suggest sand, sun, water, and relaxed tabletop play—while keeping boards and factors readable.

---

## Single-player expansion

### Computer opponent with scalable difficulty

Add an AI player with **tunable difficulty** (e.g., lookahead depth, noise/strategy tiers, or heuristic strength) so solo play stays interesting from casual to challenging.

---

## Progression and persistence

### Profiles and leaderboards (Cakery Bakery–style)

Introduce **player profiles** and a **leaderboard layer** inspired by games like Cakery Bakery: track **wins, losses, and quits** (and/or similar stats) **per game mode** over time, with clear attribution and fair handling of abandoned matches.

---

## New mode: Battleship-flavored placement

### Hidden ships + factor aiming

Add a **Battleship-style mode** where players **place and commit ship positions** before main play. Core interaction keeps the **factor-chain selection mechanic** to aim “shots” rather than free picking arbitrary cells.

### Scalable board footprint

Support **larger boards** by optionally adding **one or three extra quadrants** relative to a baseline (resulting in **1, 2, or 4 quadrants** total). Players choose **which quadrant** to act in on their turn while still using factors to target within that region.

---

## Multiplayer

### Real-time online play

Add **online competition** so players can face others **in real time** (matchmaking or invites, synchronized game state, reconnection and fairness rules TBD).

---

## Notes for future implementation

- Order above is **not** prescribed; dependencies (e.g., persistence before leaderboards, netcode before ranked online) should drive sequencing.
- Each major bullet likely deserves its own design pass: rules clarity, UX flows, and technical spikes (especially battleship + multi-quadrant factor mapping and online sync).
