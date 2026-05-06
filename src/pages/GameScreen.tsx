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
import { autoPlaceCpuFleet, pickComputerMove } from '../game/computerPlayer'
import {
  advanceBattleshipHandoff,
  applyMove,
  battleshipSalvoTargets,
  commitBattleshipShipPlacement,
  createMatch,
  flipPlayer,
  isFactorPlayable,
  NOTE_BATTLESHIP_AMBIGUOUS,
  NOTE_DEADLOCK_RESET,
  NOTE_FACTOR_DEAD_LOWER,
  NOTE_FACTOR_DEAD_UPPER,
  tryApplyMove,
} from '../game/engine'
import { slotsForFactorTreeActiveQuadrant } from '../game/factorPreview'
import { fullOceanSlots } from '../game/gridSpec'
import { defaultFleetLengths } from '../game/presets'
import {
  parseStoredGameSettings,
  SESSION_SETTINGS_KEY,
  type MenuGameSettings,
} from '../game/session'
import { recordMatchResult, recordQuit } from '../game/stats'
import type { MatchState, PlayerId, SelectorKind } from '../game/types'

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
  if (note === NOTE_BATTLESHIP_AMBIGUOUS)
    return 'Multiple squares match — tap the right one on the big chart.'
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
      <div className="mc-wood-bg flex min-h-screen items-center justify-center text-[var(--color-cc-yellow)]">
        Loading…
      </div>
    )
  }

  return (
    <GameSession
      key={`${rematchToken}-${settings.rules}-${settings.mode}-q${settings.quadrantCount}-${settings.opponent}-${settings.shuffleSeed ?? 'x'}-${(settings.fleetLengths ?? []).join(',')}`}
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
  const [match, setMatch] = useState<MatchState>(() =>
    createMatch({
      rules: settings.rules,
      quadrantCount: settings.quadrantCount,
      mode: settings.mode,
      shuffleSeed: settings.shuffleSeed,
      fleetLengths:
        settings.rules === 'battleship'
          ? settings.fleetLengths ?? defaultFleetLengths(settings.quadrantCount)
          : undefined,
    }),
  )

  const [placementSel, setPlacementSel] = useState<number[]>([])
  const cpuP2Placed = useRef(false)
  const outcomeRecorded = useRef(false)

  const colors = [settings.playerOneColor, settings.playerTwoColor] as const
  const names = [settings.playerOneName, settings.playerTwoName]

  const isCpuOpponent = settings.opponent === 'computer'
  const bs = match.battleship

  const battlePhase =
    settings.rules !== 'battleship' ||
    (bs !== null && bs.placement === 'battle')

  const placing =
    settings.rules === 'battleship' &&
    bs !== null &&
    (bs.placement === 'p1_place' || bs.placement === 'p2_place')

  const placementPlayer: PlayerId | null =
    placing && bs
      ? bs.placement === 'p1_place'
        ? 0
        : 1
      : null

  const currentShipLen =
    placing && bs
      ? bs.fleetLengths[bs.placingShipIndex]
      : undefined

  const hideBattleGrid =
    settings.rules === 'battleship' &&
    bs !== null &&
    (bs.placement === 'handoff_to_p2' || bs.placement === 'handoff_to_battle')

  const battleDefenderId: PlayerId | null =
    settings.rules === 'battleship' &&
    bs !== null &&
    bs.placement === 'battle'
      ? flipPlayer(match.currentPlayer)
      : null

  const battleShooterId: PlayerId | null =
    bs?.placement === 'battle' ? match.currentPlayer : null

  const cpuDefenseMain =
    settings.rules === 'battleship' &&
    battlePhase &&
    isCpuOpponent &&
    match.currentPlayer === 1

  const placementPeer: PlayerId | null =
    placing && placementPlayer !== null ? flipPlayer(placementPlayer) : null

  const primaryChart =
    settings.rules === 'battleship' && match.battleProducts && bs
      ? bs.placement === 'battle' && battleDefenderId !== null
        ? match.battleProducts[battleDefenderId]
        : placing && placementPlayer !== null
          ? match.battleProducts[placementPlayer]
          : match.productsBySlot
      : match.productsBySlot

  const primaryBattleshipDefender: PlayerId | null =
    bs?.placement === 'battle' && battleDefenderId !== null
      ? battleDefenderId
      : placing && placementPlayer !== null
        ? placementPlayer
        : null

  const leftMiniBattle =
    battlePhase &&
    match.battleProducts &&
    battleShooterId !== null &&
    !cpuDefenseMain
      ? {
          chart: match.battleProducts[battleShooterId],
          defender: battleShooterId,
        }
      : null

  const rightMiniBattle =
    battlePhase &&
    match.battleProducts &&
    cpuDefenseMain &&
    battleShooterId !== null
      ? {
          chart: match.battleProducts[battleShooterId],
          defender: battleShooterId,
        }
      : null

  const rightMiniPlacement =
    placing &&
    placementPeer !== null &&
    match.battleProducts
      ? {
          chart: match.battleProducts[placementPeer],
        }
      : null

  const quadrantTabs =
    settings.quadrantCount === 1 ? 1 : settings.quadrantCount === 2 ? 2 : 4

  useEffect(() => {
    outcomeRecorded.current = false
  }, [settings])

  useEffect(() => {
    if (match.phase !== 'won' || outcomeRecorded.current) return
    outcomeRecorded.current = true
    const w = match.winner!
    const loser = flipPlayer(w)
    recordMatchResult(settings, names[w], names[loser])
  }, [match.phase, match.winner, settings])

  useEffect(() => {
    if (!isCpuOpponent || bs?.placement !== 'p2_place') {
      cpuP2Placed.current = false
      return
    }
    if (cpuP2Placed.current) return
    cpuP2Placed.current = true
    setMatch((m) => autoPlaceCpuFleet(m, 1))
  }, [isCpuOpponent, bs?.placement])

  useEffect(() => {
    if (!isCpuOpponent || bs?.placement !== 'handoff_to_p2') return
    const id = window.setTimeout(() => {
      setMatch((m) => advanceBattleshipHandoff(m))
    }, 560)
    return () => clearTimeout(id)
  }, [isCpuOpponent, bs?.placement])

  useEffect(() => {
    if (!battlePhase || match.phase !== 'playing') return
    if (!isCpuOpponent || match.currentPlayer !== 1) return
    const id = window.setTimeout(() => {
      setMatch((m) => {
        if (m.phase !== 'playing' || m.currentPlayer !== 1) return m
        const mv = pickComputerMove(m, settings.aiDifficulty)
        return mv ? applyMove(m, mv) : m
      })
    }, 440)
    return () => clearTimeout(id)
  }, [
    battlePhase,
    match.phase,
    match.currentPlayer,
    isCpuOpponent,
    settings.aiDifficulty,
  ])

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

  const previewProducts =
    settings.rules === 'battleship' &&
    battlePhase &&
    bs &&
    match.battleProducts
      ? match.battleProducts[flipPlayer(match.currentPlayer)]
      : match.productsBySlot

  const salvoTargets = useMemo(() => battleshipSalvoTargets(match), [match])

  const factorHighlightSlots = useMemo(() => {
    if (previewFactor === null || !battlePhase) return null
    return slotsForFactorTreeActiveQuadrant(
      previewProducts,
      previewFactor,
      match.activeQuadrant,
      match.quadrantCount,
      match.cols,
    )
  }, [
    previewFactor,
    battlePhase,
    previewProducts,
    match.activeQuadrant,
    match.quadrantCount,
    match.cols,
  ])

  const primaryHighlightSlots = useMemo(() => {
    const set = new Set<number>()
    factorHighlightSlots?.forEach((s) => set.add(s))
    salvoTargets?.forEach((s) => set.add(s))
    return set.size ? set : null
  }, [factorHighlightSlots, salvoTargets])

  const onPrimaryBoardSlot = useCallback(
    (slot: number) => {
      if (salvoTargets?.includes(slot)) {
        setMatch((m) => applyMove(m, { kind: 'salvo', targetSlot: slot }))
        clearPreview()
        return
      }
      if (battlePhase && match.phase === 'playing') clearPreview()
    },
    [salvoTargets, battlePhase, match.phase, clearPreview],
  )

  const onCommit = useCallback(
    (kind: SelectorKind, value: number) => {
      clearPreview()
      setMatch((m) => applyMove(m, { kind, value }))
    },
    [clearPreview],
  )

  const onFactorClick = useCallback((f: number) => {
    setPreviewFactor((prev) => (prev === f ? null : f))
  }, [])

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
    if (
      !stage ||
      !rail ||
      !playing ||
      !battlePhase ||
      hideBattleGrid
    ) {
      setDigitRowOffsetPx(0)
      return
    }

    const s2 = stage.querySelector('[data-primary-board] [data-slot="2"]')
    const s3 = stage.querySelector('[data-primary-board] [data-slot="3"]')
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
    const correction = targetRel - f5cx
    setDigitRowOffsetPx((prev) => {
      const next = Math.round(prev + correction)
      return Math.abs(next - prev) <= 1 ? prev : next
    })
  }, [
    playing,
    battlePhase,
    hideBattleGrid,
    previewProducts,
    match.upperFactor,
    match.lowerFactor,
    alignRemeasureGen,
    digitRowOffsetPx,
  ])

  const activeTurnPlayerIndex = match.currentPlayer
  const shipOrdinal =
    bs && (bs.placement === 'p1_place' || bs.placement === 'p2_place')
      ? bs.placingShipIndex + 1
      : null
  const shipTotal =
    bs && (bs.placement === 'p1_place' || bs.placement === 'p2_place')
      ? bs.fleetLengths.length
      : null

  const turnLabel =
    placing && placementPlayer !== null && currentShipLen !== undefined
      ? `${names[placementPlayer].toUpperCase()} — ship ${shipOrdinal}/${shipTotal} (${currentShipLen} cells in one row or column)`
      : playing && battlePhase
        ? `${names[activeTurnPlayerIndex].toUpperCase()}'S TURN`
        : match.phase === 'won'
          ? `${names[match.winner!]} WINS`
          : 'DRAW'

  useEffect(() => {
    if (!playing || !battlePhase) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearPreview()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, battlePhase, clearPreview])

  useEffect(() => {
    if (!playing || !battlePhase) setScrollPrimeHint(null)
  }, [playing, battlePhase])

  const gameplayStatusMain =
    battlePhase && playing && match.lastMoveNote
      ? displaySnapbackReason(match.lastMoveNote)
      : null

  const factorPlayableCb = useCallback(
    (n: number) => isFactorPlayable(match, n),
    [match],
  )

  const quitToMenu = () => {
    if (match.phase === 'playing') recordQuit(settings)
    onMenu()
  }

  const togglePlacementSlot = (slot: number) => {
    if (placementPlayer === null || currentShipLen === undefined) return
    const ocean = fullOceanSlots(match.cols, match.rows)
    if (!ocean.has(slot)) return
    setPlacementSel((prev) => {
      if (prev.includes(slot)) return prev.filter((s) => s !== slot)
      const next = [...prev, slot].sort((a, b) => a - b)
      if (next.length <= currentShipLen) return next
      return [...prev.slice(1), slot].sort((a, b) => a - b)
    })
  }

  const commitPlacement = () => {
    if (placementPlayer === null) return
    const r = commitBattleshipShipPlacement(match, placementPlayer, placementSel)
    if (r.ok) {
      setMatch(r.next)
      setPlacementSel([])
    } else {
      setMatch((m) => ({ ...m, lastMoveNote: r.reason }))
    }
  }

  const railDisabled =
    !battlePhase ||
    match.phase !== 'playing' ||
    (isCpuOpponent && match.currentPlayer === 1)

  const placementInteractive =
    placing &&
    placementPlayer !== null &&
    !(isCpuOpponent && placementPlayer === 1)

  const maxStageClass =
    settings.quadrantCount === 4
      ? 'max-w-[min(96vw,680px)]'
      : settings.quadrantCount === 2
        ? 'max-w-[min(94vw,520px)]'
        : 'max-w-[min(90vw,380px)]'

  return (
    <div className="mc-wood-bg flex min-h-screen flex-col">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 pt-3 sm:px-6 sm:pt-4">
        <span className="min-w-0" aria-hidden />
        <h1 className="mc-title justify-self-center text-center text-lg sm:text-2xl">
          CALCULATOR COVE
        </h1>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={quitToMenu}
            className="rounded-lg bg-[var(--color-cc-coral)] px-3 py-1.5 text-xs font-bold text-[var(--color-cc-yellow)] shadow-md hover:bg-[var(--color-cc-coral-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cc-yellow)] sm:px-4 sm:py-2 sm:text-sm"
          >
            QUIT
          </button>
        </div>
      </header>

      {bs &&
        bs.placement === 'handoff_to_p2' &&
        !isCpuOpponent && (
          <HandoffShield
            title="Pass the device"
            body={`${names[1]} — deploy your fleet secretly. ${names[0]} must not peek.`}
            onContinue={() =>
              setMatch((m) => advanceBattleshipHandoff(m))
            }
          />
        )}

      {bs && bs.placement === 'handoff_to_battle' && (
        <HandoffShield
          title="Battle stations"
          body={
            bs.pendingFirstShooter !== null
              ? `${names[bs.pendingFirstShooter]} shoots first (random draw). Hand the device back before firing.`
              : 'Both fleets are anchored — continue when ready.'
          }
          onContinue={() => setMatch((m) => advanceBattleshipHandoff(m))}
        />
      )}

      <div className="mt-2 flex flex-col items-center gap-1">
        <p className="mc-turn text-center text-sm sm:text-base">{turnLabel}</p>
        {playing && battlePhase && (
          <span
            className="h-3 w-3 shrink-0 rounded-sm border border-white/35 shadow-inner sm:h-3.5 sm:w-3.5"
            style={{ backgroundColor: colors[activeTurnPlayerIndex] }}
            aria-hidden
            title={`Current turn color (${names[activeTurnPlayerIndex]})`}
          />
        )}
      </div>

      {battlePhase && playing && quadrantTabs > 1 && (
        <div className="mx-auto mt-2 flex flex-wrap justify-center gap-2 px-3">
          <span className="text-xs text-yellow-100/70">Active quadrant</span>
          {Array.from({ length: quadrantTabs }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`rounded-md border px-2 py-1 text-xs font-semibold transition sm:text-sm ${
                match.activeQuadrant === i
                  ? 'border-[var(--color-cc-yellow)] bg-yellow-400/15 text-[var(--color-cc-yellow)]'
                  : 'border-white/20 bg-black/25 text-yellow-100/75 hover:bg-black/35'
              }`}
              onClick={() =>
                setMatch((m) => ({
                  ...m,
                  activeQuadrant: i,
                  lastMoveNote: null,
                }))
              }
            >
              Q{i + 1}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto mt-1 flex min-h-6 flex-wrap items-center justify-center gap-2 px-3">
        {previewFactor !== null && battlePhase && playing && (
          <>
            <span className="text-xs text-yellow-100/85 sm:text-sm">
              Showing multiples of {previewFactor} (active quadrant)
            </span>
            <button
              type="button"
              onClick={clearPreview}
              className="rounded-lg border border-yellow-400/50 bg-black/25 px-3 py-1 text-xs font-semibold text-[var(--color-cc-yellow)] hover:bg-black/40"
            >
              Stop showing
            </button>
          </>
        )}
      </div>

      {placing && (
        <div className="mx-auto mt-2 flex max-w-lg flex-col items-center gap-2 px-4 text-center text-xs text-yellow-100/85 sm:text-sm">
          <p>
            Tap exactly {currentShipLen ?? '…'} cells in your ocean in a straight row or column,
            then confirm.
          </p>
          {placementInteractive && (
            <button
              type="button"
              onClick={commitPlacement}
              disabled={
                currentShipLen === undefined ||
                placementSel.length !== currentShipLen
              }
              className="rounded-lg bg-[var(--color-cc-coral)] px-4 py-2 text-sm font-bold text-[var(--color-cc-yellow)] shadow-md disabled:cursor-not-allowed disabled:opacity-45 hover:bg-[var(--color-cc-coral-deep)]"
            >
              Confirm ship placement
            </button>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-start px-3 pb-3 pt-1 sm:px-4">
        <div
          ref={stageRef}
          className={`flex w-full flex-col gap-2 ${maxStageClass}`}
        >
          <div className="flex min-h-[3.875rem] w-full flex-col justify-center gap-0.5 px-1">
            <p
              className={`line-clamp-2 px-1 text-center text-xs leading-snug sm:text-sm ${
                gameplayStatusMain ? 'text-amber-200/95' : 'text-transparent'
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

          {!hideBattleGrid &&
            (settings.rules === 'battleship' ? (
              <div className="flex w-full flex-row items-start justify-center gap-1.5 sm:gap-3">
                <aside
                  className={[
                    'min-h-0 shrink-0 transition-[width,opacity,padding] duration-200 ease-out',
                    leftMiniBattle
                      ? 'w-[72px] overflow-visible pt-0 opacity-100 sm:w-[96px]'
                      : 'pointer-events-none w-0 overflow-hidden p-0 opacity-0',
                  ].join(' ')}
                  aria-hidden={!leftMiniBattle}
                >
                  {leftMiniBattle ? (
                    <div className="rounded-xl border border-white/15 bg-black/30 p-1 shadow-inner backdrop-blur-sm">
                      <p className="mb-1 text-center text-[0.55rem] font-bold uppercase leading-tight tracking-wide text-yellow-100/80">
                        {names[leftMiniBattle.defender]}
                        <span className="block font-semibold normal-case text-yellow-200/55">
                          Fleet
                        </span>
                      </p>
                      <BoardGrid
                        state={match}
                        playerColors={colors}
                        compact
                        interactive={false}
                        productsChart={leftMiniBattle.chart}
                        battleshipDefender={leftMiniBattle.defender}
                      />
                    </div>
                  ) : null}
                </aside>

                <div
                  data-primary-board
                  className="flex min-w-0 flex-1 flex-col gap-2"
                >
                  <BoardGrid
                    state={match}
                    playerColors={colors}
                    interactive={battlePhase || placing}
                    highlightSlots={primaryHighlightSlots}
                    placementSelection={placing ? placementSel : null}
                    placementPlayer={placementPlayer}
                    productsChart={primaryChart}
                    battleshipDefender={primaryBattleshipDefender}
                    onSlotPointerDown={
                      placing && placementInteractive
                        ? togglePlacementSlot
                        : battlePhase && playing
                          ? onPrimaryBoardSlot
                          : undefined
                    }
                  />
                </div>

                <aside
                  className={[
                    'min-h-0 shrink-0 transition-[width,opacity,padding] duration-200 ease-out',
                    rightMiniBattle || rightMiniPlacement
                      ? 'w-[72px] overflow-visible pt-0 opacity-100 sm:w-[96px]'
                      : 'pointer-events-none w-0 overflow-hidden p-0 opacity-0',
                  ].join(' ')}
                  aria-hidden={!(rightMiniBattle || rightMiniPlacement)}
                >
                  {rightMiniBattle ? (
                    <div className="rounded-xl border border-white/15 bg-black/30 p-1 shadow-inner backdrop-blur-sm">
                      <p className="mb-1 text-center text-[0.55rem] font-bold uppercase leading-tight tracking-wide text-yellow-100/80">
                        {names[rightMiniBattle.defender]}
                        <span className="block font-semibold normal-case text-yellow-200/55">
                          Chart
                        </span>
                      </p>
                      <BoardGrid
                        state={match}
                        playerColors={colors}
                        compact
                        interactive={false}
                        productsChart={rightMiniBattle.chart}
                        battleshipDefender={rightMiniBattle.defender}
                      />
                    </div>
                  ) : rightMiniPlacement ? (
                    <div className="rounded-xl border border-white/15 bg-black/30 p-1 shadow-inner backdrop-blur-sm">
                      <p className="mb-1 text-center text-[0.55rem] font-bold uppercase leading-tight tracking-wide text-yellow-100/80">
                        {names[placementPeer!]}
                        <span className="block font-semibold normal-case text-yellow-200/55">
                          Ocean
                        </span>
                      </p>
                      <BoardGrid
                        state={match}
                        playerColors={colors}
                        compact
                        interactive={false}
                        plainOcean
                        productsChart={rightMiniPlacement.chart}
                      />
                    </div>
                  ) : null}
                </aside>
              </div>
            ) : (
              <BoardGrid
                state={match}
                playerColors={colors}
                interactive={battlePhase || placing}
                highlightSlots={factorHighlightSlots}
                placementSelection={placing ? placementSel : null}
                placementPlayer={placementPlayer}
                onSlotPointerDown={
                  placing && placementInteractive
                    ? togglePlacementSlot
                    : battlePhase && playing
                      ? clearPreview
                      : undefined
                }
              />
            ))}
          <FactorRail
            ref={factorRailRef}
            upperFactor={match.upperFactor}
            lowerFactor={match.lowerFactor}
            disabled={railDisabled}
            evaluateMove={evaluateMove}
            onSnapbackNote={onSnapbackNote}
            onCommit={onCommit}
            onFactorClick={battlePhase && playing ? onFactorClick : undefined}
            digitRowOffsetPx={digitRowOffsetPx}
            onScrollPrimeHint={onScrollPrimeHint}
            isFactorPlayable={
              battlePhase && playing && !railDisabled ? factorPlayableCb : undefined
            }
          />
        </div>
      </div>

      {match.phase !== 'playing' ? (
        <EndOverlay
          title={
            match.phase === 'won'
              ? settings.rules === 'battleship'
                ? `${names[match.winner!]} wins — fleet sunk!`
                : `${names[match.winner!]} wins`
              : 'Draw'
          }
          hint={
            match.phase === 'draw'
              ? settings.rules === 'connect'
                ? 'Board filled — no four in a row.'
                : 'Stalemate reached.'
              : settings.rules === 'connect'
                ? 'Four in a row on the grid.'
                : 'All enemy ship tiles were hit.'
          }
          onMenu={quitToMenu}
          onRematch={onRematch}
        />
      ) : null}
    </div>
  )
}

function HandoffShield({
  title,
  body,
  onContinue,
}: {
  title: string
  body: string
  onContinue: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal
      aria-labelledby="handoff-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-900/95 p-6 text-center shadow-2xl">
        <h2 id="handoff-title" className="mc-title text-xl">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-yellow-100/82">{body}</p>
        <button
          type="button"
          className="mt-6 w-full rounded-xl bg-[var(--color-cc-coral)] py-3 font-bold text-[var(--color-cc-yellow)] hover:bg-[var(--color-cc-coral-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-cc-yellow)]"
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
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
            className="w-full rounded-xl bg-[var(--color-cc-coral)] py-3 font-bold text-[var(--color-cc-yellow)] hover:bg-[var(--color-cc-coral-deep)]"
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
