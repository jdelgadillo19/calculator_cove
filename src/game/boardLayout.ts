import { NUM_SLOTS } from './types'

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
  if (products.length !== NUM_SLOTS) {
    throw new Error(`Expected ${NUM_SLOTS} slots, got ${products.length}`)
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
