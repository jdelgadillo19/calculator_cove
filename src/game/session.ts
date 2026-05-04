import type { GameMode } from './types'

export type MenuGameSettings = {
  mode: GameMode
  /** Deterministic shuffle when mode is shuffled (optional). */
  shuffleSeed?: number
  playerOneName: string
  playerTwoName: string
  playerOneColor: string
  playerTwoColor: string
}

export const DEFAULT_SETTINGS: MenuGameSettings = {
  mode: 'classic',
  playerOneName: 'Player 1',
  playerTwoName: 'Player 2',
  playerOneColor: '#3b82f6',
  playerTwoColor: '#ef4444',
}

/** Survives refresh / router quirks; cleared when starting a new game from the menu. */
export const SESSION_SETTINGS_KEY = 'multiplication_connect_settings_v1'

export function parseStoredGameSettings(
  raw: string | null,
): MenuGameSettings | undefined {
  if (!raw) return undefined
  try {
    const o = JSON.parse(raw) as Partial<MenuGameSettings>
    if (o.mode !== 'classic' && o.mode !== 'shuffled') return undefined
    return {
      mode: o.mode,
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
