import {
  assertCanonicalShape,
  buildDualPlayerBattleProducts,
  buildProductsGrid,
} from './boardLayout'
import {
  fullOceanSlots,
  quadrantCountToDims,
  slotCol,
  slotQuadrant,
  slotRow,
} from './gridSpec'
import { defaultFleetLengths } from './presets'
import type {
  BattleshipPlacementTag,
  BattleshipState,
  MatchState,
  MoveInput,
  PlayerId,
  QuadrantCount,
  SelectorKind,
} from './types'
import { SLOTS_PER_QUADRANT } from './types'

export function createMatch(options: {
  productsBySlot?: readonly number[]
  battleProducts?: readonly [readonly number[], readonly number[]]
  fleetLengths?: readonly number[]
  rules?: MatchState['rules']
  quadrantCount?: QuadrantCount
  activeQuadrant?: number
  mode?: import('./types').GameMode
  shuffleSeed?: number
  startUpper?: number | null
  startLower?: number | null
}): MatchState {
  const qc = options.quadrantCount ?? 1
  const { cols, rows } = quadrantCountToDims(qc)
  const rules = options.rules ?? 'connect'
  const len = cols * rows

  let battleProducts: MatchState['battleProducts'] = null
  let products: readonly number[]

  if (rules === 'battleship') {
    if (options.battleProducts) {
      const [a, b] = options.battleProducts
      if (a.length !== len || b.length !== len) {
        throw new Error(`Expected ${len} products per captain chart for layout ${qc}`)
      }
      battleProducts = [a.slice(), b.slice()] as const
    } else {
      battleProducts = buildDualPlayerBattleProducts({
        quadrantCount: qc,
        mode: options.mode ?? 'classic',
        shuffleSeed: options.shuffleSeed,
      })
    }
    products = battleProducts[0]
  } else {
    let grid = options.productsBySlot
    if (!grid) {
      grid = buildProductsGrid({
        quadrantCount: qc,
        mode: options.mode ?? 'classic',
        shuffleSeed: options.shuffleSeed,
      })
    } else if (grid.length === SLOTS_PER_QUADRANT && len === SLOTS_PER_QUADRANT) {
      assertCanonicalShape(grid as number[])
    } else if (grid.length !== len) {
      throw new Error(`Expected ${len} products for quadrant layout ${qc}, got ${grid.length}`)
    }
    products = grid
    battleProducts = null
  }

  const upper =
    options.startUpper === undefined ? null : normalizeFactor(options.startUpper)
  const lower =
    options.startLower === undefined ? null : normalizeFactor(options.startLower)

  const maxQ = qc === 4 ? 3 : qc === 2 ? 1 : 0
  const aq = Math.min(Math.max(options.activeQuadrant ?? 0, 0), maxQ)

  const emptyShots = (): (PlayerId | null)[] =>
    Array.from({ length: len }, () => null)

  const fleet: readonly number[] =
    rules === 'battleship'
      ? [...(options.fleetLengths ?? defaultFleetLengths(qc))].map((n) =>
          Math.max(1, Math.round(n)),
        )
      : []

  const battleship: BattleshipState | null =
    rules === 'battleship'
      ? {
          placement: 'p1_place',
          fleetLengths: fleet,
          ships: [[], []],
          shotsReceivedByDefender: [emptyShots(), emptyShots()],
          placingShipIndex: 0,
          pendingFirstShooter: null,
        }
      : null

  return {
    rules,
    quadrantCount: qc,
    cols,
    rows,
    activeQuadrant: aq,
    productsBySlot: products,
    battleProducts,
    owners: Array.from({ length: len }, () => null),
    upperFactor: upper,
    lowerFactor: lower,
    currentPlayer: 0,
    phase: 'playing',
    winner: null,
    lastMoveNote: null,
    battleship,
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

export const NOTE_DEADLOCK_RESET =
  'Dead end — no empty tile could be claimed from those factors. Arrows reset.'

export const NOTE_FACTOR_DEAD_UPPER =
  'That upper factor has no empty product left on the board.'

export const NOTE_FACTOR_DEAD_LOWER =
  'That lower factor has no empty product left on the board.'

export const NOTE_BATTLESHIP_AMBIGUOUS =
  'Several squares show that product — tap one to fire.'

function slotsWithProductInActiveQuadrant(
  state: MatchState,
  product: number,
): number[] {
  const { cols, productsBySlot, activeQuadrant, quadrantCount } = state
  const total = cols * state.rows
  const out: number[] = []
  for (let s = 0; s < total; s++) {
    if (slotQuadrant(s, quadrantCount, cols) !== activeQuadrant) continue
    if (productsBySlot[s] === product) out.push(s)
  }
  return out
}

/** Defender’s multiplication chart + active quadrant — attacker aims here. */
function slotsWithProductDefenderChart(
  state: MatchState,
  defender: PlayerId,
  product: number,
): number[] {
  const grid = state.battleProducts![defender]
  const { cols, activeQuadrant, quadrantCount } = state
  const total = cols * state.rows
  const out: number[] = []
  for (let s = 0; s < total; s++) {
    if (slotQuadrant(s, quadrantCount, cols) !== activeQuadrant) continue
    if (grid[s] === product) out.push(s)
  }
  return out
}

export function hasClaimableCompletionAsUpper(
  state: MatchState,
  upperFactor: number,
): boolean {
  const U = clampFactor(upperFactor)
  const { owners } = state
  for (let L = 1; L <= 9; L++) {
    const p = U * L
    for (const slot of slotsWithProductInActiveQuadrant(state, p)) {
      if (owners[slot] === null) return true
    }
  }
  return false
}

export function hasClaimableCompletionAsLower(
  state: MatchState,
  lowerFactor: number,
): boolean {
  return hasClaimableCompletionAsUpper(state, lowerFactor)
}

export function isFactorPlayable(state: MatchState, factor: number): boolean {
  if (state.rules === 'battleship' && state.battleship?.placement === 'battle') {
    return hasBattleshipUnshotSlot(state, factor)
  }
  return hasClaimableCompletionAsUpper(state, factor)
}

function unshotDefenderSlotsForProduct(
  state: MatchState,
  defender: PlayerId,
  product: number,
): number[] {
  const shots = state.battleship!.shotsReceivedByDefender[defender]
  return slotsWithProductDefenderChart(state, defender, product).filter(
    (s) => shots[s] === null,
  )
}

/** When ≥2 empty squares match the current factor pair — UI must pick `salvo`. */
export function battleshipSalvoTargets(state: MatchState): number[] | null {
  if (state.rules !== 'battleship' || state.battleship?.placement !== 'battle') {
    return null
  }
  if (state.upperFactor === null || state.lowerFactor === null) return null
  const defender = flipPlayer(state.currentPlayer)
  const product = state.upperFactor * state.lowerFactor
  const slots = unshotDefenderSlotsForProduct(state, defender, product)
  if (slots.length <= 1) return null
  return slots
}

function finalizeBattleshipShot(
  base: MatchState,
  defender: PlayerId,
  slot: number,
): TryApplyResult {
  const shooter = base.currentPlayer
  const bs = base.battleship!
  const shotsLedger: [(PlayerId | null)[], (PlayerId | null)[]] = [
    bs.shotsReceivedByDefender[0].slice(),
    bs.shotsReceivedByDefender[1].slice(),
  ]
  if (shotsLedger[defender][slot] !== null) {
    return { ok: false, reason: 'That cell was already fired upon.' }
  }

  shotsLedger[defender][slot] = shooter

  const nb: BattleshipState = {
    ...bs,
    shotsReceivedByDefender: shotsLedger,
  }

  let phase: MatchState['phase'] = 'playing'
  let winner: PlayerId | null = null

  if (allDefenderShipTilesHit(nb.ships[defender], shotsLedger[defender])) {
    phase = 'won'
    winner = shooter
  }

  const after: MatchState = {
    ...base,
    battleship: nb,
    upperFactor: null,
    lowerFactor: null,
    currentPlayer: flipPlayer(shooter),
    phase,
    winner,
    lastMoveNote: null,
  }

  return { ok: true, next: after }
}

function tryApplyBattleshipSalvo(
  state: MatchState,
  move: Extract<MoveInput, { kind: 'salvo' }>,
): TryApplyResult {
  if (state.upperFactor === null || state.lowerFactor === null) {
    return { ok: false, reason: 'Choose both factors before picking a square.' }
  }
  const defender = flipPlayer(state.currentPlayer)
  const product = state.upperFactor * state.lowerFactor
  const slots = unshotDefenderSlotsForProduct(state, defender, product)
  if (!slots.includes(move.targetSlot)) {
    return {
      ok: false,
      reason: 'Pick one of the squares that matches your factors.',
    }
  }
  return finalizeBattleshipShot(state, defender, move.targetSlot)
}

function allDefenderShipTilesHit(
  armada: readonly number[][],
  shots: readonly (PlayerId | null)[],
): boolean {
  for (const ship of armada) {
    for (const cell of ship) {
      if (shots[cell] === null) return false
    }
  }
  return armada.length > 0
}

export function tryApplyMove(state: MatchState, move: MoveInput): TryApplyResult {
  if (state.phase !== 'playing') {
    return { ok: false, reason: 'Game is over.' }
  }

  if (state.rules === 'battleship' && state.battleship) {
    if (state.battleship.placement !== 'battle') {
      return { ok: false, reason: 'Place fleets or finish the handoff first.' }
    }
    if (move.kind === 'salvo') {
      return tryApplyBattleshipSalvo(state, move)
    }
    return tryApplyBattleshipBattle(state, move)
  }

  return tryApplyConnectMove(state, move)
}

function tryApplyConnectMove(state: MatchState, move: MoveInput): TryApplyResult {
  if (move.kind === 'salvo') {
    return { ok: false, reason: 'Salvo shots only apply in Island Fleets combat.' }
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
      reason: 'Move exactly one selector by choosing a different factor.',
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
      if (!hasClaimableCompletionAsUpper(state, upper)) {
        return { ok: false, reason: NOTE_FACTOR_DEAD_UPPER }
      }
    }
    if (upper === null && lower !== null) {
      if (!hasClaimableCompletionAsLower(state, lower)) {
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
  const matching = slotsWithProductInActiveQuadrant(next, product)
  if (matching.length === 0) {
    return { ok: false, reason: `No tile shows ${product}.` }
  }
  const slot = matching[0]
  if (matching.length > 1) {
    return {
      ok: false,
      reason: 'Ambiguous shot — pick another quadrant or factor.',
    }
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

  const winner = computeWinner(withOwners.owners, withOwners.cols, withOwners.rows)
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

function tryApplyBattleshipBattle(
  state: MatchState,
  move: { kind: SelectorKind; value: number },
): TryApplyResult {
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
      reason: 'Move exactly one selector by choosing a different factor.',
    }
  }

  const next: MatchState = {
    ...state,
    upperFactor: upper,
    lowerFactor: lower,
    lastMoveNote: null,
  }

  const defender = flipPlayer(state.currentPlayer)

  if (upper === null || lower === null) {
    const solo = upper ?? lower!
    if (upper !== null && lower === null) {
      if (!hasBattleshipUnshotSlot(state, solo)) {
        return { ok: false, reason: NOTE_FACTOR_DEAD_UPPER }
      }
    }
    if (upper === null && lower !== null) {
      if (!hasBattleshipUnshotSlot(state, solo)) {
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
  const slots = unshotDefenderSlotsForProduct(next, defender, product)
  if (slots.length === 0) {
    return {
      ok: false,
      reason: `No target tile shows ${product} in the active region.`,
    }
  }
  if (slots.length > 1) {
    return { ok: false, reason: NOTE_BATTLESHIP_AMBIGUOUS }
  }

  return finalizeBattleshipShot(next, defender, slots[0]!)
}

function hasBattleshipUnshotSlot(state: MatchState, factor: number): boolean {
  const defender = flipPlayer(state.currentPlayer)
  const F = clampFactor(factor)
  for (let k = 1; k <= 9; k++) {
    const slots = unshotDefenderSlotsForProduct(state, defender, F * k)
    if (slots.length >= 1) return true
  }
  return false
}

export function hasClaimableNeighbor(state: MatchState): boolean {
  if (state.rules === 'battleship') return true

  const A = state.upperFactor
  const B = state.lowerFactor
  if (A === null || B === null) return true

  const { owners } = state

  for (let U = 1; U <= 9; U++) {
    if (U === A) continue
    const p = U * B
    for (const slot of slotsWithProductInActiveQuadrant(state, p)) {
      if (owners[slot] === null) return true
    }
  }
  for (let L = 1; L <= 9; L++) {
    if (L === B) continue
    const p = A * L
    for (const slot of slotsWithProductInActiveQuadrant(state, p)) {
      if (owners[slot] === null) return true
    }
  }
  return false
}

export function applyDeadlockReset(state: MatchState): MatchState {
  if (state.phase !== 'playing') return state
  return {
    ...state,
    upperFactor: null,
    lowerFactor: null,
    lastMoveNote: NOTE_DEADLOCK_RESET,
  }
}

export function clearSelectorsIfDeadlocked(state: MatchState): MatchState {
  if (state.phase !== 'playing') return state
  if (state.rules !== 'connect') return state
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
  if (state.rules === 'connect') {
    return clearSelectorsIfDeadlocked(r.next)
  }
  return r.next
}

export function flipPlayer(p: PlayerId): PlayerId {
  return p === 0 ? 1 : 0
}

export function slotRowIndex(slot: number, cols: number): number {
  return slotRow(slot, cols)
}

export function slotColIndex(slot: number, cols: number): number {
  return slotCol(slot, cols)
}

const DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

export function computeWinner(
  owners: (PlayerId | null)[],
  cols: number,
  rows: number,
): PlayerId | null {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const start = r * cols + c
      const pid = owners[start]
      if (pid === null) continue
      for (const [dr, dc] of DIRS) {
        let len = 1
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k
          const nc = c + dc * k
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break
          const idx = nr * cols + nc
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
  kind: import('./types').SelectorKind,
  value: number,
): MoveInput {
  return { kind, value }
}

export function validateBattleshipCells(
  cells: readonly number[],
  ocean: ReadonlySet<number>,
  cols: number,
  shipLen: number,
): boolean {
  if (cells.length !== shipLen) return false
  const uniq = new Set(cells)
  if (uniq.size !== shipLen) return false
  for (const s of cells) {
    if (!ocean.has(s)) return false
  }
  const sorted = [...cells].sort((a, b) => a - b)
  const sameRow = sorted.every((s) => slotRow(s, cols) === slotRow(sorted[0]!, cols))
  const sameCol = sorted.every((s) => slotCol(s, cols) === slotCol(sorted[0]!, cols))
  if (!sameRow && !sameCol) return false
  if (sameRow) {
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1]! + 1) return false
    }
  } else {
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1]! + cols) return false
    }
  }
  return true
}

export function commitBattleshipShipPlacement(
  state: MatchState,
  player: PlayerId,
  cells: readonly number[],
): { ok: true; next: MatchState } | { ok: false; reason: string } {
  if (state.rules !== 'battleship' || !state.battleProducts || !state.battleship) {
    return { ok: false, reason: 'Not a battleship match.' }
  }
  const bs = state.battleship
  if (bs.placement === 'battle') {
    return { ok: false, reason: 'Fleets already deployed.' }
  }
  if (
    bs.placement === 'handoff_to_p2' ||
    bs.placement === 'handoff_to_battle'
  ) {
    return { ok: false, reason: 'Dismiss the handoff screen first.' }
  }
  if (bs.placement === 'p1_place' && player !== 0) {
    return { ok: false, reason: 'Player 1 deploys first.' }
  }
  if (bs.placement === 'p2_place' && player !== 1) {
    return { ok: false, reason: 'Player 2 deploys second.' }
  }

  const shipLen = bs.fleetLengths[bs.placingShipIndex]
  if (shipLen === undefined) {
    return { ok: false, reason: 'Fleet roster is invalid.' }
  }

  const ocean = fullOceanSlots(state.cols, state.rows)
  if (!validateBattleshipCells(cells, ocean, state.cols, shipLen)) {
    return {
      ok: false,
      reason: `Pick ${shipLen} touching cells in one row or column on your ocean.`,
    }
  }

  const cellsSorted = [...cells].sort((a, b) => a - b)
  const occupied = new Set(bs.ships[player].flat())
  if (cellsSorted.some((c) => occupied.has(c))) {
    return { ok: false, reason: 'Ship overlaps another ship in your fleet.' }
  }

  const newArmada = [...bs.ships[player], cellsSorted]
  const ships: BattleshipState['ships'] =
    player === 0 ? [newArmada, bs.ships[1]] : [bs.ships[0], newArmada]

  const nextIndex = bs.placingShipIndex + 1
  const finishedPlayerFleet = nextIndex >= bs.fleetLengths.length

  let placement: BattleshipPlacementTag = bs.placement
  let placingShipIndex = nextIndex
  let pendingFirstShooter = bs.pendingFirstShooter

  if (finishedPlayerFleet) {
    placingShipIndex = 0
    if (player === 0) {
      placement = 'handoff_to_p2'
    } else {
      placement = 'handoff_to_battle'
      pendingFirstShooter = (Math.floor(Math.random() * 2) ? 1 : 0) as PlayerId
    }
  }

  const nb: BattleshipState = {
    ...bs,
    placement,
    ships,
    placingShipIndex,
    pendingFirstShooter,
  }

  const next: MatchState = {
    ...state,
    battleship: nb,
    upperFactor: null,
    lowerFactor: null,
    lastMoveNote: null,
  }

  return { ok: true, next }
}

/** Continue past a shield — unlocks the next placement phase or battle + turn order. */
export function advanceBattleshipHandoff(state: MatchState): MatchState {
  if (state.rules !== 'battleship' || !state.battleship) return state
  const bs = state.battleship
  if (bs.placement === 'handoff_to_p2') {
    return {
      ...state,
      battleship: {
        ...bs,
        placement: 'p2_place',
        placingShipIndex: 0,
      },
      lastMoveNote: null,
    }
  }
  if (bs.placement === 'handoff_to_battle') {
    const first = bs.pendingFirstShooter ?? (0 as PlayerId)
    return {
      ...state,
      battleship: {
        ...bs,
        placement: 'battle',
        pendingFirstShooter: null,
      },
      currentPlayer: first,
      upperFactor: null,
      lowerFactor: null,
      lastMoveNote: null,
    }
  }
  return state
}
