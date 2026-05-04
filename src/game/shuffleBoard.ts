import { CANONICAL_PRODUCTS } from './boardLayout'
import { NUM_SLOTS } from './types'

/** Fisher–Yates shuffle copy of canonical products into slot order. */
export function shuffledProducts(seed?: number): number[] {
  const arr = [...CANONICAL_PRODUCTS]
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 0xffffffff))

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Deterministic PRNG for reproducible tests / optional seeded shuffle. */
function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function validateUniqueProducts(products: number[]): boolean {
  if (products.length !== NUM_SLOTS) return false
  return new Set(products).size === NUM_SLOTS
}
