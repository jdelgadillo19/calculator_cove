import type {
  AiDifficulty,
  GameMode,
  QuadrantCount,
  RulesKind,
} from './types'

export type MenuGameSettings = {
  rules: RulesKind
  mode: GameMode
  quadrantCount: QuadrantCount
  /** Deterministic shuffle when mode is shuffled (optional). */
  shuffleSeed?: number
  opponent: 'human' | 'computer'
  aiDifficulty: AiDifficulty
  /** Island fleets — optional roster override (defaults by ocean size). */
  fleetLengths?: readonly number[]
  playerOneName: string
  playerTwoName: string
  playerOneColor: string
  playerTwoColor: string
}

export const DEFAULT_SETTINGS: MenuGameSettings = {
  rules: 'connect',
  mode: 'classic',
  quadrantCount: 1,
  opponent: 'human',
  aiDifficulty: 'medium',
  playerOneName: 'Player 1',
  playerTwoName: 'Player 2',
  playerOneColor: '#3b82f6',
  playerTwoColor: '#ef4444',
}

/** Survives refresh / router quirks; cleared when starting a new game from the menu. */
export const SESSION_SETTINGS_KEY = 'calculator_cove_settings_v2'

function clampQuadrantCount(v: unknown): QuadrantCount {
  return v === 2 || v === 4 ? v : 1
}

function clampAiDifficulty(v: unknown): AiDifficulty {
  if (v === 'easy' || v === 'medium' || v === 'hard') return v
  return 'medium'
}

function clampFleetLengths(v: unknown): readonly number[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined
  const nums: number[] = []
  for (const x of v) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return undefined
    const n = Math.max(1, Math.round(Math.min(12, x)))
    nums.push(n)
  }
  return nums
}

export function parseStoredGameSettings(
  raw: string | null,
): MenuGameSettings | undefined {
  if (!raw) return undefined
  try {
    const o = JSON.parse(raw) as Partial<MenuGameSettings> & {
      mode?: unknown
    }
    const mode: GameMode =
      o.mode === 'shuffled' || o.mode === 'classic' ? o.mode : 'classic'

    return {
      rules: o.rules === 'battleship' ? 'battleship' : 'connect',
      mode,
      quadrantCount: clampQuadrantCount(o.quadrantCount),
      shuffleSeed:
        typeof o.shuffleSeed === 'number' && !Number.isNaN(o.shuffleSeed)
          ? o.shuffleSeed
          : undefined,
      opponent: o.opponent === 'computer' ? 'computer' : 'human',
      aiDifficulty: clampAiDifficulty(o.aiDifficulty),
      fleetLengths: clampFleetLengths(o.fleetLengths),
      playerOneName:
        typeof o.playerOneName === 'string' ? o.playerOneName : 'Player 1',
      playerTwoName:
        typeof o.playerTwoName === 'string' ? o.playerTwoName : 'Player 2',
      playerOneColor:
        typeof o.playerOneColor === 'string' ? o.playerOneColor : '#3b82f6',
      playerTwoColor:
        typeof o.playerTwoColor === 'string' ? o.playerTwoColor : '#ef4444',
    }
  } catch {
    return undefined
  }
}

export function statsModeKey(settings: MenuGameSettings): string {
  const rule = settings.rules
  const mode = settings.mode
  const q = settings.quadrantCount
  if (settings.opponent === 'computer') {
    return `${rule}-${mode}-q${q}-ai-${settings.aiDifficulty}`
  }
  return `${rule}-${mode}-q${q}-local`
}
