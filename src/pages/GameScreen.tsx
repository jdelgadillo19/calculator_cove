import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BoardGrid } from '../components/BoardGrid'
import {
  FactorRail,
  NOTE_SCROLL_CANCEL_RELEASE,
  type MoveEvaluation,
} from '../components/FactorRail'
import {
  applyMove,
  createMatch,
  isFactorPlayable,
  NOTE_DEADLOCK_RESET,
  NOTE_FACTOR_DEAD_LOWER,
  NOTE_FACTOR_DEAD_UPPER,
  tryApplyMove,
} from '../game/engine'
import { slotsForFactorTree } from '../game/factorPreview'
import {
  parseStoredGameSettings,
  SESSION_SETTINGS_KEY,
  type MenuGameSettings,
} from '../game/session'
import { shuffledProducts } from '../game/shuffleBoard'
import type { MatchState, SelectorKind } from '../game/types'

/** Engine copy for a claimed product — shown to players as simpler wording above the grid. */
const ENGINE_NOTE_ALREADY_CLAIMED = 'That product is already claimed.'

function displaySnapbackReason(note: string): string {
  if (note === ENGINE_NOTE_ALREADY_CLAIMED) return 'tile already claimed'
  if (note === NOTE_SCROLL_CANCEL_RELEASE)
    return 'Move canceled (scroll primed, then released).'
  if (note === NOTE_DEADLOCK_RESET)
    return 'Dead end — nothing left to claim from those factors. Arrows reset.'
  if (note === NOTE_FACTOR_DEAD_UPPER || note === NOTE_FACTOR_DEAD_LOWER)
    return 'That factor has no empty products left on the board.'
  return note
}

export function GameScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const settings =
    (location.state as MenuGameSettings | undefined) ??
    parseStoredGameSettings(sessionStorage.getItem(SESSION_SETTINGS_KEY))
  const [rematchToken, setRematchToken] = useState(0)

  useEffect(() => {
    if (!settings) navigate('/', { replace: true })
  }, [settings, navigate])

  if (!settings) {
    return (
      <div className="mc-wood-bg flex min-h-screen items-center justify-center text-[var(--color-mc-yellow)]">
        Loading…
      </div>
    )
  }

  return (
    <GameSession
      key={`${rematchToken}-${settings.mode}-${settings.shuffleSeed ?? 'random'}`}
      settings={settings}
      onMenu={() => navigate('/')}
      onRematch={() => setRematchToken((t) => t + 1)}
    />
  )
}

function GameSession({
  settings,
  onMenu,
  onRematch,
}: {
  settings: MenuGameSettings
  onMenu: () => void
  onRematch: () => void
}) {
  const productsBySlot = useMemo(() => {
    if (settings.mode === 'shuffled') {
      return shuffledProducts(settings.shuffleSeed)
    }
    return undefined
  }, [settings.mode, settings.shuffleSeed])

  const [match, setMatch] = useState<MatchState>(() =>
    createMatch({
      productsBySlot,
    }),
  )

  const evaluateMove = useCallback(
    (kind: SelectorKind, value: number): MoveEvaluation => {
      const r = tryApplyMove(match, { kind, value })
      return r.ok ? { ok: true } : { ok: false, reason: r.reason }
    },
    [match],
  )

  const onSnapbackNote = useCallback((note: string) => {
    setMatch((m) => ({ ...m, lastMoveNote: note }))
  }, [])

  const [previewFactor, setPreviewFactor] = useState<number | null>(null)

  const clearPreview = useCallback(() => setPreviewFactor(null), [])

  const highlightSlots = useMemo(() => {
    if (previewFactor === null) return null
    return slotsForFactorTree(match.productsBySlot, previewFactor)
  }, [previewFactor, match.productsBySlot])

  const onCommit = useCallback((kind: SelectorKind, value: number) => {
    clearPreview()
    setMatch((m) => applyMove(m, { kind, value }))
  }, [clearPreview])

  const onFactorClick = useCallback((f: number) => {
    setPreviewFactor((prev) => (prev === f ? null : f))
  }, [])

  const colors = [settings.playerOneColor, settings.playerTwoColor] as const
  const names = [settings.playerOneName, settings.playerTwoName]
  const playing = match.phase === 'playing'

  const stageRef = useRef<HTMLDivElement>(null)
  const factorRailRef = useRef<HTMLDivElement>(null)
  const [digitRowOffsetPx, setDigitRowOffsetPx] = useState(0)
  const [alignRemeasureGen, setAlignRemeasureGen] = useState(0)
  const [scrollPrimeHint, setScrollPrimeHint] = useState<string | null>(null)

  const onScrollPrimeHint = useCallback((hint: string | null) => {
    setScrollPrimeHint(hint)
  }, [])

  useEffect(() => {
    const onResize = () => setAlignRemeasureGen((g) => g + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const rail = factorRailRef.current
    if (!stage || !rail || !playing) {
      setDigitRowOffsetPx(0)
      return
    }

    const s2 = stage.querySelector('[data-slot="2"]')
    const s3 = stage.querySelector('[data-slot="3"]')
    const f5 = rail.querySelector('[data-factor="5"]')
    if (!(s2 instanceof HTMLElement) || !(s3 instanceof HTMLElement) || !(f5 instanceof HTMLElement)) {
      setDigitRowOffsetPx(0)
      return
    }

    const r2 = s2.getBoundingClientRect()
    const r3 = s3.getBoundingClientRect()
    const mid = (r2.right + r3.left) / 2
    const railLeft = rail.getBoundingClientRect().left
    const targetRel = mid - railLeft
    const f5r = f5.getBoundingClientRect()
    const f5cx = f5r.left + f5r.width / 2 - railLeft
    /** Measured center already includes current translate; adjust incrementally toward target. */
    const correction = targetRel - f5cx
    setDigitRowOffsetPx((prev) => {
      const next = Math.round(prev + correction)
      return Math.abs(next - prev) <= 1 ? prev : next
    })
  }, [
    playing,
    match.productsBySlot,
    match.upperFactor,
    match.lowerFactor,
    alignRemeasureGen,
    digitRowOffsetPx,
  ])

  /** Same index used for turn copy and board colors (0 = player one, 1 = player two). */
  const activeTurnPlayerIndex = match.currentPlayer
  const turnLabel = playing
    ? `${names[activeTurnPlayerIndex].toUpperCase()}'S TURN`
    : match.phase === 'won'
      ? `${names[match.winner!]} WINS`
      : 'DRAW'

  useEffect(() => {
    if (!playing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearPreview()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, clearPreview])

  useEffect(() => {
    if (!playing) setScrollPrimeHint(null)
  }, [playing])

  const gameplayStatusMain =
    playing && match.lastMoveNote
      ? displaySnapbackReason(match.lastMoveNote)
      : null

  const factorPlayableCb = useCallback(
    (n: number) => isFactorPlayable(match, n),
    [match],
  )

  return (
    <div className="mc-wood-bg flex min-h-screen flex-col">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-3 sm:px-6 sm:pt-4">
        <span className="min-w-0" aria-hidden />
        <h1 className="mc-title justify-self-center text-center text-lg sm:text-2xl">
          MULTIPLICATION GAME
        </h1>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onMenu}
            className="rounded-lg bg-[var(--color-mc-purple)] px-3 py-1.5 text-xs font-bold text-[var(--color-mc-yellow)] shadow-md hover:bg-[var(--color-mc-purple-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-mc-yellow)] sm:px-4 sm:py-2 sm:text-sm"
          >
            QUIT
          </button>
        </div>
      </header>

      <div className="mt-2 flex flex-col items-center gap-1">
        <p className="mc-turn text-center text-sm sm:text-base">{turnLabel}</p>
        {playing && (
          <span
            className="h-3 w-3 shrink-0 rounded-sm border border-white/35 shadow-inner sm:h-3.5 sm:w-3.5"
            style={{ backgroundColor: colors[activeTurnPlayerIndex] }}
            aria-hidden
            title={`Current turn color (${names[activeTurnPlayerIndex]})`}
          />
        )}
      </div>

      <div className="mx-auto mt-1 flex min-h-6 flex-wrap items-center justify-center gap-2 px-3">
        {previewFactor !== null && playing && (
          <>
            <span className="text-xs text-yellow-100/85 sm:text-sm">
              Showing multiples of {previewFactor}
            </span>
            <button
              type="button"
              onClick={clearPreview}
              className="rounded-lg border border-yellow-400/50 bg-black/25 px-3 py-1 text-xs font-semibold text-[var(--color-mc-yellow)] hover:bg-black/40"
            >
              Stop showing
            </button>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-start px-3 pb-3 pt-1 sm:px-4">
        <div
          ref={stageRef}
          className="flex w-full max-w-[min(90vw,380px)] flex-col gap-2"
        >
          <div className="flex min-h-[3.875rem] w-full flex-col justify-center gap-0.5 px-1">
            <p
              className={`line-clamp-2 px-1 text-center text-xs leading-snug sm:text-sm ${
                gameplayStatusMain
                  ? 'text-amber-200/95'
                  : 'text-transparent'
              }`}
              role="status"
              aria-live="polite"
            >
              {gameplayStatusMain ?? '\u00a0'}
            </p>
            <p
              className={`min-h-[1rem] line-clamp-2 px-1 text-center text-[0.65rem] leading-tight sm:text-xs ${
                scrollPrimeHint ? 'text-amber-300/55' : 'text-transparent'
              }`}
              aria-live="polite"
            >
              {scrollPrimeHint ?? '\u00a0'}
            </p>
          </div>

          <BoardGrid
            state={match}
            playerColors={colors}
            interactive={playing}
            highlightSlots={highlightSlots}
            onSlotPointerDown={playing ? clearPreview : undefined}
          />
          <FactorRail
            ref={factorRailRef}
            upperFactor={match.upperFactor}
            lowerFactor={match.lowerFactor}
            disabled={!playing}
            evaluateMove={evaluateMove}
            onSnapbackNote={onSnapbackNote}
            onCommit={onCommit}
            onFactorClick={onFactorClick}
            digitRowOffsetPx={digitRowOffsetPx}
            onScrollPrimeHint={onScrollPrimeHint}
            isFactorPlayable={playing ? factorPlayableCb : undefined}
          />
        </div>
      </div>

      {!playing && (
        <EndOverlay
          title={match.phase === 'won' ? `${names[match.winner!]} wins` : 'Draw'}
          hint={
            match.phase === 'draw'
              ? 'Board filled — no four in a row.'
              : 'Four in a row on the grid.'
          }
          onMenu={onMenu}
          onRematch={onRematch}
        />
      )}
    </div>
  )
}

function EndOverlay({
  title,
  hint,
  onMenu,
  onRematch,
}: {
  title: string
  hint: string
  onMenu: () => void
  onRematch: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal
      aria-labelledby="end-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-900/95 p-6 text-center shadow-2xl">
        <h2 id="end-title" className="mc-title text-2xl">
          {title}
        </h2>
        <p className="mt-2 text-sm text-yellow-100/75">{hint}</p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={onRematch}
            className="w-full rounded-xl bg-[var(--color-mc-purple)] py-3 font-bold text-[var(--color-mc-yellow)] hover:bg-[var(--color-mc-purple-deep)]"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="w-full rounded-xl border border-white/20 py-3 font-semibold text-yellow-100 hover:bg-white/5"
          >
            Main menu
          </button>
        </div>
      </div>
    </div>
  )
}
