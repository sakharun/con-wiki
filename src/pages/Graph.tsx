import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type { GraphData, Kind } from '@/types'
import { BASE, articlePath, formatNumber, plural } from '@/lib/content'
import { usePageTitle } from '@/lib/usePageTitle'

interface Node extends SimulationNodeDatum {
  id: string
  title: string
  kind: Kind
  letter: string
  backlinks: number
  degree: number
}

interface Link extends SimulationLinkDatum<Node> {
  weight: number
}

const CONCEPT_COLOR = '#2f4d7d'
const ENTITY_COLOR = '#0f766e'
const CONCEPT_COLOR_DARK = '#9ab8e9'
const ENTITY_COLOR_DARK = '#34d399'

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function nodeRadius(degree: number) {
  return 1.9 + Math.min(5.2, Math.sqrt(degree) * 0.85)
}

function GraphCanvas({ data }: { data: GraphData }) {
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [query, setQuery] = useState('')
  const [showConcepts, setShowConcepts] = useState(true)
  const [showEntities, setShowEntities] = useState(true)
  const [hover, setHover] = useState<Node | null>(null)
  const [view, setView] = useState({ k: 1 })
  const [ready, setReady] = useState(false)

  const matchCount = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/ё/g, 'е')
    if (!normalized) return 0
    return data.nodes.filter((node) => node.title.toLowerCase().replace(/ё/g, 'е').includes(normalized)).length
  }, [data, query])

  const nodesRef = useRef<Node[]>([])
  const linksRef = useRef<Link[]>([])
  const simRef = useRef<Simulation<Node, Link> | null>(null)
  const viewRef = useRef({ x: 0, y: 0, k: 1 })
  const hoverRef = useRef<Node | null>(null)
  const neighborsRef = useRef<Set<string>>(new Set())
  const matchesRef = useRef<Set<string>>(new Set())
  const filtersRef = useRef({ concept: true, entity: true })
  const dragRef = useRef<{
    mode: 'pan' | 'node'
    node?: Node
    screenX: number
    screenY: number
    originX: number
    originY: number
    moved: boolean
  } | null>(null)
  const rafRef = useRef(0)

  const isDark = () => document.documentElement.classList.contains('dark')

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, width, height)

    const { x: tx, y: ty, k } = viewRef.current
    const hovered = hoverRef.current
    const matches = matchesRef.current
    const filters = filtersRef.current
    const dark = isDark()

    const visible = (node: Node) =>
      filters[node.kind] && (matches.size === 0 || matches.has(node.id))

    const point = (node: Node) => ({
      x: tx + (node.x ?? 0) * k,
      y: ty + (node.y ?? 0) * k,
    })

    const radius = (node: Node) => nodeRadius(node.degree)

    // Рёбра
    context.save()
    context.translate(tx, ty)
    context.scale(k, k)
    context.strokeStyle = cssVar('--c-line')
    context.globalAlpha = 0.6
    context.lineWidth = 0.7
    context.beginPath()
    for (const link of linksRef.current) {
      const source = link.source as Node
      const target = link.target as Node
      if (!visible(source) || !visible(target)) continue
      context.moveTo(source.x ?? 0, source.y ?? 0)
      context.lineTo(target.x ?? 0, target.y ?? 0)
    }
    context.stroke()

    if (hovered) {
      context.strokeStyle = dark ? CONCEPT_COLOR_DARK : CONCEPT_COLOR
      context.globalAlpha = 0.35
      context.lineWidth = 1.4
      context.beginPath()
      for (const link of linksRef.current) {
        const source = link.source as Node
        const target = link.target as Node
        if (source !== hovered && target !== hovered) continue
        context.moveTo(source.x ?? 0, source.y ?? 0)
        context.lineTo(target.x ?? 0, target.y ?? 0)
      }
      context.stroke()
    }
    context.restore()

    // Узлы
    const conceptColor = dark ? CONCEPT_COLOR_DARK : CONCEPT_COLOR
    const entityColor = dark ? ENTITY_COLOR_DARK : ENTITY_COLOR

    for (const node of nodesRef.current) {
      if (!visible(node)) continue
      const { x, y } = point(node)
      if (x < -30 || y < -30 || x > width + 30 || y > height + 30) continue

      const dim = hovered && hovered !== node && !neighborsRef.current.has(node.id)
      context.globalAlpha = dim ? 0.2 : 1
      context.fillStyle = node.kind === 'concept' ? conceptColor : entityColor
      context.beginPath()
      context.arc(x, y, radius(node), 0, Math.PI * 2)
      context.fill()

      if (matches.size > 0 && matches.has(node.id)) {
        context.strokeStyle = conceptColor
        context.lineWidth = 1.5
        context.globalAlpha = 0.9
        context.beginPath()
        context.arc(x, y, radius(node) + 3, 0, Math.PI * 2)
        context.stroke()
      }
    }

    // Подписи
    const labelThreshold = k >= 1.6 ? 8 : k >= 1.1 ? 28 : k >= 0.8 ? 55 : 130
    const priority = (node: Node) =>
      node === hovered ? 3 : matches.has(node.id) ? 2 : neighborsRef.current.has(node.id) ? 1 : 0

    const labelNodes = nodesRef.current
      .filter((node) => {
        if (!visible(node)) return false
        if (hovered === node) return true
        if (matches.size > 0 && matches.has(node.id)) return true
        if (hovered && neighborsRef.current.has(node.id)) return true
        return node.degree >= labelThreshold
      })
      .sort((a, b) => priority(b) - priority(a) || b.degree - a.degree)
      .slice(0, 70)

    context.font = '500 10px Inter, system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'bottom'
    context.lineJoin = 'round'
    context.strokeStyle = cssVar('--c-paper')
    context.fillStyle = dark ? '#d9d3c7' : '#4b463d'
    context.lineWidth = 3

    const placed: Array<[number, number, number, number]> = []

    for (const node of labelNodes) {
      const { x, y } = point(node)
      if (x < 20 || y < 20 || x > width - 20 || y > height - 20) continue
      const text = node.title.length > 26 ? `${node.title.slice(0, 25)}…` : node.title
      const labelY = y - radius(node) - 3
      const textWidth = context.measureText(text).width
      const rect: [number, number, number, number] = [
        x - textWidth / 2 - 2,
        labelY - 11,
        x + textWidth / 2 + 2,
        labelY + 2,
      ]
      const collides = placed.some(
        ([x1, y1, x2, y2]) => !(rect[2] < x1 || rect[0] > x2 || rect[3] < y1 || rect[1] > y2),
      )
      if (collides && priority(node) < 2) continue
      placed.push(rect)
      context.strokeText(text, x, labelY)
      context.fillText(text, x, labelY)
    }

    context.globalAlpha = 1
  }, [])

  const fit = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const nodes = nodesRef.current
    if (!nodes.length) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of nodes) {
      minX = Math.min(minX, node.x ?? 0)
      minY = Math.min(minY, node.y ?? 0)
      maxX = Math.max(maxX, node.x ?? 0)
      maxY = Math.max(maxY, node.y ?? 0)
    }

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const spanX = Math.max(maxX - minX, 1)
    const spanY = Math.max(maxY - minY, 1)
    const k = Math.min(2.2, Math.max(0.16, 0.88 * Math.min(width / spanX, height / spanY)))
    viewRef.current = {
      k,
      x: width / 2 - ((minX + maxX) / 2) * k,
      y: height / 2 - ((minY + maxY) / 2) * k,
    }
    setView({ k })
    draw()
  }, [draw])

  // Построение симуляции
  useEffect(() => {
    const nodes: Node[] = data.nodes.map((node) => ({ ...node, degree: 0 }))
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const links: Link[] = []

    for (const edge of data.edges) {
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      if (!source || !target) continue
      links.push({ source, target, weight: edge.weight })
      source.degree += 1
      target.degree += 1
    }

    nodesRef.current = nodes
    linksRef.current = links

    const simulation = forceSimulation<Node>(nodes)
      .force(
        'link',
        forceLink<Node, Link>(links)
          .id((node) => node.id)
          .distance((link) => 52 + 32 / (link.weight + 1))
          .strength(0.22),
      )
      .force('charge', forceManyBody<Node>().strength(-95).distanceMax(520))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide<Node>(3.6))
      .stop()

    for (let i = 0; i < 240; i++) simulation.tick()
    simRef.current = simulation

    requestAnimationFrame(() => {
      fit()
      setReady(true)
    })

    return () => {
      simulation.stop()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [data, fit])

  const kick = useCallback(() => {
    const simulation = simRef.current
    if (!simulation) return
    simulation.alpha(Math.max(simulation.alpha(), 0.25))

    const step = () => {
      rafRef.current = 0
      const current = simRef.current
      if (!current) return
      if (current.alpha() > 0.01) {
        current.tick()
        draw()
        rafRef.current = requestAnimationFrame(step)
      }
    }

    if (!rafRef.current) rafRef.current = requestAnimationFrame(step)
  }, [draw])

  // Размер холста
  useEffect(() => {
    const element = wrapRef.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      draw()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [draw])

  // Тема
  useEffect(() => {
    const observer = new MutationObserver(() => draw())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [draw])

  // Поиск и фильтры
  useEffect(() => {
    const normalized = query.trim().toLowerCase().replace(/ё/g, 'е')
    matchesRef.current = normalized
      ? new Set(
          nodesRef.current
            .filter((node) => node.title.toLowerCase().replace(/ё/g, 'е').includes(normalized))
            .map((node) => node.id),
        )
      : new Set()
    draw()
  }, [query, draw])

  useEffect(() => {
    filtersRef.current = { concept: showConcepts, entity: showEntities }
    draw()
  }, [showConcepts, showEntities, draw])

  const hoverNode = useCallback(
    (node: Node | null) => {
      if (hoverRef.current?.id === node?.id) return
      hoverRef.current = node
      const neighbors = new Set<string>()
      if (node) {
        neighbors.add(node.id)
        for (const link of linksRef.current) {
          const source = link.source as Node
          const target = link.target as Node
          if (source.id === node.id) neighbors.add(target.id)
          if (target.id === node.id) neighbors.add(source.id)
        }
      }
      neighborsRef.current = neighbors
      setHover(node)
      draw()
    },
    [draw],
  )

  const toWorld = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const { x, y, k } = viewRef.current
    return { x: (clientX - rect.left - x) / k, y: (clientY - rect.top - y) / k }
  }

  const nodeAt = (clientX: number, clientY: number): Node | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const sx = clientX - rect.left
    const sy = clientY - rect.top
    const { x: tx, y: ty, k } = viewRef.current
    let best: Node | null = null
    let bestDistance = Infinity

    for (const node of nodesRef.current) {
      if (!filtersRef.current[node.kind]) continue
      const nx = tx + (node.x ?? 0) * k
      const ny = ty + (node.y ?? 0) * k
      const distance = Math.hypot(nx - sx, ny - sy)
      const hit = nodeRadius(node.degree) + 5
      if (distance < hit && distance < bestDistance) {
        best = node
        bestDistance = distance
      }
    }
    return best
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    const node = nodeAt(event.clientX, event.clientY)
    dragRef.current = {
      mode: node ? 'node' : 'pan',
      node: node ?? undefined,
      screenX: event.clientX,
      screenY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
      moved: false,
    }
    if (node) {
      node.fx = node.x
      node.fy = node.y
    }
    event.currentTarget.style.cursor = 'grabbing'
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag) {
      const node = nodeAt(event.clientX, event.clientY)
      hoverNode(node)
      if (canvasRef.current) canvasRef.current.style.cursor = node ? 'pointer' : 'grab'
      return
    }

    if (Math.hypot(event.clientX - drag.screenX, event.clientY - drag.screenY) > 3) drag.moved = true

    if (drag.mode === 'pan') {
      viewRef.current.x = drag.originX + (event.clientX - drag.screenX)
      viewRef.current.y = drag.originY + (event.clientY - drag.screenY)
      draw()
    } else if (drag.node) {
      const world = toWorld(event.clientX, event.clientY)
      drag.node.fx = world.x
      drag.node.fy = world.y
      kick()
    }
  }

  function onPointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'

    if (!drag) return

    if (drag.mode === 'node' && drag.node) {
      drag.node.fx = null
      drag.node.fy = null
      kick()
      if (!drag.moved) {
        hoverNode(null)
        navigate(articlePath(drag.node.kind, drag.node.id))
      }
    }
  }

  function onWheel(event: WheelEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    event.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const current = viewRef.current
    const nextK = Math.min(6, Math.max(0.12, current.k * Math.exp(-event.deltaY * 0.0015)))
    viewRef.current = {
      k: nextK,
      x: sx - ((sx - current.x) / current.k) * nextK,
      y: sy - ((sy - current.y) / current.k) * nextK,
    }
    setView({ k: nextK })
    draw()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [draw])

  function openFirstMatch() {
    const node = nodesRef.current.find((item) => matchesRef.current.has(item.id))
    if (node) navigate(articlePath(node.kind, node.id))
  }

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-2xl border border-line/70 bg-surface"
      style={{ height: 'min(76vh, 780px)' }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        style={{ cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (!dragRef.current) hoverNode(null)
        }}
        role="img"
        aria-label={`Граф связей: ${data.nodes.length} узлов и ${data.edges.length} связей. Используйте страницу «Все статьи» для навигации без графа.`}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto w-64 rounded-xl border border-line/80 bg-surface/92 p-2.5 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2 rounded-md border border-line/70 bg-paper px-2 py-1.5">
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') openFirstMatch()
              }}
              placeholder="Найти узел…"
              className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted/70"
              aria-label="Поиск понятия в графе"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-[13px] text-muted hover:text-ink" aria-label="Очистить">
                ×
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowConcepts((value) => !value)}
              className={`flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                showConcepts ? 'border-line bg-paper text-ink' : 'border-transparent text-muted line-through'
              }`}
            >
              <span className="size-1.5 rounded-full" style={{ background: CONCEPT_COLOR }} />
              концепции
            </button>
            <button
              type="button"
              onClick={() => setShowEntities((value) => !value)}
              className={`flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                showEntities ? 'border-line bg-paper text-ink' : 'border-transparent text-muted line-through'
              }`}
            >
              <span className="size-1.5 rounded-full" style={{ background: ENTITY_COLOR }} />
              сущности
            </button>
            <button
              type="button"
              onClick={fit}
              className="ml-auto rounded border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted transition-colors hover:text-ink"
            >
              Вписать
            </button>
          </div>

          {query && (
            <p className="mt-2 text-[10px] text-muted">
              {matchCount
                ? `${matchCount} ${plural(matchCount, 'совпадение', 'совпадения', 'совпадений')}`
                : 'Ничего не найдено'}
            </p>
          )}
        </div>

        <div className="pointer-events-auto hidden rounded-lg border border-line/80 bg-surface/92 px-2.5 py-1.5 text-[10px] text-muted shadow-sm backdrop-blur sm:block">
          {formatNumber(data.nodes.length)} узлов · {formatNumber(data.edges.length)} связей · масштаб{' '}
          {Math.round(view.k * 100)}%
        </div>
      </div>

      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-surface/70 text-[13px] text-muted backdrop-blur-sm">
          Раскладываю узлы…
        </div>
      )}

      {hover && (
        <div className="absolute bottom-3 left-3 max-w-xs rounded-xl border border-line/80 bg-surface/95 p-3 shadow-lg backdrop-blur">
          <p className="text-[9px] uppercase tracking-[0.14em] text-muted">
            {hover.kind === 'concept' ? 'Концепция' : 'Сущность'}
          </p>
          <p className="mt-1 font-serif text-[15px] font-medium">{hover.title}</p>
          <p className="mt-1 text-[11px] text-muted">
            {hover.degree} {plural(hover.degree, 'связь', 'связи', 'связей')} · {hover.backlinks}{' '}
            {plural(hover.backlinks, 'упоминание', 'упоминания', 'упоминаний')}
          </p>
          <p className="mt-1.5 text-[11px] text-accent">Нажмите, чтобы открыть</p>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-2 right-3 hidden text-[10px] text-muted/80 sm:block">
        колесо — масштаб · перетаскивание — панорама и узлы
      </p>
    </div>
  )
}

export default function Graph() {
  const [data, setData] = useState<GraphData | null>(null)
  const [error, setError] = useState(false)
  usePageTitle('Граф связей')

  useEffect(() => {
    let alive = true
    fetch(`${BASE}content/graph.json`)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json() as Promise<GraphData>
      })
      .then((graph) => alive && setData(graph))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div>
      <header className="max-w-3xl">
        <p className="pill">Атлас</p>
        <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">Граф связей</h1>
        <p className="mt-3 font-serif text-[16px] leading-relaxed text-muted">
          Каждый узел — статья, каждая линия — вики-ссылка между понятиями. Размер узла зависит от
          числа связей. Наведите курсор, чтобы подсветить окружение, и нажмите, чтобы открыть статью.
        </p>
      </header>

      <div className="mt-7">
        {error && (
          <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-[14px] text-muted">
            Не удалось загрузить граф. Обновите страницу.
          </div>
        )}
        {!data && !error && (
          <div className="grid h-[50vh] place-items-center rounded-2xl border border-line/70 bg-surface text-[13px] text-muted">
            Загружаю граф…
          </div>
        )}
        {data && <GraphCanvas data={data} />}
      </div>

      <p className="mt-3 text-[11px] text-muted">
        Граф строится из связей внутри статей. Ссылки на источники и неразрешённые ссылки в граф не
        входят — их видно в тексте статьи.{' '}
        <Link to="/all" className="text-accent hover:underline">
          Открыть алфавитный указатель
        </Link>
      </p>
    </div>
  )
}
