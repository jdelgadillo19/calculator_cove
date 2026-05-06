# Calculator Cove

Multiplication connect-four style game for **Gojito Games**. Tiers match the platform:

| Tier | Meaning (short) |
|------|------------------|
| **Bean** | Logged out / cookie-only |
| **Beef** | Free account (Firestore); future online leaderboards & competitive modes will require at least this |
| **Guac** | Paid entitlement (authoritative state in Workers KV, synced from Stripe or manual admin grant) |

Guac-gated previews (Battleship / larger boards) show a placeholder screen until gameplay is ready.

## Setup

```bash
npm install
cp .env.example .env.local
# fill VITE_FIREBASE_* and VITE_GOJITO_API_URL
npm run dev
```

## Selective Guac grant (your accounts)

Paid tier is stored in **`gojito-backend`** KV. Do **not** put `GOJITO_ADMIN_SECRET` in any `VITE_*` variable.

**Option A — CLI (recommended)** from `gojito-backend/`:

```bash
GOJITO_API_URL="https://<worker>" GOJITO_ADMIN_SECRET="$GOJITO_ADMIN_SECRET" \
  npm run grant-guac -- "<Firebase UID>" true
```

Use `false` instead of `true` to revoke Guac (user becomes Beef).

**Option B — curl** — same as documented in `gojito-backend/README.md` (`POST /api/admin/entitlements`).

After granting, in Calculator Cove open **Account → Refresh Guac access** (or sign out/in).

In **development only**, the Account dialog includes a collapsible **Developer** section with your Firebase UID and ready-to-run curl snippets (still using `$GOJITO_ADMIN_SECRET` only on your machine).

## Scripts

- `npm run dev` — Vite dev server  
- `npm run build` — production build  
- `npm run test` — Vitest  
