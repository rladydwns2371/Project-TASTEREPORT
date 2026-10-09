import asyncio
import time
from collections.abc import Mapping
from typing import Any, Literal

import httpx

from app.core.config import Settings
from app.providers.errors import (
    CatalogProviderRateLimitError,
    CatalogProviderUnavailableError,
)
from app.schemas.catalog import CatalogAttribution, CatalogItem, CatalogSearchResponse

MusicEntity = Literal["artist", "track"]

_CACHE_TTL_SECONDS = 60.0
_cache: dict[tuple[str, MusicEntity, int], tuple[float, CatalogSearchResponse]] = {}


class ItunesMusicProvider:
    base_url = "https://itunes.apple.com"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def search(self, query: str, entity: MusicEntity, limit: int) -> CatalogSearchResponse:
        cache_key = (query.casefold(), entity, limit)
        cached = _cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1]

        payload = await self._request(
            "/search",
            params={
                "term": query,
                # The KR storefront currently returns empty music searches even for major
                # Korean artists. The US catalog still resolves Korean and English queries.
                "country": "US",
                "media": "music",
                "entity": "musicArtist" if entity == "artist" else "song",
                "limit": limit,
                "explicit": "No",
            },
        )
        raw_results = payload.get("results", [])
        if not isinstance(raw_results, list):
            raise CatalogProviderUnavailableError("iTunes returned an invalid result list")

        items: list[CatalogItem] = []
        seen_ids: set[str] = set()
        for raw in raw_results:
            item = self._map_item(raw, entity)
            if item and item.provider_id not in seen_ids:
                seen_ids.add(item.provider_id)
                items.append(item)

        result = CatalogSearchResponse(
            items=items,
            page=1,
            has_more=False,
            attribution=CatalogAttribution(
                provider="itunes",
                label="Apple iTunes Search",
                notice="Search results provided by the Apple iTunes Search API.",
                url="https://www.apple.com/itunes/",
            ),
        )
        _cache[cache_key] = (time.monotonic() + _CACHE_TTL_SECONDS, result)
        return result

    async def _request(self, path: str, *, params: Mapping[str, str | int]) -> dict[str, Any]:
        attempts = self.settings.catalog_max_retries + 1
        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(
                    base_url=self.base_url,
                    timeout=self.settings.catalog_timeout_seconds,
                ) as client:
                    response = await client.get(path, params=params)
                if response.status_code == 429:
                    raise CatalogProviderRateLimitError("iTunes rate limit exceeded")
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise CatalogProviderUnavailableError("iTunes returned invalid JSON")
                return data
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as error:
                if attempt == attempts - 1:
                    raise CatalogProviderUnavailableError("iTunes request failed") from error
                await asyncio.sleep(0.15 * (attempt + 1))
        raise CatalogProviderUnavailableError("iTunes request failed")

    @staticmethod
    def _map_item(raw: Any, entity: MusicEntity) -> CatalogItem | None:
        if not isinstance(raw, dict):
            return None
        if entity == "artist":
            provider_id = raw.get("artistId")
            title = raw.get("artistName")
            if not provider_id or not title:
                return None
            return CatalogItem(
                provider="itunes",
                provider_id=str(provider_id),
                item_type="artist",
                title=str(title),
                subtitle=str(raw.get("primaryGenreName") or "아티스트"),
                external_url=raw.get("artistLinkUrl") or raw.get("artistViewUrl"),
            )

        provider_id = raw.get("trackId")
        title = raw.get("trackName")
        artist = raw.get("artistName")
        if not provider_id or not title or not artist:
            return None
        release_date = raw.get("releaseDate")
        release_year = None
        if isinstance(release_date, str) and len(release_date) >= 4 and release_date[:4].isdigit():
            release_year = int(release_date[:4])
        return CatalogItem(
            provider="itunes",
            provider_id=str(provider_id),
            item_type="track",
            title=str(title),
            subtitle=str(artist),
            detail=str(raw.get("collectionName")) if raw.get("collectionName") else None,
            release_year=release_year,
            external_url=raw.get("trackViewUrl"),
        )
