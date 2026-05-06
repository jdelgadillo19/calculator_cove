import type { GameMode } from './types'

/** Premium experiments — gated to Guac until gameplay ships. */
export type PremiumFeature = null | 'battleship' | 'board_12x6' | 'board_12x12'

export type MenuGameSettings = {
  mode: GameMode
  /** Deterministic shuffle when mode is shuffled (optional). */
  shuffleSeed?: number
  /** Standard grid uses `null`; premium routes use a stub placeholder screen. */
  premiumFeature: PremiumFeature
  playerOneName: string
  playerTwoName: string
  playerOneColor: string
  playerTwoColor: string
}

export const DEFAULT_SETTINGS: MenuGameSettings = {
  mode: 'classic',
  premiumFeature: null,
  playerOneName: 'Player 1',
  playerTwoName: 'Player 2',
  playerOneColor: '#3b82f6',
  playerTwoColor: '#ef4444',
}

/** Survives refresh / router quirks; cleared when starting a new game from the menu. */
export const SESSION_SETTINGS_KEY = 'multiplication_connect_settings_v1'

function parsePremiumFeature(raw: unknown): PremiumFeature {
  if (
    raw === 'battleship' ||
    raw === 'board_12x6' ||
    raw === 'board_12x12'
  ) {
    return raw
  }
  return null
}

export function parseStoredGameSettings(
  raw: string | null,
): MenuGameSettings | undefined {
  if (!raw) return undefined
  try {
    const o = JSON.parse(raw) as Partial<MenuGameSettings>
    if (o.mode !== 'classic' && o.mode !== 'shuffled') return undefined
    return {
      mode: o.mode,
      premiumFeature: parsePremiumFeature(o.premiumFeature),
      shuffleSeed:
        typeof o.shuffleSeed === 'number' && !Number.isNaN(o.shuffleSeed)
          ? o.shuffleSeed
          : undefined,
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
