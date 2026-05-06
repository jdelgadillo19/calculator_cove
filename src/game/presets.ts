import type { AiDifficulty, GameMode, QuadrantCount } from './types'

/** Built-in island scenarios — locked layouts and difficulty (not editable). */
export type PresetClassId = 'wading_pool' | 'reef_crossing' | 'deep_ocean'

export type PresetBattleClass = {
  id: PresetClassId
  name: string
  /** Short pitch shown on the menu card. */
  description: string
  quadrantCount: QuadrantCount
  mode: GameMode
  opponent: 'human' | 'computer'
  aiDifficulty: AiDifficulty
  /** Classic-style lengths (longest first); scaled to board size. */
  fleetLengths: readonly number[]
}

/** Full ocean per player; ordered tiles vs shuffled quadrants; AI tier baked in. */
export const PRESET_BATTLE_CLASSES: readonly PresetBattleClass[] = [
  {
    id: 'wading_pool',
    name: 'Wading Pool',
    description:
      'One calm 6×6 sea each — tiles in order — CPU plays gentle.',
    quadrantCount: 1,
    mode: 'classic',
    opponent: 'computer',
    aiDifficulty: 'easy',
    fleetLengths: [4, 3, 2],
  },
  {
    id: 'reef_crossing',
    name: 'Reef Crossing',
    description:
      'Two wide regions (12×6) — tiles shuffled — surf‑lesson CPU.',
    quadrantCount: 2,
    mode: 'shuffled',
    opponent: 'computer',
    aiDifficulty: 'medium',
    fleetLengths: [5, 4, 3, 2],
  },
  {
    id: 'deep_ocean',
    name: 'Deep Ocean',
    description:
      'Four quadrants per captain (12×12) — random reefs — rip‑current CPU.',
    quadrantCount: 4,
    mode: 'shuffled',
    opponent: 'computer',
    aiDifficulty: 'hard',
    fleetLengths: [5, 4, 3, 3, 2],
  },
] as const

export function presetBattleById(id: PresetClassId): PresetBattleClass {
  const p = PRESET_BATTLE_CLASSES.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown preset ${id}`)
  return p
}

export function presetProfileRef(id: PresetClassId): string {
  return `preset:${id}`
}

/** Menu / engine default fleets when not loading a named preset row. */
export function defaultFleetLengths(quadrantCount: QuadrantCount): readonly number[] {
  switch (quadrantCount) {
    case 1:
      return [4, 3, 2]
    case 2:
      return [5, 4, 3, 2]
    case 4:
      return [5, 4, 3, 3, 2]
    default:
      return [4, 3, 2]
  }
}
