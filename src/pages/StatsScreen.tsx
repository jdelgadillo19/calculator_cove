import { Link } from 'react-router-dom'
import { loadStats } from '../game/stats'

export function StatsScreen() {
  const store = loadStats()
  const players = Object.entries(store.players).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="mc-wood-bg flex min-h-screen flex-col px-4 pb-10 pt-6 text-neutral-100 sm:px-8">
      <header className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <Link
          to="/"
          className="w-fit rounded-lg border border-white/20 bg-black/25 px-3 py-1.5 text-sm font-semibold text-[var(--color-cc-yellow)] hover:bg-black/35"
        >
          ← Main menu
        </Link>
        <h1 className="mc-title text-center text-2xl sm:text-3xl">Island stats</h1>
        <p className="text-center text-sm text-yellow-100/75">
          Wins and losses are tracked per player name and mode key. Quit counts are stored once per
          mid-game menu quit (no player split).
        </p>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl rounded-xl border border-white/10 bg-black/25 p-4 shadow-xl backdrop-blur-sm sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-cc-yellow)]">Quits by mode</h2>
        {Object.keys(store.modeQuits).length === 0 ? (
          <p className="mt-2 text-sm text-yellow-100/65">No recorded quits yet.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {Object.entries(store.modeQuits)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([mode, n]) => (
                <li key={mode} className="flex justify-between gap-4 border-b border-white/10 py-1">
                  <span className="font-mono text-xs text-yellow-100/80">{mode}</span>
                  <span className="text-yellow-50">{n}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="mx-auto mt-6 w-full max-w-2xl rounded-xl border border-white/10 bg-black/25 p-4 shadow-xl backdrop-blur-sm sm:p-6">
        <h2 className="text-lg font-semibold text-[var(--color-cc-yellow)]">Players</h2>
        {players.length === 0 ? (
          <p className="mt-2 text-sm text-yellow-100/65">Play a finished match to populate stats.</p>
        ) : (
          players.map(([name, modes]) => (
            <div key={name} className="mt-4 border-t border-white/10 pt-4 first:mt-3 first:border-t-0 first:pt-0">
              <h3 className="font-semibold text-yellow-100">{name}</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {Object.entries(modes)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([mode, wlq]) => (
                    <li
                      key={mode}
                      className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-1 font-mono text-xs text-yellow-100/75"
                    >
                      <span>{mode}</span>
                      <span>
                        W {wlq.wins} · L {wlq.losses}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
