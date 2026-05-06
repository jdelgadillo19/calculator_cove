import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider, isFirebaseConfigured } from './firebaseClient'
import {
  ensureUserProfile,
  getUserProfile,
  normalizeTier,
  type UserProfileDoc,
} from './profileStore'
import { syncFirestoreTierFromGojitoBackend } from './gojitoEntitlements'
import {
  accountTierShort,
  type AccountTierShort,
} from './tier'

type CoveUser = {
  id: string
  full_name: string
  email: string | null
}

type AuthContextValue = {
  user: CoveUser
  profile: UserProfileDoc | null
  /** Firestore-backed tier when signed in (`beef` | `guac`); undefined when logged out. */
  profileTier: string | undefined
  accountTier: AccountTierShort
  hasGuacEntitlement: boolean
  isFirebaseConfigured: boolean
  isAuthenticated: boolean
  isLoadingAuth: boolean
  authError: { type: string; message: string } | null
  logout: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  refreshEntitlements: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CoveUser>({
    id: 'local',
    full_name: 'Player',
    email: null,
  })
  const [profile, setProfile] = useState<UserProfileDoc | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(isFirebaseConfigured)
  const [authError, setAuthError] = useState<{ type: string; message: string } | null>(
    null,
  )

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setIsLoadingAuth(false)
      setIsAuthenticated(false)
      setProfile(null)
      return
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        setIsLoadingAuth(true)
        if (!firebaseUser) {
          setUser({ id: 'local', full_name: 'Player', email: null })
          setProfile(null)
          setIsAuthenticated(false)
          setAuthError(null)
          return
        }

        const ensured =
          (await ensureUserProfile(firebaseUser)) ??
          (await getUserProfile(firebaseUser.uid))
        const backendSynced = await syncFirestoreTierFromGojitoBackend(firebaseUser)
        const mergedProfile = backendSynced ?? ensured ?? null

        setUser({
          id: firebaseUser.uid,
          full_name:
            firebaseUser.displayName ||
            mergedProfile?.displayName ||
            'Player',
          email: firebaseUser.email ?? mergedProfile?.email ?? null,
        })
        setProfile(mergedProfile)
        setIsAuthenticated(true)
        setAuthError(null)
      } catch (e) {
        setAuthError({
          type: 'auth_failed',
          message: e instanceof Error ? e.message : 'Authentication failed',
        })
        setIsAuthenticated(false)
      } finally {
        setIsLoadingAuth(false)
      }
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    if (!isFirebaseConfigured || !auth || !isAuthenticated || user.id === 'local') {
      return undefined
    }

    const intervalMs = 5 * 60 * 1000
    const tick = () => {
      const current = auth?.currentUser
      if (!current) return
      void syncFirestoreTierFromGojitoBackend(current).then((doc) => {
        if (doc) setProfile(doc)
      })
    }

    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [isAuthenticated, user.id])

  const refreshEntitlements = useCallback(async (): Promise<boolean> => {
    if (!isFirebaseConfigured || !auth?.currentUser) return false
    const doc = await syncFirestoreTierFromGojitoBackend(auth.currentUser, {
      forceRefreshToken: true,
    })
    if (doc) {
      setProfile(doc)
      return true
    }
    return false
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return
    setAuthError(null)
    await signInWithPopup(auth, googleProvider)
  }, [])

  const logout = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return
    await signOut(auth)
  }, [])

  const profileTier = isAuthenticated ? normalizeTier(profile?.tier) : undefined

  const accountTier = accountTierShort(isFirebaseConfigured, isAuthenticated, profileTier)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      profileTier,
      accountTier,
      hasGuacEntitlement: accountTier === 'guac',
      isFirebaseConfigured,
      isAuthenticated,
      isLoadingAuth,
      authError,
      logout,
      signInWithGoogle,
      refreshEntitlements,
    }),
    [
      accountTier,
      authError,
      isAuthenticated,
      isFirebaseConfigured,
      isLoadingAuth,
      logout,
      profile,
      profileTier,
      refreshEntitlements,
      signInWithGoogle,
      user,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
