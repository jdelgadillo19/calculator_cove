import {
  assertCanonicalShape,
  CANONICAL_PRODUCTS,
  productToSlotMap,
} from './boardLayout'
import type { MatchState, MoveInput, PlayerId, SelectorKind } from './types'
import { GRID_SIZE, NUM_SLOTS } from './types'

export function createMatch(options: {
  productsBySlot?: readonly number[]
  startUpper?: number | null
  startLower?: number | null
}): MatchState {
  const products =
    options.productsBySlot ?? [...CANONICAL_PRODUCTS]
  assertCanonicalShape(products)
  const upper =
    options.startUpper === undefined ? null : normalizeFactor(options.startUpper)
  const lower =
    options.startLower === undefined ? null : normalizeFactor(options.startLower)
  return {
    productsBySlot: products,
    owners: Array.from({ length: NUM_SLOTS }, () => null),
    upperFactor: upper,
    lowerFactor: lower,
    currentPlayer: 0,
    phase: 'playing',
    winner: null,
    lastMoveNote: null,
  }
}

function normalizeFactor(n: number | null): number | null {
  if (n === null) return null
  return clampFactor(n)
}

function clampFactor(n: number): number {
  return Math.min(9, Math.max(1, Math.round(n)))
}

export type TryApplyResult =
  | { ok: true; next: MatchState }
  | { ok: false; reason: string }

/** Shown after selectors reset because neither arrow could reach an empty tile. */
export const NOTE_DEADLOCK_RESET =
  'Dead end — no empty tile could be claimed from those factors. Arrows reset.'

/** Upper factor cannot pair with any lower to hit an empty board tile. */
export const NOTE_FACTOR_DEAD_UPPER =
  'That upper factor has no empty product left on the board.'

/** Lower factor cannot pair with any upper to hit an empty board tile. */
export const NOTE_FACTOR_DEAD_LOWER =
  'That lower factor has no empty product left on the board.'

/** True if some lower factor 1–9 can multiply with upperFactor to claim an empty slot. */
export function hasClaimableCompletionAsUpper(
  state: MatchState,
  upperFactor: number,
): boolean {
  const U = clampFactor(upperFactor)
  const slotMap = productToSlotMap(state.productsBySlot)
  const { owners } = state
  for (let L = 1; L <= 9; L++) {
    const p = U * L
    const slot = slotMap.get(p)
    if (slot !== undefined && owners[slot] === null) return true
  }
  return false
}

/** Same predicate as upper-path (multiplication is commutative on products checked). */
export function hasClaimableCompletionAsLower(
  state: MatchState,
  lowerFactor: number,
): boolean {
  return hasClaimableCompletionAsUpper(state, lowerFactor)
}

/** Factor N can still produce at least one empty tile on the board (as either selector). */
export function isFactorPlayable(state: MatchState, factor: number): boolean {
  return hasClaimableCompletionAsUpper(state, factor)
}

/** Pure move attempt for UI validation (no deadlock side-effects). */
export function tryApplyMove(state: MatchState, move: MoveInput): TryApplyResult {
  if (state.phase !== 'playing') {
    return { ok: false, reason: 'Game is over.' }
  }

  const v = clampFactor(move.value)
  const prevUpper = state.upperFactor
  const prevLower = state.lowerFactor

  let upper = prevUpper
  let lower = prevLower
  if (move.kind === 'upper') upper = v
  else lower = v

  const upperChanged = upper !== prevUpper
  const lowerChanged = lower !== prevLower
  if (upperChanged === lowerChanged) {
    return {
      ok: false,
      reason:
        'Move exactly one selector by choosing a different factor.',
    }
  }

  const next: MatchState = {
    ...state,
    upperFactor: upper,
    lowerFactor: lower,
    lastMoveNote: null,
  }

  if (upper === null || lower === null) {
    if (upper !== null && lower === null) {
      if (!isFactorPlayable(state, upper)) {
        return { ok: false, reason: NOTE_FACTOR_DEAD_UPPER }
      }
    }
    if (upper === null && lower !== null) {
      if (!isFactorPlayable(state, lower)) {
        return { ok: false, reason: NOTE_FACTOR_DEAD_LOWER }
      }
    }
    return {
      ok: true,
      next: {
        ...next,
        currentPlayer: flipPlayer(next.currentPlayer),
        lastMoveNote: null,
      },
    }
  }

  const product = upper * lower
  const slotMap = productToSlotMap(next.productsBySlot)
  const slot = slotMap.get(product)

  if (slot === undefined) {
    return { ok: false, reason: `No tile shows ${product}.` }
  }
  if (next.owners[slot] !== null) {
    return { ok: false, reason: 'That product is already claimed.' }
  }

  const owners = next.owners.slice()
  owners[slot] = next.currentPlayer

  const withOwners: MatchState = {
    ...next,
    owners,
    lastMoveNote: null,
    currentPlayer: flipPlayer(next.currentPlayer),
  }

  const winner = computeWinner(withOwners.owners)
  if (winner !== null) {
    return {
      ok: true,
      next: {
        ...withOwners,
        phase: 'won',
        winner,
        currentPlayer: flipPlayer(withOwners.currentPlayer),
      },
    }
  }

  if (isBoardFull(withOwners.owners)) {
    return {
      ok: true,
      next: {
        ...withOwners,
        phase: 'draw',
        currentPlayer: flipPlayer(withOwners.currentPlayer),
      },
    }
  }

  return { ok: true, next: withOwners }
}

/**
 * True when at least one single-selector change claims an empty slot that exists on the board.
 * Opening phase (either factor null) is never deadlock by this definition.
 */
export function hasClaimableNeighbor(state: MatchState): boolean {
  const A = state.upperFactor
  const B = state.lowerFactor
  if (A === null || B === null) return true

  const slotMap = productToSlotMap(state.productsBySlot)
  const { owners } = state

  for (let U = 1; U <= 9; U++) {
    if (U === A) continue
    const p = U * B
    const slot = slotMap.get(p)
    if (slot !== undefined && owners[slot] === null) return true
  }
  for (let L = 1; L <= 9; L++) {
    if (L === B) continue
    const p = A * L
    const slot = slotMap.get(p)
    if (slot !== undefined && owners[slot] === null) return true
  }
  return false
}

/** Reset selectors to unplaced (null); keeps owners and current player. */
export function applyDeadlockReset(state: MatchState): MatchState {
  if (state.phase !== 'playing') return state
  return {
    ...state,
    upperFactor: null,
    lowerFactor: null,
    lastMoveNote: NOTE_DEADLOCK_RESET,
  }
}

/** After a move: if no empty slot is claimable in one step, clear selectors to null. */
export function clearSelectorsIfDeadlocked(state: MatchState): MatchState {
  if (state.phase !== 'playing') return state
  if (state.upperFactor === null || state.lowerFactor === null) return state
  if (hasClaimableNeighbor(state)) return state
  return applyDeadlockReset(state)
}

export function applyMove(state: MatchState, move: MoveInput): MatchState {
  const r = tryApplyMove(state, move)
  if (!r.ok) {
    return {
      ...state,
      lastMoveNote: r.reason,
    }
  }
  return clearSelectorsIfDeadlocked(r.next)
}

export function flipPlayer(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0
}

export function slotRow(slot: number): number {
  return Math.floor(slot / GRID_SIZE)
}

export function slotCol(slot: number): number {
  return slot % GRID_SIZE
}

const DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

export function computeWinner(owners: (PlayerId | null)[]): PlayerId | null {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const start = r * GRID_SIZE + c
      const pid = owners[start]
      if (pid === null) continue
      for (const [dr, dc] of DIRS) {
        let len = 1
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k
          const nc = c + dc * k
          if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) break
          const idx = nr * GRID_SIZE + nc
          if (owners[idx] !== pid) break
          len++
        }
        if (len >= 4) return pid
      }
    }
  }
  return null
}

export function isBoardFull(owners: (PlayerId | null)[]): boolean {
  return owners.every((o) => o !== null)
}

export function describeSelectorMove(
  kind: SelectorKind,
  value: number,
): MoveInput {
  return { kind, value }
}
