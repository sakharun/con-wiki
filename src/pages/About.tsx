import { Link } from 'react-router-dom'
import { formatNumber, plural, useManifest } from '@/lib/content'
import { usePageTitle } from '@/lib/usePageTitle'

const SECTIONS = [
  {
    title: 'Определение',
    text: 'Краткая суть понятия — то, что в исходной вики записано в разделе Summary. Выделено рамкой под заголовком статьи.',
  },
  {
    title: 'Текущее понимание',
    text: 'Тезисы, которые сложились на текущий момент. Это рабочая модель, а не догма: формулировки уточняются по мере разбора новых источников.',
  },
  {
    title: 'Доказательства',
    text: 'Цитаты из лекций, семинаров и занятий с указанием источника. Ссылки на источники показаны в тексте как серые чипы.',
  },
  {
    title: 'Связанные страницы',
    text: 'Ближайшие понятия. В правой колонке они дополнены обратными ссылками — статьями, которые ссылаются сюда.',
  },
  {
    title: 'Противоречия и неопределённость',
    text: 'Места, где данные расходятся или статус утверждения ещё не подтверждён. Важная часть словаря: она показывает, где знание открыто.',
  },
  {
    title: 'Следующие вопросы',
    text: 'Направления, которые ещё предстоит разобрать. По ним видно, куда движется исследование понятия.',
  },
]

export default function About() {
  const { manifest } = useManifest()
  usePageTitle('О словаре')
  const stats = manifest?.stats

  return (
    <div className="max-w-3xl">
      <header>
        <p className="pill">О проекте</p>
        <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">О словаре</h1>
        <p className="mt-4 font-serif text-[17px] leading-relaxed text-muted">
          Это читательская версия вики «Реконструктор Сознания»: 773 концепции и 38 сущностей,
          собранные из лекций и семинаров. Сайт не заменяет исходные тексты, а помогает быстро найти
          понятие, увидеть его определение и перейти по связям. Лекции по адресу: https://rutube.ru/plst/425558/
        </p>
      </header>

      {stats && (
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line/70 bg-line/60 sm:grid-cols-4">
          {[
            { label: 'статей', value: stats.articles },
            { label: 'связей', value: stats.links },
            { label: 'источников', value: stats.sources },
            { label: 'слов', value: stats.words },
          ].map((item) => (
            <div key={item.label} className="bg-surface px-4 py-4">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-muted">{item.label}</dt>
              <dd className="mt-1 font-serif text-2xl">{formatNumber(item.value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Как устроена статья</h2>
        <div className="mt-4 divide-y divide-line/60 border-y border-line/60">
          {SECTIONS.map((section) => (
            <div key={section.title} className="grid gap-1 py-4 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-6">
              <p className="font-serif text-[15px] font-medium">{section.title}</p>
              <p className="text-[13.5px] leading-relaxed text-muted">{section.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Что вошло в словарь</h2>
        <p className="mt-3 font-serif text-[15px] leading-relaxed text-muted">
          Только словарные статьи: концепции и сущности. Конспекты источников, журнал изменений и
          отчёты о проверке остаются в исходной вики. Ссылки на источники внутри статей не ведут на
          отдельные страницы — они показываются как чипы с названием источника, чтобы было видно
          происхождение утверждения.
        </p>
        <p className="mt-3 font-serif text-[15px] leading-relaxed text-muted">
          Неразрешённые ссылки (их {stats ? stats.unresolved : '—'}) отмечены пунктирным чипом: это
          места, где понятие ещё не заведено или название расходится с файлом.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Навигация</h2>
        <ul className="mt-4 space-y-3 text-[14px] text-muted">
          <li>
            <span className="kbd">Ctrl</span> + <span className="kbd">K</span> или <span className="kbd">/</span> — поиск
            из любого места. В палитре можно включить поиск по всему тексту статей.
          </li>
          <li>
            <Link to="/all" className="text-accent hover:underline">
              Указатель
            </Link>{' '}
            — алфавитный список с фильтром по типу статьи и строкой поиска.
          </li>
          <li>
            <Link to="/graph" className="text-accent hover:underline">
              Граф
            </Link>{' '}
            — визуальная карта связей. Полезен, чтобы увидеть окружение понятия и кластеры.
          </li>
          <li>Внутри статьи правый столбец показывает содержание, связанные страницы и обратные ссылки.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Как обновляется</h2>
        <p className="mt-3 font-serif text-[15px] leading-relaxed text-muted">
          Контент собирается из Markdown-файлов вики при каждой сборке сайта: статья разбирается на
          определение и разделы, ссылки вида{' '}
          <code className="rounded bg-line/40 px-1.5 py-0.5 font-sans text-[12px]">[[Понятие]]</code>{' '}
          превращаются в переходы, попутно считаются обратные ссылки и граф. Чтобы обновить словарь,
          достаточно изменить файлы в папке <code className="rounded bg-line/40 px-1.5 py-0.5 font-sans text-[12px]">wiki</code> и
          пересобрать сайт.
        </p>
        {stats && (
          <p className="mt-4 text-[12px] text-muted">
            Сборка от{' '}
            {new Date(stats.generatedAt).toLocaleString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            : {formatNumber(stats.articles)} {plural(stats.articles, 'статья', 'статьи', 'статей')},{' '}
            {formatNumber(stats.edges)} {plural(stats.edges, 'связь', 'связи', 'связей')},{' '}
            {formatNumber(stats.words)} {plural(stats.words, 'слово', 'слова', 'слов')}.
          </p>
        )}
      </section>

      <section className="mt-10 rounded-xl border border-line/70 bg-surface px-5 py-5">
        <h2 className="font-serif text-xl">Технически</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          React 19, TypeScript, Vite и Tailwind CSS. Полнотекстовый поиск — MiniSearch с русским
          стеммером, граф — d3-force на canvas. Сайт полностью статический: контент лежит готовыми
          JSON-файлами и не требует сервера.
        </p>
      </section>

      <p className="mt-10">
        <Link to="/" className="text-[14px] text-accent hover:underline">
          ← Вернуться к словарю
        </Link>
      </p>
    </div>
  )
}
