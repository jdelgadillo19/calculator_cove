import { useMemo, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { gojitoApiBaseUrl } from '../lib/gojitoEntitlements'
import { FUTURE_BEEF_FOR_ONLINE_COPY } from '../lib/tierRoadmap'

const TIER_COPY: Record<
  'bean' | 'beef' | 'guac',
  { short: string; full: string }
> = {
  bean: {
    short: 'Bean tier',
    full: 'Gojito’s bean burrito buddies',
  },
  beef: {
    short: 'Beef tier',
    full: 'Gojito’s Beefy Supreme Team',
  },
  guac: {
    short: 'Guac tier',
    full: 'Gojito’s Guacamole Gang',
  },
}

type AccountToolbarProps = {
  isGameBreakingState: boolean
  onRequireSafeExit?: () => void
}

export function AccountToolbar({ isGameBreakingState, onRequireSafeExit }: AccountToolbarProps) {
  const {
    accountTier,
    user,
    isFirebaseConfigured,
    isAuthenticated,
    isLoadingAuth,
    authError,
    signInWithGoogle,
    logout,
    refreshEntitlements,
  } = useAuth()
  const [open, setOpen] = useState(false)
  const [refreshNote, setRefreshNote] = useState<string | null>(null)

  const tierLabel = useMemo(() => TIER_COPY[accountTier].short, [accountTier])

  const handleOpen = () => {
    if (isGameBreakingState && onRequireSafeExit) {
      onRequireSafeExit()
      return
    }
    setOpen(true)
  }

  const onRefreshAccess = async () => {
    setRefreshNote(null)
    const ok = await refreshEntitlements()
    setRefreshNote(
      ok ? 'Access refreshed from Gojito.' : 'Could not refresh — try again or sign out and back in.',
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-xs text-yellow-100/90">
          {tierLabel}
        </span>
        <button
          type="button"
          onClick={handleOpen}
          className="rounded-lg border border-white/20 bg-black/30 px-3 py-1.5 text-xs font-semibold text-yellow-100 hover:bg-black/45"
        >
          Account
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Account management"
            className="w-full max-w-sm rounded-xl border border-white/20 bg-neutral-900 p-5 text-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--color-mc-yellow)]">Gojito Games account</h2>
            <p className="mt-1 text-sm text-yellow-100/80">
              You’re on <strong>{TIER_COPY[accountTier].full}</strong> ({tierLabel}).
            </p>

            <p className="mt-3 text-xs leading-snug text-yellow-100/55">{FUTURE_BEEF_FOR_ONLINE_COPY}</p>

            {!isFirebaseConfigured && (
              <p className="mt-3 text-xs text-amber-200/90">
                Firebase env vars are not configured for this build — everyone stays on Bean tier until `VITE_FIREBASE_*`
                keys are set.
              </p>
            )}

            {isFirebaseConfigured && isAuthenticated && (
              <p className="mt-3 text-xs text-yellow-100/70">
                Signed in as <strong>{user.full_name}</strong>
                {user.email ? ` (${user.email})` : ''}.
              </p>
            )}

            {isLoadingAuth && (
              <p className="mt-3 text-xs text-yellow-100/60">Checking session…</p>
            )}

            {authError && (
              <p className="mt-3 text-xs text-red-300/95">{authError.message}</p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2">
              {isFirebaseConfigured && !isAuthenticated && (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="rounded-lg bg-[var(--color-mc-purple)] px-3 py-2.5 text-sm font-bold text-[var(--color-mc-yellow)] hover:bg-[var(--color-mc-purple-deep)]"
                >
                  Sign in with Google (recommended)
                </button>
              )}
              {isFirebaseConfigured && isAuthenticated && (
                <>
                  <button
                    type="button"
                    onClick={() => void onRefreshAccess()}
                    className="rounded-lg border border-yellow-400/35 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100 hover:bg-yellow-500/15"
                  >
                    Refresh Guac access
                  </button>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="rounded-lg border border-white/20 bg-black/35 px-3 py-2 text-sm hover:bg-black/50"
                  >
                    Sign out
                  </button>
                </>
              )}
            </div>

            {refreshNote && (
              <p className="mt-3 text-xs text-yellow-100/75">{refreshNote}</p>
            )}

            {import.meta.env.DEV && isFirebaseConfigured && (
              <DevGuacGrantPanel firebaseUid={isAuthenticated ? user.id : null} />
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-[var(--color-mc-purple)] px-4 py-2 text-sm font-bold text-[var(--color-mc-yellow)] hover:bg-[var(--color-mc-purple-deep)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function escapeForDoubleQuotedShell(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function grantGuacCurlCommand(base: string, uid: string, grantGuac: boolean): string {
  const root = base.replace(/\/+$/, '') || 'https://<your-worker-host>'
  const body = escapeForDoubleQuotedShell(JSON.stringify({ firebaseUid: uid, grantGuac }))
  return [
    `curl -sS -X POST "${root}/api/admin/entitlements" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "X-Gojito-Admin-Secret: $GOJITO_ADMIN_SECRET" \\`,
    `  -d "${body}"`,
  ].join('\n')
}

function DevGuacGrantPanel({ firebaseUid }: { firebaseUid: string | null }) {
  const [copied, setCopied] = useState<'curl' | 'uid' | null>(null)
  const apiBase = gojitoApiBaseUrl()
  const uidForCurl = firebaseUid ?? '<YOUR_FIREBASE_UID>'
  const curlGrant = grantGuacCurlCommand(apiBase, uidForCurl, true)
  const curlRevoke = grantGuacCurlCommand(apiBase, uidForCurl, false)

  const flash = (which: 'curl' | 'uid') => {
    setCopied(which)
    window.setTimeout(() => setCopied(null), 2000)
  }

  const copyCurlGrant = async () => {
    try {
      await navigator.clipboard.writeText(curlGrant)
      flash('curl')
    } catch {
      /* ignore */
    }
  }

  const copyUid = async () => {
    if (!firebaseUid) return
    try {
      await navigator.clipboard.writeText(firebaseUid)
      flash('uid')
    } catch {
      /* ignore */
    }
  }

  return (
    <details className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-left">
      <summary className="cursor-pointer text-xs font-semibold text-amber-100/95">
        Developer — selective Guac override (admin API)
      </summary>
      <p className="mt-2 text-[11px] leading-snug text-yellow-100/65">
        Authoritative tier lives in Workers KV. Grant Guac for a specific Firebase UID using{' '}
        <code className="rounded bg-black/35 px-1 py-0.5 text-yellow-100/85">GOJITO_ADMIN_SECRET</code>{' '}
        on your machine — never put that secret in Vite env. Then tap “Refresh Guac access”, or use{' '}
        <code className="rounded bg-black/35 px-1 py-0.5">npm run grant-guac</code> in{' '}
        <code className="rounded bg-black/35 px-1 py-0.5">gojito-backend/</code>.
      </p>
      {firebaseUid ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-yellow-100/70">Your UID</span>
          <code className="max-w-full truncate rounded bg-black/35 px-2 py-1 text-[10px] text-amber-100/90">
            {firebaseUid}
          </code>
          <button
            type="button"
            onClick={() => void copyUid()}
            className="rounded border border-white/20 px-2 py-1 text-[11px] text-yellow-100 hover:bg-white/10"
          >
            {copied === 'uid' ? 'Copied' : 'Copy UID'}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-yellow-100/60">Sign in to show your Firebase UID for copy/paste.</p>
      )}
      <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-yellow-100/50">
        Grant Guac
      </p>
      <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 font-mono text-[10px] leading-snug text-green-200/90">
        {curlGrant}
      </pre>
      <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-yellow-100/50">
        Revoke → Beef
      </p>
      <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded bg-black/40 p-2 font-mono text-[10px] leading-snug text-green-200/90">
        {curlRevoke}
      </pre>
      <button
        type="button"
        onClick={() => void copyCurlGrant()}
        className="mt-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-50 hover:bg-amber-500/15"
      >
        {copied === 'curl' ? 'Copied grant command' : 'Copy grant command'}
      </button>
    </details>
  )
}
