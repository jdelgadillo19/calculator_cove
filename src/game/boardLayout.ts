import {
  quadrantCountToDims,
  slotQuadrant,
  slotWithinQuadrant,
} from './gridSpec'
import { shuffledProducts } from './shuffleBoard'
import type { GameMode, QuadrantCount } from './types'
import { SLOTS_PER_QUADRANT } from './types'

/**
 * Displayed values offset per quadrant so the same small-multiple pattern
 * does not collide across quadrants when resolving factor → cell.
 */
export const PRODUCT_QUADRANT_OFFSET = 280

/**
 * Canonical board: 36 distinct products in ascending order (reading order),
 * matching the reference mockup.
 */
export const CANONICAL_PRODUCTS: readonly number[] = [
  1, 2, 3, 4, 5, 6,
  7, 8, 9, 10, 12, 14,
  15, 16, 18, 20, 21, 24,
  25, 27, 28, 30, 32, 35,
  36, 40, 42, 45, 48, 49,
  54, 56, 63, 64, 72, 81,
] as const

export function assertCanonicalShape(products: readonly number[]): void {
  if (products.length !== SLOTS_PER_QUADRANT) {
    throw new Error(`Expected ${SLOTS_PER_QUADRANT} slots, got ${products.length}`)
  }
  const seen = new Set<number>()
  for (const p of products) {
    if (seen.has(p)) throw new Error(`Duplicate product on board: ${p}`)
    seen.add(p)
  }
}

/** Build value → single slot index map (unique board). */
export function productToSlotMap(productsBySlot: readonly number[]): Map<number, number> {
  const m = new Map<number, number>()
  productsBySlot.forEach((p, slot) => {
    m.set(p, slot)
  })
  return m
}

function quadrantTemplateCount(qc: QuadrantCount): number {
  switch (qc) {
    case 1:
      return 1
    case 2:
      return 2
    case 4:
      return 4
    default:
      return 1
  }
}

/** Flat product grid for `quadrantCount` regions (classic or shuffled per region). */
export function buildProductsGrid(options: {
  quadrantCount: QuadrantCount
  mode: GameMode
  shuffleSeed?: number
}): number[] {
  const qc = options.quadrantCount
  const { cols, rows } = quadrantCountToDims(qc)
  const templates: number[][] = []
  const nTpl = quadrantTemplateCount(qc)
  for (let q = 0; q < nTpl; q++) {
    if (options.mode === 'classic') {
      templates.push([...CANONICAL_PRODUCTS])
    } else {
      const seed = (options.shuffleSeed ?? Math.floor(Math.random() * 0xffffffff)) + q * 97_231
      templates.push(shuffledProducts(seed))
    }
  }
  const total = cols * rows
  const out = new Array<number>(total)
  for (let s = 0; s < total; s++) {
    const qi = slotQuadrant(s, qc, cols)
    const wi = slotWithinQuadrant(s, qc, cols)
    out[s] = templates[qi][wi] + qi * PRODUCT_QUADRANT_OFFSET
  }
  return out
}

/** Independent charts for two captains (shuffle seeds differ when shuffled). */
export function buildDualPlayerBattleProducts(options: {
  quadrantCount: QuadrantCount
  mode: GameMode
  shuffleSeed?: number
}): [number[], number[]] {
  const left = buildProductsGrid(options)
  const rightSeed =
    options.mode === 'shuffled'
      ? (options.shuffleSeed ?? 13_811) + 41_707
      : undefined
  const right = buildProductsGrid({
    quadrantCount: options.quadrantCount,
    mode: options.mode,
    shuffleSeed: rightSeed,
  })
  return [left, right]
}
