import {
  battleshipSalvoTargets,
  commitBattleshipShipPlacement,
  flipPlayer,
  tryApplyMove,
  validateBattleshipCells,
} from './engine'
import { fullOceanSlots } from './gridSpec'
import type { AiDifficulty, MatchState, MoveInput, PlayerId } from './types'

export function listLegalMoves(state: MatchState): MoveInput[] {
  const out: MoveInput[] = []
  const salvoTargets = battleshipSalvoTargets(state)
  if (salvoTargets && salvoTargets.length > 1) {
    for (const targetSlot of salvoTargets) {
      const mv: MoveInput = { kind: 'salvo', targetSlot }
      if (tryApplyMove(state, mv).ok) out.push(mv)
    }
  }
  const seen = new Set<string>()
  for (let v = 1; v <= 9; v++) {
    for (const kind of ['upper', 'lower'] as const) {
      const mv: MoveInput = { kind, value: v }
      if (tryApplyMove(state, mv).ok) {
        const sig = `${kind}-${v}`
        if (!seen.has(sig)) {
          seen.add(sig)
          out.push(mv)
        }
      }
    }
  }
  return out
}

function heuristicConnect(state: MatchState, perspective: PlayerId): number {
  let score = 0
  const { owners, cols, rows } = state
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ] as const
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      const pid = owners[idx]
      if (pid === null) continue
      const weight = pid === perspective ? 1 : -1
      for (const [dr, dc] of dirs) {
        let len = 1
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k
          const nc = c + dc * k
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break
          if (owners[nr * cols + nc] !== pid) break
          len++
        }
        score += weight * len * len
      }
    }
  }
  return score
}

function heuristicBattleship(state: MatchState, perspective: PlayerId): number {
  const opp = flipPlayer(perspective)
  const bs = state.battleship
  if (!bs) return 0
  const shipsFlat = bs.ships[opp].flat()
  if (shipsFlat.length === 0) return 0
  const shots = bs.shotsReceivedByDefender[opp]
  let hits = 0
  for (const s of shipsFlat) {
    if (shots[s] !== null) hits++
  }
  const ratio = hits / shipsFlat.length
  return ratio * 500 + Math.random()
}

function heuristic(state: MatchState, perspective: PlayerId): number {
  if (state.rules === 'connect') return heuristicConnect(state, perspective)
  return heuristicBattleship(state, perspective)
}

function scoreImmediate(
  state: MatchState,
  mv: MoveInput,
  perspective: PlayerId,
): number {
  const r = tryApplyMove(state, mv)
  if (!r.ok) return -1e9
  const n = r.next
  if (n.phase === 'won' && n.winner === perspective) return 1e6
  if (n.phase === 'won' && n.winner !== null && n.winner !== perspective)
    return -1e6
  return heuristic(n, perspective)
}

export function pickComputerMove(
  state: MatchState,
  difficulty: AiDifficulty,
): MoveInput | null {
  const legal = listLegalMoves(state)
  if (legal.length === 0) return null
  const perspective = state.currentPlayer
  const ranked = legal.map((mv) => ({
    mv,
    score: scoreImmediate(state, mv, perspective),
  }))
  ranked.sort((a, b) => b.score - a.score)

  if (difficulty === 'easy') {
    return legal[Math.floor(Math.random() * legal.length)]!
  }
  if (difficulty === 'medium') {
    if (Math.random() < 0.58 && ranked[0]) return ranked[0].mv
    return legal[Math.floor(Math.random() * legal.length)]!
  }
  const top = ranked[0]?.score ?? 0
  const tier = ranked.filter((x) => x.score >= top - 3)
  return tier[Math.floor(Math.random() * tier.length)]!.mv
}

/** Random orthogonal ship fully inside the personal ocean. */
export function randomBattleshipLine(
  state: MatchState,
  _player: PlayerId,
  shipLen: number,
): number[] {
  const oceanArr = [...fullOceanSlots(state.cols, state.rows)]
  const ocean = new Set(oceanArr)
  const { cols } = state

  for (let attempt = 0; attempt < 2400; attempt++) {
    const start = oceanArr[Math.floor(Math.random() * oceanArr.length)]!
    const horizontal = Math.random() < 0.5
    const line: number[] = [start]
    for (let k = 1; k < shipLen; k++) {
      line.push(horizontal ? start + k : start + k * cols)
    }
    if (validateBattleshipCells(line, ocean, cols, shipLen)) return line
  }

  for (const start of oceanArr) {
    for (const horizontal of [true, false]) {
      const line: number[] = [start]
      for (let k = 1; k < shipLen; k++) {
        line.push(horizontal ? start + k : start + k * cols)
      }
      if (validateBattleshipCells(line, ocean, cols, shipLen)) return line
    }
  }

  throw new Error('randomBattleshipLine: no legal placement found')
}

/** CPU Player 2 — places every ship in `p2_place` until handoff to battle. */
export function autoPlaceCpuFleet(state: MatchState, player: PlayerId): MatchState {
  let m = state
  let guard = 0
  while (m.battleship?.placement === 'p2_place') {
    guard++
    if (guard > 8000) {
      return {
        ...m,
        lastMoveNote: 'CPU could not finish fleet placement.',
      }
    }
    try {
      const bs = m.battleship!
      const len = bs.fleetLengths[bs.placingShipIndex]!
      const line = randomBattleshipLine(m, player, len)
      const r = commitBattleshipShipPlacement(m, player, line)
      if (r.ok) m = r.next
    } catch {
      /* retry */
    }
  }
  return m
}
