/** Firestore / backend tier strings (canonical: beef | guac). */
export function isGuacProfileTier(tier: string | null | undefined): boolean {
  return tier === 'guac' || tier === 'gold' || tier === 'paid'
}

export type AccountTierShort = 'bean' | 'beef' | 'guac'

export function accountTierShort(
  isFirebaseConfigured: boolean,
  isAuthenticated: boolean,
  profileTier: string | undefined,
): AccountTierShort {
  if (!isFirebaseConfigured || !isAuthenticated) return 'bean'
  return isGuacProfileTier(profileTier) ? 'guac' : 'beef'
}
