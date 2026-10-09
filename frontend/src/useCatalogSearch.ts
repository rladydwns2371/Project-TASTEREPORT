import { useEffect, useState } from 'react'
import { searchMovies, searchMusic } from './catalogApi'
import type { CatalogAttribution, CatalogItem, MusicCatalogItem } from './types'

type SearchState<T> = {
  items: T[]
  loading: boolean
  error?: string
  attribution?: CatalogAttribution
}

const emptyState = <T,>(): SearchState<T> => ({ items: [], loading: false })

export function useMovieCatalogSearch(query: string) {
  const [retryKey, setRetryKey] = useState(0)
  const [state, setState] = useState<SearchState<CatalogItem>>(emptyState)

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setState(emptyState())
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true, error: undefined }))
      try {
        const result = await searchMovies(normalized, controller.signal)
        setState({ items: result.items, loading: false, attribution: result.attribution })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ items: [], loading: false, error: error instanceof Error ? error.message : '검색에 실패했습니다.' })
      }
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, retryKey])

  return { ...state, retry: () => setRetryKey((value) => value + 1) }
}

export function useMusicCatalogSearch(query: string, entity: 'artist' | 'track') {
  const [retryKey, setRetryKey] = useState(0)
  const [state, setState] = useState<SearchState<MusicCatalogItem>>(emptyState)

  useEffect(() => {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setState(emptyState())
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true, error: undefined }))
      try {
        const result = await searchMusic(normalized, entity, controller.signal)
        setState({ items: result.items, loading: false, attribution: result.attribution })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ items: [], loading: false, error: error instanceof Error ? error.message : '검색에 실패했습니다.' })
      }
    }, 350)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [entity, query, retryKey])

  return { ...state, retry: () => setRetryKey((value) => value + 1) }
}
