import type { CatalogAttribution, CatalogImageCredit, CatalogItem, MusicCatalogItem } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

type ApiCatalogItem = {
  provider: 'wikidata' | 'itunes'
  provider_id: string
  item_type: 'movie' | 'artist' | 'track'
  title: string
  subtitle?: string | null
  detail?: string | null
  release_year?: number | null
  image_url?: string | null
  image_credit?: {
    creator: string
    license: string
    source_url: string
    license_url?: string | null
  } | null
  external_url?: string | null
}

type ApiCatalogResponse = {
  items: ApiCatalogItem[]
  page: number
  has_more: boolean
  attribution: CatalogAttribution
}

type ApiErrorResponse = {
  error?: { code?: string, message?: string }
}

export class CatalogSearchError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CatalogSearchError'
    this.code = code
  }
}

export type CatalogSearchResult<T> = {
  items: T[]
  hasMore: boolean
  attribution: CatalogAttribution
}

async function requestCatalog(path: string, signal: AbortSignal): Promise<ApiCatalogResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new CatalogSearchError('NETWORK_ERROR', '검색 서버에 연결할 수 없습니다. 서버 실행 상태를 확인해 주세요.')
  }

  if (!response.ok) {
    let payload: ApiErrorResponse = {}
    try {
      payload = await response.json() as ApiErrorResponse
    } catch {
      // The user-facing fallback below intentionally hides provider internals.
    }
    throw new CatalogSearchError(
      payload.error?.code ?? 'CATALOG_SEARCH_FAILED',
      payload.error?.message ?? '검색 중 문제가 생겼습니다. 다시 시도해 주세요.',
    )
  }

  const payload = await response.json() as ApiCatalogResponse
  if (!Array.isArray(payload.items) || !payload.attribution) {
    throw new CatalogSearchError('INVALID_RESPONSE', '검색 결과 형식이 올바르지 않습니다.')
  }
  return payload
}

function accentFromId(value: string) {
  const palette = ['#7568df', '#5a73ff', '#bf6659', '#568a78', '#b18c45', '#a45f82']
  const total = [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return palette[total % palette.length]
}

function mapImageCredit(credit: ApiCatalogItem['image_credit']): CatalogImageCredit | undefined {
  if (!credit) return undefined
  return {
    creator: credit.creator,
    license: credit.license,
    sourceUrl: credit.source_url,
    licenseUrl: credit.license_url ?? undefined,
  }
}

export async function searchMovies(query: string, signal: AbortSignal): Promise<CatalogSearchResult<CatalogItem>> {
  const payload = await requestCatalog(`/catalog/movies/search?query=${encodeURIComponent(query)}`, signal)
  return {
    items: payload.items.filter((item) => item.item_type === 'movie').map((item) => ({
      provider: 'wikidata',
      providerId: item.provider_id,
      title: item.title,
      subtitle: item.subtitle ?? '',
      year: item.release_year ?? undefined,
      accent: accentFromId(item.provider_id),
      imageUrl: item.image_url ?? undefined,
      imageCredit: mapImageCredit(item.image_credit),
      detail: item.detail ?? undefined,
      sourceUrl: item.external_url ?? undefined,
    })),
    hasMore: payload.has_more,
    attribution: payload.attribution,
  }
}

export async function searchMusic(query: string, entity: 'artist' | 'track', signal: AbortSignal): Promise<CatalogSearchResult<MusicCatalogItem>> {
  const payload = await requestCatalog(`/catalog/music/search?query=${encodeURIComponent(query)}&entity=${entity}&limit=15`, signal)
  return {
    items: payload.items.filter((item) => item.item_type === entity).map((item) => ({
      provider: 'itunes',
      providerId: item.provider_id,
      itemType: entity,
      title: item.title,
      subtitle: item.subtitle ?? (entity === 'artist' ? '아티스트' : '가수 정보 없음'),
      detail: item.detail ?? undefined,
      accent: accentFromId(item.provider_id),
      releaseYear: item.release_year ?? undefined,
      sourceUrl: item.external_url ?? undefined,
    })),
    hasMore: payload.has_more,
    attribution: payload.attribution,
  }
}
