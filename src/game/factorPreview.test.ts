import { describe, expect, it } from 'vitest'
import { CANONICAL_PRODUCTS } from './boardLayout'
import { productTreeValues, slotsForFactorTree } from './factorPreview'

describe('productTreeValues', () => {
  it('includes multiples 1..9 for factor 3', () => {
    const s = productTreeValues(3)
    expect(s.has(3)).toBe(true)
    expect(s.has(27)).toBe(true)
    expect(s.has(30)).toBe(false)
  })

  it('clamps factor to 1..9', () => {
    const sort = (s: Set<number>) => [...s].sort((a, b) => a - b)
    expect(sort(productTreeValues(0))).toEqual(sort(productTreeValues(1)))
    expect(sort(productTreeValues(99))).toEqual(sort(productTreeValues(9)))
  })
})

describe('slotsForFactorTree', () => {
  it('maps canonical board values for factor 9', () => {
    const slots = slotsForFactorTree(CANONICAL_PRODUCTS, 9)
    const values = [...slots].map((i) => CANONICAL_PRODUCTS[i])
    expect(values).toContain(9)
    expect(values).toContain(81)
    expect(values.every((v) => v % 9 === 0)).toBe(true)
  })
})
