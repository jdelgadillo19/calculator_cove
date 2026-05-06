import type { AiDifficulty, GameMode, QuadrantCount, RulesKind } from './types'

const STORAGE_KEY = 'calculator_cove_custom_profiles_v1'

export type CustomGameProfile = {
  id: string
  name: string
  rules: RulesKind
  quadrantCount: QuadrantCount
  mode: GameMode
  shuffleSeed?: number
  opponent: 'human' | 'computer'
  aiDifficulty: AiDifficulty
  /** Only used when rules === 'battleship'; defaults derived from quadrant if omitted in older saves. */
  fleetLengths?: readonly number[]
  createdAt: number
}

export function loadCustomProfiles(): CustomGameProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const o = JSON.parse(raw) as unknown
    if (!Array.isArray(o)) return []
    return o.filter(isCustomProfile)
  } catch {
    return []
  }
}

function isCustomProfile(v: unknown): v is CustomGameProfile {
  if (!v || typeof v !== 'object') return false
  const x = v as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    (x.rules === 'connect' || x.rules === 'battleship') &&
    (x.quadrantCount === 1 || x.quadrantCount === 2 || x.quadrantCount === 4) &&
    (x.mode === 'classic' || x.mode === 'shuffled') &&
    (x.opponent === 'human' || x.opponent === 'computer') &&
    (x.aiDifficulty === 'easy' ||
      x.aiDifficulty === 'medium' ||
      x.aiDifficulty === 'hard') &&
    typeof x.createdAt === 'number'
  )
}

export function saveCustomProfiles(list: CustomGameProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

export function customProfileRef(id: string): string {
  return `custom:${id}`
}
