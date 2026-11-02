import { NavLink, Outlet, Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import { formatNumber, plural, useManifest } from '@/lib/content'

const NAV = [
  { to: '/', label: 'Словарь', end: true },
  { to: '/all', label: 'Указатель' },
  { to: '/graph', label: 'Граф' },
  { to: '/about', label: 'О словаре' },
]

interface Props {
  onOpenSearch: () => void
}

export default function Layout({ onOpenSearch }: Props) {
  const { manifest } = useManifest()

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        К содержанию
      </a>

      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="group flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line bg-surface font-serif text-lg font-semibold text-accent shadow-sm">
              Р
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-muted">Словарь</span>
              <span className="hidden truncate font-serif text-[15px] font-medium sm:block">
                Реконструктор Сознания
              </span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm transition-colors ${
                    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-line/30 hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={onOpenSearch}
            className="ml-auto flex h-9 min-w-0 items-center gap-2 rounded-md border border-line/80 bg-surface px-3 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink sm:w-56 lg:w-72"
            aria-label="Открыть поиск"
          >
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <span className="hidden truncate sm:inline">Найти понятие…</span>
            <span className="kbd ml-auto hidden sm:inline-flex">Ctrl K</span>
          </button>

          <ThemeToggle />
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-line/60 px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] transition-colors ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-muted'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-6 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            {manifest ? (
              <>
                {formatNumber(manifest.stats.articles)} {plural(manifest.stats.articles, 'статья', 'статьи', 'статей')} ·{' '}
                {formatNumber(manifest.stats.concepts)} {plural(manifest.stats.concepts, 'концепция', 'концепции', 'концепций')} ·{' '}
                {formatNumber(manifest.stats.entities)} {plural(manifest.stats.entities, 'сущность', 'сущности', 'сущностей')}
              </>
            ) : (
              'Словарь понятий'
            )}
          </p>
          <p className="flex items-center gap-4">
            <Link to="/about" className="transition-colors hover:text-ink">
              О словаре
            </Link>
            {manifest && (
              <span>
                обновлён{' '}
                {new Date(manifest.stats.generatedAt).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            )}
          </p>
        </div>
      </footer>
    </div>
  )
}
