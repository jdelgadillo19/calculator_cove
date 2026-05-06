import type { User } from 'firebase/auth'
import {
  getUserProfile,
  normalizeProfileTier,
  updateUserTier,
} from './profileStore'

export function gojitoApiBaseUrl(): string {
  const raw = import.meta.env.VITE_GOJITO_API_URL
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/\/+$/, '')
}

/**
 * Sync authoritative tier from gojito-backend into Firestore `users/{uid}.tier`.
 */
export async function syncFirestoreTierFromGojitoBackend(
  firebaseUser: User,
  opts: { forceRefreshToken?: boolean } = {},
): Promise<Awaited<ReturnType<typeof getUserProfile>>> {
  const base = gojitoApiBaseUrl()
  if (!base || !firebaseUser?.uid) return null

  let token: string
  try {
    token = await firebaseUser.getIdToken(Boolean(opts.forceRefreshToken))
  } catch {
    return null
  }

  let res: Response
  try {
    res = await fetch(`${base}/api/entitlements/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return null
  }

  if (!res.ok) return null

  let data: { profileTier?: string }
  try {
    data = (await res.json()) as { profileTier?: string }
  } catch {
    return null
  }

  const remoteTier = data.profileTier === 'guac' ? 'guac' : 'beef'

  try {
    const existing = await getUserProfile(firebaseUser.uid)
    const localTier = normalizeProfileTier(existing?.tier)
    if (localTier === remoteTier) {
      return existing
    }
    await updateUserTier(firebaseUser.uid, remoteTier)
    return await getUserProfile(firebaseUser.uid)
  } catch {
    return null
  }
}
