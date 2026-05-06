import type { PlayerId, QuadrantCount } from './types'

/** Grid spans — classic board is one 6×6 quadrant. */
export const QUADRANT_SIDE = 6

export function quadrantCountToDims(q: QuadrantCount): { cols: number; rows: number } {
  switch (q) {
    case 1:
      return { cols: QUADRANT_SIDE, rows: QUADRANT_SIDE }
    case 2:
      return { cols: QUADRANT_SIDE * 2, rows: QUADRANT_SIDE }
    case 4:
      return { cols: QUADRANT_SIDE * 2, rows: QUADRANT_SIDE * 2 }
    default:
      return { cols: QUADRANT_SIDE, rows: QUADRANT_SIDE }
  }
}

export function numSlotsForQuadrants(q: QuadrantCount): number {
  const { cols, rows } = quadrantCountToDims(q)
  return cols * rows
}

export function slotRow(slot: number, cols: number): number {
  return Math.floor(slot / cols)
}

export function slotCol(slot: number, cols: number): number {
  return slot % cols
}

/** Which quadrant index (0..q-1) a global slot belongs to. */
export function slotQuadrant(
  slot: number,
  quadrantCount: QuadrantCount,
  cols: number,
): number {
  const row = Math.floor(slot / cols)
  const col = slot % cols
  switch (quadrantCount) {
    case 1:
      return 0
    case 2:
      return col < QUADRANT_SIDE ? 0 : 1
    case 4: {
      const qr = row < QUADRANT_SIDE ? 0 : 1
      const qc = col < QUADRANT_SIDE ? 0 : 1
      return qr * 2 + qc
    }
    default:
      return 0
  }
}

/** Linear index within the 6×6 quadrant (0–35). */
export function slotWithinQuadrant(
  slot: number,
  quadrantCount: QuadrantCount,
  cols: number,
): number {
  const row = Math.floor(slot / cols)
  const col = slot % cols
  switch (quadrantCount) {
    case 1:
      return slot
    case 2:
      return row * QUADRANT_SIDE + (col % QUADRANT_SIDE)
    case 4:
      return (row % QUADRANT_SIDE) * QUADRANT_SIDE + (col % QUADRANT_SIDE)
    default:
      return slot
  }
}

/** Global slots belonging to a quadrant index. */
export function slotsInQuadrant(
  qIndex: number,
  quadrantCount: QuadrantCount,
  cols: number,
  rows: number,
): number[] {
  const out: number[] = []
  for (let s = 0; s < cols * rows; s++) {
    if (slotQuadrant(s, quadrantCount, cols) === qIndex) out.push(s)
  }
  return out
}

/** Every cell index on a captain’s personal ocean (same footprint for both players). */
export function fullOceanSlots(cols: number, rows: number): ReadonlySet<number> {
  return new Set(Array.from({ length: cols * rows }, (_, i) => i))
}

/** Connect-mode split oceans when multiple quadrants share one physical board. */
export function oceanSlotsForPlayer(
  player: PlayerId,
  quadrantCount: QuadrantCount,
  cols: number,
  rows: number,
): ReadonlySet<number> {
  const set = new Set<number>()
  const total = cols * rows
  for (let s = 0; s < total; s++) {
    if (quadrantCount === 1) {
      set.add(s)
      continue
    }
    const q = slotQuadrant(s, quadrantCount, cols)
    const owner: PlayerId =
      quadrantCount === 2
          ? q === 0
            ? (0 as PlayerId)
            : (1 as PlayerId)
          : // 4 quadrants: P0 owns Q0+Q3, P1 owns Q1+Q2
            q === 0 || q === 3
            ? (0 as PlayerId)
            : (1 as PlayerId)
    if (owner === player) set.add(s)
  }
  return set
}
