import asyncio
import html
import re
import time
from collections.abc import Mapping
from typing import Any
from urllib.parse import unquote, urlparse

import httpx

from app.core.config import Settings
from app.providers.errors import (
    CatalogProviderRateLimitError,
    CatalogProviderUnavailableError,
)
from app.schemas.catalog import (
    CatalogAttribution,
    CatalogImageCredit,
    CatalogItem,
    CatalogSearchResponse,
)

_CACHE_TTL_SECONDS = 300.0
_cache: dict[str, tuple[float, CatalogSearchResponse]] = {}
_HTML_TAG = re.compile(r"<[^>]+>")
_WIKIDATA_ID = re.compile(r"^Q\d+$")


class WikidataMovieProvider:
    search_url = "https://www.wikidata.org/w/api.php"
    sparql_url = "https://query.wikidata.org/sparql"
    commons_url = "https://commons.wikimedia.org/w/api.php"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def search(self, query: str, page: int) -> CatalogSearchResponse:
        cache_key = query.casefold()
        cached = _cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1]

        languages = ("ko", "en") if self._contains_hangul(query) else ("en", "ko")
        searches = await asyncio.gather(
            *(self._search_entities(query, language) for language in languages)
        )
        candidate_ids = list(dict.fromkeys(item_id for result in searches for item_id in result))[:40]
        details = await self._fetch_film_details(candidate_ids) if candidate_ids else {}
        credits = await self._fetch_image_credits(details) if details else {}

        candidate_order = {item_id: index for index, item_id in enumerate(candidate_ids)}
        ranked_ids = sorted(
            candidate_ids,
            key=lambda item_id: (
                -self._rank_detail(query, details.get(item_id)),
                candidate_order[item_id],
            ),
        )
        items: list[CatalogItem] = []
        for item_id in ranked_ids:
            detail = details.get(item_id)
            if not detail:
                continue
            image_credit = credits.get(item_id)
            image_url = detail.get("image_url") if image_credit else None
            original_title = self._first_distinct(detail["original_titles"], detail["title"])
            directors = ", ".join(detail["directors"][:2])
            items.append(
                CatalogItem(
                    provider="wikidata",
                    provider_id=item_id,
                    item_type="movie",
                    title=detail["title"],
                    subtitle=original_title,
                    detail=directors or detail.get("description"),
                    release_year=min(detail["years"]) if detail["years"] else None,
                    image_url=image_url,
                    image_credit=image_credit,
                    external_url=f"https://www.wikidata.org/wiki/{item_id}",
                )
            )

        result = CatalogSearchResponse(
            items=items[:20],
            page=page,
            has_more=False,
            attribution=CatalogAttribution(
                provider="wikidata",
                label="Wikidata · Wikimedia Commons",
                notice=(
                    "영화 정보는 CC0 Wikidata를 사용합니다. 이미지는 Commons에서 "
                    "라이선스 정보가 확인된 경우에만 표시합니다."
                ),
                url="https://www.wikidata.org/",
            ),
        )
        _cache[cache_key] = (time.monotonic() + _CACHE_TTL_SECONDS, result)
        return result

    async def _search_entities(self, query: str, language: str) -> list[str]:
        payload = await self._request_json(
            self.search_url,
            params={
                "action": "wbsearchentities",
                "search": query,
                "language": language,
                "uselang": "ko",
                "type": "item",
                "limit": 30,
                "format": "json",
            },
        )
        raw_results = payload.get("search", [])
        if not isinstance(raw_results, list):
            raise CatalogProviderUnavailableError("Wikidata returned an invalid search result")
        return [
            str(raw["id"])
            for raw in raw_results
            if isinstance(raw, dict) and _WIKIDATA_ID.fullmatch(str(raw.get("id", "")))
        ]

    async def _fetch_film_details(self, item_ids: list[str]) -> dict[str, dict[str, Any]]:
        values = " ".join(f"wd:{item_id}" for item_id in item_ids)
        query = f"""
SELECT ?item ?itemLabel ?itemDescription ?date ?image ?originalTitle ?directorLabel ?country ?sitelinks WHERE {{
  VALUES ?item {{ {values} }}
  ?item wdt:P31/wdt:P279* wd:Q11424.
  OPTIONAL {{ ?item wdt:P577 ?date. }}
  OPTIONAL {{ ?item wdt:P18 ?image. }}
  OPTIONAL {{ ?item wdt:P1476 ?originalTitle. }}
  OPTIONAL {{ ?item wdt:P57 ?director. }}
  OPTIONAL {{ ?item wdt:P495 ?country. }}
  OPTIONAL {{ ?item wikibase:sitelinks ?sitelinks. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "ko,en". }}
}}
""".strip()
        payload = await self._request_json(
            self.sparql_url,
            params={"query": query, "format": "json"},
            accept="application/sparql-results+json",
        )
        bindings = payload.get("results", {}).get("bindings", [])
        if not isinstance(bindings, list):
            raise CatalogProviderUnavailableError("Wikidata returned invalid film details")

        details: dict[str, dict[str, Any]] = {}
        for binding in bindings:
            if not isinstance(binding, dict):
                continue
            item_id = self._binding_value(binding, "item").rsplit("/", 1)[-1]
            title = self._binding_value(binding, "itemLabel")
            if not _WIKIDATA_ID.fullmatch(item_id) or not title:
                continue
            detail = details.setdefault(
                item_id,
                {
                    "title": title,
                    "description": self._binding_value(binding, "itemDescription") or None,
                    "years": [],
                    "directors": [],
                    "original_titles": [],
                    "countries": [],
                    "sitelinks": 0,
                    "image_url": None,
                },
            )
            date = self._binding_value(binding, "date")
            if len(date) >= 4 and date[:4].isdigit():
                year = int(date[:4])
                if year not in detail["years"]:
                    detail["years"].append(year)
            director = self._binding_value(binding, "directorLabel")
            if director and director not in detail["directors"]:
                detail["directors"].append(director)
            original_title = self._binding_value(binding, "originalTitle")
            if original_title and original_title not in detail["original_titles"]:
                detail["original_titles"].append(original_title)
            country = self._binding_value(binding, "country").rsplit("/", 1)[-1]
            if _WIKIDATA_ID.fullmatch(country) and country not in detail["countries"]:
                detail["countries"].append(country)
            sitelinks = self._binding_value(binding, "sitelinks")
            if sitelinks.isdigit():
                detail["sitelinks"] = max(detail["sitelinks"], int(sitelinks))
            if not detail["image_url"]:
                detail["image_url"] = self._binding_value(binding, "image") or None
        return details

    async def _fetch_image_credits(
        self, details: dict[str, dict[str, Any]]
    ) -> dict[str, CatalogImageCredit]:
        filenames: dict[str, str] = {}
        for item_id, detail in details.items():
            image_url = detail.get("image_url")
            if isinstance(image_url, str):
                filename = self._commons_filename(image_url)
                if filename:
                    filenames[item_id] = filename
        if not filenames:
            return {}

        payload = await self._request_json(
            self.commons_url,
            params={
                "action": "query",
                "format": "json",
                "prop": "imageinfo",
                "iiprop": "url|extmetadata",
                "iiurlwidth": 500,
                "titles": "|".join(f"File:{name}" for name in filenames.values()),
            },
        )
        pages = payload.get("query", {}).get("pages", {})
        if not isinstance(pages, dict):
            return {}

        by_filename: dict[str, tuple[str, CatalogImageCredit]] = {}
        for page_data in pages.values():
            if not isinstance(page_data, dict):
                continue
            title = str(page_data.get("title", ""))
            image_info = page_data.get("imageinfo", [])
            if not title.startswith("File:") or not isinstance(image_info, list) or not image_info:
                continue
            info = image_info[0]
            metadata = info.get("extmetadata", {}) if isinstance(info, dict) else {}
            license_name = self._metadata_value(metadata, "LicenseShortName")
            source_url = str(info.get("descriptionurl", ""))
            thumb_url = str(info.get("thumburl", ""))
            if not license_name or not source_url or not thumb_url:
                continue
            creator = self._clean_credit(self._metadata_value(metadata, "Artist"))
            credit = CatalogImageCredit(
                creator=creator or "저작자 정보는 원본 페이지 참고",
                license=license_name,
                source_url=source_url,
                license_url=self._metadata_value(metadata, "LicenseUrl") or None,
            )
            by_filename[title[5:].replace("_", " ")] = (thumb_url, credit)

        credits: dict[str, CatalogImageCredit] = {}
        for item_id, filename in filenames.items():
            matched = by_filename.get(filename.replace("_", " "))
            if matched:
                details[item_id]["image_url"] = matched[0]
                credits[item_id] = matched[1]
        return credits

    async def _request_json(
        self,
        url: str,
        *,
        params: Mapping[str, str | int],
        accept: str = "application/json",
    ) -> dict[str, Any]:
        attempts = self.settings.catalog_max_retries + 1
        headers = {
            "User-Agent": self.settings.wikimedia_user_agent,
            "Api-User-Agent": self.settings.wikimedia_user_agent,
            "Accept": accept,
            "Accept-Encoding": "gzip, deflate",
        }
        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(
                    timeout=self.settings.catalog_timeout_seconds,
                    follow_redirects=True,
                ) as client:
                    response = await client.get(url, params=params, headers=headers)
                if response.status_code == 429:
                    raise CatalogProviderRateLimitError("Wikimedia rate limit exceeded")
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict):
                    raise CatalogProviderUnavailableError("Wikimedia returned invalid JSON")
                return data
            except CatalogProviderRateLimitError:
                raise
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError, ValueError) as error:
                if attempt == attempts - 1:
                    raise CatalogProviderUnavailableError("Wikimedia request failed") from error
                await asyncio.sleep(0.2 * (attempt + 1))
        raise CatalogProviderUnavailableError("Wikimedia request failed")

    @staticmethod
    def _contains_hangul(value: str) -> bool:
        return any("가" <= character <= "힣" for character in value)

    @staticmethod
    def _binding_value(binding: dict[str, Any], key: str) -> str:
        raw = binding.get(key)
        return str(raw.get("value", "")) if isinstance(raw, dict) else ""

    @staticmethod
    def _first_distinct(values: list[str], title: str) -> str | None:
        return next((value for value in values if value.casefold() != title.casefold()), None)

    @classmethod
    def _rank_detail(cls, query: str, detail: dict[str, Any] | None) -> int:
        if not detail:
            return -1000
        score = 0
        if str(detail["title"]).casefold() == query.casefold():
            score += 20
        if any(str(title).casefold() == query.casefold() for title in detail["original_titles"]):
            score += 10
        if cls._contains_hangul(query) and "Q884" in detail["countries"]:
            score += 100
        score += min(int(detail.get("sitelinks", 0)), 80)
        return score

    @staticmethod
    def _commons_filename(image_url: str) -> str | None:
        path = unquote(urlparse(image_url).path)
        marker = "/Special:FilePath/"
        return path.split(marker, 1)[1] if marker in path else None

    @staticmethod
    def _metadata_value(metadata: Any, key: str) -> str:
        if not isinstance(metadata, dict) or not isinstance(metadata.get(key), dict):
            return ""
        return str(metadata[key].get("value", ""))

    @staticmethod
    def _clean_credit(value: str) -> str:
        return " ".join(html.unescape(_HTML_TAG.sub(" ", value)).split())
