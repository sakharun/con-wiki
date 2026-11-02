import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">404</p>
      <h1 className="mt-3 font-serif text-4xl">Страница не найдена</h1>
      <p className="mt-3 text-[14px] text-muted">
        Возможно, ссылка устарела. Попробуйте найти понятие через поиск или указатель.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link
          to="/"
          className="rounded-lg border border-line bg-surface px-4 py-2 text-[14px] transition-colors hover:border-accent/60"
        >
          На главную
        </Link>
        <Link
          to="/all"
          className="rounded-lg bg-accent px-4 py-2 text-[14px] text-accent-ink transition-opacity hover:opacity-90"
        >
          К указателю
        </Link>
      </div>
    </div>
  )
}
