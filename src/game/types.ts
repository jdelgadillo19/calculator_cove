export type PlayerId = 0 | 1

/** Cells in one 6×6 quadrant (canonical board size). */
export const SLOTS_PER_QUADRANT = 6 * 6

/** @deprecated Prefer `SLOTS_PER_QUADRANT` or `match.productsBySlot.length`. */
export const NUM_SLOTS = SLOTS_PER_QUADRANT

export type SlotId = number & { readonly __brand: 'SlotId' }

export type QuadrantCount = 1 | 2 | 4

export type GameMode = 'classic' | 'shuffled'

export type RulesKind = 'connect' | 'battleship'

export type AiDifficulty = 'easy' | 'medium' | 'hard'

export type SelectorKind = 'upper' | 'lower'

export type MatchPhase = 'playing' | 'won' | 'draw'

/** Progressive fleet deployment + device handoffs + battle. */
export type BattleshipPlacementTag =
  | 'p1_place'
  | 'handoff_to_p2'
  | 'p2_place'
  | 'handoff_to_battle'
  | 'battle'

export type BattleshipState = {
  placement: BattleshipPlacementTag
  /** Ordered ship lengths (classic-style). */
  fleetLengths: readonly number[]
  /** Each player’s committed ships as disjoint sorted cell lists. */
  ships: [number[][], number[][]]
  /** Shots landing on each defender’s personal ocean (`null` = never fired). */
  shotsReceivedByDefender: [(PlayerId | null)[], (PlayerId | null)[]]
  /** Index into `fleetLengths` for whoever is currently anchoring ships. */
  placingShipIndex: number
  /** Set when entering `handoff_to_battle`; applied when the shield is dismissed. */
  pendingFirstShooter: PlayerId | null
}

export type MatchState = {
  rules: RulesKind
  quadrantCount: QuadrantCount
  cols: number
  rows: number
  /** Factor moves resolve against this quadrant’s product slice. */
  activeQuadrant: number
  /** Connect: single shared board products. Battleship: ignored if `battleProducts` set. */
  productsBySlot: readonly number[]
  /** Battleship: separate coordinate chart per captain (same dimensions). */
  battleProducts: readonly [readonly number[], readonly number[]] | null
  /** Connect: claimed owner. */
  owners: (PlayerId | null)[]
  upperFactor: number | null
  lowerFactor: number | null
  currentPlayer: PlayerId
  phase: MatchPhase
  winner: PlayerId | null
  lastMoveNote: string | null
  battleship: BattleshipState | null
}

export type MoveInput =
  | {
      kind: SelectorKind
      /** factor 1..9 */
      value: number
    }
  | {
      /** Disambiguate duplicate products on the defender chart (same factor pair). */
      kind: 'salvo'
      targetSlot: number
    }
