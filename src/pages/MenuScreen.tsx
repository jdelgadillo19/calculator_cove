import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DEFAULT_SETTINGS,
  SESSION_SETTINGS_KEY,
  type MenuGameSettings,
} from '../game/session'
import { AccountToolbar } from '../components/AccountToolbar'
import { useAuth } from '../lib/AuthContext'

type MenuLocationState = {
  paywallBlocked?: NonNullable<MenuGameSettings['premiumFeature']>
}

/** One-click presets for player tile colors (distinct on the wood UI). */
const PLAYER_TILE_COLOR_PRESETS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#84cc16',
  '#06b6d4',
  '#78716c',
] as const

export function MenuScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasGuacEntitlement } = useAuth()
  const [gateNotice, setGateNotice] = useState<string | null>(null)
  const [mode, setMode] = useState(DEFAULT_SETTINGS.mode)
  const [shuffleSeed, setShuffleSeed] = useState('')
  const [p1Name, setP1Name] = useState(DEFAULT_SETTINGS.playerOneName)
  const [p2Name, setP2Name] = useState(DEFAULT_SETTINGS.playerTwoName)
  const [p1Color, setP1Color] = useState(DEFAULT_SETTINGS.playerOneColor)
  const [p2Color, setP2Color] = useState(DEFAULT_SETTINGS.playerTwoColor)

  useEffect(() => {
    const st = location.state as MenuLocationState | null
    if (!st?.paywallBlocked) return
    setGateNotice(
      'That preview needs Guac tier — sign in with Google using a Gojito Games account that includes Gojito’s Guacamole Gang.',
    )
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.pathname, location.state, navigate])

  const buildBaseSettings = (): Omit<MenuGameSettings, 'premiumFeature'> => {
    const seedNum =
      shuffleSeed.trim() === '' ? undefined : Number.parseInt(shuffleSeed, 10)
    return {
      mode,
      shuffleSeed:
        mode === 'shuffled' && seedNum !== undefined && !Number.isNaN(seedNum)
          ? seedNum
          : mode === 'shuffled'
            ? undefined
            : undefined,
      playerOneName: p1Name.trim() || 'Player 1',
      playerTwoName: p2Name.trim() || 'Player 2',
      playerOneColor: p1Color,
      playerTwoColor: p2Color,
    }
  }

  const startPremium = (premiumFeature: NonNullable<MenuGameSettings['premiumFeature']>) => {
    if (!hasGuacEntitlement) {
      setGateNotice(
        'Recommended: sign in with Google using an account on Gojito’s Guacamole Gang (Guac tier), then use Account → Refresh Guac access.',
      )
      return
    }
    const settings: MenuGameSettings = {
      ...buildBaseSettings(),
      premiumFeature,
    }
    try {
      sessionStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore quota / private mode */
    }
    navigate('/play', { state: settings })
  }

  const startGame = () => {
    const settings: MenuGameSettings = {
      ...buildBaseSettings(),
      premiumFeature: null,
    }
    try {
      sessionStorage.setItem(SESSION_SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore quota / private mode */
    }
    navigate('/play', { state: settings })
  }

  return (
    <div className="mc-wood-bg flex min-h-screen flex-col text-neutral-100">
      <header className="flex flex-col items-center px-4 pb-3 pt-5 text-center sm:px-8">
        <div className="mb-3 w-full max-w-lg">
          <AccountToolbar isGameBreakingState={false} />
        </div>
        {gateNotice && (
          <div
            role="status"
            className="mx-auto mb-3 flex max-w-lg flex-wrap items-center justify-center gap-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-50"
          >
            <span className="text-left">{gateNotice}</span>
            <button
              type="button"
              onClick={() => setGateNotice(null)}
              className="shrink-0 rounded-md border border-amber-300/40 px-2 py-1 font-semibold text-amber-100 hover:bg-amber-400/10"
            >
              Dismiss
            </button>
          </div>
        )}
        <h1 className="mc-title text-2xl sm:text-4xl">MULTIPLICATION GAME</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-yellow-100/75">
          Connect four claimed cells in a row on the grid. Each turn, move one yellow arrow to
          pick a factor; the product marks your tile.
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 pb-8 sm:px-8">
        <section className="mx-auto w-full max-w-lg rounded-xl border border-white/10 bg-black/25 p-5 text-center shadow-xl backdrop-blur-sm sm:p-6">
          <h2 className="mb-3 text-lg font-semibold text-[var(--color-mc-yellow)]">
            Game mode
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ModeCard
              title="Classic board"
              description="Products in ascending order (reference layout)."
              selected={mode === 'classic'}
              onSelect={() => setMode('classic')}
            />
            <ModeCard
              title="Shuffled"
              description="Same 36 products in random positions."
              selected={mode === 'shuffled'}
              onSelect={() => setMode('shuffled')}
            />
          </div>

          {mode === 'shuffled' && (
            <label className="mx-auto mt-4 block max-w-md text-center text-sm text-yellow-100/80">
              Optional seed (leave blank for random):
              <input
                type="number"
                value={shuffleSeed}
                onChange={(e) => setShuffleSeed(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-[var(--color-mc-yellow)]"
                placeholder="e.g. 42"
              />
            </label>
          )}

          <h2 className="mb-3 mt-7 text-lg font-semibold text-[var(--color-mc-yellow)]">
            Players
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <PlayerFields
              label="Player 1"
              name={p1Name}
              color={p1Color}
              onNameChange={setP1Name}
              onColorChange={setP1Color}
            />
            <PlayerFields
              label="Player 2"
              name={p2Name}
              color={p2Color}
              onNameChange={setP2Name}
              onColorChange={setP2Color}
            />
          </div>

          <button
            type="button"
            onClick={startGame}
            className="mt-7 w-full rounded-xl bg-[var(--color-mc-purple)] py-3 text-lg font-bold text-[var(--color-mc-yellow)] shadow-lg transition hover:bg-[var(--color-mc-purple-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-mc-yellow)]"
          >
            Play (recommended)
          </button>

          <h2 className="mb-3 mt-10 text-lg font-semibold text-[var(--color-mc-yellow)]">
            Guac previews
          </h2>
          <p className="mx-auto mb-4 max-w-md text-xs text-yellow-100/65">
            Battleship rules and expanded boards are{' '}
            <strong>Gojito’s Guacamole Gang</strong> (Guac tier) previews — gameplay is stubbed while we
            harden billing and entitlements.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <PremiumFeatureCard
              title="Battleship mode"
              description="Alternate ruleset — placeholder screen for now."
              locked={!hasGuacEntitlement}
              onSelect={() => startPremium('battleship')}
            />
            <PremiumFeatureCard
              title="12 × 6 board"
              description="Wide grid preview — placeholder screen for now."
              locked={!hasGuacEntitlement}
              onSelect={() => startPremium('board_12x6')}
            />
            <PremiumFeatureCard
              title="12 × 12 board"
              description="Large grid preview — placeholder screen for now."
              locked={!hasGuacEntitlement}
              onSelect={() => startPremium('board_12x12')}
            />
          </div>
        </section>
      </main>
    </div>
  )
}

function PremiumFeatureCard({
  title,
  description,
  locked,
  onSelect,
}: {
  title: string
  description: string
  locked: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full rounded-lg border-2 p-4 text-left transition sm:max-w-[220px] sm:flex-1',
        locked
          ? 'border-white/10 bg-black/15 hover:border-white/20'
          : 'border-[var(--color-mc-yellow)] bg-yellow-400/10 hover:border-[var(--color-mc-yellow)]',
      ].join(' ')}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--color-mc-yellow)]">{title}</div>
          <p className="mt-1 text-xs text-yellow-100/70">{description}</p>
        </div>
        <span
          className={[
            'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            locked ? 'border-white/25 text-yellow-100/75' : 'border-[var(--color-mc-yellow)] text-[var(--color-mc-yellow)]',
          ].join(' ')}
        >
          {locked ? 'Guac' : 'Open'}
        </span>
      </div>
    </button>
  )
}

function ModeCard({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex-1 rounded-lg border-2 p-4 text-center transition',
        selected
          ? 'border-[var(--color-mc-yellow)] bg-yellow-400/10'
          : 'border-white/15 bg-black/20 hover:border-white/30',
      ].join(' ')}
    >
      <div className="font-semibold text-[var(--color-mc-yellow)]">{title}</div>
      <p className="mt-1 text-xs text-yellow-100/70">{description}</p>
    </button>
  )
}

function PlayerFields({
  label,
  name,
  color,
  onNameChange,
  onColorChange,
}: {
  label: string
  name: string
  color: string
  onNameChange: (v: string) => void
  onColorChange: (v: string) => void
}) {
  const [panel, setPanel] = useState<'closed' | 'palette' | 'custom'>('closed')
  const wrapRef = useRef<HTMLDivElement>(null)
  const paletteId = useId()

  useEffect(() => {
    if (panel !== 'palette') return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPanel('closed')
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [panel])

  useEffect(() => {
    if (panel === 'closed') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel('closed')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [panel])

  const normalized = color.toLowerCase()

  return (
    <div ref={wrapRef} className="relative rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-center text-sm font-medium text-yellow-100/90">{label}</div>
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-center text-sm text-white outline-none focus:border-[var(--color-mc-yellow)]"
      />
      <button
        type="button"
        aria-expanded={panel !== 'closed'}
        aria-controls={panel === 'palette' ? paletteId : undefined}
        aria-haspopup="dialog"
        onClick={() =>
          setPanel((p) => (p === 'palette' ? 'closed' : 'palette'))
        }
        className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-yellow-100/70 outline-none transition hover:border-white/25 hover:bg-black/40 focus-visible:border-[var(--color-mc-yellow)] focus-visible:ring-1 focus-visible:ring-[var(--color-mc-yellow)]"
      >
        Tile color
        <span
          className="h-8 w-12 shrink-0 rounded border border-white/25 shadow-inner"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      </button>

      {panel === 'palette' && (
        <div
          id={paletteId}
          role="dialog"
          aria-label="Choose tile color"
          className="absolute left-1/2 top-full z-20 mt-1 w-[min(100%,220px)] -translate-x-1/2 rounded-lg border border-white/15 bg-neutral-950/98 p-2 shadow-xl backdrop-blur-sm"
        >
          <div className="grid grid-cols-4 gap-2">
            {PLAYER_TILE_COLOR_PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                aria-label={`Use color ${hex}`}
                aria-current={normalized === hex ? 'true' : undefined}
                className={[
                  'h-9 w-full rounded-md border-2 shadow-inner transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-mc-yellow)]',
                  normalized === hex
                    ? 'border-[var(--color-mc-yellow)] ring-1 ring-[var(--color-mc-yellow)]'
                    : 'border-white/25',
                ].join(' ')}
                style={{ backgroundColor: hex }}
                onClick={() => {
                  onColorChange(hex)
                  setPanel('closed')
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="mt-2 w-full rounded-md border border-white/20 bg-black/40 py-2 text-center text-xs font-semibold text-yellow-100/90 transition hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-mc-yellow)]"
            onClick={() => setPanel('custom')}
          >
            Customize…
          </button>
        </div>
      )}

      {panel === 'custom' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPanel('closed')
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Custom tile color"
            className="w-full max-w-xs rounded-xl border border-white/15 bg-neutral-900 p-4 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-sm font-medium text-[var(--color-mc-yellow)]">
              Custom color
            </p>
            <label className="flex flex-col gap-2 text-xs text-yellow-100/70">
              <span className="sr-only">Color picker</span>
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                className="mx-auto h-36 w-full max-w-[12rem] cursor-pointer rounded-lg border border-white/20 bg-transparent [&::-webkit-color-swatch-wrapper]:p-1 [&::-webkit-color-swatch]:rounded-md"
              />
            </label>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-[var(--color-mc-purple)] py-2 text-sm font-bold text-[var(--color-mc-yellow)] hover:bg-[var(--color-mc-purple-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-mc-yellow)]"
              onClick={() => setPanel('closed')}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
