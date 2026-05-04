/** Products k*f for k in 1..9 on the reference factor strip. */
export function productTreeValues(f: number): Set<number> {
  const s = new Set<number>()
  const factor = Math.min(9, Math.max(1, Math.round(f)))
  for (let k = 1; k <= 9; k++) s.add(factor * k)
  return s
}

/** Slot indices whose displayed product lies on this factor's tree. */
export function slotsForFactorTree(
  productsBySlot: readonly number[],
  f: number,
): Set<number> {
  const tree = productTreeValues(f)
  const out = new Set<number>()
  productsBySlot.forEach((p, slot) => {
    if (tree.has(p)) out.add(slot)
  })
  return out
}
