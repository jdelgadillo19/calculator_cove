import type { MenuGameSettings } from '../game/session'
import { AccountToolbar } from '../components/AccountToolbar'

const FEATURE_TITLE: Record<
  NonNullable<MenuGameSettings['premiumFeature']>,
  string
> = {
  battleship: 'Battleship mode',
  board_12x6: '12 × 6 board',
  board_12x12: '12 × 12 board',
}

export function PremiumPlayPlaceholder({
  settings,
  onMenu,
}: {
  settings: MenuGameSettings
  onMenu: () => void
}) {
  const pf = settings.premiumFeature
  if (!pf) return null

  return (
    <div className="mc-wood-bg flex min-h-screen flex-col text-neutral-100">
      <header className="flex flex-col items-center px-4 pb-3 pt-5 text-center sm:px-8">
        <div className="mb-3 w-full max-w-lg">
          <AccountToolbar isGameBreakingState={false} />
        </div>
        <h1 className="mc-title text-2xl sm:text-4xl">{FEATURE_TITLE[pf]}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-yellow-100/80">
          You’ve unlocked this Guac preview — thanks for supporting{' '}
          <strong>Gojito Games</strong>. Gameplay for this layout is still in progress (live builds were
          unreliable), so we’re using it to validate paywalls and entitlements first.
        </p>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md rounded-xl border border-white/10 bg-black/30 p-6 text-center shadow-xl backdrop-blur-sm">
          <p className="text-sm text-yellow-100/75">
            When this ships, your match will start from the main menu with these rules hooked into the same
            multiplication engine as classic mode.
          </p>
          <button
            type="button"
            onClick={onMenu}
            className="mt-6 w-full rounded-xl bg-[var(--color-mc-purple)] py-3 text-lg font-bold text-[var(--color-mc-yellow)] shadow-lg transition hover:bg-[var(--color-mc-purple-deep)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-mc-yellow)]"
          >
            Back to menu
          </button>
        </div>
      </main>
    </div>
  )
}
