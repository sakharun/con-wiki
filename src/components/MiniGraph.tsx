import { useNavigate } from 'react-router-dom'
import type { Entry } from '@/types'
import { articlePath } from '@/lib/content'

interface Props {
  center: { slug: string; title: string }
  neighbors: Entry[]
}

const MAX = 8

export default function MiniGraph({ center, neighbors }: Props) {
  const navigate = useNavigate()
  const visible = neighbors.slice(0, MAX)
  const width = 300
  const height = 240
  const cx = width / 2
  const cy = height / 2 - 4
  const radius = 82

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Ближайшие связи понятия">
        <circle cx={cx} cy={cy} r={radius + 14} className="fill-none stroke-line/50" strokeDasharray="2 4" />

        {visible.map((entry, index) => {
          const angle = (index / Math.max(visible.length, 1)) * Math.PI * 2 - Math.PI / 2
          const x = cx + Math.cos(angle) * radius
          const y = cy + Math.sin(angle) * radius
          return (
            <line
              key={`line-${entry.slug}`}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              className="stroke-line"
              strokeWidth={1}
            />
          )
        })}

        {visible.map((entry, index) => {
          const angle = (index / Math.max(visible.length, 1)) * Math.PI * 2 - Math.PI / 2
          const x = cx + Math.cos(angle) * radius
          const y = cy + Math.sin(angle) * radius
          const label = entry.title.length > 16 ? `${entry.title.slice(0, 15)}…` : entry.title
          const anchor = Math.abs(Math.cos(angle)) < 0.3 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
          const labelX = anchor === 'middle' ? x : x + (anchor === 'start' ? 8 : -8)
          return (
            <g
              key={entry.slug}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={entry.title}
              onClick={() => navigate(articlePath(entry.kind, entry.slug))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(articlePath(entry.kind, entry.slug))
                }
              }}
            >
              <title>{entry.title}</title>
              <circle
                cx={x}
                cy={y}
                r={4}
                className={entry.kind === 'concept' ? 'fill-accent' : 'fill-emerald-600 dark:fill-emerald-400'}
              />
              <text
                x={labelX}
                y={y + 13}
                textAnchor={anchor}
                className="fill-muted font-sans text-[8.5px]"
              >
                {label}
              </text>
            </g>
          )
        })}

        <circle cx={cx} cy={cy} r={9} className="fill-accent/15" />
        <circle cx={cx} cy={cy} r={4.5} className="fill-accent" />
        <text
          x={cx}
          y={cy + 22}
          textAnchor="middle"
          className="fill-ink font-sans text-[9px] font-semibold"
        >
          {center.title.length > 20 ? `${center.title.slice(0, 19)}…` : center.title}
        </text>
      </svg>

      {neighbors.length > MAX && (
        <p className="mt-1 text-center text-[11px] text-muted">и ещё {neighbors.length - MAX}</p>
      )}
    </div>
  )
}
