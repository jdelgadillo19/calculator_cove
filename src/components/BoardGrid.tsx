import type { MatchState, PlayerId } from '../game/types'
import { GRID_SIZE } from '../game/types'

type Props = {
  state: MatchState
  playerColors: readonly [string, string]
  interactive?: boolean
  highlightSlots?: ReadonlySet<number> | null
  onSlotPointerDown?: (slot: number) => void
}

export function BoardGrid({
  state,
  playerColors,
  interactive = true,
  highlightSlots,
  onSlotPointerDown,
}: Props) {
  const { productsBySlot, owners } = state

  return (
    <div
      className="grid w-full gap-1 sm:gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
      }}
      role="grid"
      aria-label="Product grid"
    >
      {productsBySlot.map((product, slot) => {
        const preview = highlightSlots?.has(slot) ?? false
        const claimed = owners[slot] !== null
        return (
          <div
            key={slot}
            data-slot={slot}
            role="gridcell"
            aria-label={`Slot ${slot + 1}, value ${product}`}
            className={[
              'flex aspect-square cursor-default items-center justify-center rounded-md border-2 text-base font-semibold shadow-inner sm:text-lg',
              interactive ? '' : 'opacity-90',
              claimed ? '' : 'border-[var(--color-mc-tile-border)] bg-[var(--color-mc-tile)] text-neutral-800',
              preview ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-[#1a1510] sm:ring-offset-2' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              claimed
                ? {
                    borderColor: playerColors[owners[slot] as PlayerId],
                    backgroundColor: `${playerColors[owners[slot] as PlayerId]}33`,
                    color: '#111',
                  }
                : undefined
            }
            onPointerDown={() => onSlotPointerDown?.(slot)}
          >
            {product}
          </div>
        )
      })}
    </div>
  )
}
