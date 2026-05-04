import { describe, expect, it } from 'vitest'
import { CANONICAL_PRODUCTS } from './boardLayout'
import {
  applyMove,
  clearSelectorsIfDeadlocked,
  computeWinner,
  createMatch,
  hasClaimableNeighbor,
  NOTE_DEADLOCK_RESET,
  NOTE_FACTOR_DEAD_UPPER,
  tryApplyMove,
} from './engine'
import { shuffledProducts } from './shuffleBoard'
import { NUM_SLOTS } from './types'

describe('createMatch', () => {
  it('starts with empty ownership and unset selectors', () => {
    const m = createMatch({})
    expect(m.owners.every((o) => o === null)).toBe(true)
    expect(m.phase).toBe('playing')
    expect(m.upperFactor).toBeNull()
    expect(m.lowerFactor).toBeNull()
  })

  it('accepts shuffled products with unique values', () => {
    const products = shuffledProducts(42)
    expect(new Set(products).size).toBe(NUM_SLOTS)
    const m = createMatch({ productsBySlot: products })
    expect(m.productsBySlot).toEqual(products)
  })
})

describe('win detection', () => {
  it('detects horizontal four in a row on fixed slots', () => {
    const owners = Array.from({ length: NUM_SLOTS }, () => null as 0 | 1 | null)
    owners[0] = 0
    owners[1] = 0
    owners[2] = 0
    owners[3] = 0
    expect(computeWinner(owners)).toBe(0)
  })

  it('is unchanged when only products permute (ownership pattern)', () => {
    const owners = Array.from({ length: NUM_SLOTS }, () => null as 0 | 1 | null)
    owners[6] = 1
    owners[12] = 1
    owners[18] = 1
    owners[24] = 1
    expect(computeWinner(owners)).toBe(1)
  })
})

describe('applyMove', () => {
  it('does not claim until both selectors are placed', () => {
    let m = createMatch({})
    m = applyMove(m, { kind: 'upper', value: 2 })
    expect(m.upperFactor).toBe(2)
    expect(m.lowerFactor).toBeNull()
    expect(m.owners.every((o) => o === null)).toBe(true)
    expect(m.currentPlayer).toBe(1)

    m = applyMove(m, { kind: 'lower', value: 3 })
    expect(m.upperFactor).toBe(2)
    expect(m.lowerFactor).toBe(3)
    const slot = CANONICAL_PRODUCTS.indexOf(6)
    expect(m.owners[slot]).toBe(1)
    expect(m.currentPlayer).toBe(0)
  })

  it('alternates players after a successful claim in steady state', () => {
    let m = createMatch({
      startUpper: 2,
      startLower: 3,
    })
    m = applyMove(m, { kind: 'upper', value: 4 })
    const slot = CANONICAL_PRODUCTS.indexOf(12)
    expect(m.owners[slot]).toBe(0)
    expect(m.currentPlayer).toBe(1)
  })

  it('allows repositioning the first arrow before the partner is placed', () => {
    let m = createMatch({})
    m = applyMove(m, { kind: 'upper', value: 2 })
    m = applyMove(m, { kind: 'upper', value: 5 })
    expect(m.upperFactor).toBe(5)
    expect(m.lowerFactor).toBeNull()
    expect(m.owners.every((o) => o === null)).toBe(true)
  })
})

describe('tryApplyMove', () => {
  it('rejects XOR violation without changing factors', () => {
    const m = createMatch({ startUpper: 3, startLower: 4 })
    const r = tryApplyMove(m, { kind: 'upper', value: 3 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('exactly one selector')
  })

  it('rejects product not shown on the board (factors unchanged, same player)', () => {
    const products = CANONICAL_PRODUCTS.map((p) => (p === 12 ? 97 : p))
    const m = createMatch({
      productsBySlot: products,
      startUpper: 3,
      startLower: 5,
    })
    const r = tryApplyMove(m, { kind: 'lower', value: 4 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toContain('No tile shows')
      expect(r.reason).toContain('12')
    }
    expect(m.upperFactor).toBe(3)
    expect(m.lowerFactor).toBe(5)
    expect(m.currentPlayer).toBe(0)
  })

  it('rejects claim when product slot is already owned', () => {
    const slot12 = CANONICAL_PRODUCTS.indexOf(12)
    const base = createMatch({ startUpper: 3, startLower: 5 })
    const owners = base.owners.map((o, i) => (i === slot12 ? (0 as const) : o))
    const m = { ...base, owners, currentPlayer: 1 as const }
    const r = tryApplyMove(m, { kind: 'lower', value: 4 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('already claimed')
    expect(m.upperFactor).toBe(3)
    expect(m.lowerFactor).toBe(5)
    expect(m.currentPlayer).toBe(1)
    expect(m.owners[slot12]).toBe(0)
  })
})

describe('applyMove invalid product', () => {
  it('only sets lastMoveNote and leaves match unchanged for missing product', () => {
    const products = CANONICAL_PRODUCTS.map((p) => (p === 12 ? 97 : p))
    const before = createMatch({
      productsBySlot: products,
      startUpper: 3,
      startLower: 5,
    })
    const after = applyMove(before, { kind: 'lower', value: 4 })
    expect(after.upperFactor).toBe(before.upperFactor)
    expect(after.lowerFactor).toBe(before.lowerFactor)
    expect(after.currentPlayer).toBe(before.currentPlayer)
    expect(after.owners).toEqual(before.owners)
    expect(after.lastMoveNote).toContain('No tile shows')
    expect(after.lastMoveNote).toContain('12')
  })

  it('only sets lastMoveNote for already-claimed product', () => {
    const slot12 = CANONICAL_PRODUCTS.indexOf(12)
    const base = createMatch({ startUpper: 3, startLower: 5 })
    const owners = base.owners.map((o, i) => (i === slot12 ? (0 as const) : o))
    const before = { ...base, owners, currentPlayer: 1 as const }
    const after = applyMove(before, { kind: 'lower', value: 4 })
    expect(after.upperFactor).toBe(3)
    expect(after.lowerFactor).toBe(5)
    expect(after.currentPlayer).toBe(1)
    expect(after.owners[slot12]).toBe(0)
    expect(after.lastMoveNote).toContain('already claimed')
  })
})

describe('deadlock', () => {
  it('detects no claimable neighbor when all one-step products are claimed', () => {
    const base = createMatch({})
    const neighborProducts = new Set<number>()
    const A = 5
    const B = 5
    for (let U = 1; U <= 9; U++) {
      if (U !== A) neighborProducts.add(U * B)
    }
    for (let L = 1; L <= 9; L++) {
      if (L !== B) neighborProducts.add(A * L)
    }
    const owners = base.owners.slice()
    for (let i = 0; i < NUM_SLOTS; i++) {
      const p = CANONICAL_PRODUCTS[i]
      if (neighborProducts.has(p)) owners[i] = 0
    }
    const m = {
      ...base,
      owners,
      upperFactor: 5 as const,
      lowerFactor: 5 as const,
    }
    expect(hasClaimableNeighbor(m)).toBe(false)
    const cleared = clearSelectorsIfDeadlocked(m)
    expect(cleared.upperFactor).toBeNull()
    expect(cleared.lowerFactor).toBeNull()
    expect(cleared.lastMoveNote).toBe(NOTE_DEADLOCK_RESET)
  })

  it('rejects placing a selector on a factor with no empty products left', () => {
    const base = createMatch({})
    const owners = base.owners.slice()
    for (let i = 0; i < NUM_SLOTS; i++) {
      const p = CANONICAL_PRODUCTS[i]
      if (p >= 1 && p <= 9) owners[i] = 0
    }
    const m = { ...base, owners }
    const r = tryApplyMove(m, { kind: 'upper', value: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe(NOTE_FACTOR_DEAD_UPPER)
  })
})
