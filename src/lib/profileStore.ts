import type { User } from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { db, isFirebaseConfigured } from './firebaseClient'

export const DEFAULT_PROFILE_TIER = 'beef'

function profileRef(uid: string) {
  if (!db) throw new Error('Firestore not initialized')
  return doc(db, 'users', uid)
}

/** Canonical stored tiers: `beef` | `guac`. Legacy values normalized on read. */
export function normalizeTier(tier: unknown): typeof DEFAULT_PROFILE_TIER | 'guac' {
  if (tier === 'guac' || tier === 'gold' || tier === 'paid') return 'guac'
  if (tier === 'mvp' || tier === 'free') return 'beef'
  return DEFAULT_PROFILE_TIER
}

export function normalizeProfileTier(tier: unknown): typeof DEFAULT_PROFILE_TIER | 'guac' {
  return normalizeTier(tier)
}

export type UserProfileDoc = DocumentData & {
  uid?: string
  displayName?: string
  email?: string | null
  tier?: string
}

export async function getUserProfile(uid: string): Promise<UserProfileDoc | null> {
  if (!isFirebaseConfigured || !db || !uid) return null
  const snap = await getDoc(profileRef(uid))
  return snap.exists() ? (snap.data() as UserProfileDoc) : null
}

export async function ensureUserProfile(firebaseUser: User): Promise<UserProfileDoc | null> {
  if (!isFirebaseConfigured || !db || !firebaseUser?.uid) return null
  const ref = profileRef(firebaseUser.uid)
  const existing = await getDoc(ref)
  if (existing.exists()) {
    const data = existing.data() as UserProfileDoc
    const normalizedTier = normalizeTier(data.tier)
    if (data.tier !== normalizedTier) {
      await updateDoc(ref, { tier: normalizedTier, updatedAt: serverTimestamp() })
      return { ...data, tier: normalizedTier }
    }
    return data
  }

  const created: UserProfileDoc = {
    uid: firebaseUser.uid,
    displayName: firebaseUser.displayName || 'Player',
    email: firebaseUser.email ?? null,
    tier: DEFAULT_PROFILE_TIER,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  await setDoc(ref, created, { merge: true })
  return { ...created, createdAt: new Date(), updatedAt: new Date() }
}

export async function updateUserTier(uid: string, tier: string): Promise<void> {
  if (!isFirebaseConfigured || !db || !uid) return
  await updateDoc(profileRef(uid), {
    tier: normalizeTier(tier),
    updatedAt: serverTimestamp(),
  })
}
