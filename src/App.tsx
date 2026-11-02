import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import Layout from '@/components/Layout'
import SearchPalette from '@/components/SearchPalette'
import Home from '@/pages/Home'
import All from '@/pages/All'
import Article from '@/pages/Article'
import About from '@/pages/About'
import NotFound from '@/pages/NotFound'

const GraphPage = lazy(() => import('@/pages/Graph'))

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function RoutesView() {
  const [searchOpen, setSearchOpen] = useState(false)
  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((value) => !value)
        return
      }

      if (event.key === '/' && !typing && !searchOpen) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen])

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout onOpenSearch={openSearch} />}>
          <Route index element={<Home onOpenSearch={openSearch} />} />
          <Route path="all" element={<All />} />
          <Route path="k/:slug" element={<Article kind="concept" />} />
          <Route path="e/:slug" element={<Article kind="entity" />} />
          <Route
            path="graph"
            element={
              <Suspense
                fallback={
                  <div className="grid min-h-[50vh] place-items-center text-sm text-muted">Строю граф…</div>
                }
              >
                <GraphPage />
              </Suspense>
            }
          />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <SearchPalette open={searchOpen} onClose={closeSearch} />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={BASENAME}>
      <RoutesView />
    </BrowserRouter>
  )
}
