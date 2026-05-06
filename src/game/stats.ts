import type { MenuGameSettings } from './session'
import { statsModeKey } from './session'

export type WLQ = { wins: number; losses: number; quits: number }

export type StatsStore = {
  version: 2
  /** Mid-game menu quits counted once per session quit (no player attribution). */
  modeQuits: Record<string, number>
  players: Record<string, Record<string, WLQ>>
}

const STORAGE_KEY = 'calculator_cove_stats_v2'

const emptyWLQ = (): WLQ => ({ wins: 0, losses: 0, quits: 0 })

export function loadStats(): StatsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 2, modeQuits: {}, players: {} }
    const o = JSON.parse(raw) as Partial<StatsStore>
    if (o.version !== 2 || typeof o.players !== 'object' || o.players === null) {
      return { version: 2, modeQuits: {}, players: {} }
    }
    return {
      version: 2,
      modeQuits:
        typeof o.modeQuits === 'object' && o.modeQuits !== null ? { ...o.modeQuits } : {},
      players: { ...o.players },
    }
  } catch {
    return { version: 2, modeQuits: {}, players: {} }
  }
}

function saveStats(store: StatsStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    /* quota */
  }
}

function ensurePlayer(store: StatsStore, name: string): Record<string, WLQ> {
  const key = name.trim() || 'Player'
  if (!store.players[key]) store.players[key] = {}
  return store.players[key]
}

export function recordQuit(settings: MenuGameSettings): void {
  const mk = statsModeKey(settings)
  const store = loadStats()
  store.modeQuits[mk] = (store.modeQuits[mk] ?? 0) + 1
  saveStats(store)
}

export function recordMatchResult(
  settings: MenuGameSettings,
  winnerName: string,
  loserName: string,
): void {
  const mk = statsModeKey(settings)
  const store = loadStats()
  const w = ensurePlayer(store, winnerName)
  const l = ensurePlayer(store, loserName)
  const wb = w[mk] ?? emptyWLQ()
  const lb = l[mk] ?? emptyWLQ()
  w[mk] = { ...wb, wins: wb.wins + 1 }
  l[mk] = { ...lb, losses: lb.losses + 1 }
  saveStats(store)
}
