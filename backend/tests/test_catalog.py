from fastapi.testclient import TestClient

from app.api.routes.catalog import get_itunes_provider, get_wikidata_provider
from app.main import app
from app.providers.errors import CatalogProviderUnavailableError
from app.providers.wikidata import WikidataMovieProvider
from app.schemas.catalog import (
    CatalogAttribution,
    CatalogImageCredit,
    CatalogItem,
    CatalogSearchResponse,
)

client = TestClient(app)


class FakeMovieProvider:
    async def search(self, query: str, page: int) -> CatalogSearchResponse:
        assert query == "괴물"
        assert page == 1
        return CatalogSearchResponse(
            items=[
                CatalogItem(
                    provider="wikidata",
                    provider_id="Q488222",
                    item_type="movie",
                    title="괴물",
                    detail="봉준호",
                    release_year=2006,
                    image_url="https://upload.wikimedia.org/example.jpg",
                    image_credit=CatalogImageCredit(
                        creator="Example Author",
                        license="CC BY 2.0",
                        source_url="https://commons.wikimedia.org/wiki/File:Example.jpg",
                    ),
                    external_url="https://www.wikidata.org/wiki/Q488222",
                )
            ],
            page=1,
            has_more=False,
            attribution=CatalogAttribution(
                provider="wikidata",
                label="Wikidata · Wikimedia Commons",
                notice="영화 정보는 CC0 Wikidata를 사용합니다.",
                url="https://www.wikidata.org/",
            ),
        )


class UnavailableMovieProvider:
    async def search(self, query: str, page: int) -> CatalogSearchResponse:
        raise CatalogProviderUnavailableError


class FakeMusicProvider:
    async def search(self, query: str, entity: str, limit: int) -> CatalogSearchResponse:
        assert query == "아이유"
        assert entity == "track"
        assert limit == 15
        return CatalogSearchResponse(
            items=[
                CatalogItem(
                    provider="itunes",
                    provider_id="1732231761",
                    item_type="track",
                    title="Love wins all",
                    subtitle="아이유",
                    detail="The Winning",
                    release_year=2024,
                    external_url="https://music.apple.com/kr/album/example",
                )
            ],
            page=1,
            has_more=False,
            attribution=CatalogAttribution(
                provider="itunes",
                label="Apple iTunes Search",
                notice="Search results provided by the Apple iTunes Search API.",
                url="https://www.apple.com/itunes/",
            ),
        )


def test_search_movies_maps_provider_response() -> None:
    app.dependency_overrides[get_wikidata_provider] = lambda: FakeMovieProvider()
    try:
        response = client.get("/api/catalog/movies/search", params={"query": "괴물"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["provider"] == "wikidata"
    assert payload["items"][0]["title"] == "괴물"
    assert payload["items"][0]["image_credit"]["license"] == "CC BY 2.0"
    assert payload["attribution"]["provider"] == "wikidata"


def test_search_movies_maps_provider_failure_safely() -> None:
    app.dependency_overrides[get_wikidata_provider] = lambda: UnavailableMovieProvider()
    try:
        response = client.get("/api/catalog/movies/search", params={"query": "괴물"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CATALOG_PROVIDER_UNAVAILABLE"


def test_search_music_maps_provider_response() -> None:
    app.dependency_overrides[get_itunes_provider] = lambda: FakeMusicProvider()
    try:
        response = client.get(
            "/api/catalog/music/search",
            params={"query": "아이유", "entity": "track"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["items"][0]["provider"] == "itunes"
    assert payload["items"][0]["title"] == "Love wins all"
    assert payload["attribution"]["provider"] == "itunes"


def test_catalog_search_rejects_short_query() -> None:
    response = client.get("/api/catalog/music/search", params={"query": "a", "entity": "track"})
    assert response.status_code == 422


def test_movie_ranking_prefers_widely_documented_exact_title() -> None:
    obscure_short = {
        "title": "Interstellar",
        "original_titles": [],
        "countries": [],
        "sitelinks": 3,
    }
    feature_film = {
        "title": "Interstellar",
        "original_titles": [],
        "countries": [],
        "sitelinks": 180,
    }

    assert WikidataMovieProvider._rank_detail(
        "Interstellar", feature_film
    ) > WikidataMovieProvider._rank_detail("Interstellar", obscure_short)
