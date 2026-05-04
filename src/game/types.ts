export type PlayerId = 0 | 1

export const GRID_SIZE = 6
export const NUM_SLOTS = GRID_SIZE * GRID_SIZE
export type SlotId = number & { readonly __brand: 'SlotId' }

export type GameMode = 'classic' | 'shuffled'

export type SelectorKind = 'upper' | 'lower'

export type MatchPhase = 'playing' | 'won' | 'draw'

export type MatchState = {
  /** product value per slot (slot-major order); immutable identity per match setup */
  productsBySlot: readonly number[]
  /** owner per slot; null = empty */
  owners: (PlayerId | null)[]
  /** null = arrow not placed on the rail yet */
  upperFactor: number | null
  lowerFactor: number | null
  currentPlayer: PlayerId
  phase: MatchPhase
  winner: PlayerId | null
  lastMoveNote: string | null
}

export type MoveInput = {
  kind: SelectorKind
  /** factor 1..9 */
  value: number
}
