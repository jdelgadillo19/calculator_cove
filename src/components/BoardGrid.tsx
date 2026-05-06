import type { MatchState, PlayerId } from '../game/types'
import { fullOceanSlots } from '../game/gridSpec'

type Props = {
  state: MatchState
  playerColors: readonly [string, string]
  interactive?: boolean
  compact?: boolean
  highlightSlots?: ReadonlySet<number> | null
  onSlotPointerDown?: (slot: number) => void
  placementSelection?: readonly number[] | null
  placementPlayer?: PlayerId | null
  /** Battleship: multiplication chart for the ocean being shown (placement owner or battle defender). */
  productsChart?: readonly number[] | null
  /** Battleship battle: defender whose fog-of-war / hits apply (typically the opponent of `currentPlayer`). */
  battleshipDefender?: PlayerId | null
  /** Products-only ocean (no fleet tint) — e.g. opponent minimap during placement. */
  plainOcean?: boolean
}

export function BoardGrid({
  state,
  playerColors,
  interactive = true,
  compact = false,
  highlightSlots,
  onSlotPointerDown,
  placementSelection,
  placementPlayer,
  productsChart = null,
  battleshipDefender = null,
  plainOcean = false,
}: Props) {
  const chart = productsChart ?? state.productsBySlot
  const { owners, cols, rules, battleship } = state
  const selectionSet =
    placementSelection && placementSelection.length > 0
      ? new Set(placementSelection)
      : null

  const placementActive =
    rules === 'battleship' &&
    battleship !== null &&
    (battleship.placement === 'p1_place' ||
      battleship.placement === 'p2_place')

  const ocean =
    placementActive && placementPlayer !== null && placementPlayer !== undefined
      ? fullOceanSlots(state.cols, state.rows)
      : null

  const battleMode =
    rules === 'battleship' && battleship?.placement === 'battle'

  return (
    <div
      className={[
        'grid w-full',
        compact ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5',
      ].join(' ')}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      }}
      role="grid"
      aria-label={rules === 'battleship' ? 'Fleet grid' : 'Product grid'}
    >
      {chart.map((product, slot) => {
        const preview = highlightSlots?.has(slot) ?? false

        let claimedConnect = false
        let ownerId: PlayerId | null = null
        let battleshipUi:
          | { kind: 'sea' | 'miss' | 'hit'; shipTint?: string }
          | null = null

        if (rules === 'connect') {
          claimedConnect = owners[slot] !== null
          ownerId = owners[slot]
        } else if (
          plainOcean &&
          rules === 'battleship' &&
          battleship !== null
        ) {
          battleshipUi = { kind: 'sea' }
        } else if (battleMode && battleship && battleshipDefender !== null) {
          const def = battleshipDefender
          const shot = battleship.shotsReceivedByDefender[def][slot]
          const shipHere = battleship.ships[def].some((ship) =>
            ship.includes(slot),
          )

          if (shot !== null) {
            battleshipUi = {
              kind: shipHere ? 'hit' : 'miss',
              shipTint: shipHere ? playerColors[def] : undefined,
            }
          } else {
            battleshipUi = { kind: 'sea' }
          }
        } else if (
          placementActive &&
          battleship &&
          placementPlayer !== null &&
          placementPlayer !== undefined
        ) {
          const mine = battleship.ships[placementPlayer].some((ship) =>
            ship.includes(slot),
          )
          battleshipUi = mine
            ? {
                kind: 'sea',
                shipTint: playerColors[placementPlayer],
              }
            : { kind: 'sea' }
        }

        const placementHighlight =
          ocean?.has(slot) && selectionSet?.has(slot) === true

        return (
          <div
            key={slot}
            data-slot={slot}
            role="gridcell"
            aria-label={`Slot ${slot + 1}, value ${product}`}
            className={[
              'relative flex aspect-square cursor-default items-center justify-center rounded-md border-2 font-semibold shadow-inner',
              compact
                ? 'border-[1.5px] text-[0.6rem] sm:text-[0.7rem]'
                : 'border-2 text-base sm:text-lg',
              interactive ? '' : 'opacity-90',
              rules === 'connect' && !claimedConnect
                ? 'border-[var(--color-cc-tile-border)] bg-[var(--color-cc-tile)] text-neutral-800'
                : '',
              rules === 'connect' && claimedConnect ? '' : '',
              preview
                ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-[var(--color-cc-ocean-deep)] sm:ring-offset-2'
                : '',
              placementHighlight ? 'ring-2 ring-cyan-300 ring-offset-1' : '',
              ocean && placementSelection && ocean.has(slot)
                ? 'cursor-pointer hover:brightness-105'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              rules === 'connect' && claimedConnect && ownerId !== null
                ? {
                    borderColor: playerColors[ownerId],
                    backgroundColor: `${playerColors[ownerId]}33`,
                    color: '#111',
                  }
                : battleshipUi?.kind === 'hit'
                  ? {
                      borderColor: battleshipUi.shipTint ?? '#b91c1c',
                      backgroundColor: `${battleshipUi.shipTint ?? '#ef4444'}55`,
                      color: '#111',
                    }
                  : battleshipUi?.kind === 'miss'
                    ? {
                        borderColor: 'rgba(56, 189, 248, 0.55)',
                        backgroundColor: 'rgba(14, 165, 233, 0.2)',
                        color: '#0c4a6e',
                      }
                    : battleshipUi?.kind === 'sea' && battleshipUi.shipTint
                      ? {
                          borderColor: `${battleshipUi.shipTint}aa`,
                          backgroundColor: `${battleshipUi.shipTint}28`,
                          color: '#111',
                        }
                      : battleshipUi?.kind === 'sea'
                        ? {
                            borderColor: 'rgba(255,255,255,0.22)',
                            backgroundColor: 'rgba(15, 76, 117, 0.22)',
                            color: '#e0f2fe',
                          }
                        : undefined
            }
            onPointerDown={() => onSlotPointerDown?.(slot)}
          >
            <span className="relative z-[1]">{product}</span>
            {battleshipUi?.kind === 'hit' && (
              <span className="pointer-events-none absolute inset-1 rounded-sm border border-white/35 bg-black/15 text-[0.65rem] font-black leading-none text-white shadow-inner sm:text-xs">
                ×
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
