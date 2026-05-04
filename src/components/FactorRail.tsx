import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type RefObject,
} from 'react'
import type { SelectorKind } from '../game/types'

const FACTORS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

/** Signed wheel accumulation must reach this (either direction) to prime cancel. */
const SCROLL_PRIME_ENTER = 70
/** Drop below this (hysteresis) to clear primed state when scrolling the other way. */
const SCROLL_PRIME_EXIT = 28

/** Shown in UI while cancel is primed (still dragging). */
export const SCROLL_PRIME_WARNING =
  'Cancel armed — scroll the other way to undo, or release to cancel this move.'

/** Stored in match.lastMoveNote when player releases while scroll-cancel was primed. */
export const NOTE_SCROLL_CANCEL_RELEASE =
  'Move canceled (scroll primed, then released).'

function wheelSignedDelta(ev: WheelEvent): number {
  return Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return
  if (typeof ref === 'function') ref(value)
  else (ref as MutableRefObject<T | null>).current = value
}

type LayoutSnap = {
  /** Horizontal center for the arrow when no factor is placed — middle of the invisible park band beside the tile tray. */
  nullRestCx: number
  tileCx: number[]
}

function snapsNearlyEqual(a: LayoutSnap, b: LayoutSnap, eps = 0.5): boolean {
  if (Math.abs(a.nullRestCx - b.nullRestCx) > eps) return false
  if (a.tileCx.length !== b.tileCx.length) return false
  for (let i = 0; i < a.tileCx.length; i++) {
    if (Math.abs(a.tileCx[i] - b.tileCx[i]) > eps) return false
  }
  return true
}

/** Result of validating a selector move against current match rules. */
export type MoveEvaluation =
  | { ok: true }
  | { ok: false; reason: string }

const SNAPBACK_NOTE_PICK_MISS =
  'Release closer to a factor number (1–9).' as const

/** Horizontal snap-to-rest matched the factor already on this rail — no rule violation, but explain why nothing changed. */
const SNAPBACK_NOTE_SAME_FACTOR =
  'That factor is already selected — drag to a different number.' as const

/** Pointer Events: scroll / some trackpad gestures abort an active pointer capture (common on Magic Mouse). */
const SNAPBACK_NOTE_POINTER_CANCEL =
  'Scrolling canceled the drag — keep the finger still on click, or use keyboard ← →.' as const

type Props = {
  upperFactor: number | null
  lowerFactor: number | null
  disabled?: boolean
  evaluateMove: (kind: SelectorKind, value: number) => MoveEvaluation
  onSnapbackNote: (note: string) => void
  onCommit: (kind: SelectorKind, value: number) => void
  onFactorClick?: (factor: number) => void
  /** Horizontal shift (px) for the digit row so factor 5 aligns with the board column boundary. */
  digitRowOffsetPx?: number
  /** Prime warning line while dragging (`null` when not primed). */
  onScrollPrimeHint?: (hint: string | null) => void
  /** Factors that cannot pair with anything to claim an empty tile this round (grey out). */
  isFactorPlayable?: (factor: number) => boolean
}

export const FactorRail = forwardRef<HTMLDivElement, Props>(
  function FactorRail(
    {
      upperFactor,
      lowerFactor,
      disabled,
      evaluateMove,
      onSnapbackNote,
      onCommit,
      onFactorClick,
      digitRowOffsetPx = 0,
      onScrollPrimeHint,
      isFactorPlayable,
    },
    forwardedRef,
  ) {
    const outerRef = useRef<HTMLDivElement>(null)
    /** Layout-only strip (invisible): reserves blank space so null selectors sit off the “1” tile, matching old gutter geometry without a visible placeholder cell. */
    const arrowParkRef = useRef<HTMLDivElement>(null)
    const tileRefs = useRef<(HTMLButtonElement | null)[]>([])
    const upperLabelId = useId()
    const lowerLabelId = useId()
    const [layoutGen, setLayoutGen] = useState(0)
    const [snap, setSnap] = useState<LayoutSnap | null>(null)

    const bumpLayout = useCallback(() => setLayoutGen((g) => g + 1), [])

    const setRootRef = useCallback(
      (el: HTMLDivElement | null) => {
        outerRef.current = el
        assignRef(forwardedRef, el)
      },
      [forwardedRef],
    )

    useLayoutEffect(() => {
      const outer = outerRef.current
      const park = arrowParkRef.current
      const tile0 = tileRefs.current[0]
      if (!outer || !park || !tile0) return
      const o = outer.getBoundingClientRect()
      const parkRect = park.getBoundingClientRect()
      const nullRestCx = parkRect.left + parkRect.width / 2 - o.left
      const r0 = tile0.getBoundingClientRect()
      const tileCx = FACTORS.map((_, i) => {
        const el = tileRefs.current[i]
        if (!el) return r0.left + r0.width / 2 - o.left
        const r = el.getBoundingClientRect()
        return r.left + r.width / 2 - o.left
      })
      const next = { nullRestCx, tileCx }
      setSnap((prev) => {
        if (prev && snapsNearlyEqual(prev, next)) return prev
        return next
      })
    }, [layoutGen, upperFactor, lowerFactor, digitRowOffsetPx])

    useEffect(() => {
      const onResize = () => bumpLayout()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [bumpLayout])

    /** Stable per index — inline ref callbacks change identity every render and React will detach/attach repeatedly, causing an infinite bumpLayout loop. */
    const tileRefCallbacks = useMemo(
      () =>
        FACTORS.map((_, index) => (el: HTMLButtonElement | null) => {
          tileRefs.current[index] = el
          bumpLayout()
        }),
      [bumpLayout],
    )

    const restingPx = useCallback(
      (factor: number | null, layout: LayoutSnap | null): number => {
        if (!layout) return 0
        if (factor === null) return layout.nullRestCx
        return layout.tileCx[factor - 1] ?? layout.nullRestCx
      },
      [],
    )

    const upperRestingPx = restingPx(upperFactor, snap)
    const lowerRestingPx = restingPx(lowerFactor, snap)

    const primeHintCb = useCallback(
      (hint: string | null) => {
        onScrollPrimeHint?.(hint)
      },
      [onScrollPrimeHint],
    )

    /** Shared `gap-px` grout; outer `overflow-hidden rounded-md` clips square tile corners so only the rounded shell reads at edges. */
    const tileBase =
      'relative flex aspect-square w-full min-h-0 min-w-0 items-center justify-center bg-[var(--color-mc-tile)] text-xs font-semibold text-neutral-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-400/90 sm:text-sm'

    return (
      <div
        ref={setRootRef}
        className="relative w-full select-none [--gutter:2.5rem] sm:[--gutter:2.75rem]"
        role="group"
        aria-label="Factor selectors"
      >
        <div className="relative h-9 sm:h-10">
          <TrackHint id={upperLabelId} text="Upper factor — arrow points toward factors" />
          <ArrowHandle
            ariaLabelledBy={upperLabelId}
            kind="upper"
            factor={upperFactor}
            restingCenterPx={upperRestingPx}
            disabled={disabled}
            direction="down"
            outerRef={outerRef}
            tileRefs={tileRefs}
            evaluateMove={evaluateMove}
            onSnapbackNote={onSnapbackNote}
            onCommit={onCommit}
            onScrollPrimeHint={onScrollPrimeHint ? primeHintCb : undefined}
          />
        </div>

        <div
          className="flex gap-px"
          style={{
            transform:
              digitRowOffsetPx !== 0 ? `translateX(${digitRowOffsetPx}px)` : undefined,
          }}
        >
          <div
            ref={arrowParkRef}
            className="invisible w-10 shrink-0 pointer-events-none sm:w-11"
            aria-hidden
          />
          <div className="min-w-0 flex-1 overflow-hidden rounded-lg bg-black/18 p-px ring-1 ring-white/[0.07]">
            <div className="grid min-w-0 w-full grid-cols-9 gap-px bg-[color-mix(in_srgb,var(--color-mc-tile-border)_72%,var(--color-mc-purple)_28%)] p-px shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]">
            {FACTORS.map((n, index) => {
              const playable = isFactorPlayable ? isFactorPlayable(n) : true
              const unavailable = !disabled && !playable
              return (
                <button
                  key={n}
                  ref={tileRefCallbacks[index]}
                  type="button"
                  data-factor={n}
                  aria-disabled={disabled || unavailable}
                  disabled={disabled || unavailable}
                  title={unavailable ? 'Unavailable — no empty product for this factor' : undefined}
                  className={`${tileBase} ${
                    disabled
                      ? 'cursor-not-allowed opacity-70'
                      : unavailable
                        ? 'cursor-not-allowed bg-neutral-600/45 text-neutral-400 grayscale'
                        : 'cursor-pointer hover:brightness-105 active:brightness-95'
                  }`}
                  onClick={() => {
                    if (!disabled && !unavailable) onFactorClick?.(n)
                  }}
                >
                  {n}
                </button>
              )
            })}
            </div>
          </div>
        </div>

        <div className="relative h-9 sm:h-10">
          <TrackHint id={lowerLabelId} text="Lower factor — arrow points toward factors" />
          <ArrowHandle
            ariaLabelledBy={lowerLabelId}
            kind="lower"
            factor={lowerFactor}
            restingCenterPx={lowerRestingPx}
            disabled={disabled}
            direction="up"
            outerRef={outerRef}
            tileRefs={tileRefs}
            evaluateMove={evaluateMove}
            onSnapbackNote={onSnapbackNote}
            onCommit={onCommit}
            onScrollPrimeHint={onScrollPrimeHint ? primeHintCb : undefined}
          />
        </div>

        <p className="mt-1.5 text-center text-[0.65rem] leading-snug text-yellow-200/65 sm:text-xs">
          Tap a factor tile to preview its products · Drag arrows onto factors · Keyboard:
          Tab · ← →
        </p>
      </div>
    )
  },
)

FactorRail.displayName = 'FactorRail'

function TrackHint({ id, text }: { id: string; text: string }) {
  return (
    <span id={id} className="sr-only">
      {text}
    </span>
  )
}

/**
 * Map a horizontal client position to a factor (1–9).
 * Uses nearest-tile distance so flex gaps between tiles do not produce null
 * (which caused snapback on otherwise valid releases).
 */
function factorFromTipClientX(
  tipClientX: number,
  tiles: readonly (HTMLButtonElement | null)[],
): number | null {
  let best: { factor: number; d: number } | null = null
  let minHalfW = Infinity
  for (let i = 0; i < FACTORS.length; i++) {
    const el = tiles[i]
    if (!el) continue
    const r = el.getBoundingClientRect()
    minHalfW = Math.min(minHalfW, r.width / 2)
    let d: number
    if (tipClientX < r.left) d = r.left - tipClientX
    else if (tipClientX > r.right) d = tipClientX - r.right
    else d = 0
    const factor = i + 1
    if (!best || d < best.d) best = { factor, d }
  }
  if (!best) return null
  // Tiles abut with `gap-px`; allow slight horizontal tolerance for releases near tile edges.
  const maxSlop = Math.min(18, 6 + minHalfW)
  if (best.d > maxSlop) return null
  return best.factor
}

type ArrowProps = {
  kind: SelectorKind
  factor: number | null
  restingCenterPx: number
  disabled?: boolean
  direction: 'up' | 'down'
  outerRef: RefObject<HTMLDivElement | null>
  tileRefs: MutableRefObject<(HTMLButtonElement | null)[]>
  evaluateMove: (kind: SelectorKind, value: number) => MoveEvaluation
  onSnapbackNote: (note: string) => void
  onCommit: (kind: SelectorKind, value: number) => void
  onScrollPrimeHint?: (hint: string | null) => void
  ariaLabelledBy: string
}

function ArrowHandle({
  kind,
  factor,
  restingCenterPx,
  disabled,
  direction,
  outerRef,
  tileRefs,
  evaluateMove,
  onSnapbackNote,
  onCommit,
  onScrollPrimeHint,
  ariaLabelledBy,
}: ArrowProps) {
  const [dragLeftPx, setDragLeftPx] = useState<number | null>(null)
  const grabRef = useRef<{
    pointerId: number
    pointerClientX: number
    arrowCenterClientX: number
  } | null>(null)

  /** Button that owns pointer capture during drag. */
  const activeDragButtonRef = useRef<HTMLButtonElement | null>(null)

  /** Signed wheel accumulation (dominant axis per tick). */
  const scrollSignedAccumRef = useRef(0)
  /** True after scroll passes threshold until undone or drag ends. */
  const cancelPrimedRef = useRef(false)

  const wheelDuringDragCleanupRef = useRef<(() => void) | null>(null)

  const removeWheelListenerOnly = () => {
    wheelDuringDragCleanupRef.current?.()
    wheelDuringDragCleanupRef.current = null
  }

  const stopBlockingWheelDuringDrag = () => {
    removeWheelListenerOnly()
    scrollSignedAccumRef.current = 0
  }

  const startBlockingWheelDuringDrag = () => {
    stopBlockingWheelDuringDrag()
    cancelPrimedRef.current = false
    scrollSignedAccumRef.current = 0
    onScrollPrimeHint?.(null)

    const blockWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      scrollSignedAccumRef.current += wheelSignedDelta(ev)
      const a = scrollSignedAccumRef.current
      const absA = Math.abs(a)

      if (!cancelPrimedRef.current && absA >= SCROLL_PRIME_ENTER) {
        cancelPrimedRef.current = true
        onScrollPrimeHint?.(SCROLL_PRIME_WARNING)
      }
      if (cancelPrimedRef.current && absA < SCROLL_PRIME_EXIT) {
        cancelPrimedRef.current = false
        scrollSignedAccumRef.current = 0
        onScrollPrimeHint?.(null)
      }
    }
    window.addEventListener('wheel', blockWheel, { capture: true, passive: false })
    wheelDuringDragCleanupRef.current = () => {
      window.removeEventListener('wheel', blockWheel, { capture: true })
    }
  }

  useLayoutEffect(() => {
    if (grabRef.current === null) setDragLeftPx(null)
  }, [factor, restingCenterPx])

  useEffect(() => {
    return () => stopBlockingWheelDuringDrag()
  }, [])

  const tryFinalizePointerDrag = (
    e: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    const g = grabRef.current
    if (!g || e.pointerId !== g.pointerId) return
    const releasePrimedCancel = cancelPrimedRef.current

    grabRef.current = null
    activeDragButtonRef.current = null
    setDragLeftPx(null)
    cancelPrimedRef.current = false
    scrollSignedAccumRef.current = 0
    onScrollPrimeHint?.(null)
    stopBlockingWheelDuringDrag()

    const btn = e.currentTarget
    try {
      btn.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    if (releasePrimedCancel) {
      onSnapbackNote(NOTE_SCROLL_CANCEL_RELEASE)
      return
    }

    const arrowCenterX =
      g.arrowCenterClientX + (e.clientX - g.pointerClientX)
    const picked = factorFromTipClientX(arrowCenterX, tileRefs.current)

    if (picked === null) {
      onSnapbackNote(SNAPBACK_NOTE_PICK_MISS)
      return
    }
    if (picked === factor) {
      onSnapbackNote(SNAPBACK_NOTE_SAME_FACTOR)
      return
    }
    const ev = evaluateMove(kind, picked)
    if (!ev.ok) {
      onSnapbackNote(ev.reason)
      return
    }
    onCommit(kind, picked)
  }

  const applyKeyboardMove = (value: number) => {
    if (disabled) return
    const ev = evaluateMove(kind, value)
    if (!ev.ok) {
      onSnapbackNote(ev.reason)
      return
    }
    onCommit(kind, value)
  }

  const commitFirstPlayableFromRest = (lowToHigh: boolean) => {
    if (disabled) return
    const order = lowToHigh ? FACTORS : [...FACTORS].reverse()
    for (const v of order) {
      const ev = evaluateMove(kind, v)
      if (ev.ok) {
        onCommit(kind, v)
        return
      }
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled) return
    const placed = factor !== null
    if (!placed) {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        commitFirstPlayableFromRest(true)
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        commitFirstPlayableFromRest(false)
        return
      }
      return
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      for (let next = factor - 1; next >= 1; next--) {
        const ev = evaluateMove(kind, next)
        if (ev.ok) {
          onCommit(kind, next)
          return
        }
      }
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      for (let next = factor + 1; next <= 9; next++) {
        const ev = evaluateMove(kind, next)
        if (ev.ok) {
          onCommit(kind, next)
          return
        }
      }
      return
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      applyKeyboardMove(factor)
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return
    const btn = e.currentTarget
    const br = btn.getBoundingClientRect()
    const arrowCenterX = br.left + br.width / 2
    grabRef.current = {
      pointerId: e.pointerId,
      pointerClientX: e.clientX,
      arrowCenterClientX: arrowCenterX,
    }
    activeDragButtonRef.current = btn
    startBlockingWheelDuringDrag()
    try {
      btn.setPointerCapture(e.pointerId)
    } catch {
      grabRef.current = null
      activeDragButtonRef.current = null
      stopBlockingWheelDuringDrag()
      setDragLeftPx(null)
      return
    }
    const outer = outerRef.current
    if (outer) {
      const ol = outer.getBoundingClientRect().left
      setDragLeftPx(arrowCenterX - ol)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = grabRef.current
    if (!g || e.pointerId !== g.pointerId) return
    const outer = outerRef.current
    if (!outer) return
    const arrowCenterX =
      g.arrowCenterClientX + (e.clientX - g.pointerClientX)
    const ol = outer.getBoundingClientRect().left
    setDragLeftPx(arrowCenterX - ol)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    tryFinalizePointerDrag(e)
  }

  /**
   * If capture is dropped before `pointerup` reaches this node (browser / compositor timing),
   * `lostpointercapture` still runs on the capture target — finalize there so we never “lose”
   * the gesture with a silent snapback.
   */
  const onLostPointerCapture = (e: ReactPointerEvent<HTMLButtonElement>) => {
    tryFinalizePointerDrag(e)
  }

  const onPointerCancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const g = grabRef.current
    if (!g || e.pointerId !== g.pointerId) return
    grabRef.current = null
    activeDragButtonRef.current = null
    setDragLeftPx(null)
    cancelPrimedRef.current = false
    scrollSignedAccumRef.current = 0
    onScrollPrimeHint?.(null)
    stopBlockingWheelDuringDrag()
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    /* Not a deliberate pointerup — don’t use scroll-release cancel copy. */
    onSnapbackNote(SNAPBACK_NOTE_POINTER_CANCEL)
  }

  const leftPx = dragLeftPx ?? restingCenterPx

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="relative h-full w-full">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-yellow-400/25 [margin-left:var(--gutter)]" />

        <button
          type="button"
          aria-labelledby={ariaLabelledBy}
          aria-disabled={disabled}
          disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          className={`pointer-events-auto absolute z-10 flex -translate-x-1/2 cursor-grab touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 active:cursor-grabbing ${direction === 'down' ? 'bottom-0' : 'top-0'}`}
          style={{ left: leftPx }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onLostPointerCapture}
          onKeyDown={onKeyDown}
        >
          <span className="sr-only">
            {kind === 'upper' ? 'Upper' : 'Lower'} selector
            {factor !== null ? `, factor ${factor}` : ', not placed'}
          </span>
          <svg
            width="38"
            height="24"
            viewBox="0 0 44 28"
            aria-hidden
            className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]"
          >
            {direction === 'down' ? (
              <polygon
                points="4,4 40,4 22,26"
                fill="#f5e63a"
                stroke="#a89820"
                strokeWidth="2"
              />
            ) : (
              <polygon
                points="22,2 4,24 40,24"
                fill="#f5e63a"
                stroke="#a89820"
                strokeWidth="2"
              />
            )}
          </svg>
        </button>
      </div>
    </div>
  )
}
